// Customer Orders API for the AI inbox agents and admin tools.
//
// Public base URL: https://www.newtolet.com/api/v1  (nginx proxies /api/v1/ to this function)
// Direct URL:      https://api.newtolet.com/functions/v1/customer-orders
//
//   POST   /orders                         create an order (Idempotency-Key header supported)
//   GET    /orders                         list / search
//   GET    /orders/by-customer?phone=...   a customer's orders
//   GET    /orders/{id}                    one order with claims, matches and timeline
//   PATCH  /orders/{id}                    update customer / requirement fields, assignee
//   POST   /orders/{id}/status             change status (to_status, reason)
//   POST   /orders/{id}/payment-claim      record a payment or partial payment (amount required)
//   POST   /orders/{id}/payment-verify     verify / reject a claim            (admin keys only)
//   POST   /orders/{id}/notes              add an internal note
//   POST   /orders/{id}/matches            attach a property preview
//   GET    /orders/{id}/timeline           status history + notes + activity
//   DELETE /orders/{id}                    soft delete                        (admin keys only)
//
// Auth: `Authorization: Bearer <key>`. ORDERS_AGENT_API_KEYS and ORDERS_ADMIN_API_KEYS
// hold `label:key,label:key` lists; the list a key is in decides its scope.
//
// This file only authenticates, routes and shapes JSON. Prices, the status
// machine and every payment rule live in the co_* SQL functions
// (supabase/migrations/20261116090000_customer_orders.sql), which the admin
// dashboard calls too. The service-role client bypasses RLS, so nothing here
// writes to a table directly.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { type ApiKey, ApiKeyConfigError, bearerToken, matchKey, parseKeyList } from "../_shared/apiKeys.ts";
import { createAdminClient } from "../_shared/paymently.ts";
import { ApiError, errorBody, fromDbError, okBody, validationError } from "./errors.ts";
import { actorTypeForScope, assertScope, matchRoute, type Route, type Scope } from "./router.ts";
import { serializeClaim, serializeDetail, serializeOrder, serializeTimeline } from "./serialize.ts";
import {
  dhakaDayStart,
  dhakaNextDayStart,
  escapePattern,
  type ListQuery,
  MAX_BODY_BYTES,
  normalizePhone,
  parseClaimBody,
  parseCreateBody,
  parseDeleteBody,
  parseListQuery,
  parseMatchBody,
  parseNoteBody,
  parseStatusBody,
  parseUpdateBody,
  parseVerifyBody,
} from "./validation.ts";

const RATE_LIMIT_PER_MINUTE = 120;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ENRICHED = "customer_orders_enriched";

const baseHeaders = {
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Idempotency-Key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json",
};

type Row = Record<string, any>;
type AdminClient = ReturnType<typeof createAdminClient>;
type ScopedKey = ApiKey & { scope: Scope };
type Actor = { p_actor_type: string; p_actor_id: null; p_actor_label: string };
type Context = { supabase: AdminClient; actor: Actor; request: Request; url: URL };

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...baseHeaders, ...extraHeaders } });

// ---------------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------------

const getKeys = (): ScopedKey[] => {
  const agents = parseKeyList(Deno.env.get("ORDERS_AGENT_API_KEYS"), "ORDERS_AGENT_API_KEYS")
    .map((entry) => ({ ...entry, scope: "agent" as Scope }));
  const admins = parseKeyList(Deno.env.get("ORDERS_ADMIN_API_KEYS"), "ORDERS_ADMIN_API_KEYS")
    .map((entry) => ({ ...entry, scope: "admin" as Scope }));
  const keys = [...agents, ...admins];
  if (!keys.length) throw new ApiKeyConfigError("ORDERS_AGENT_API_KEYS / ORDERS_ADMIN_API_KEYS are not set");
  for (const admin of admins) {
    // A label or key present in both lists would make the scope ambiguous.
    if (agents.some((agent) => agent.label === admin.label)) {
      throw new ApiKeyConfigError(`label "${admin.label}" is used in both key lists`);
    }
    if (agents.some((agent) => agent.key === admin.key)) {
      throw new ApiKeyConfigError(`key "${admin.label}" is also listed as an agent key`);
    }
  }
  return keys;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rpc = async (supabase: AdminClient, fn: string, args: Row) => {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const mapped = fromDbError(error);
    if (mapped.status >= 500) console.error(`customer-orders rpc ${fn} failed:`, error.message, error.code || "");
    throw mapped;
  }
  return data as Row;
};

const readBody = async (request: Request): Promise<unknown> => {
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) throw validationError("Request body is too large.");
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw validationError("Request body is too large.");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw validationError("Request body must be valid JSON.");
  }
};

const findOrder = async (supabase: AdminClient, orderNo: string): Promise<Row> => {
  const { data, error } = await supabase.from(ENRICHED).select("*").eq("order_no", orderNo).is("deleted_at", null).maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Order was not found.");
  return data;
};

/** `assigned_to` may be an admin user's id or email. The SQL layer checks it is an admin. */
const resolveAssignee = async (supabase: AdminClient, value: string): Promise<string> => {
  if (UUID_REGEX.test(value)) return value.toLowerCase();
  if (!value.includes("@")) throw validationError("assigned_to must be an admin user id or email.");
  const { data, error } = await supabase.from("users").select("id").ilike("email", escapePattern(value)).limit(2);
  if (error) throw fromDbError(error);
  if (!data || data.length !== 1) throw validationError("assigned_to does not match an admin user.");
  return data[0].id;
};

const applyListQuery = (supabase: AdminClient, q: ListQuery, assigneeId: string | null) => {
  let query = supabase.from(ENRICHED).select("*", { count: "exact" }).is("deleted_at", null);

  if (q.q) {
    const pattern = escapePattern(q.q);
    if (pattern) {
      query = query.or(
        ["order_no", "customer_name", "customer_phone", "facebook_name", "area"]
          .map((column) => `${column}.ilike.*${pattern}*`).join(","),
      );
    }
  }
  if (q.statuses.length) query = query.in("status", q.statuses);
  if (q.phone) query = query.eq("customer_phone", q.phone);
  if (q.area) {
    const pattern = escapePattern(q.area);
    if (pattern) query = query.ilike("area", `%${pattern}%`);
  }
  // Budget overlap: the order's [min, max] range intersects the requested range.
  if (q.budgetMin !== null) query = query.or(`budget_max.is.null,budget_max.gte.${q.budgetMin}`);
  if (q.budgetMax !== null) query = query.or(`budget_min.is.null,budget_min.lte.${q.budgetMax}`);
  if (q.rooms !== null) query = query.eq("rooms", q.rooms);
  if (q.moveInFrom) query = query.gte("move_in_date", q.moveInFrom);
  if (q.moveInTo) query = query.lte("move_in_date", q.moveInTo);
  if (assigneeId) query = query.eq("assigned_to", assigneeId);
  if (q.source) query = query.eq("source", q.source);
  if (q.createdVia) query = query.eq("created_via", q.createdVia);
  if (q.paymentStatus) query = query.eq("payment_status", q.paymentStatus);
  if (q.hasListings === true) query = query.gt("listings_found_count", 0);
  if (q.hasListings === false) query = query.eq("listings_found_count", 0);
  if (q.listingsFoundMin !== null) query = query.gte("listings_found_count", q.listingsFoundMin);
  if (q.createdFrom) query = query.gte("created_at", dhakaDayStart(q.createdFrom));
  if (q.createdTo) query = query.lt("created_at", dhakaNextDayStart(q.createdTo));

  if (q.sort === "oldest") query = query.order("created_at", { ascending: true });
  else if (q.sort === "move_in") {
    query = query.order("move_in_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
  } else query = query.order("created_at", { ascending: false });

  const from = (q.page - 1) * q.perPage;
  return query.range(from, from + q.perPage - 1);
};

const runList = async ({ supabase }: Context, q: ListQuery) => {
  const assigneeId = q.assignedTo ? await resolveAssignee(supabase, q.assignedTo) : null;
  const { data, error, count } = await applyListQuery(supabase, q, assigneeId);
  if (error) throw fromDbError(error);
  const total = count ?? 0;
  return json(okBody((data || []).map(serializeOrder), {
    page: q.page,
    per_page: q.perPage,
    total,
    total_pages: Math.ceil(total / q.perPage),
  }));
};

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

const listOrders = (ctx: Context) => runList(ctx, parseListQuery(ctx.url.searchParams));

const ordersByCustomer = (ctx: Context) => {
  const raw = (ctx.url.searchParams.get("phone") || "").trim();
  if (!raw) throw validationError("phone is required.", ["phone is required, e.g. ?phone=01712345678"]);
  if (!normalizePhone(raw)) {
    throw validationError("phone must be a Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX).");
  }
  const params = new URLSearchParams();
  for (const key of ["phone", "page", "per_page"]) {
    const value = ctx.url.searchParams.get(key);
    if (value !== null) params.set(key, value);
  }
  return runList(ctx, parseListQuery(params));
};

const createOrder = async ({ supabase, actor, request }: Context) => {
  const { fields, assignedTo, confirmDuplicate } = parseCreateBody(await readBody(request));
  if (typeof assignedTo === "string") fields.assigned_to = await resolveAssignee(supabase, assignedTo);
  const result = await rpc(supabase, "co_create_order", {
    ...actor,
    p_payload: fields,
    p_idempotency_key: (request.headers.get("idempotency-key") || "").trim() || null,
    p_confirm_duplicate: confirmDuplicate,
  });
  // A retried Idempotency-Key returns the original order with 200 instead of 201.
  return json(okBody(serializeOrder(result.order)), result.created ? 201 : 200);
};

const getOrder = async ({ supabase }: Context, orderNo: string) => {
  const order = await findOrder(supabase, orderNo);
  const [claims, matches, timeline] = await Promise.all([
    supabase.from("customer_order_payment_claims").select("*").eq("order_id", order.id).order("claimed_at", { ascending: false }),
    supabase.from("customer_order_matches").select("*").eq("order_id", order.id).is("removed_at", null).order("created_at", { ascending: false }),
    supabase.rpc("co_timeline", { p_order_id: order.id }),
  ]);
  for (const result of [claims, matches, timeline]) {
    if (result.error) throw fromDbError(result.error);
  }
  return json(okBody(serializeDetail(order, claims.data || [], matches.data || [], timeline.data)));
};

const updateOrder = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { fields, assignedTo } = parseUpdateBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  let latest: Row | null = null;
  if (Object.keys(fields).length) {
    latest = (await rpc(supabase, "co_update_order", { ...actor, p_order_id: order.id, p_patch: fields })).order;
  }
  if (assignedTo !== undefined) {
    const assignee = assignedTo === null ? null : await resolveAssignee(supabase, assignedTo);
    latest = (await rpc(supabase, "co_assign", { ...actor, p_order_id: order.id, p_assigned_to: assignee })).order;
  }
  return json(okBody(serializeOrder(latest || order)));
};

const changeStatus = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { toStatus, reason, takenOverBy } = parseStatusBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  const result = await rpc(supabase, "co_set_status", {
    ...actor,
    p_order_id: order.id,
    p_to_status: toStatus,
    p_reason: reason,
    p_taken_over_by: takenOverBy,
  });
  return json(okBody(serializeOrder(result.order)));
};

const recordPaymentClaim = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { amountBdt, trxId, senderLast4 } = parseClaimBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  const result = await rpc(supabase, "co_record_payment_claim", {
    ...actor,
    p_order_id: order.id,
    p_amount_bdt: amountBdt,
    p_trx_id: trxId,
    p_sender_last4: senderLast4,
  });
  return json(okBody({ ...serializeOrder(result.order), claim_id: result.claim_id }));
};

const verifyPayment = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { claimId, action, note } = parseVerifyBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  const { data: claims, error } = await supabase
    .from("customer_order_payment_claims").select("*").eq("order_id", order.id).order("claimed_at", { ascending: true });
  if (error) throw fromDbError(error);

  let target = claimId;
  if (target) {
    if (!(claims || []).some((claim: Row) => claim.id === target)) {
      throw new ApiError(404, "NOT_FOUND", "Payment claim was not found on this order.");
    }
  } else {
    const open = (claims || []).filter((claim: Row) => claim.status === "CLAIMED");
    if (open.length === 0) throw new ApiError(409, "CONFLICT", "This order has no payment claim awaiting verification.");
    if (open.length > 1) {
      throw validationError(
        `claim_id is required: this order has ${open.length} claims awaiting verification.`,
        open.map((claim: Row) => `${claim.id}: ${claim.amount_bdt} BDT (${claim.trx_id ? "TrxID " + claim.trx_id : "last-4 " + claim.sender_last4})`),
      );
    }
    target = open[0].id;
  }

  const result = await rpc(supabase, "co_review_payment_claim", {
    ...actor,
    p_claim_id: target,
    p_decision: action,
    p_note: note,
  });
  const { data: after, error: afterError } = await supabase
    .from("customer_order_payment_claims").select("*").eq("order_id", order.id).order("claimed_at", { ascending: false });
  if (afterError) throw fromDbError(afterError);
  return json(okBody({ ...serializeOrder(result.order), payment_claims: (after || []).map(serializeClaim) }));
};

const addNote = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { note } = parseNoteBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  const result = await rpc(supabase, "co_add_note", { ...actor, p_order_id: order.id, p_body: note });
  return json(okBody({ ...serializeOrder(result.order), note_id: result.note_id }), 201);
};

const addMatch = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { match } = parseMatchBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  const result = await rpc(supabase, "co_add_match", { ...actor, p_order_id: order.id, p_match: match });
  return json(okBody({ ...serializeOrder(result.order), match_id: result.match_id }), 201);
};

const getTimeline = async ({ supabase }: Context, orderNo: string) => {
  const order = await findOrder(supabase, orderNo);
  const { data, error } = await supabase.rpc("co_timeline", { p_order_id: order.id });
  if (error) throw fromDbError(error);
  return json(okBody({ id: order.order_no, status: order.status, timeline: serializeTimeline(data) }));
};

const deleteOrder = async ({ supabase, actor, request }: Context, orderNo: string) => {
  const { reason } = parseDeleteBody(await readBody(request));
  const order = await findOrder(supabase, orderNo);
  await rpc(supabase, "co_soft_delete", { ...actor, p_order_id: order.id, p_reason: reason });
  return json(okBody({ id: order.order_no, deleted: true }));
};

const dispatch = (route: Route, ctx: Context) => {
  const orderNo = route.orderNo as string;
  switch (route.name) {
    case "list": return listOrders(ctx);
    case "create": return createOrder(ctx);
    case "byCustomer": return ordersByCustomer(ctx);
    case "get": return getOrder(ctx, orderNo);
    case "update": return updateOrder(ctx, orderNo);
    case "delete": return deleteOrder(ctx, orderNo);
    case "status": return changeStatus(ctx, orderNo);
    case "paymentClaim": return recordPaymentClaim(ctx, orderNo);
    case "paymentVerify": return verifyPayment(ctx, orderNo);
    case "addNote": return addNote(ctx, orderNo);
    case "addMatch": return addMatch(ctx, orderNo);
    case "timeline": return getTimeline(ctx, orderNo);
  }
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: baseHeaders });

  try {
    // Authenticate before anything else, so an unauthenticated caller learns nothing about routes.
    const key = await matchKey(bearerToken(request.headers.get("authorization")), getKeys());
    if (!key) {
      return json(
        errorBody(new ApiError(401, "UNAUTHORIZED", "A valid API key is required: Authorization: Bearer <key>.")),
        401,
        { "WWW-Authenticate": "Bearer" },
      );
    }

    const url = new URL(request.url);
    const route = matchRoute(request.method, url.pathname);
    assertScope(route.name, key.scope);

    const supabase = createAdminClient();
    const allowed: unknown = await rpc(supabase, "co_rate_limit_hit", { p_key_label: key.label, p_limit: RATE_LIMIT_PER_MINUTE });
    if (allowed === false) {
      return json(
        errorBody(new ApiError(429, "RATE_LIMITED", `Too many requests (limit ${RATE_LIMIT_PER_MINUTE} per minute). Try again shortly.`)),
        429,
        { "Retry-After": String(60 - new Date().getUTCSeconds()) },
      );
    }

    // Audit trail for writes: which key did what. The label is logged, never the key.
    if (request.method !== "GET") console.log(`customer-orders ${key.label} ${request.method} ${url.pathname}`);

    const actor: Actor = { p_actor_type: actorTypeForScope(key.scope), p_actor_id: null, p_actor_label: key.label };
    return await dispatch(route, { supabase, actor, request, url });
  } catch (error) {
    if (error instanceof ApiError) return json(errorBody(error), error.status);
    if (error instanceof ApiKeyConfigError) {
      console.error("Customer orders API configuration error:", error.message);
      return json(errorBody(new ApiError(500, "INTERNAL_ERROR", "Orders API is not configured")), 500);
    }
    console.error("Customer orders API error:", error);
    return json(errorBody(new ApiError(500, "INTERNAL_ERROR", "Unexpected error")), 500);
  }
});

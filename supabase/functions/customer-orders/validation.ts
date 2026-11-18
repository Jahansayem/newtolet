// Request validation for the Customer Orders API: shape checks and the mapping
// from the public JSON (nested customer / requirements) to the flat keys the
// SQL functions take. Value rules (phone, dates, ranges) are enforced again in
// SQL, which is the authority. No Deno imports: tests load this file in Node.

import { ApiError, validationError } from "./errors.ts";

type Json = Record<string, unknown>;

export const MAX_BODY_BYTES = 64 * 1024;
export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export const ORDER_STATUSES = [
  "PENDING", "REQUIREMENTS_COLLECTED", "SEARCHING_BY_AI", "SEARCHING_BY_HUMAN", "PREVIEWS_SENT",
  "PAYMENT_INTERESTED", "PAYMENT_CLAIMED", "PAYMENT_VERIFIED", "MATCHED", "COMPLETED",
  "SELF_SERVICE", "CANCELLED", "REFUND_REQUESTED", "REFUNDED", "PAYMENT_ISSUE", "PAYMENT_FAILED",
];
export const PAYMENT_STATUSES = ["PENDING", "PARTIAL_PAID", "PAID"];
export const SOURCES = ["messenger", "lead_generation", "manual", "phone", "whatsapp", "website"];
export const CREATED_VIA = ["customer", "ai_agent", "human_agent"];
export const SORTS = ["newest", "oldest", "move_in"];

/** Fields the server owns. Sending one is an error, not something to ignore silently. */
const SERVER_OWNED = new Set([
  "id", "order_no", "status", "service_charge_bdt", "service_charge", "charge", "price", "amount", "amount_paid",
  "amount_due", "amount_verified", "payment_status", "payment_verification", "overpaid", "listings_found_count",
  "listings_verified_count", "listings_unverified_count", "created_via", "created_by", "created_at", "updated_at",
  "bkash_number", "bkash", "payment_number", "nagad_number", "contact_unlocked", "owner_contact_unlocked",
]);

const CUSTOMER_KEYS: Record<string, string> = {
  name: "customer_name",
  phone: "customer_phone",
  facebook_name: "facebook_name",
  facebook_thread_url: "facebook_thread_url",
};

const REQUIREMENT_KEYS: Record<string, string> = {
  area: "area",
  rooms: "rooms",
  budget_min: "budget_min",
  budget_max: "budget_max",
  move_in_date: "move_in_date",
  family_or_bachelor: "tenant_type",
  gas: "gas",
  bathrooms: "bathrooms",
  balconies: "balconies",
  facilities: "facilities",
  notes: "requirement_notes",
};

const MATCH_KEYS = [
  "reference_id", "property_id", "general_location", "rent", "verification_status",
  "owner_contact_phone", "exact_address", "owner_permission",
];

const isObject = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const fieldError = (path: string) =>
  SERVER_OWNED.has(path.split(".").pop() || "")
    ? `${path} is set by the server and cannot be sent`
    : `${path} is not a known field`;

const assertBody = (body: unknown): Json => {
  if (!isObject(body)) throw validationError("Request body must be a JSON object.");
  return body;
};

const scalar = (value: unknown, path: string, errors: string[]) => {
  if (value === null || typeof value === "string" || typeof value === "number") return value;
  errors.push(`${path} must be a string, a number or null`);
  return null;
};

const mapGroup = (group: unknown, path: string, keys: Record<string, string>, out: Json, errors: string[]) => {
  if (group === undefined) return;
  if (!isObject(group)) {
    errors.push(`${path} must be an object`);
    return;
  }
  for (const [key, value] of Object.entries(group)) {
    const target = keys[key];
    if (!target) {
      errors.push(fieldError(`${path}.${key}`));
      continue;
    }
    out[target] = scalar(value, `${path}.${key}`, errors);
  }
};

const finish = (errors: string[]) => {
  if (errors.length) throw validationError("Request body is not valid.", errors);
};

export type OrderWrite = {
  /** Flat payload for co_create_order / co_update_order. */
  fields: Json;
  /** undefined = not sent; null = clear; string = uuid or email of an admin user. */
  assignedTo: string | null | undefined;
  confirmDuplicate: boolean;
};

const parseOrderBody = (input: unknown, mode: "create" | "update"): OrderWrite => {
  const body = assertBody(input);
  const errors: string[] = [];
  const fields: Json = {};
  let assignedTo: string | null | undefined;
  let confirmDuplicate = false;

  for (const [key, value] of Object.entries(body)) {
    switch (key) {
      case "customer":
        mapGroup(value, "customer", CUSTOMER_KEYS, fields, errors);
        break;
      case "requirements":
        mapGroup(value, "requirements", REQUIREMENT_KEYS, fields, errors);
        break;
      case "source":
      case "follow_up_at":
        fields[key] = scalar(value, key, errors);
        break;
      case "type":
        if (mode === "update") errors.push("type cannot be changed");
        else if (typeof value !== "string" || value.trim().toUpperCase() !== "HOUSE_SEARCH") {
          errors.push("type must be HOUSE_SEARCH (the only order type)");
        }
        break;
      case "assigned_to":
        if (value === null || (typeof value === "string" && value.trim() === "")) assignedTo = null;
        else if (typeof value === "string") assignedTo = value.trim();
        else errors.push("assigned_to must be an admin user id or email");
        break;
      case "confirm_duplicate":
        if (mode === "update") errors.push(fieldError(key));
        else if (typeof value !== "boolean") errors.push("confirm_duplicate must be true or false");
        else confirmDuplicate = value;
        break;
      default:
        errors.push(fieldError(key));
    }
  }

  if (mode === "create") {
    const name = fields.customer_name;
    if (typeof name !== "string" || !name.trim()) errors.push("customer.name is required");
    const hasPhone = fields.customer_phone !== undefined && fields.customer_phone !== null && String(fields.customer_phone).trim() !== "";
    const hasThread = typeof fields.facebook_thread_url === "string" && fields.facebook_thread_url.trim() !== "";
    if (!hasPhone && !hasThread) {
      errors.push("at least one contact channel is required: customer.phone or customer.facebook_thread_url");
    }
  } else if (Object.keys(fields).length === 0 && assignedTo === undefined) {
    errors.push("nothing to update");
  }

  finish(errors);
  return { fields, assignedTo, confirmDuplicate };
};

export const parseCreateBody = (input: unknown) => parseOrderBody(input, "create");
export const parseUpdateBody = (input: unknown) => parseOrderBody(input, "update");

const onlyKeys = (body: Json, allowed: string[], errors: string[]) => {
  for (const key of Object.keys(body)) {
    if (!allowed.includes(key)) errors.push(fieldError(key));
  }
};

const optionalText = (value: unknown, path: string, errors: string[]) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    errors.push(`${path} must be text`);
    return null;
  }
  return value.trim() || null;
};

export const parseStatusBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  onlyKeys(body, ["to_status", "reason", "taken_over_by"], errors);
  const toStatus = typeof body.to_status === "string" ? body.to_status.trim().toUpperCase() : "";
  if (!toStatus) errors.push("to_status is required");
  else if (!ORDER_STATUSES.includes(toStatus)) errors.push(`to_status must be one of: ${ORDER_STATUSES.join(", ")}`);
  const reason = optionalText(body.reason, "reason", errors);
  if (!reason) errors.push("reason is required");
  const takenOverBy = optionalText(body.taken_over_by, "taken_over_by", errors);
  finish(errors);
  return { toStatus, reason: reason as string, takenOverBy };
};

export const parseClaimBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  onlyKeys(body, ["amount_bdt", "trx_id", "sender_last4"], errors);
  const amount = body.amount_bdt;
  if (amount === undefined || amount === null || amount === "") {
    errors.push("amount_bdt is required: the amount the customer actually paid");
  } else if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    errors.push("amount_bdt must be a positive whole number of BDT");
  }
  const trxId = optionalText(body.trx_id, "trx_id", errors);
  const last4 = body.sender_last4 === undefined || body.sender_last4 === null
    ? null
    : typeof body.sender_last4 === "string" || typeof body.sender_last4 === "number"
    ? String(body.sender_last4).trim() || null
    : (errors.push("sender_last4 must be 4 digits"), null);
  if (!trxId && !last4) errors.push("send trx_id or sender_last4 (either one is enough)");
  if (last4 && !/^\d{4}$/.test(last4)) errors.push("sender_last4 must be exactly 4 digits");
  finish(errors);
  return { amountBdt: amount as number, trxId, senderLast4: last4 };
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const parseVerifyBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  onlyKeys(body, ["claim_id", "action", "note"], errors);
  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : "";
  if (action !== "verify" && action !== "reject") errors.push('action must be "verify" or "reject"');
  let claimId: string | null = null;
  if (body.claim_id !== undefined && body.claim_id !== null) {
    if (typeof body.claim_id !== "string" || !UUID_REGEX.test(body.claim_id.trim())) errors.push("claim_id must be a payment claim id");
    else claimId = body.claim_id.trim().toLowerCase();
  }
  const note = optionalText(body.note, "note", errors);
  if (action === "reject" && !note) errors.push("note is required when rejecting a payment claim");
  finish(errors);
  return { claimId, action: action as "verify" | "reject", note };
};

export const parseNoteBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  onlyKeys(body, ["note"], errors);
  const note = optionalText(body.note, "note", errors);
  if (!note) errors.push("note is required");
  finish(errors);
  return { note: note as string };
};

export const parseMatchBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  const match: Json = {};
  for (const [key, value] of Object.entries(body)) {
    if (!MATCH_KEYS.includes(key)) {
      errors.push(fieldError(key));
      continue;
    }
    if (key === "owner_permission") {
      if (typeof value !== "boolean") errors.push("owner_permission must be true or false");
      else match[key] = value;
      continue;
    }
    match[key] = scalar(value, key, errors);
  }
  if (typeof match.reference_id !== "string" || !match.reference_id.trim()) errors.push("reference_id is required");
  finish(errors);
  return { match };
};

export const parseDeleteBody = (input: unknown) => {
  const body = assertBody(input);
  const errors: string[] = [];
  onlyKeys(body, ["reason"], errors);
  const reason = optionalText(body.reason, "reason", errors);
  if (!reason) errors.push("reason is required");
  finish(errors);
  return { reason: reason as string };
};

// ---------------------------------------------------------------------------
// List / search query
// ---------------------------------------------------------------------------

export type ListQuery = {
  q: string | null;
  statuses: string[];
  phone: string | null;
  area: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  rooms: number | null;
  moveInFrom: string | null;
  moveInTo: string | null;
  assignedTo: string | null;
  source: string | null;
  createdVia: string | null;
  paymentStatus: string | null;
  hasListings: boolean | null;
  listingsFoundMin: number | null;
  createdFrom: string | null;
  createdTo: string | null;
  sort: string;
  page: number;
  perPage: number;
};

const LIST_PARAMS = new Set([
  "q", "status", "type", "phone", "area", "budget_min", "budget_max", "rooms", "move_in_from", "move_in_to",
  "assigned_to", "source", "created_via", "payment_status", "has_listings", "listings_found_min",
  "created_from", "created_to", "sort", "page", "per_page",
]);

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string) => {
  if (!DATE_REGEX.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

export const normalizePhone = (value: string): string | null => {
  const digits = value.replace(/[\s\-()]/g, "").replace(/^\+?88/, "");
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
};

/** Escape PostgREST pattern characters and drop the ones that would break an `or=(...)` filter. */
export const escapePattern = (value: string) =>
  value.replace(/[\\%_]/g, "\\$&").replace(/[(),*"]/g, " ").replace(/\s+/g, " ").trim();

export const parseListQuery = (params: URLSearchParams): ListQuery => {
  const errors: string[] = [];
  for (const key of new Set(params.keys())) {
    if (!LIST_PARAMS.has(key)) errors.push(`${key} is not a known filter`);
  }

  const text = (name: string, max = 100) => {
    const value = (params.get(name) || "").trim().slice(0, max);
    return value || null;
  };
  const whole = (name: string, min: number, max: number) => {
    const raw = text(name);
    if (raw === null) return null;
    if (!/^\d{1,9}$/.test(raw) || Number(raw) < min || Number(raw) > max) {
      errors.push(`${name} must be a whole number between ${min} and ${max}`);
      return null;
    }
    return Number(raw);
  };
  const date = (name: string) => {
    const raw = text(name);
    if (raw === null) return null;
    if (!isRealDate(raw)) {
      errors.push(`${name} must be a date in YYYY-MM-DD format`);
      return null;
    }
    return raw;
  };
  const oneOf = (name: string, allowed: string[], transform: (value: string) => string) => {
    const raw = text(name);
    if (raw === null) return null;
    const value = transform(raw);
    if (!allowed.includes(value)) {
      errors.push(`${name} must be one of: ${allowed.join(", ")}`);
      return null;
    }
    return value;
  };
  const upper = (value: string) => value.toUpperCase();
  const lower = (value: string) => value.toLowerCase();

  const statuses = [...new Set(
    params.getAll("status").flatMap((value) => value.split(",")).map((value) => value.trim().toUpperCase()).filter(Boolean),
  )];
  for (const status of statuses) {
    if (!ORDER_STATUSES.includes(status)) errors.push(`status "${status}" is not a known status`);
  }

  const type = text("type");
  if (type !== null && type.toUpperCase() !== "HOUSE_SEARCH") errors.push("type must be HOUSE_SEARCH (the only order type)");

  let phone: string | null = null;
  const rawPhone = text("phone");
  if (rawPhone !== null) {
    phone = normalizePhone(rawPhone);
    if (!phone) errors.push("phone must be a Bangladeshi mobile number (01XXXXXXXXX or +8801XXXXXXXXX)");
  }

  let hasListings: boolean | null = null;
  const rawHasListings = text("has_listings");
  if (rawHasListings !== null) {
    if (rawHasListings === "true" || rawHasListings === "false") hasListings = rawHasListings === "true";
    else errors.push("has_listings must be true or false");
  }

  const budgetMin = whole("budget_min", 0, 999_999_999);
  const budgetMax = whole("budget_max", 0, 999_999_999);
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) errors.push("budget_min cannot be greater than budget_max");

  const query: ListQuery = {
    q: text("q"),
    statuses,
    phone,
    area: text("area"),
    budgetMin,
    budgetMax,
    rooms: whole("rooms", 0, 50),
    moveInFrom: date("move_in_from"),
    moveInTo: date("move_in_to"),
    assignedTo: text("assigned_to", 255),
    source: oneOf("source", SOURCES, lower),
    createdVia: oneOf("created_via", CREATED_VIA, lower),
    paymentStatus: oneOf("payment_status", PAYMENT_STATUSES, upper),
    hasListings,
    listingsFoundMin: whole("listings_found_min", 0, 100_000),
    createdFrom: date("created_from"),
    createdTo: date("created_to"),
    sort: oneOf("sort", SORTS, lower) || "newest",
    page: whole("page", 1, 1_000_000) || 1,
    perPage: whole("per_page", 1, MAX_PER_PAGE) || DEFAULT_PER_PAGE,
  };

  if (errors.length) throw new ApiError(400, "VALIDATION_ERROR", "Query parameters are not valid.", errors);
  return query;
};

/** Dhaka is UTC+6 all year; date filters mean Dhaka calendar days. */
export const dhakaDayStart = (date: string) => `${date}T00:00:00+06:00`;
export const dhakaNextDayStart = (date: string) => {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return `${next.toISOString().slice(0, 10)}T00:00:00+06:00`;
};

// Route table and key scopes for the Customer Orders API.
// No Deno imports: tests load this file in Node.

import { ApiError } from "./errors.ts";

export const FUNCTION_SLUG = "customer-orders";

export type Scope = "agent" | "admin";

export type RouteName =
  | "list"
  | "create"
  | "byCustomer"
  | "get"
  | "update"
  | "delete"
  | "status"
  | "paymentClaim"
  | "paymentVerify"
  | "addNote"
  | "addMatch"
  | "timeline";

export type Route = { name: RouteName; orderNo: string | null };

/** The lowest scope allowed to call each route. `admin` routes refuse agent keys. */
export const ROUTE_SCOPE: Record<RouteName, Scope> = {
  list: "agent",
  create: "agent",
  byCustomer: "agent",
  get: "agent",
  update: "agent",
  status: "agent",
  paymentClaim: "agent",
  addNote: "agent",
  addMatch: "agent",
  timeline: "agent",
  // Human-only actions.
  paymentVerify: "admin",
  delete: "admin",
};

const ORDER_NO_REGEX = /^NT-\d{4}-\d{4,}$/;

const SUB_ROUTES: Record<string, { method: string; name: RouteName }> = {
  status: { method: "POST", name: "status" },
  "payment-claim": { method: "POST", name: "paymentClaim" },
  "payment-verify": { method: "POST", name: "paymentVerify" },
  notes: { method: "POST", name: "addNote" },
  matches: { method: "POST", name: "addMatch" },
  timeline: { method: "GET", name: "timeline" },
};

const notFound = () => new ApiError(404, "NOT_FOUND", "Route not found");
const methodNotAllowed = (allowed: string) =>
  new ApiError(405, "METHOD_NOT_ALLOWED", `Method not allowed. Use ${allowed}.`);

/**
 * Resolves `METHOD /…/customer-orders/orders[/…]` (also reached as `/api/v1/orders[/…]`
 * through nginx). Throws ApiError 404 / 405.
 */
export const matchRoute = (method: string, pathname: string): Route => {
  const verb = method.toUpperCase();
  const segments = pathname.split("/").filter(Boolean).map((segment) => {
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  });
  const slugIndex = segments.lastIndexOf(FUNCTION_SLUG);
  const rest = slugIndex >= 0 ? segments.slice(slugIndex + 1) : segments.slice(Math.max(segments.lastIndexOf("orders"), 0));

  if (rest[0] !== "orders" || rest.length > 3) throw notFound();

  if (rest.length === 1) {
    if (verb === "GET") return { name: "list", orderNo: null };
    if (verb === "POST") return { name: "create", orderNo: null };
    throw methodNotAllowed("GET or POST");
  }

  if (rest.length === 2 && rest[1] === "by-customer") {
    if (verb !== "GET") throw methodNotAllowed("GET");
    return { name: "byCustomer", orderNo: null };
  }

  const orderNo = rest[1].toUpperCase();
  if (!ORDER_NO_REGEX.test(orderNo)) throw new ApiError(404, "NOT_FOUND", "Order was not found.");

  if (rest.length === 2) {
    if (verb === "GET") return { name: "get", orderNo };
    if (verb === "PATCH") return { name: "update", orderNo };
    if (verb === "DELETE") return { name: "delete", orderNo };
    throw methodNotAllowed("GET, PATCH or DELETE");
  }

  const sub = SUB_ROUTES[rest[2]];
  if (!sub) throw notFound();
  if (verb !== sub.method) throw methodNotAllowed(sub.method);
  return { name: sub.name, orderNo };
};

/** Throws 403 when the key's scope may not call the route. */
export const assertScope = (route: RouteName, scope: Scope) => {
  if (ROUTE_SCOPE[route] === "admin" && scope !== "admin") {
    throw new ApiError(
      403,
      "FORBIDDEN",
      route === "paymentVerify"
        ? "Agent keys cannot verify or reject payments. A human with an admin key or the dashboard must do it."
        : "This action requires an admin key.",
    );
  }
};

export const actorTypeForScope = (scope: Scope) => (scope === "admin" ? "api_admin" : "api_agent");

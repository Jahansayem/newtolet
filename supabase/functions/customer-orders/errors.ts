// Error type, JSON envelope and database-error mapping for the Customer Orders API.
// No Deno imports: tests load this file in Node.

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "INVALID_TRANSITION"
  | "DUPLICATE_ORDER_WARNING"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  status: number;
  code: ErrorCode;
  details?: string[];
  extra?: Record<string, unknown>;

  constructor(status: number, code: ErrorCode, message: string, details?: string[], extra?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.extra = extra;
  }
}

export const validationError = (message: string, details?: string[]) =>
  new ApiError(400, "VALIDATION_ERROR", message, details);

export const okBody = (data: unknown, meta?: Record<string, unknown>) =>
  meta ? { success: true, data, meta } : { success: true, data };

export const errorBody = (error: ApiError) => ({
  success: false,
  error: {
    code: error.code,
    message: error.message,
    ...(error.details && error.details.length ? { details: error.details } : {}),
    ...(error.extra || {}),
  },
});

type DbError = { message?: string | null; hint?: string | null; code?: string | null };

const stripPrefix = (message: string) => message.replace(/^[A-Z_]+:\s*/, "");

/**
 * The SQL functions raise `PREFIX: message` (the same prefixes the admin RPCs
 * use). Anything unrecognised becomes a 500 without leaking the database text.
 */
export const fromDbError = (error: DbError): ApiError => {
  const message = String(error?.message || "");
  const hint = String(error?.hint || "");
  const text = stripPrefix(message);

  if (message.startsWith("ADMIN_VALIDATION:")) return validationError(text);
  if (message.startsWith("ADMIN_NOT_FOUND:")) return new ApiError(404, "NOT_FOUND", text);
  if (message.startsWith("ADMIN_PERMISSION_DENIED:")) return new ApiError(403, "FORBIDDEN", text);
  if (message.startsWith("ADMIN_INVALID_TRANSITION:")) {
    const from = /(?:^|;)from=([^;]*)/.exec(hint)?.[1];
    const to = /(?:^|;)to=([^;]*)/.exec(hint)?.[1];
    return new ApiError(422, "INVALID_TRANSITION", text, undefined, from || to ? { from_status: from || null, to_status: to || null } : undefined);
  }
  if (message.startsWith("ADMIN_CONFLICT:")) {
    const duplicate = /^duplicate_of=(.+)$/.exec(hint)?.[1];
    if (duplicate) {
      return new ApiError(
        409,
        "DUPLICATE_ORDER_WARNING",
        `${text} Update that order instead, or resend with "confirm_duplicate": true to create a second one.`,
        undefined,
        { existing_order_id: duplicate },
      );
    }
    return new ApiError(409, "CONFLICT", text);
  }
  // Constraint violations that slipped past the explicit checks.
  if (error?.code === "23514" || error?.code === "22P02" || error?.code === "22007" || error?.code === "22008") {
    return validationError("A field has an invalid value.");
  }
  return new ApiError(500, "INTERNAL_ERROR", "Unexpected error");
};

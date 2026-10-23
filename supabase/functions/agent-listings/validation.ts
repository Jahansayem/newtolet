// Request validation for the AI Agent Listings API.
//
// Rules mirror the frontend add/edit property flow (src/utils/formValidation.js,
// src/services/propertyService.js) and the option lists in
// src/Component/Navber/Addproperty.jsx. Enumerated values are matched
// case-insensitively on input and stored in their canonical casing so that the
// exact-match filters used by the site keep working.

export const MAX_IMAGES = 10;
export const MAX_AMENITIES = 30;
export const MAX_IMAGE_URL_LENGTH = 2048;
/** Base64 characters for a 4 MiB image (4 MiB * 4/3, rounded up with padding). */
export const MAX_IMAGE_BASE64_LENGTH = 5_700_000;
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_DESCRIPTION_LENGTH = 2000;
export const MIN_DESCRIPTION_LENGTH = 10;
export const MAX_SHORT_TEXT_LENGTH = 120;
export const MAX_FLOOR_LEVEL_LENGTH = 40;
export const MAX_AMENITY_LENGTH = 60;
export const MAX_COUNT = 1000;
export const MAX_SQFT = 1_000_000;
export const MAX_RENT = 100_000_000;

export const CATEGORIES = ["Family", "Office", "Sublet", "Bachelor", "Hostel", "Shop"];
export const PROPERTY_TYPES = [
  "Unit",
  "Apartment",
  "House",
  "Office Space",
  "Shop",
  "Warehouse",
  "Factory",
  "Hostel",
  "Hotel",
  "Building",
];
export const OCCUPANCIES = ["No Restriction", "Only Family", "Only Male", "Only Female"];
export const RENT_PERIODS = ["Daily", "Weekly", "Monthly", "Yearly"];

// Legacy spellings that exist in live data or that agents commonly send. Keys are
// lower-cased input, values are the canonical option above.
export const CATEGORY_ALIASES: Record<string, string> = {
  "family home": "Family",
  "office space": "Office",
  "hostel/mess": "Hostel",
  "hostel / mess": "Hostel",
  mess: "Hostel",
};
export const PROPERTY_TYPE_ALIASES: Record<string, string> = {
  flat: "Apartment",
  room: "Unit",
  "single room": "Unit",
  office: "Office Space",
};
export const OCCUPANCY_ALIASES: Record<string, string> = {
  family: "Only Family",
  "family only": "Only Family",
  male: "Only Male",
  "male only": "Only Male",
  bachelor: "Only Male",
  female: "Only Female",
  "female only": "Only Female",
  "no restrictions": "No Restriction",
  any: "No Restriction",
  anyone: "No Restriction",
};
export const RENT_PERIOD_ALIASES: Record<string, string> = {
  day: "Daily",
  "per day": "Daily",
  week: "Weekly",
  "per week": "Weekly",
  month: "Monthly",
  "per month": "Monthly",
  year: "Yearly",
  "per year": "Yearly",
  annual: "Yearly",
  annually: "Yearly",
};

/** Fields an agent may send on POST and PATCH. Everything else is rejected. */
export const EDITABLE_FIELDS = [
  "category",
  "property_type",
  "total_rooms",
  "total_bathrooms",
  "balcony",
  "total_kitchen",
  "dining_rooms",
  "living_rooms",
  "floor_level",
  "occupancy",
  "room_size_sqft",
  "rent_amount_bdt",
  "rent_period",
  "is_rent_negotiable",
  "state_district",
  "area",
  "sub_area",
  "short_description",
  "sector",
  "road",
  "house_plot",
  "lat",
  "lng",
  "available_from",
  "deadline",
  "contact_number",
  "amenities",
  "images",
] as const;

/** Server-controlled fields. Listed so the agent gets a precise error message. */
export const FORBIDDEN_FIELDS = [
  "id",
  "user_id",
  "status",
  "reviewed_at",
  "is_admin",
  "is_active",
  "is_featured",
  "is_pinned",
  "pinned_at",
  "pinned_until",
  "deactivated_at",
  "property_id_number",
  "views",
  "created_at",
  "updated_at",
  "listing_points_awarded",
  "listing_points_awarded_at",
  "submission_completed_at",
] as const;

export const REQUIRED_ON_CREATE = [
  "category",
  "property_type",
  "rent_period",
  "state_district",
  "area",
  "available_from",
] as const;

const COUNT_FIELDS = [
  "total_rooms",
  "total_bathrooms",
  "balcony",
  "total_kitchen",
  "dining_rooms",
  "living_rooms",
] as const;

const OPTIONAL_SHORT_TEXT_FIELDS = ["sub_area", "sector", "road", "house_plot"] as const;

const PHONE_REGEX = /^(\+88|88)?01[3-9]\d{8}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class ValidationError extends Error {
  details: string[];
  constructor(details: string[]) {
    super("Invalid request");
    this.name = "ValidationError";
    this.details = details;
  }
}

/** A `property_images` row as inserted (without property_id). */
export type ImageRow = {
  image_url: string;
  is_thumbnail: boolean;
  display_order: number;
};

/**
 * One requested image, in final display order, before it is fetched/decoded and
 * copied into storage. `index` is the position in the request array (for error
 * reporting); `is_thumbnail` is true for exactly one entry when the list is not empty.
 */
export type ImageSource = { index: number; is_thumbnail: boolean } & (
  | { kind: "url"; url: string }
  | { kind: "base64"; data: string; content_type: string | null }
);

export type ValidatedListing = {
  /** Column values for the `properties` table. */
  fields: Record<string, unknown>;
  /** `undefined` on PATCH when the key was omitted (do not replace). */
  images?: ImageSource[];
  /** `undefined` on PATCH when the key was omitted (do not replace). */
  amenities?: string[];
  /** Normalised phone, or `undefined` when the agent did not send one. */
  contactNumber?: string;
};

// Same rules as normalizeContactNumberForStorage in src/services/propertyService.js.
export const normalizeContactNumber = (value: unknown): string => {
  if (typeof value !== "string") return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("88")) return `+${digits}`;
  if (digits.startsWith("0")) return `+88${digits}`;
  return `+${digits}`;
};

export const isValidPhoneNumber = (value: string) => PHONE_REGEX.test(value.replace(/\s+/g, ""));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const matchOption = (value: string, options: string[], aliases: Record<string, string> = {}) => {
  const needle = value.trim().replace(/\s+/g, " ").toLowerCase();
  return options.find((option) => option.toLowerCase() === needle) ?? aliases[needle] ?? null;
};

const parseDate = (value: string) => {
  if (!DATE_REGEX.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) return null;
  // Reject values such as 2026-02-31 that Date.parse silently rolls over.
  return new Date(time).toISOString().slice(0, 10) === value ? value : null;
};

type Ctx = { errors: string[]; fields: Record<string, unknown> };

const readEnum = (
  ctx: Ctx,
  body: Record<string, unknown>,
  key: string,
  options: string[],
  aliases: Record<string, string> = {},
) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (typeof raw !== "string" || !raw.trim()) {
    ctx.errors.push(`${key} must be one of: ${options.join(", ")}`);
    return;
  }
  const match = matchOption(raw, options, aliases);
  if (!match) {
    ctx.errors.push(`${key} must be one of: ${options.join(", ")}`);
    return;
  }
  ctx.fields[key] = match;
};

const readInteger = (
  ctx: Ctx,
  body: Record<string, unknown>,
  key: string,
  { min, max }: { min: number; max: number },
) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null || raw === "") {
    ctx.fields[key] = null;
    return;
  }
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    ctx.errors.push(`${key} must be an integer between ${min} and ${max}`);
    return;
  }
  ctx.fields[key] = value;
};

const readNumber = (
  ctx: Ctx,
  body: Record<string, unknown>,
  key: string,
  { min, max }: { min: number; max: number },
) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null || raw === "") {
    ctx.fields[key] = null;
    return;
  }
  const value = typeof raw === "string" ? Number(raw) : raw;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    ctx.errors.push(`${key} must be a number between ${min} and ${max}`);
    return;
  }
  ctx.fields[key] = value;
};

const readText = (
  ctx: Ctx,
  body: Record<string, unknown>,
  key: string,
  { min = 0, max, nullable }: { min?: number; max: number; nullable: boolean },
) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null || raw === "") {
    if (nullable) ctx.fields[key] = null;
    else ctx.errors.push(`${key} is required`);
    return;
  }
  if (typeof raw !== "string") {
    ctx.errors.push(`${key} must be a string`);
    return;
  }
  const value = raw.trim().replace(/\s+/g, " ");
  if (value.length < min) {
    ctx.errors.push(`${key} must be at least ${min} characters`);
    return;
  }
  if (value.length > max) {
    ctx.errors.push(`${key} must be at most ${max} characters`);
    return;
  }
  ctx.fields[key] = value;
};

const readDate = (ctx: Ctx, body: Record<string, unknown>, key: string, nullable: boolean) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (raw === null || raw === "") {
    if (nullable) ctx.fields[key] = null;
    else ctx.errors.push(`${key} cannot be empty`);
    return;
  }
  const value = typeof raw === "string" ? parseDate(raw.trim()) : null;
  if (!value) {
    ctx.errors.push(`${key} must be a valid date in YYYY-MM-DD format`);
    return;
  }
  ctx.fields[key] = value;
};

const readBoolean = (ctx: Ctx, body: Record<string, unknown>, key: string) => {
  if (!(key in body)) return;
  const raw = body[key];
  if (typeof raw === "boolean") {
    ctx.fields[key] = raw;
    return;
  }
  if (raw === "true" || raw === "false") {
    ctx.fields[key] = raw === "true";
    return;
  }
  ctx.errors.push(`${key} must be true or false`);
};

export const normalizeAmenities = (raw: unknown, errors: string[]): string[] | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.push("amenities must be an array of strings");
    return undefined;
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of raw) {
    if (typeof entry !== "string") {
      errors.push("amenities must contain only strings");
      return undefined;
    }
    const value = entry.trim().replace(/\s+/g, " ");
    if (!value) continue;
    if (value.length > MAX_AMENITY_LENGTH) {
      errors.push(`each amenity must be at most ${MAX_AMENITY_LENGTH} characters`);
      return undefined;
    }
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  if (result.length > MAX_AMENITIES) {
    errors.push(`amenities must contain at most ${MAX_AMENITIES} items`);
    return undefined;
  }
  return result;
};

const isValidImageUrl = (value: string) => {
  if (value.length > MAX_IMAGE_URL_LENGTH) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const DATA_URI_REGEX = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)?(?:;[a-z0-9=-]+)*;base64,/i;

/**
 * Split an `image_base64` value into its payload and the content type carried by an
 * optional `data:<type>;base64,` prefix. Whitespace (line wrapping) is removed.
 */
const readBase64Source = (value: string, declaredType: unknown) => {
  let data = value.trim();
  let contentType: string | null = null;
  const match = DATA_URI_REGEX.exec(data);
  if (match) {
    contentType = match[1]?.toLowerCase() ?? null;
    data = data.slice(match[0].length);
  }
  if (typeof declaredType === "string" && declaredType.trim()) {
    contentType = declaredType.trim().toLowerCase().split(";")[0];
  }
  return { data: data.replace(/\s+/g, ""), contentType };
};

export const normalizeImages = (raw: unknown, errors: string[]): ImageSource[] | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null) return [];
  if (!Array.isArray(raw)) {
    errors.push("images must be an array");
    return undefined;
  }
  if (raw.length > MAX_IMAGES) {
    errors.push(`images must contain at most ${MAX_IMAGES} items`);
    return undefined;
  }

  const seen = new Set<string>();
  type Entry = {
    source: { kind: "url"; url: string } | { kind: "base64"; data: string; content_type: string | null };
    thumbnail: boolean;
    order: number | null;
    index: number;
  };
  const entries: Entry[] = [];
  for (const [index, entry] of raw.entries()) {
    const item = typeof entry === "string" ? { image_url: entry } : entry;
    if (!isPlainObject(item)) {
      errors.push(`images[${index}] must be an object with image_url or image_base64`);
      return undefined;
    }
    const hasUrl = item.image_url !== undefined && item.image_url !== null;
    const hasBase64 = item.image_base64 !== undefined && item.image_base64 !== null;
    if (hasUrl === hasBase64) {
      errors.push(`images[${index}] must have exactly one of image_url or image_base64`);
      return undefined;
    }

    let source: Entry["source"];
    if (hasUrl) {
      if (typeof item.image_url !== "string") {
        errors.push(`images[${index}].image_url must be a string`);
        return undefined;
      }
      const url = item.image_url.trim();
      if (!isValidImageUrl(url)) {
        errors.push(`images[${index}].image_url must be a valid http(s) URL`);
        return undefined;
      }
      if (seen.has(url)) continue;
      seen.add(url);
      source = { kind: "url", url };
    } else {
      if (typeof item.image_base64 !== "string" || !item.image_base64.trim()) {
        errors.push(`images[${index}].image_base64 must be a non-empty base64 string`);
        return undefined;
      }
      if (item.image_base64.length > MAX_IMAGE_BASE64_LENGTH + 64) {
        errors.push(`images[${index}].image_base64 must decode to at most 4 MB`);
        return undefined;
      }
      if (
        item.content_type !== undefined && item.content_type !== null &&
        typeof item.content_type !== "string"
      ) {
        errors.push(`images[${index}].content_type must be a string`);
        return undefined;
      }
      const { data, contentType } = readBase64Source(item.image_base64, item.content_type);
      if (!data) {
        errors.push(`images[${index}].image_base64 must be a non-empty base64 string`);
        return undefined;
      }
      if (contentType && !IMAGE_CONTENT_TYPES.includes(contentType)) {
        errors.push(
          `images[${index}].content_type must be one of ${IMAGE_CONTENT_TYPES.join(", ")}`,
        );
        return undefined;
      }
      // Cheap duplicate guard; byte-identical uploads are also de-duplicated by hash later.
      const key = `base64:${data.length}:${data.slice(0, 64)}:${data.slice(-64)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      source = { kind: "base64", data, content_type: contentType };
    }

    let order: number | null = null;
    if (item.display_order !== undefined && item.display_order !== null) {
      const parsed = Number(item.display_order);
      if (!Number.isInteger(parsed) || parsed < 0) {
        errors.push(`images[${index}].display_order must be a non-negative integer`);
        return undefined;
      }
      order = parsed;
    }
    if (item.is_thumbnail !== undefined && typeof item.is_thumbnail !== "boolean") {
      errors.push(`images[${index}].is_thumbnail must be true or false`);
      return undefined;
    }
    entries.push({ source, thumbnail: item.is_thumbnail === true, order, index });
  }

  // Stable sort by requested display_order (unspecified entries keep array position).
  // Final display_order values are assigned after the images are fetched, because an
  // image that cannot be retrieved is dropped and the rest close the gap.
  entries.sort((a, b) => (a.order ?? a.index) - (b.order ?? b.index) || a.index - b.index);
  const thumbnailIndex = Math.max(0, entries.findIndex((entry) => entry.thumbnail));
  return entries.map((entry, position) => ({
    ...entry.source,
    index: entry.index,
    is_thumbnail: position === thumbnailIndex,
  }));
};

const checkKeys = (body: Record<string, unknown>, errors: string[]) => {
  const editable = new Set<string>(EDITABLE_FIELDS);
  const forbidden = new Set<string>(FORBIDDEN_FIELDS);
  for (const key of Object.keys(body)) {
    if (editable.has(key)) continue;
    if (forbidden.has(key)) errors.push(`${key} is set by the server and cannot be provided`);
    else errors.push(`unknown field: ${key}`);
  }
};

const readScalars = (ctx: Ctx, body: Record<string, unknown>) => {
  readEnum(ctx, body, "category", CATEGORIES, CATEGORY_ALIASES);
  readEnum(ctx, body, "property_type", PROPERTY_TYPES, PROPERTY_TYPE_ALIASES);
  readEnum(ctx, body, "occupancy", OCCUPANCIES, OCCUPANCY_ALIASES);
  readEnum(ctx, body, "rent_period", RENT_PERIODS, RENT_PERIOD_ALIASES);

  for (const key of COUNT_FIELDS) {
    readInteger(ctx, body, key, { min: 0, max: MAX_COUNT });
  }
  readInteger(ctx, body, "room_size_sqft", { min: 1, max: MAX_SQFT });
  readInteger(ctx, body, "rent_amount_bdt", { min: 1, max: MAX_RENT });
  readBoolean(ctx, body, "is_rent_negotiable");

  readText(ctx, body, "state_district", { min: 1, max: MAX_SHORT_TEXT_LENGTH, nullable: false });
  readText(ctx, body, "area", { min: 1, max: MAX_SHORT_TEXT_LENGTH, nullable: false });
  for (const key of OPTIONAL_SHORT_TEXT_FIELDS) {
    readText(ctx, body, key, { max: MAX_SHORT_TEXT_LENGTH, nullable: true });
  }
  readText(ctx, body, "floor_level", { max: MAX_FLOOR_LEVEL_LENGTH, nullable: true });
  readText(ctx, body, "short_description", {
    min: MIN_DESCRIPTION_LENGTH,
    max: MAX_DESCRIPTION_LENGTH,
    nullable: true,
  });

  readNumber(ctx, body, "lat", { min: -90, max: 90 });
  readNumber(ctx, body, "lng", { min: -180, max: 180 });
  if (("lat" in ctx.fields) !== ("lng" in ctx.fields)) {
    ctx.errors.push("lat and lng must be provided together");
  } else if ("lat" in ctx.fields && (ctx.fields.lat === null) !== (ctx.fields.lng === null)) {
    ctx.errors.push("lat and lng must both be set or both be null");
  }

  readDate(ctx, body, "available_from", false);
  readDate(ctx, body, "deadline", true);
  if (
    typeof ctx.fields.available_from === "string" &&
    typeof ctx.fields.deadline === "string" &&
    ctx.fields.deadline < ctx.fields.available_from
  ) {
    ctx.errors.push("deadline must be on or after available_from");
  }
};

const readContactNumber = (ctx: Ctx, body: Record<string, unknown>): string | undefined => {
  if (!("contact_number" in body)) return undefined;
  const raw = body.contact_number;
  if (raw === null || raw === "") return undefined;
  if (typeof raw !== "string" || !isValidPhoneNumber(raw)) {
    ctx.errors.push("contact_number must be a valid Bangladesh mobile number (e.g. +8801712345678)");
    return undefined;
  }
  return normalizeContactNumber(raw);
};

export const validateCreateBody = (body: unknown): ValidatedListing => {
  if (!isPlainObject(body)) throw new ValidationError(["request body must be a JSON object"]);

  const ctx: Ctx = { errors: [], fields: {} };
  checkKeys(body, ctx.errors);
  readScalars(ctx, body);

  for (const key of REQUIRED_ON_CREATE) {
    if (!(key in body)) ctx.errors.push(`${key} is required`);
  }

  const negotiable = ctx.fields.is_rent_negotiable === true;
  const hasRent = typeof ctx.fields.rent_amount_bdt === "number";
  if (!hasRent && !negotiable) {
    ctx.errors.push("rent_amount_bdt is required unless is_rent_negotiable is true");
  }

  const contactNumber = readContactNumber(ctx, body);
  const amenities = normalizeAmenities(body.amenities, ctx.errors) ?? [];
  const images = normalizeImages(body.images, ctx.errors) ?? [];

  if (ctx.errors.length) throw new ValidationError(ctx.errors);
  return { fields: ctx.fields, images, amenities, contactNumber };
};

export const validatePatchBody = (body: unknown): ValidatedListing => {
  if (!isPlainObject(body)) throw new ValidationError(["request body must be a JSON object"]);
  if (!Object.keys(body).length) {
    throw new ValidationError(["request body must include at least one field"]);
  }

  const ctx: Ctx = { errors: [], fields: {} };
  checkKeys(body, ctx.errors);
  readScalars(ctx, body);

  // A PATCH may clear the rent only while marking the listing negotiable.
  if (ctx.fields.rent_amount_bdt === null && ctx.fields.is_rent_negotiable !== true) {
    ctx.errors.push("rent_amount_bdt can only be cleared when is_rent_negotiable is true");
  }

  const contactNumber = readContactNumber(ctx, body);
  const amenities = normalizeAmenities(body.amenities, ctx.errors);
  const images = normalizeImages(body.images, ctx.errors);

  if (ctx.errors.length) throw new ValidationError(ctx.errors);
  return { fields: ctx.fields, images, amenities, contactNumber };
};

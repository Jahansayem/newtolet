// Response shaping for the Customer Orders API. Every response goes through
// these functions, so this is the one place that decides whether an owner's
// phone number or an exact address may leave the server.
// No Deno imports: tests load this file in Node.

type Row = Record<string, any>;

/** Keys that are never returned unless the order is unlocked AND the owner agreed. */
export const OWNER_PRIVATE_KEYS = ["owner_contact_phone", "exact_address"];

export const serializeOrder = (row: Row) => ({
  id: row.order_no,
  type: row.type,
  status: row.status,
  search: { mode: row.search_mode ?? null, taken_over_by: row.search_taken_over_by ?? null },
  created_via: row.created_via,
  created_by: row.created_by_label,
  source: row.source,
  customer: {
    name: row.customer_name,
    phone: row.customer_phone ?? null,
    facebook_name: row.facebook_name ?? null,
    facebook_thread_url: row.facebook_thread_url ?? null,
  },
  requirements: {
    area: row.area ?? null,
    rooms: row.rooms ?? null,
    budget_min: row.budget_min ?? null,
    budget_max: row.budget_max ?? null,
    move_in_date: row.move_in_date ?? null,
    family_or_bachelor: row.tenant_type ?? null,
    gas: row.gas ?? null,
    bathrooms: row.bathrooms ?? null,
    balconies: row.balconies ?? null,
    facilities: row.facilities ?? null,
    notes: row.requirement_notes ?? null,
  },
  service_charge_bdt: row.service_charge_bdt,
  payment_status: row.payment_status,
  amount_paid: row.amount_paid,
  amount_due: row.amount_due,
  overpaid: Boolean(row.overpaid),
  payment_verification: row.payment_verification,
  listings_found_count: row.listings_found_count,
  listings_verified_count: row.listings_verified_count,
  listings_unverified_count: row.listings_unverified_count,
  owner_contact_unlocked: Boolean(row.contact_unlocked),
  assigned_to: row.assigned_to ? { id: row.assigned_to, name: row.assignee_name ?? null } : null,
  follow_up_at: row.follow_up_at ?? null,
  payment_claimed_at: row.payment_claimed_at ?? null,
  payment_verified_at: row.payment_verified_at ?? null,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const serializeClaim = (row: Row) => ({
  id: row.id,
  amount_bdt: row.amount_bdt,
  trx_id: row.trx_id ?? null,
  sender_last4: row.sender_last4 ?? null,
  status: row.status,
  claimed_by: row.claimed_by_label,
  claimed_at: row.claimed_at,
  verified_by: row.reviewed_by_label ?? null,
  verified_at: row.reviewed_at ?? null,
  note: row.review_note ?? null,
});

/**
 * Owner phone and exact address are included only when the order's full charge
 * is paid AND verified (orderUnlocked) and the owner's permission is recorded
 * on this match. A verified partial payment never unlocks them.
 */
export const serializeMatch = (row: Row, orderUnlocked: boolean) => {
  const available = Boolean(orderUnlocked) && row.owner_permission === true;
  return {
    id: row.id,
    reference_id: row.reference_id,
    property_id: row.property_id ?? null,
    general_location: row.general_location ?? null,
    rent: row.rent ?? null,
    verification_status: row.verification_status,
    owner_permission: Boolean(row.owner_permission),
    owner_contact_available: available,
    ...(available
      ? { owner_contact_phone: row.owner_contact_phone ?? null, exact_address: row.exact_address ?? null }
      : {}),
    added_by: row.created_by_label,
    created_at: row.created_at,
  };
};

const stripPrivate = (value: unknown) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return value ?? null;
  const copy: Row = { ...(value as Row) };
  for (const key of OWNER_PRIVATE_KEYS) delete copy[key];
  return copy;
};

/** Timeline entries never carry owner phone / exact address, whatever the order state. */
export const serializeTimeline = (items: unknown) =>
  (Array.isArray(items) ? items : []).map((item: Row) =>
    item?.kind === "activity" ? { ...item, before: stripPrivate(item.before), after: stripPrivate(item.after) } : item
  );

export const serializeDetail = (order: Row, claims: Row[], matches: Row[], timeline: unknown) => ({
  ...serializeOrder(order),
  payment_claims: (claims || []).map(serializeClaim),
  matches: (matches || []).map((match) => serializeMatch(match, Boolean(order.contact_unlocked))),
  timeline: serializeTimeline(timeline),
});

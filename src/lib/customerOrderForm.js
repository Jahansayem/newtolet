// Draft <-> payload helpers for the admin customer-order form
// (src/components/admin-panel/customer-orders/OrderFormDialog.jsx).
// Pure module: no React or Supabase import, safe for node --test.

/** Sources staff can pick. Older orders may carry manual / lead_generation / website. */
export const SOURCE_OPTIONS = Object.freeze(['messenger', 'phone', 'whatsapp'])
export const DEFAULT_SOURCE = 'messenger'

/** Rooms and bathrooms dropdown values. */
export const COUNT_OPTIONS = Object.freeze([1, 2, 3, 4])

/** 'line' is the value the agent API documents for piped gas. */
export const GAS_OPTIONS = Object.freeze([
  { value: 'line', label: 'Gas' },
  { value: 'cylinder', label: 'Cylinder' },
])

export const FACILITY_OPTIONS = Object.freeze(['Lift', 'Parking', 'Generator', 'CCTV', 'WiFi', 'Furnished', 'AC', 'Security guard'])

/** Every Bangladeshi mobile number starts with this; the phone field is pre-filled with it. */
export const PHONE_PREFIX = '01'

const TEXT_FIELDS = ['customer_name', 'customer_phone', 'facebook_name', 'source', 'area', 'move_in_date', 'tenant_type', 'gas', 'requirement_notes']
const NUMBER_FIELDS = ['rooms', 'budget_min', 'budget_max', 'bathrooms', 'balconies']

const clean = (value) => String(value ?? '').trim()

/** "lift, Roof access" -> ['Lift', 'Roof access']: known options in their canonical spelling, anything else kept as written. */
export const parseFacilities = (text) => {
  const seen = new Set()
  const list = []
  for (const piece of String(text ?? '').split(',')) {
    const raw = piece.trim()
    if (!raw) continue
    const item = FACILITY_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase()) || raw
    const key = item.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    list.push(item)
  }
  return list
}

/** Known options first (in display order), then any free-text ones. */
export const formatFacilities = (list) => {
  const items = parseFacilities((list || []).join(','))
  const known = FACILITY_OPTIONS.filter((option) => items.includes(option))
  const other = items.filter((item) => !FACILITY_OPTIONS.includes(item))
  return [...known, ...other].join(', ') || null
}

/** 'Line' -> 'line'; free text such as 'line or cylinder' is kept as written. */
export const normaliseGas = (value) => {
  const text = clean(value)
  return GAS_OPTIONS.find((option) => option.value === text.toLowerCase())?.value || text
}

export const toLocalInput = (iso) => {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Form state for an existing order, or for a new one when order is null. */
export const draftFrom = (order = null) => {
  const draft = { follow_up_at: toLocalInput(order?.follow_up_at), assigned_to: order?.assigned_to || '' }
  for (const key of TEXT_FIELDS) draft[key] = order?.[key] ?? ''
  for (const key of NUMBER_FIELDS) draft[key] = order?.[key] ?? ''
  draft.gas = normaliseGas(draft.gas)
  draft.facilities = parseFacilities(order?.facilities)
  if (!order) {
    draft.source = DEFAULT_SOURCE
    draft.customer_phone = PHONE_PREFIX
  }
  return draft
}

/** Draft -> { key: value|null } with trimmed text, whole numbers and an ISO follow-up time. */
export const normalise = (draft) => {
  const values = {}
  for (const key of TEXT_FIELDS) values[key] = clean(draft[key]) || null
  for (const key of NUMBER_FIELDS) values[key] = draft[key] === '' || draft[key] === null || draft[key] === undefined ? null : Number(draft[key])
  // The untouched "01" prefix is not a phone number.
  if (values.customer_phone === PHONE_PREFIX) values.customer_phone = null
  values.facilities = formatFacilities(draft.facilities)
  values.follow_up_at = draft.follow_up_at ? new Date(draft.follow_up_at).toISOString() : null
  return values
}

/** True when a normalised value says the same thing as what the order already stores. */
export const sameValue = (key, next, order) => {
  const current = order?.[key] ?? null
  if (key === 'follow_up_at') return (next ? new Date(next).getTime() : null) === (current ? new Date(current).getTime() : null)
  if (key === 'facilities') return formatFacilities(parseFacilities(next)) === formatFacilities(parseFacilities(current))
  if (key === 'gas') return (normaliseGas(next) || null) === (normaliseGas(current) || null)
  return (next ?? null) === current
}

/** Only the fields an edit really changed. */
export const changedFields = (values, order) =>
  Object.fromEntries(Object.entries(values).filter(([key, value]) => !sameValue(key, value, order)))

/** Dropdown values 1-4, plus the order's own value when it is outside that range. */
export const countChoices = (current) => {
  const value = current === '' || current === null || current === undefined ? null : Number(current)
  return value !== null && Number.isFinite(value) && !COUNT_OPTIONS.includes(value) ? [...COUNT_OPTIONS, value].sort((a, b) => a - b) : [...COUNT_OPTIONS]
}

/** Gas tick options, plus the order's free-text value when it is neither of the two. */
export const gasChoices = (current) => {
  const value = clean(current)
  return value && !GAS_OPTIONS.some((option) => option.value === value) ? [...GAS_OPTIONS, { value, label: value }] : [...GAS_OPTIONS]
}

/** Facility tick options, plus any free-text facilities already on the order. */
export const facilityChoices = (selected) => [...FACILITY_OPTIONS, ...(selected || []).filter((item) => !FACILITY_OPTIONS.includes(item))]

/** Source tick options, plus the order's own source when it is an older one (manual, lead generation, website). */
export const sourceChoices = (current) => (current && !SOURCE_OPTIONS.includes(current) ? [...SOURCE_OPTIONS, current] : [...SOURCE_OPTIONS])

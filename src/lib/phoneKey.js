// Phone-number key used for duplicate-listing detection.
// Must stay identical to the generated column properties.contact_phone_key:
//   nullif(right(regexp_replace(coalesce(contact_number,''), '\D', '', 'g'), 11), '')
// Pure module, safe for node --test.

export const normalizePhoneForDuplicateKey = (value) => {
  if (value === null || value === undefined) return null
  const digits = String(value).replace(/\D/g, '')
  if (!digits) return null
  return digits.slice(-11)
}

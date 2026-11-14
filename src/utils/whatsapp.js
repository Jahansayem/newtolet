// wa.me needs the number in international form without "+" or spaces: 8801712345678.

export const toWhatsAppNumber = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '')
  if (/^8801[3-9]\d{8}$/.test(digits)) return digits
  if (/^01[3-9]\d{8}$/.test(digits)) return `88${digits}`
  return ''
}

export const buildWhatsAppHref = (phone, message = '') => {
  const number = toWhatsAppNumber(phone)
  if (!number) return ''
  const text = message ? `?text=${encodeURIComponent(message)}` : ''
  return `https://wa.me/${number}${text}`
}

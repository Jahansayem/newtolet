// Single source of truth for NewTolet's public contact details.
// Footer, Contact page, policy pages and JSON-LD all read from here so they can never disagree.

export const SITE_CONTACT = Object.freeze({
  companyName: 'NewTolet.Com',
  websiteUrl: 'https://www.newtolet.com/',
  email: 'newtolet.com@gmail.com',
  phoneDisplay: '+880 1707346634',
  phoneHref: 'tel:+8801707346634',
  // Bengali display of the address lives in the i18n dictionaries (footer.address).
  addressEn: 'Jugidor, Moulvibazar, Sylhet',
  addressLocality: 'Moulvibazar',
  addressRegion: 'Sylhet',
  addressCountry: 'BD',
  // Add real profile URLs here; the footer only renders icons for entries that exist.
  socialLinks: Object.freeze([]),
})

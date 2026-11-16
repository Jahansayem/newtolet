// Adds nginx SSI includes to the exported /listdetails/ page so the listing-seo Edge Function
// can supply per-listing <head> tags and an H1 block (see scripts/deploy/nginx-newtolet.conf).
// The page's own generic tags become the SSI stub, so nginx falls back to them when the
// function fails. Throws when the Next.js markup no longer matches, rather than shipping a
// page without SEO tags.

const TITLE_RUN = /<title>[^<]*<\/title><meta name="description" content="[^"]*"\/>/g
// Generic tags the function replaces; they move into the stub so they are not duplicated.
const MOVED_TAGS = ['property="og:title"', 'property="og:description"', 'name="twitter:title"', 'name="twitter:description"']
  .map((attribute) => new RegExp(`<meta ${attribute} content="[^"]*"/>`, 'g'))

export const HEAD_INCLUDE = '<!--# include virtual="/__seo/head?id=$arg_id" stub="seo_head" -->'
export const BODY_INCLUDE = '<!--# include virtual="/__seo/body?id=$arg_id" stub="seo_none" -->'

const exactlyOne = (html, pattern) => (html.match(pattern) || []).length === 1

export function addListingSsi(html) {
  if (html.includes(HEAD_INCLUDE)) return html
  if (!exactlyOne(html, TITLE_RUN) || !MOVED_TAGS.every((pattern) => exactlyOne(html, pattern)) || html.split('</body>').length !== 2) {
    throw new Error('listdetails markup changed: update the patterns in scripts/listing-ssi.mjs')
  }
  const moved = MOVED_TAGS.map((pattern) => html.match(pattern)[0]).join('')
  const stripped = MOVED_TAGS.reduce((result, pattern) => result.replace(pattern, () => ''), html)
  return stripped
    .replace(TITLE_RUN, (titleRun) => `<!--# block name="seo_head" -->${titleRun}${moved}<!--# endblock -->${HEAD_INCLUDE}`)
    .replace('</body>', () => `<!--# block name="seo_none" --><!--# endblock -->${BODY_INCLUDE}</body>`)
}

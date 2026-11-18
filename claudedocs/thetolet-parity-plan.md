# NewTolet → TheTolet feature parity plan

Written 2026-11-18. Based on a crawl of the public pages of www.thetolet.com and www.newtolet.com plus a read of this repo
(branch `feat/order-home-nav`).

## How to use this file

Run the prompts **one at a time, in order**, each in a fresh Claude Code session opened in this folder.
Every prompt is self-contained. After each one: review the diff, run `npm test` and `npm run lint`, check the page
with `npm run dev`, then commit before starting the next. Build and deploy with `npm run build` + `scripts/deploy/upload.sh`
only after the change is checked.

## Constraints every prompt must respect

These come from how this project is built. Breaking them breaks production.

- **Static export.** `next.config.mjs` has `output: 'export'`. There is no Node server in production.
  Dynamic routes need `generateStaticParams()`. Anything per-listing goes through nginx + SSI + the
  `listing-seo` Supabase Edge Function (see `scripts/listing-ssi.mjs`, `scripts/deploy/nginx-newtolet.conf`).
- **Hosting is nginx on a VPS** (`scripts/deploy/`). `public/.htaccess` is legacy Apache and not used in production.
- **Data:** Supabase (self-hosted at `api.newtolet.com`). Schema changes go in a new file under `supabase/migrations/`.
- **i18n:** every user-visible string goes through `useLanguage()` / `t()`, with keys in both
  `src/i18n/locales/en` and `src/i18n/locales/bn`. Run `node scripts/i18n-check-keys.mjs`.
- **Routing shim:** `react-router-dom` is aliased to `src/lib/react-router-dom.jsx`. Use the existing `Link`.
- **Tests:** `tests/routeLinks.test.mjs` fails if any internal link points at a route the export does not build.
  Add every new page to it implicitly by creating `app/(site)/.../page.js`.
- **No copying thetolet.com.** Match the *features*, not their text, images, branding or reviews. Testimonials, stats
  and press coverage must be real NewTolet data, or the section is left out.

## What is already in the code (don't rebuild)

Save property, a compare toggle (`src/services/propertyCompareService.js`), report dialog
(`src/components/listing/ReportListingDialog.jsx`), credits/unlock, referrals, job feed, Order Home form, WhatsApp contact
button, homepage category sections, About, ArticlePreview and Feedback sections (`src/Component/Home/Home.jsx`),
division pages, `is_featured` / `available_from` / `view_count` columns, Bangla/English toggle, advanced filters, map.

## Gaps, in build order

| # | Gap | Why first |
|---|-----|-----------|
| 0 | GA4 hits blocked by CSP | Live bug, analytics currently lose data |
| 1 | Home page sections not showing on live site | Verify before adding more sections |
| 2 | Compare page | Toggle exists, page doesn't |
| 3 | Detail page fields (updated at, availability, rent includes) | Small, high trust value |
| 4 | Category landing pages | SEO |
| 5 | Area landing pages + popular places | SEO, biggest traffic driver on thetolet |
| 6 | Readable listing URLs | SEO |
| 7 | Individual article pages | SEO/content |
| 8 | Public Order Home landing section | Revenue |
| 9 | Home extras: featured, stats, app block | Conversion |
| 10 | FAQ, Affiliate, Disclaimer, DMCA, Team pages | Trust + SEO |
| 11 | Floating contact widget + PWA install | Support/retention |

---

## Prompt 0: Fix Google Analytics being blocked

```
On the live site the browser console shows GA4 requests to https://analytics.google.com/g/collect and
https://www.google.com/g/collect blocked by the Content-Security-Policy connect-src directive. The rule is in
scripts/deploy/nginx-newtolet-security-headers.conf; `https://*.analytics.google.com` does not match the bare
`analytics.google.com` host, and `www.google.com` is not listed at all.

1. Add https://analytics.google.com and https://www.google.com to connect-src (keep everything else as is).
   Also check img-src/script-src cover what GA4 needs per Google's CSP guidance for GA4.
2. Check whether the CSP is also defined anywhere else (app/layout.js, next.config.mjs, the admin conf) and keep them consistent.
3. Tell me the exact command(s) to reload nginx on the VPS after deploying, based on scripts/deploy/README.md. Do not run them.
```

## Prompt 1: Find out why the home sections don't show on the live site

```
src/Component/Home/Home.jsx renders category sections, ArticlePreview, JobFeedSection, About, Feedback and Adsterra
banners, most wrapped in src/components/DeferredSection.jsx (IntersectionObserver). On the live site
(https://www.newtolet.com/) only the hero, the job feed and the footer appeared during a crawl; that crawl ran in a hidden
browser tab, so it may be a false alarm.

1. Run `npm run dev`, open the home page in a visible browser, scroll to the bottom, and list which sections render.
2. Then check the static export (`npm run build`, serve ./out locally) the same way.
3. If a section never mounts (e.g. listcontext never finishes loading, DeferredSection never intersects, a dynamic import
   fails), find the root cause and fix it. Add a fallback so DeferredSection mounts its children after a timeout or when
   IntersectionObserver is unavailable, so crawlers also see the content.
4. Report what you found before and after, with evidence.
```

## Prompt 2: Compare page

```
Build a /compare/ page that shows the listings the user added with the compare toggle, side by side.

Existing pieces: src/services/propertyCompareService.js (localStorage ids, COMPARE_PROPERTIES_BROWSER_EVENT,
toggleComparedProperty), the toggle in src/components/PropertyListingCard.jsx, and data loading in
src/services/propertyService.js / propertyCatalogService.js.

Requirements:
- New route app/(site)/compare/page.js (+ layout.js with metadata via src/lib/seo/siteMeta.js buildRouteMetadata, noindex).
- Fetch the compared listings by id in one query. Show up to 4 columns, horizontally scrollable on mobile.
- Rows: photo, title, category, property type, rent, area/district, bedrooms, bathrooms, balcony, floor, available from,
  occupancy restriction, facilities, property ID. Highlight cells that differ.
- Per column: remove button, link to the listing. Empty state with a link to /bd/property-listing/.
- A small floating "Compare (n)" pill on listing pages when n >= 1 that links to /compare/. Limit to 4 items with a toast.
- Add "Compare" to the user menu / footer quick links.
- All strings in en and bn locale files. Add a unit test for any new pure helpers under tests/.
```

## Prompt 3: Detail page – updated date, availability, rent includes

```
Add three things to the listing detail page (src/Component/Home/Listdetails.jsx) that thetolet shows and we don't:
"Last updated" date, "Availability status", and "Rent includes" (water, gas, electricity, service charge, security, internet).

1. Inspect the properties table in supabase/migrations and DATABASE_SCHEMA_FIXED.sql. updated_at and available_from
   already exist. Add a migration for:
   - rent_includes text[] (allowed values: water, gas, electricity, service_charge, security, internet, lift, generator, parking)
   - availability_status text with check ('available','rented','coming_soon'), default 'available'.
   Make sure RLS and any RPCs/views that select explicit columns (search the migrations and src/services) include them.
2. Add-property and edit-property forms (src/components/AddProperty, app/(site)/edit-property): a checkbox group for
   rent includes, a select for availability. Admin property editor (src/components/admin-panel/property-editor) too.
3. Detail page: show "Updated <relative date>", an availability badge, and a "Rent includes" chip list next to the price.
   Rented listings show a clear "Already rented" banner and are excluded from default search results (check
   src/Component/Home/propertySearchCore.js and the listing queries).
4. Update the listing-seo Edge Function only if it renders these fields.
5. en + bn strings. Tests for any new helpers. Give me the SQL I must run on the server.
```

## Prompt 4: Category landing pages

```
Create static SEO landing pages per category, like /bd/property/category/family/.

Categories: family, bachelor, office, sublet, hostel, shop (see src/lib/propertyCategories.js and
src/Component/Home/categoryConfig.js).

- Route app/(site)/bd/property/category/[categorySlug]/page.js with generateStaticParams() for the 6 slugs
  (static export: no runtime params).
- Follow the pattern of app/(site)/bd/property-division/[divisionSlug]/ (server page for metadata + a client component).
- Each page: unique H1 and an original 120-200 word intro per category in en and bn (what the category means in
  Bangladesh, typical rents, what to check), then the existing listing grid pre-filtered by category, with all filters
  still working and division links below.
- Metadata: title, description, canonical, OpenGraph, plus BreadcrumbList and ItemList JSON-LD (reuse src/lib/seo).
- Point the home page category tabs/"See more" links and footer at these URLs (keep ?category= working).
- Add the URLs to the sitemap (supabase/functions/sitemap). Update tests/seo.test.mjs.
```

## Prompt 5: Area landing pages + "Most popular places"

```
Thetolet's biggest SEO asset is a page per area (e.g. /bd/property-area/dhaka/dhaka/mirpur) with a written intro
and the listings for that area. Build the same for NewTolet.

Data: src/thetolet_locations_bundle.json (divisions → districts → upazillas → sub_areas). Because of the static export,
pages must be generated at build time.

1. Route app/(site)/bd/property-area/[division]/[district]/[area]/page.js with generateStaticParams().
   Do NOT generate a page for every upazila in the country: at build time, query Supabase for the areas that have at least
   3 approved listings (use the anon key from .env.local at build), and generate those only. Unbuilt areas fall back to
   /bd/property-listing/?area=... via an nginx rule (add it to scripts/deploy/nginx-newtolet.conf).
2. Slug helper with tests (Bangla-safe, stable, matches thetolet-style lowercase-hyphen slugs).
3. Page content: H1 "House, flat & room rent in <Area>, <District>", listing count, a short intro, category tabs,
   the filtered listing grid, nearby areas in the same district, breadcrumb.
   Intro text: write a generic template that varies by real data (count per category, median rent, min/max rent),
   plus an optional hand-written paragraph from a new src/data/areaIntros.js for the top ~20 Dhaka/Chattogram areas
   (write those 20, original, en + bn). No thin duplicate pages: noindex any area page with fewer than 3 listings.
4. Home page: a "Most popular places" section (top 12 areas by listing count, with counts) linking to these pages.
   Fetch counts once at build time for the static HTML and refresh client-side.
5. Add the pages to the sitemap Edge Function. Update tests/routeLinks.test.mjs expectations and tests/seo.test.mjs.
```

## Prompt 6: Readable listing URLs

```
Listing URLs are /listdetails/?id=<uuid>. Thetolet uses /bd/property-post/<division>/<area>/<propertyId>/<category>.
Add readable URLs without breaking existing links.

Read first: scripts/listing-ssi.mjs, scripts/deploy/nginx-newtolet.conf (the /listdetails/ SSI block and /__seo/),
supabase/functions/listing-seo, supabase/functions/sitemap, and the migration
20261021120000_property_id_number_sequence_and_lookup.sql (numeric property_id lookup).

1. New public URL: /bd/property-post/<division-slug>/<area-slug>/<property_id>/<category-slug>/.
2. nginx: internally rewrite that pattern to /listdetails/index.html with the numeric id, so SSI still runs. The SSI
   include and listing-seo function must accept either the uuid or the numeric property_id.
3. Listdetails.jsx must read the id from either the query string or the path.
4. Canonical URL, og:url, the sitemap and every internal link (PropertyListingCard, similar listings, share button,
   Facebook auto-post in supabase/functions/facebook-page-post) switch to the new URL.
5. Old /listdetails/?id=<uuid> URLs keep working and get a canonical pointing at the new URL. Don't 301 them in nginx
   unless that can be done without a DB lookup.
6. A shared URL builder in src/lib with tests. Show me the nginx diff and the deploy steps.
```

## Prompt 7: Individual article pages

```
/article/ is one long page built from src/Component/Home/articleContent.js (ARTICLE_ITEMS). Thetolet has a blog with
one URL per article, which ranks in search.

1. Route app/(site)/article/[slug]/page.js with generateStaticParams() from ARTICLE_ITEMS (add a slug to each item).
2. Each article page: H1, published/updated date, reading time, body, related listings (by the article's area/category
   if it has one), related articles, breadcrumb, Article JSON-LD, share buttons.
3. /article/ becomes an index with cards linking to each article; keep the anchors (#refer-and-earn,
   #earn-by-finding-homes) working because /earnmoney/ links to them, or update those links.
4. Write 4 new original articles (en + bn) on: avoiding advance-payment scams, a renting checklist for bachelors in Dhaka,
   how the credit/unlock system works on NewTolet, how to earn with referrals and Order Home jobs.
5. Sitemap + tests.
```

## Prompt 8: Public Order Home landing

```
Order Home (/orderhome/, src/Component/Navber/CreateOrderForm.jsx) is NewTolet's paid "we find a home for you" service,
but visitors who are not logged in see no explanation of it. Thetolet sells it on the home page with price, delivery time
and refund policy.

1. Read CreateOrderForm.jsx, src/services/orderService.js, supabase/migrations/20261116090000_customer_orders.sql and
   src/lib/customerOrderForm.js to find the real fee, timeline and refund rules. If they are not in code, ask me for them
   instead of inventing them.
2. Logged-out visitors on /orderhome/ see a landing section first: how it works (3-4 steps), fee, delivery time, refund
   policy (link /refund/), FAQs, and a "Start order" button that goes to login with a return URL back to the form.
3. Add a compact Order Home promo section on the home page, between the category sections and the job feed.
4. en + bn strings. Metadata for /orderhome/ so it is indexable.
```

## Prompt 9: Home page extras

```
Add these sections to src/Component/Home/Home.jsx, each in a DeferredSection with a skeleton:

1. "Featured properties": listings with is_featured = true (column exists), newest first, max 12, horizontal carousel
   (swiper is already a dependency). Hide the section when there are none. Admin must be able to toggle is_featured in
   the property editor; add it if missing.
2. "Recently published" is already covered by the category sections, so leave that.
3. Stats strip: total approved listings, registered users, areas covered, years active. Compute real numbers
   (a Supabase RPC or the existing src/lib/propertyCounts.js); never hard-code inflated numbers.
4. App/PWA block: explain installing NewTolet on the phone (see Prompt 11 for the install button). Skip any app-store
   badge unless a real app exists.
5. Check the existing Feedback section shows only approved, real feedback (FEEDBACK_APPROVAL_SYSTEM.sql).
Keep the order: hero → category bar → featured → categories → Order Home promo → popular places → job feed → articles →
stats → feedback → about → app block.
```

## Prompt 10: Missing static pages

```
Thetolet has FAQ, Our Team, Affiliate Program, Disclaimer, DMCA and News Coverage pages. We have none of them.

Create, following the pattern of app/(site)/terms and src/Component/Home/PolicyPage.jsx + policyContent.js:
1. /faq/: 15-20 real questions about NewTolet (posting, approval, credits and unlocking, refunds, Order Home, referrals,
   safety, account). Base answers on what the code actually does; mark anything you are unsure about for me to check.
   Accordion UI + FAQPage JSON-LD.
2. /affiliate/: the referral program in detail (read src/services/referralService.js and IMPLEMENT_REFERRAL_SYSTEM_V2.sql
   for the real reward amounts and withdrawal rules). Link it from /earnmoney/.
3. /disclaimer/ and /dmca/: standard text adapted to NewTolet, owner contact from src/config/siteContact.js.
4. /team/ and /news/: create only the components with an empty data file (src/data/team.js, src/data/press.js), and keep
   them out of nav until I fill in real people and press links.
5. Add the live pages to the footer (src/Component/Home/Footer.jsx), nginx redirects for common aliases
   (/faqs, /disclaimer-policy, /dmca-policy, /affiliate-program), and the sitemap. en + bn. Run the route-link test.
```

## Prompt 11: Floating contact widget + PWA install

```
1. Floating contact button (bottom-right, above the mobile bottom nav) that opens WhatsApp, Messenger and Call options.
   Numbers/URLs come from src/config/siteContact.js and src/utils/whatsapp.js; add a Messenger page URL setting if missing.
   Hidden on /admin*, /dashboard and the add-property flow. Accessible (focus trap, Esc closes, aria labels).
2. PWA: public/site.webmanifest and public/sw.js exist. Check the manifest is complete (name, short_name, icons
   192/512 maskable, start_url, display standalone, theme colour) and the service worker is registered
   (tests/serviceWorker.test.mjs, scripts/deploy/nginx-sw-no-cache.sh). Add an "Install app" button that uses
   beforeinstallprompt on Android/Chrome and shows Add-to-Home-Screen instructions on iOS. Put it in the footer, the
   user menu and the home app block.
3. Make sure the CSP still allows everything (scripts/deploy/nginx-newtolet-security-headers.conf).
```

---

## Deliberately not copied

- **Thousands of keyword pages** ("Tolet Book In Noakhali", "Varar Bazar In Matikata"…). Thetolet does this, but Google's
  spam policies treat mass-generated pages with little unique content as doorway pages. Prompt 5 builds area pages only where
  real listings exist, which gets most of the benefit with much less risk.
- **Their testimonials, stats, press logos and copy.** Use NewTolet's own, or leave the section out.
- **Career listings.** Add jobs only when NewTolet is actually hiring.

## Already better on NewTolet (keep)

Advanced filters (rent range, rooms, baths, district/area/sub-area, property type, occupancy, sort), English/Bangla toggle,
map on listings and details, Copy Property ID, safety tips, shareable filter URLs.

# Search flow: "calling data but nothing updates" — root cause and fix

**Date:** 21 October 2026 · **Branch/tree:** uncommitted working tree (shared with the i18n work; no commits made)

## 1. Reproduction (before any change)

Headless Chrome against the running dev server (`http://localhost:3000`), 390×844 mobile emulation, then desktop:

| Step | Observed |
|---|---|
| Direct load `/propertylist2/?search=Dhaka` | page renders, skeletons clear in < 2 s, count line "Found 0 properties for "Dhaka"", "No properties found" |
| Overlay search "Sylhet" from that page | URL becomes `/propertylist2/?search=Sylhet`, count line updates to "…for "Sylhet"", still 0 results |
| Console | `net::ERR_NAME_NOT_RESOLVED` ×4, "Error searching properties: Supabase is currently unreachable", "Error fetching all properties: …" |
| User's console | `AuthRetryableFetchError` from `authService.getSession` via `AuthContext.syncAuthState` |

So the search mechanics (input → submit → URL → navigation → parsing) worked; the data never arrived and the UI presented that as a legitimate empty result.

## 2. Root cause

**Primary (environment):** the Supabase host in `.env.local` — `ohzpdfuijcajoyyrofzp.supabase.co`, the only project reference in the repository — does not resolve in DNS (NXDOMAIN on the local resolver, 8.8.8.8 and 1.1.1.1; `supabase.com` resolves; general internet works; dev logs from Sep/Oct show no such failures). Every data and auth request fails. **This can only be fixed by configuring a live Supabase project URL and anon key in `.env.local`.**

**Secondary (code):** `searchProperties` swallowed the failure and returned `[]` (or stale cache) without telling the UI, so `Homelist` rendered "Found 0 properties / No properties found", and the auth service logged the network failure with `console.error`, which the Next dev overlay promotes to an error card on every page.

**Also found while tracing (real defects with a working backend):**
- Property-type search options (`Office`, `Room`, …) did not match the values the Add/Edit forms store (`Office Space`, `Unit`, …); the server used exact `eq`, so "Office" always returned nothing and `?propertyType=Office%20Space` silently became "All".
- 28 duplicated area/sub-area names in the location bundle; the lookup kept the last one, so choosing "Mirpur" searched Kushtia (Khulna) instead of Dhaka.
- Category search used exact `eq` while the homepage used alias normalisation (`family`, `office space`, `hostel/mess`), so legacy rows appeared on the homepage but not in search.
- Every filter change on the results page used `replace`, so Back skipped all searches; the "same URL" guard compared a slash-less href with the slashed `location.href`, so it never matched and every submit refetched.
- Router shim: navigation `state` was stored under `/login?x` but read under `/login/`, and the navbar's `useLocation` consumed (deleted) it before the page read it; the deferred read was also cancelled under React Strict Mode. Result: "return to the page you came from" after login never worked off the homepage.
- The search overlay always opened empty on the results page, so an overlay search wiped the current filters; on mobile only the keyword row was inside the `<form>`, so Enter in the rent fields did nothing; mobile Cancel left the desktop overlay flag set.
- A category click on the results page fetched twice (prop change + context sync).
- Keyword + amenity searches ("dhaka lift") tagged amenity rows with the whole query and the merge kept the un-enriched copy, so the every-word post-filter misjudged both ways.

## 3. Files changed

| File | Change |
|---|---|
| `src/services/propertyCatalogService.js` | `searchPropertiesWithStatus()` returns `{ properties, source, error }`; `searchProperties()` wraps it (array contract kept). Recoverable failures log `warn` not `error`. Category/property-type filters use `.in()` with alias lists; offline fallback uses the same alias matchers. Amenity matches tagged with the matched amenity names; `mergePropertiesById` keeps that enrichment. |
| `src/services/supabaseClient.js` | `clearSupabaseConnectionFailureMark()` so a user Retry really retries inside the 30 s failure window. |
| `src/services/authService.js` | `getSession` / `getCurrentUser`: network/unreachable failures are `console.warn` in development instead of `console.error`. |
| `src/Component/Home/Homelist.jsx` | Explicit states: error (headline, hint, Retry), cached-results notice, genuine empty state; no result count is reported to the search log while the service is down; one fetch per filter change (search-mode filters no longer depend on context values). |
| `src/Component/Navber/Propertylist2.jsx` | Submit and category picks push history; chip clears and Clear all replace; canonical href comparison; result count reset when the URL changes. |
| `src/lib/react-router-dom.jsx` | `normalizeHrefKey()`; navigation state keyed canonically, read without deleting (cleared by the next state-less navigation), read synchronously; same-URL check uses canonical form; unused helper removed. |
| `src/Component/Home/NavSearchOverlay.jsx` | Seeds from the current URL on a results page; single `closeOverlay` for every X/Cancel/backdrop; the whole mobile panel is the form (`#mobile-search-form`), bottom Search is `type=submit`. |
| `src/lib/propertyTypes.js` (new) | `PROPERTY_TYPE_OPTIONS`, `PROPERTY_TYPE_ALIASES` (`Office` ↔ `Office Space`), `getPropertyTypeValues`, `resolvePropertyTypeOption`, `matchesPropertyTypeOption`. |
| `src/Component/Home/propertySearch.js` | Re-exports the options; `parseSearchFilters` / `updateSearchFilters` resolve stored spellings to options; client matching uses the alias matcher; location index keeps candidate lists for duplicate names; `buildLocationTrail` infers parents only when unambiguous and never drops a chosen area; `resolvePropertyLocation` same rule. |
| `src/lib/propertyCategories.js` | `getPropertyCategoryValues()` for `.in()` queries. |
| `src/i18n/locales/en/search.js`, `bn/search.js` | `search.results.errorHint`, `search.results.cachedNotice` (EN/BN; key parity verified). |

Not changed (documented): service-worker per-URL document cache, unbounded localStorage snapshots, full-catalogue download on search pages, legacy `/?page=` redirect, scroll-to-top on popstate, `setSearchParams` empty-value serialisation, `minPrice > maxPrice`, whole-site client rendering behind the Home skeleton (needs Suspense boundaries around navbar/rail; separate follow-up).

## 4. Verification performed

Headless Chrome (playwright-core, Google Chrome 155) against the running dev server on `:3000`, fresh browser context per scenario, no files written. The "cached" scenarios seed the app's own localStorage snapshot cache with an obviously fake fixture (`qa-fixture-…` ids) so the client-side fallback has data while Supabase is unreachable. **Result: 20 of 20 checks passed.**

| Scenario | Checks |
|---|---|
| Backend unreachable, no cache (390 px) | error headline "Unable to search properties right now." + hint + Retry shown; no "Found 0 properties"; no `console.error` for search/session; Retry re-renders without a page error |
| Cached fallback (1280 px) | "Showing saved results…" notice with 12 cards |
| Keyword search from the homepage overlay (Enter) | navigates to `/propertylist2/?search=Dhaka` |
| Category chip on results page | URL gains `category=Family`, history length +1 (push), one fetch |
| Clear the category chip | URL loses `category`, history length unchanged (replace) |
| Direct URL with stored spelling, ambiguous area and invalid params (`propertyType=Office%20Space&upazilla=Mirpur&minPrice=abc&rooms=&sort=bogus`) | no page error; type select shows `Office`; chips are Keyword/Area/Category/Type with no Kushtia; keyword and category kept |
| Overlay opened on the results page | prefilled with the URL's keyword and category (`aria-pressed`); Cancel closes it |
| Back / forward | Back returns to the previous search URL, Forward restores the later one |
| Mobile overlay (390 px) | Enter inside the max-rent field submits (`maxPrice=15000`); Cancel closes both overlays (none visible after widening to 1280 px) |
| Protected route → login | `/addproperty/` redirects to `/login/` and the return path is stored under the canonical key `__next_navigation_state__:/login` |

Static checks:
- `npx eslint` on every changed file: 0 errors (pre-existing warnings only).
- `node scripts/i18n-check-keys.mjs`: EN and BN key sets match (1430 keys each).
- `npm run build` (static export) on an isolated copy of the patched tree (so the running dev server was not disturbed): exit 0, compiled in 38.7 s, `out/` regenerated.

## 5. Remaining limitations

- The server-side `.in()` filter changes (category and property-type aliases) and the amenity-merge change cannot be exercised against the live database until a valid Supabase project is configured; they were verified through the client-side fallback path (fixture-seeded cache) and code review only.
- No automated test runner exists in the project; verification is a headless-Chrome script (`tmp/qa-search-verify.mjs`, gitignored) plus the existing QA harness journeys.
- `Room` is not aliased to the stored `Unit` type (product decision); `Factory`, `Hostel`, `Hotel`, `Building` remain unselectable in search as before.

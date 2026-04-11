# Migration Summary

## What Changed
- Replaced the Vite SPA runtime with **Next.js 16.2.2 App Router**
- Added `app/` route structure, root layout, global providers, and `app/not-found.js`
- Kept the existing React UI and business logic largely intact by mounting the old screens from new Next route files
- Added a lightweight `react-router-dom` compatibility shim at `src/lib/react-router-dom.jsx` so existing navigation-heavy screens did not require a full rewrite
- Preserved the existing Supabase browser SDK integration and client-side auth/session flow
- Preserved the existing `public/sw.js` service worker and moved registration into `components/app/ServiceWorkerRegistration.jsx`
- Migrated Tailwind from the Vite plugin path to Next-compatible PostCSS setup
- Removed obsolete Vite/SPA entry files and fallback rewrite artifacts

## Old Route -> New Route Mapping
| Old Route | New Next Route |
|---|---|
| `/` | `app/(site)/page.js` |
| `/registration` | `app/(site)/registration/page.js` |
| `/login` | `app/(site)/login/page.js` |
| `/forgot-password` | `app/(site)/forgot-password/page.js` |
| `/reset-password` | `app/(site)/reset-password/page.js` |
| `/orderhome/:id` | `app/(site)/orderhome/[id]/page.js` |
| `/addproperty` | `app/addproperty/page.js` |
| `/edit-property/:propertyId` | `app/(site)/edit-property/[propertyId]/page.js` |
| `/earnmoney` | `app/(site)/earnmoney/page.js` |
| `/propertylist` | `app/(site)/propertylist/page.js` |
| `/propertylist2` | `app/(site)/propertylist2/page.js` |
| `/my-properties` | `app/(site)/my-properties/page.js` |
| `/my-orders` | `app/(site)/my-orders/page.js` |
| `/listdetails/:id` | `app/(site)/listdetails/[id]/page.js` |
| `/book/:id` | `app/(site)/book/[id]/page.js` |
| `/book/buy-credits` | `app/(site)/book/buy-credits/page.js` |
| `/about` | `app/(site)/about/page.js` |
| `/contact` | `app/(site)/contact/page.js` |
| `/dashboard` | `app/dashboard/page.js` |
| `/admin` | `app/admin/page.js` |
| `/admin-dashboard` | `app/admin-dashboard/page.js` |
| `/payment-confirm` | `app/payment-confirm/page.js` |

## Components Marked or Mounted as Client Components
- `app/providers.js`
- `app/(site)/layout.js`
- `app/addproperty/page.js`
- all route wrapper pages under `app/`
- `components/app/ServiceWorkerRegistration.jsx`
- `src/lib/react-router-dom.jsx`

## Libraries Replaced or Removed
- Removed Vite runtime/build usage
- Removed `@tailwindcss/vite`
- Removed `@vitejs/plugin-react`
- Removed `react-router-dom` package dependency and replaced it with a local compatibility shim
- Added `next`
- Added `@tailwindcss/postcss`
- Added `postcss`

## SSR / Client-Only Limitations
- Most legacy screens are mounted with `dynamic(..., { ssr: false })`
- This was necessary because the current app depends heavily on:
  - `localStorage`
  - `window`
  - `document`
  - URL hash/query parsing in client code
  - direct Supabase browser SDK calls
- Protected/admin routes still use client-side guards rather than server middleware
- Public pages can be optimized toward SSR/ISR later, but that requires refactoring browser-only state and route assumptions first

## Environment Variable Notes
- Next-compatible env names are now expected:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_GEOAPIFY_API_KEY`
  - `NEXT_PUBLIC_ENABLE_DUMMY_DATA`
- `.env.local.example` was updated
- Existing local env files were duplicated to include `NEXT_PUBLIC_*` counterparts so the migration can build without manual secret re-entry

## Remaining Manual Follow-Ups
- Review and optionally reduce the remaining ESLint warnings in legacy admin and property-management files
- Consider replacing the local `react-router-dom` shim with direct `next/link` / `next/navigation` usage over time
- Decide whether to migrate auth to a cookie/middleware-based approach for stronger server-aware protection
- Revisit client-only route mounts if SSR/SEO improvements become a priority
- Validate deployment-specific caching headers if you need custom production cache behavior beyond Next defaults

## Testing Notes
- `npm run build`: passes
- `npm run lint`: passes with warnings only
- No automated test suite exists in the repo, so no unit/integration tests were run

## Known Risks / Unresolved Items
- Auth and admin protection remain browser-side, matching the old app but not ideal for hard security boundaries
- Several legacy screens still have hook dependency and unused-variable warnings
- The app currently favors compatibility over deep Next-native optimization
- Some pages that would ideally be server-rendered remain client-only until browser-state coupling is reduced

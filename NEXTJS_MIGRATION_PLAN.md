# Next.js Migration Plan

## 1. Router Choice
- Use **Next.js App Router**
- Keep the project in **JavaScript**
- Preserve existing client-side Supabase auth/session logic for the initial migration

## 2. Recommended Folder Structure
```text
app/
  layout.js
  globals.css
  not-found.js
  providers.js
  (site)/
    layout.js
    page.js
    about/page.js
    contact/page.js
    earnmoney/page.js
    login/page.js
    registration/page.js
    forgot-password/page.js
    reset-password/page.js
    propertylist/page.js
    propertylist2/page.js
    my-properties/page.js
    my-orders/page.js
    dashboard/page.js
    admin/page.js
    admin-dashboard/page.js
    payment-confirm/page.js
    book/
      [id]/page.js
      buy-credits/page.js
    listdetails/[id]/page.js
    orderhome/[id]/page.js
  addproperty/
    page.js
  edit-property/
    [propertyId]/page.js
components/
  app/
    ClientAuthGuard.jsx
    ClientAdminGuard.jsx
    ServiceWorkerRegistration.jsx
```

## 3. Route Mapping
| Old Route | Next Route File |
|---|---|
| `/` | `app/(site)/page.js` |
| `/about` | `app/(site)/about/page.js` |
| `/contact` | `app/(site)/contact/page.js` |
| `/earnmoney` | `app/(site)/earnmoney/page.js` |
| `/login` | `app/(site)/login/page.js` |
| `/registration` | `app/(site)/registration/page.js` |
| `/forgot-password` | `app/(site)/forgot-password/page.js` |
| `/reset-password` | `app/(site)/reset-password/page.js` |
| `/propertylist` | `app/(site)/propertylist/page.js` |
| `/propertylist2` | `app/(site)/propertylist2/page.js` |
| `/my-properties` | `app/(site)/my-properties/page.js` |
| `/my-orders` | `app/(site)/my-orders/page.js` |
| `/listdetails/:id` | `app/(site)/listdetails/[id]/page.js` |
| `/orderhome/:id` | `app/(site)/orderhome/[id]/page.js` |
| `/book/:id` | `app/(site)/book/[id]/page.js` |
| `/book/buy-credits` | `app/(site)/book/buy-credits/page.js` |
| `/dashboard` | `app/dashboard/page.js` |
| `/admin` | `app/admin/page.js` |
| `/admin-dashboard` | `app/admin-dashboard/page.js` |
| `/payment-confirm` | `app/payment-confirm/page.js` |
| `/addproperty` | `app/addproperty/page.js` |
| `/edit-property/:propertyId` | `app/edit-property/[propertyId]/page.js` |

## 4. Layout Migration Plan
- Root `app/layout.js`
  - import global CSS
  - render `<html>` and `<body>`
  - mount shared providers
- `app/(site)/layout.js`
  - render current navbar and footer shell
  - keep current route-based footer suppression out of this group by placing `/addproperty` outside `(site)`
- `app/addproperty/page.js`
  - render add-property screen without footer, matching current `Main.jsx` behavior
- Standalone pages outside the site layout if needed:
  - `payment-confirm`
  - `admin`
  - `admin-dashboard`
  - `dashboard`

## 5. Shared Component Migration Plan
- Keep existing `src/Component/**` and `src/components/**` files where possible
- Update imports from `react-router-dom` to:
  - `next/link`
  - `next/navigation`
- Keep component names and data contracts stable
- Add small wrapper components for auth/admin route protection instead of rewriting each screen’s business logic

## 6. State Management Compatibility Plan
- Keep `Listprovaider` as the app-wide provider in `app/providers.js`
- Keep `AddPropertyProvider` local to add/edit property flows
- Leave `AuthContext` unused unless required by migrated code
- Preserve current `localStorage` keys and event-driven navbar behavior

## 7. Data Fetching Migration Plan
- Keep current Supabase browser SDK data fetching in the first pass
- Do not move API calls to server components yet
- Preserve current loading, error, and redirect behavior
- Allow future follow-up SSR/ISR optimization once browser-only dependencies are reduced

## 8. Auth Migration Plan
- Preserve current client auth flow
- Replace `PrivateRouter` with `ClientAuthGuard`
- Replace `AdminRoute` with `ClientAdminGuard`
- Use client redirects via `next/navigation` router methods
- Keep reset-password token parsing on the client

## 9. Environment Variable Migration Plan
- Rename env vars:
  - `VITE_SUPABASE_URL` -> `NEXT_PUBLIC_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY` -> `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `VITE_GEOAPIFY_API_KEY` -> `NEXT_PUBLIC_GEOAPIFY_API_KEY`
  - `VITE_ENABLE_DUMMY_DATA` -> `NEXT_PUBLIC_ENABLE_DUMMY_DATA`
- Update `.env.local.example` to show Next-compatible names
- Update all `import.meta.env` reads to `process.env`

## 10. Static Assets and Public Folder Plan
- Keep static JSON and service worker in `public/`
- Keep image assets in existing locations unless import paths require a move
- Remove SPA-only fallback files not needed by Next routing
- Recreate cache headers through `next.config.js` if still useful

## 11. SEO and Metadata Plan
- Add base metadata in `app/layout.js`
- Add per-page metadata only where it is trivial and safe
- Keep current public route titles/descriptions minimal instead of introducing broad content changes

## 12. Error, Loading, and Not-Found Plan
- Use `app/not-found.js` for the catch-all replacement
- Preserve current in-screen loading states
- Add route-level `loading.js` only if a page obviously benefits and it does not increase scope

## 13. Testing and Verification Plan
- Run `npm run lint`
- Run `npm run build`
- Manually verify:
  - public browsing routes
  - auth flows
  - protected routes
  - admin routes
  - property create/edit/delete
  - payment flows
  - service worker registration

## 14. Step-by-Step Implementation Order
1. Add `MIGRATION_AUDIT.md` and `NEXTJS_MIGRATION_PLAN.md`
2. Replace Vite dependencies/scripts with Next.js equivalents
3. Add Next config, PostCSS config, App Router root files, and providers
4. Move global CSS to `app/globals.css`
5. Add route files matching current URLs
6. Add client auth/admin guard components
7. Replace `react-router-dom` imports and APIs across screens
8. Convert env variable access and update `.env.local.example`
9. Preserve and re-register the service worker from a client component
10. Remove obsolete Vite/SPA entry files and rewrite config
11. Run lint/build, fix issues, and verify behavior
12. Write `MIGRATION_SUMMARY.md`

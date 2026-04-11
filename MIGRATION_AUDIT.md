# React to Next.js Migration Audit

## 1. Current Stack Summary
- Framework: React `19.2.0`
- Build tool: Vite via `rolldown-vite@7.2.5`
- Language: JavaScript with JSX
- Routing: `react-router-dom@7.10.0` using `createBrowserRouter`
- State: custom Context provider in `src/Component/Route/Listprovaider.jsx`, local state, `localStorage`
- Forms: `react-hook-form` on auth/reset pages, custom controlled forms elsewhere
- Validation: custom validators in `src/utils/formValidation.js`
- Styling: Tailwind CSS 4, DaisyUI 5, plain CSS files, Swiper CSS imports
- Data/API layer: direct Supabase browser SDK calls from `src/services/*`
- Auth: Supabase auth plus mirrored `localStorage` session/user state
- i18n: none
- Testing: no automated test framework configured
- Linting: ESLint flat config in `eslint.config.js`
- PWA/service worker: manual `public/sw.js` registration from `src/main.jsx`

## 2. Route Inventory
| Current Route | Screen | Classification | Current Guard |
|---|---|---|---|
| `/` | `Home` | public | none |
| `/registration` | `Registration` | auth page | none |
| `/login` | `Login` | auth page | none |
| `/forgot-password` | `ForgotPassword` | auth page | none |
| `/reset-password` | `ResetPassword` | auth page with URL token parsing | none |
| `/orderhome/:id` | `Orderhome` | dynamic | none |
| `/addproperty` | `Addproperty` | protected | `PrivateRouter` |
| `/edit-property/:propertyId` | `EditProperty` | dynamic protected | `PrivateRouter` |
| `/earnmoney` | `Earnmoney` | public | none |
| `/propertylist` | `Propertylist` | public | none |
| `/propertylist2` | `Propertylist2` | public | none |
| `/my-properties` | `MyProperties` | protected | `PrivateRouter` |
| `/my-orders` | `MyOrders` | protected | `PrivateRouter` |
| `/listdetails/:id` | `Listdetails` | dynamic | none |
| `/book/:id` | `Book` | dynamic | unguarded in router, component handles auth |
| `/book/buy-credits` | `Book` | protected static | `PrivateRouter` |
| `/about` | `About` | public | none |
| `/contact` | `Contact` | public | none |
| `/dashboard` | `Dashboard` | client-only app page | none in router |
| `/admin` | `Admin` | admin | `AdminRoute` |
| `/admin-dashboard` | `AdminDashboard` | admin | `AdminRoute` |
| `/payment-confirm` | `PaymentConfirmPage` | payment callback/query page | none |
| `*` | redirect to `/` | fallback redirect | router-level |

## 3. Page-by-Page Migration Mapping
- `/` -> `app/(site)/page.js`
- `/registration` -> `app/(site)/registration/page.js`
- `/login` -> `app/(site)/login/page.js`
- `/forgot-password` -> `app/(site)/forgot-password/page.js`
- `/reset-password` -> `app/(site)/reset-password/page.js`
- `/orderhome/:id` -> `app/(site)/orderhome/[id]/page.js`
- `/addproperty` -> `app/addproperty/page.js`
- `/edit-property/:propertyId` -> `app/edit-property/[propertyId]/page.js`
- `/earnmoney` -> `app/(site)/earnmoney/page.js`
- `/propertylist` -> `app/(site)/propertylist/page.js`
- `/propertylist2` -> `app/(site)/propertylist2/page.js`
- `/my-properties` -> `app/(site)/my-properties/page.js`
- `/my-orders` -> `app/(site)/my-orders/page.js`
- `/listdetails/:id` -> `app/(site)/listdetails/[id]/page.js`
- `/book/:id` -> `app/(site)/book/[id]/page.js`
- `/book/buy-credits` -> `app/(site)/book/buy-credits/page.js`
- `/about` -> `app/(site)/about/page.js`
- `/contact` -> `app/(site)/contact/page.js`
- `/dashboard` -> `app/dashboard/page.js`
- `/admin` -> `app/admin/page.js`
- `/admin-dashboard` -> `app/admin-dashboard/page.js`
- `/payment-confirm` -> `app/payment-confirm/page.js`
- `*` -> `app/not-found.js`

## 4. Component Architecture Notes
- Real app entrypoint is `src/main.jsx`; `src/App.jsx` is unused Vite starter code.
- Shared site wrapper is `src/Component/Route/Main.jsx`, which renders navbar, children, optional footer, and route-change scroll-to-top logic.
- Navbar and footer are central shared UI dependencies.
- Property browsing depends on `Listprovaider` for global property list, auth state, category selection, and price filter selection.
- Add/Edit property flows depend on `AddPropertyContext` for draft persistence and multi-step state.
- Admin UI is a large monolithic client page (`src/Component/Home/Admin.jsx`) plus supporting admin components.
- Several UI files contain browser-only behaviors at render/effect time and must stay client-side in the first migration pass.

## 5. State Management Notes
- Global app provider: `src/Component/Route/Listprovaider.jsx`
  - fetches approved properties from Supabase
  - tracks current user from Supabase session
  - stores selected category/price filters
- Add-property wizard provider: `src/contexts/AddPropertyContext.jsx`
  - persists draft form state to `localStorage`
- `src/contexts/AuthContext.jsx` exists but is not the main auth source in current routing/UI flow
- Common persistence patterns:
  - `localStorage.user`
  - `localStorage.authToken`
  - `localStorage.savedProperties`
  - `localStorage.currentTransaction`
  - `localStorage.admin_credit_packages`
  - `localStorage.admin_credit_costs`
  - `localStorage.autoApproveProperties`
  - `localStorage.addPropertyFormDraft`

## 6. Styling Migration Notes
- Global styles live in `src/index.css`
- Tailwind 4 is configured via CSS directives and Vite plugin
- DaisyUI is loaded via `@plugin "daisyui";`
- Route-specific CSS files:
  - `src/Component/Home/Cover.css`
  - `src/Component/Route/Login.css`
- Swiper CSS is imported directly inside `Cover.jsx`
- Existing design should be preserved without a visual rewrite

## 7. API and Data Fetching Notes
- Supabase client is created in `src/services/supabaseClient.js` using `import.meta.env.VITE_*`
- Service layer is browser-oriented and directly imported by screens
- Public property list is fetched client-side through `getAllProperties()`
- Property detail page reads from the provider list rather than doing dedicated route-level fetching
- Admin, payment, inquiry, cover photo, feedback, order, and auth flows all call Supabase from the browser
- `List.jsx` fetches `public/Category.json`
- Location selection uses `src/thetolet_locations_bundle.json` and `src/utils/bangladeshLocations.js`

## 8. Auth Migration Notes
- Current auth model is client-side:
  - login writes `user` and `authToken` to `localStorage`
  - logout clears both and dispatches browser events
  - admin route reads `localStorage.user.is_admin` directly
  - private route reads Supabase session state from `Listprovaider`
- Password reset relies on Supabase recovery tokens in URL hash or query params
- This architecture is compatible with Next.js only if these screens remain Client Components
- For low-risk migration, keep current client-side auth/session approach instead of introducing cookie-based middleware auth

## 9. Risk List
- Extensive `react-router-dom` usage across navbar, auth, property, dashboard, and admin screens
- Heavy browser-only dependencies:
  - `window`
  - `document`
  - `navigator`
  - `location`
  - `localStorage`
  - `history`
- `ResetPassword` depends on direct URL hash parsing and `window.location`
- `AdminRoute` reads `localStorage` during render
- `PrivateRouter` depends on client auth state
- Navbar auth/menu logic uses custom `window` events and direct DOM listeners
- Environment variables use Vite naming and must be converted
- Current Vercel/static SPA rewrite files conflict with Next.js routing:
  - `public/404.html`
  - `public/_redirects`
  - `vercel.json` rewrite to `/index.html`
- Service worker registration currently lives in the Vite entry file
- Most pages are not SSR-safe in their current form

## 10. Recommended Migration Strategy
- Use Next.js App Router
- Keep JavaScript, not TypeScript
- Preserve current Supabase + `localStorage` auth/session pattern for the first migration pass
- Use Server Components only for route/layout shells by default
- Keep most existing screens as Client Components
- Replace React Router APIs with Next navigation APIs
- Recreate route guards as client-side guard components
- Keep the current UI, services, and data shape with minimal rewrites
- Preserve `public/sw.js` and re-home registration into a client component

## 11. Estimated Impact Areas
- `package.json`, lockfile, build scripts
- Tailwind/PostCSS/Next config
- Global entrypoints and app shell
- Every screen importing `react-router-dom`
- Supabase env access
- Client guard logic
- Static deployment config and public fallback files

## 12. Checklist of Files and Features to Verify After Migration
- Login, logout, and password reset flows
- Referral registration flow
- Property list filters and search UI
- Property detail page rendering and image gallery
- Add property draft persistence, upload, and submit flow
- Edit property load/save flow
- My properties and delete flow
- My orders and payment flow
- Buy credits flow and payment confirmation
- Dashboard profile and saved property state
- Admin access control and admin panels
- Cover photo carousel, feedback list, and category loading
- Service worker registration in production
- Supabase env variables and API calls
- Asset loading, CSS, Swiper, and responsive layout

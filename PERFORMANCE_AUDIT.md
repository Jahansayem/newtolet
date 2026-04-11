# Performance Audit

## Biggest Bottlenecks Ranked By Impact

1. App-wide property fetching in [`app/providers.js`](D:\New Project\eight\app\providers.js) via [`src/Component/Route/Listprovaider.jsx`](D:\New Project\eight\src\Component\Route\Listprovaider.jsx)
   - The root client provider fetched the full approved property list and auth state for every route.
   - This inflated hydration cost and added an unnecessary Supabase round-trip to admin, dashboard, auth, and static pages.

2. Client-only route wrappers with `dynamic(..., { ssr: false })`
   - Most routes in `app/` were thin client shells that disabled SSR for the actual page component.
   - This delayed first render until the client bundle loaded and reduced the value of the App Router migration.

3. Client-only shared site layout
   - [`app/(site)/layout.js`](D:\New Project\eight\app\(site)\layout.js) was a client component and dynamically mounted navbar/footer with `ssr: false`.
   - Every public route paid for layout hydration and lost server-first shell rendering.

4. Detail routes loading one property by scanning the full list
   - [`src/Component/Home/Listdetails.jsx`](D:\New Project\eight\src\Component\Home\Listdetails.jsx) and [`src/Component/Navber/Orderhome.jsx`](D:\New Project\eight\src\Component\Navber\Orderhome.jsx) depended on the global property list instead of fetching one property directly.
   - This turned single-record pages into full-list pages.

5. Large client components in shared paths
   - [`src/Component/Home/Navber.jsx`](D:\New Project\eight\src\Component\Home\Navber.jsx), [`src/Component/Home/Admin.jsx`](D:\New Project\eight\src\Component\Home\Admin.jsx), and [`src/Component/Dashboard/Dashboard.jsx`](D:\New Project\eight\src\Component\Dashboard\Dashboard.jsx) are large, icon-heavy, stateful components.
   - The navbar is especially important because it sits on most site routes.

6. Repeated client-side auth/session checks
   - Navbar, contact, buy-credits, and private route logic each performed their own auth checks.
   - This added redundant async work and broader rerender surfaces.

7. Timer-based rerenders in list/detail views
   - Property list/detail components forced rerenders every 10 seconds only to update “time ago” labels.
   - This needlessly repainted large trees.

8. Sequential or broad service-layer fetching
   - Property service methods often fetched primary record, images, and amenities serially.
   - Admin dashboard stats also executed multiple count queries sequentially.

## Pages / Components Causing Most Slowness

- [`app/(site)/layout.js`](D:\New Project\eight\app\(site)\layout.js)
- [`app/providers.js`](D:\New Project\eight\app\providers.js)
- [`src/Component/Route/Listprovaider.jsx`](D:\New Project\eight\src\Component\Route\Listprovaider.jsx)
- [`src/Component/Home/Navber.jsx`](D:\New Project\eight\src\Component\Home\Navber.jsx)
- [`src/Component/Home/Listdetails.jsx`](D:\New Project\eight\src\Component\Home\Listdetails.jsx)
- [`src/Component/Navber/Orderhome.jsx`](D:\New Project\eight\src\Component\Navber\Orderhome.jsx)
- [`src/Component/Home/Admin.jsx`](D:\New Project\eight\src\Component\Home\Admin.jsx)
- [`src/Component/Dashboard/Dashboard.jsx`](D:\New Project\eight\src\Component\Dashboard\Dashboard.jsx)
- [`src/Component/Route/Book.jsx`](D:\New Project\eight\src\Component\Route\Book.jsx)

## Bundle-Size Suspects

- `react-icons` across many icon packs, especially in navbar, admin, dashboard, and property detail views.
- `browser-image-compression` imported eagerly in:
  - [`src/services/imageUploadService.js`](D:\New Project\eight\src\services\imageUploadService.js)
  - [`src/services/coverPhotoService.js`](D:\New Project\eight\src\services\coverPhotoService.js)
- `swiper` and related CSS in [`src/Component/Home/Cover.jsx`](D:\New Project\eight\src\Component\Home\Cover.jsx)
- Large client route components loaded via `dynamic(..., { ssr: false })`, which prevented useful SSR and increased route JS dependence.

## Hydration Suspects

- Root provider forcing app-wide client hydration.
- Client-only site layout with navbar/footer.
- Navbar search depending on the global property dataset.
- Dashboard/admin shells with large DOM trees and modal systems.

## Data-Fetching Inefficiencies

- Global property fetch on app mount.
- Detail routes relying on the global list instead of direct fetches.
- Repeated auth/session checks across multiple components.
- Sequential property-detail subqueries.
- Sequential admin dashboard stat queries.

## Rendering Inefficiencies

- `setInterval`-driven rerenders in list/detail pages.
- Context value changes from the root provider causing broad rerenders.
- Layout-wide hydration from client-only shared wrappers.
- Search derivation running inside the navbar against the full list.

## Quick Wins

- Remove root-level property fetching.
- Convert the shared site layout back to a server layout with a small client chrome wrapper.
- Remove `dynamic(..., { ssr: false })` from route wrappers.
- Move auth consumers to a dedicated auth provider.
- Fetch property detail pages directly by ID.
- Lazy-load image compression libraries only when uploads happen.

## Medium-Effort Improvements

- Split navbar search data from full property browsing state.
- Add route-level loading boundaries for dynamic pages.
- Parallelize more service-layer fetches.
- Replace more hot-path `<img>` usage with `next/image` where remote config is safe.

## Higher-Risk Improvements

- Rebuild public data fetching to use server components and server-side Supabase helpers.
- Replace the `react-router-dom` compatibility layer with native Next navigation patterns.
- Refactor admin/dashboard into smaller route segments instead of large single components.

## Recommended Implementation Order

1. Reduce root hydration and global fetching.
2. Restore server-first shared layout behavior.
3. Remove `ssr: false` route wrappers.
4. Move auth checks to a single provider.
5. Convert detail pages to direct record fetches.
6. Remove obvious rerender hotspots.
7. Lazy-load heavy upload-only libraries.
8. Add loading boundaries and re-verify build behavior.

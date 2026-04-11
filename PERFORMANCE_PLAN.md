# Performance Plan

## High Impact / Low Risk

### 1. Remove app-wide property fetching
- What is wrong now: the root provider fetches the full approved property list for every route.
- Why it is slow: this adds unnecessary network work and forces broad client hydration even on routes that do not render properties.
- Exact change: move auth into a lightweight root provider and scope the property list provider to property-browsing pages only.
- Expected impact: faster initial load and lower hydration cost on most routes.
- Compatibility risk: low if the property pages keep the existing context shape.

### 2. Restore server-first shared layout rendering
- What is wrong now: the public site layout is client-only and dynamically mounts navbar/footer with SSR disabled.
- Why it is slow: every site route waits on client JS for shared chrome.
- Exact change: make `app/(site)/layout.js` a server layout and move browser-only behavior into a small client wrapper.
- Expected impact: faster first paint and less layout hydration work.
- Compatibility risk: low if the wrapper preserves markup order and scroll behavior.

### 3. Remove `dynamic(..., { ssr: false })` route wrappers
- What is wrong now: many routes explicitly disable SSR for the actual page component.
- Why it is slow: users see content later and route transitions depend more heavily on JS.
- Exact change: import legacy page components directly from the route files instead of wrapping them in `ssr: false`.
- Expected impact: better first render and better route transition behavior.
- Compatibility risk: low to medium if any component implicitly depended on browser-only mount timing.

### 4. Unify auth access through one provider
- What is wrong now: navbar, contact, private route guards, and buy-credits each perform their own auth/session checks.
- Why it is slow: duplicate async work and inconsistent rerender triggers.
- Exact change: use the existing auth context at the root and migrate these consumers to `useAuth`.
- Expected impact: fewer duplicate auth calls and simpler rerender behavior.
- Compatibility risk: low.

### 5. Fetch property details directly by ID
- What is wrong now: detail pages depend on the full property list and use `find()` locally.
- Why it is slow: single-record pages pay for full-list fetches.
- Exact change: call `getPropertyById()` directly in detail flows and parallelize related subqueries.
- Expected impact: much better detail page efficiency and reduced dependency on global data.
- Compatibility risk: low.

### 6. Remove timer-based rerenders from list/detail pages
- What is wrong now: list and detail views rerender every 10 seconds for relative-time labels.
- Why it is slow: this repaints large trees without meaningful UX value.
- Exact change: compute relative time on render without background timers.
- Expected impact: lower CPU usage and fewer unnecessary rerenders.
- Compatibility risk: low.

### 7. Lazy-load image compression libraries
- What is wrong now: upload-only compression libraries are imported eagerly.
- Why it is slow: they increase the initial client bundle even on pages that never upload images.
- Exact change: dynamically import `browser-image-compression` inside upload/optimization functions.
- Expected impact: smaller initial JS for non-upload routes.
- Compatibility risk: low.

## High Impact / Medium Risk

### 1. Decouple navbar search from the global property context
- What is wrong now: navbar search relies on the shared list provider.
- Why it is slow: it encourages app-wide property prefetching.
- Exact change: load search data lazily inside the navbar when search is opened.
- Expected impact: public pages that do not browse properties stop paying for the full property dataset up front.
- Compatibility risk: medium because navbar state and auth handling live in the same large component.

### 2. Keep property-list context only where filters need it
- What is wrong now: the list context is also used as a quasi-auth provider.
- Why it is slow: it broadens the rerender surface and couples unrelated features.
- Exact change: keep the existing list context only for property browsing/filter UIs.
- Expected impact: lower shared rerender cost and simpler page composition.
- Compatibility risk: medium because add/edit flows currently call `refreshProperties()`.

### 3. Add loading boundaries on dynamic routes
- What is wrong now: several routes either use `fallback={null}` or have no route-segment loading UI.
- Why it is slow: route transitions feel blank and unresponsive while loading.
- Exact change: add `loading.js` files for the dynamic public routes and edit flow.
- Expected impact: better perceived performance.
- Compatibility risk: medium only if existing layouts depend on zero-height fallback behavior.

## Nice-To-Have Improvements

### 1. Replace more hot-path images with `next/image`
- What is wrong now: logos and key visual assets still use raw `<img>`.
- Why it is slow: image loading and sizing are less optimized than they could be.
- Exact change: move low-risk local assets first, defer remote property-image migration until remote patterns are validated.
- Expected impact: moderate improvement to layout stability and bandwidth.
- Compatibility risk: medium for remote property images.

### 2. Split oversized admin/dashboard components
- What is wrong now: large single-file client components own many tabs and modal states.
- Why it is slow: the routes load and hydrate more code than each tab needs.
- Exact change: move tab panels into lazy-loaded subcomponents.
- Expected impact: better route-specific bundle sizes.
- Compatibility risk: medium to high because the admin/dashboard code is dense and stateful.

### 3. Replace the React Router compatibility layer with native Next navigation
- What is wrong now: the migration still carries a React Router shim.
- Why it is slow: it adds abstraction and discourages server-first route composition.
- Exact change: migrate legacy components gradually to `next/link`, `useRouter`, and native search param handling.
- Expected impact: long-term architectural improvement more than immediate gain.
- Compatibility risk: high for this pass, so it is intentionally deferred.

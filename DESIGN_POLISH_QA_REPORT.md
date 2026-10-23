# NewTolet — Design Polish QA Report

**Date:** 22 October 2026 · **Branch:** `feature/bengali-i18n` (uncommitted) · **Scope:** screenshot-based refinement of the work described in `DESIGN_POLISH_IMPLEMENTATION_REPORT.md`.
**Method:** headless Chrome (playwright-core) against the dev server with the fixture dataset (`scripts/qa/fixture.mjs`) at 1440×900, 1280×800, 768×1024 and 390×844; a stored test user (`localStorage.user`, `is_admin: true`) for protected routes; dark mode via `localStorage.siteTheme`; 64 screenshots under `tmp/qa-screenshots/final/`. Fixes were limited to defects found in this pass; lint and build were re-run afterwards.

---

## 1. Issues found

| # | Page / state | Viewport | Issue | Severity | Evidence | Status |
|---|---|---|---|---|---|---|
| 1 | Home, results, detail — **dark mode** | 1280 | `--color-ink` was overridden to near-white in `html[data-theme='dark']`, so every ink **surface** (hero panel, selected category chip, footer, tab-bar badge) turned white with white text; the hero became unreadable and nav links (`text-ink/80`) vanished. | Critical (dark mode only) | `final/dark-home-1280.png` (first capture) | Fixed |
| 2 | Home — dark mode | 1280 | Skeleton placeholders stayed light grey (`bg-slate-200`) on the dark canvas, reading as a large blank block while listings load. | Medium | `final/dark-home-1280.png` (first capture) | Fixed |
| 3 | Login / Registration | 768 (also 1024-tall phones) | `.auth-shell` used `min-height: max(80vh, 720px)`, so a 200 px band of plain canvas appeared under the decorated backdrop. | Medium | `final/login-768.png` (first capture) | Fixed |
| 4 | Admin dashboard | 1280 / 390 | Four stat tiles used saturated indigo / emerald / violet / cyan gradients and 28 px radii — the only gradients left in the product, off the token system. | Medium | `final/admin-1280.png` (first capture) | Fixed |
| 5 | Admin dashboard | 1280 / 390 | Template branding and migration copy ("TAILADMIN SHELL / Admin Control / NT" avatar, "TAILADMIN MIGRATION — All admin operations now live under one navigation shell.") shown to admins. | Low (copy) | `final/admin-1280.png` | Remaining — content decision |
| 6 | Dashboard, My Properties, Wallets, Add Property, Buy Credits | 1280 / 390 | Could not be rendered: with no Supabase session the auth context clears the stored user and `PrivateRouter` redirects to `/login` (only `AdminRoute` honoured the stored admin flag). | — | `final/myproperties-1280.png` shows the login page | Not verifiable here (needs credentials) |
| 7 | Home loading state (no fixture) | 1280 | Category skeleton appears as one tall grey panel for the first ~600 ms before card skeletons mount. No layout shift measured once content arrives (hero and header heights are fixed). | Low | `final/loading-home-1280.png` | Accepted (deferred section fallback) |
| 8 | 404 page | 1280 | Renders without header or footer (standalone route) — functional but a dead end. | Low | `final/notfound-1280.png` | Remaining |
| 9 | Keyboard focus | 1280 / 390 | First measurement showed no ring on a `.ui-btn`; re-measured after the 150 ms transition: 4 px brand ring on all `.ui-btn` variants, 2 px outline on links, chips and the language toggle. | — | `final/focus-ring-1280.png`; console probe | Verified, no change needed |
| 10 | Property detail | 768 | Skeleton captured at 2.5 s; re-captured at 5 s shows the full page. Loading skeleton matches the final layout (gallery 16:9, title card, sidebar). | — | `final/detail-768.png` | Verified |

Everything else in the checklist passed: no horizontal overflow at any width (document width = viewport on all 24 public cells), no overlap between the sticky bars and content, one button and one input style everywhere on the public site, consistent 12/16/24 px radii, card hover is shadow-only, dialogs (search, report, unlock, confirm) trap focus and close on Escape/backdrop, the mobile drawer and search sheet open from both the header and the tab bar, empty / error / unavailable states render with the shared `EmptyState` and note styles, Bengali mode wraps correctly at 390.

---

## 2. Fixes applied

| File | Change |
|---|---|
| `src/index.css` | Dark mode: `--color-ink` is no longer overridden (it is a surface colour); ink-coloured **text** is remapped instead via `html[data-theme='dark'] [class*='text-ink']`, plus `.ui-price`, `.ui-id-ticket`, `.ui-label`, `.ui-note`, `.ui-btn-secondary`, `.ui-btn-ghost`, `.ui-chip` → `--site-text`; `.bg-slate-200` (skeletons) → `--site-surface-muted` in dark mode. |
| `src/Component/Route/Login.css` | `.auth-shell { min-height: max(100dvh, 720px) }` so the backdrop fills the viewport at every size. |
| `src/components/admin-panel/sections/AdminDashboardSection.jsx` | Stat tiles use solid token fills (`bg-brand`, `bg-success`, `bg-ink`, `bg-primary-700`) instead of four gradients; progress bar `bg-brand`; `rounded-[28px]` → `rounded-[var(--radius-panel)]`, `rounded-[24px]` → `rounded-2xl`. No markup or behaviour changes. |
| `tmp/qa-final-capture.mjs`, `tmp/qa-recheck*.mjs`, `tmp/qa-focus.mjs` | QA capture scripts (gitignored). |

---

## 3. Pages and viewports verified

| Surface | 1440 | 1280 | 768 | 390 | Notes |
|---|---|---|---|---|---|
| Home (hero, chips, grid, sections, footer) | ✓ | ✓ | ✓ | ✓ | + dark mode @1280, Bengali @390 |
| Search dialog / mobile sheet | — | ✓ | ✓ | ✓ | opened from header and from the tab bar |
| Property list + filters (+ "More filters", chips) | ✓ | ✓ | ✓ | ✓ | filters panel open @390; dark mode @1280 |
| Empty / error results | — | ✓ | — | ✓ | `EmptyState` with Retry |
| Property detail (gallery, title, price, ID ticket, tiles, contact, safety) | ✓ | ✓ | ✓ | ✓ (full page) | + unavailable state, dark mode, Bengali |
| Card ⋮ menu + report dialog | — | ✓ | — | ✓ | |
| Card hover | — | ✓ | — | — | shadow + border only |
| Login / Registration | ✓ | ✓ | ✓ | ✓ | auth shell now fills the viewport |
| Contact | ✓ | ✓ | ✓ | ✓ | |
| 404 | — | ✓ | — | — | |
| Loading skeletons (home, list, detail) | — | ✓ | ✓ (detail) | — | no fixture, Supabase unreachable |
| Mobile drawer | — | — | ✓ | ✓ | keyboard open/close verified by harness journey J6 |
| Keyboard focus rings | — | ✓ | — | ✓ | measured after transition |
| Admin shell + dashboard | — | ✓ | — | ✓ | stored admin user; data calls fail gracefully to zeros |
| User dashboard, My Properties, Wallets, Add Property, Buy Credits | ✗ | ✗ | ✗ | ✗ | redirect to login without a real session — code-reviewed only |

Automated checks after the fixes:

| Check | Result |
|---|---|
| `npx eslint src components app scripts/qa` | 0 errors, 20 warnings (all pre-existing) |
| `npm run build` (static export) | exit 0, "Compiled successfully in 30.2s" |
| Dev server restarted on :3000 after the build | done (`dist-next/dev` cleared first) |

---

## 4. Remaining visual issues

1. **Admin template leftovers** — "TAILADMIN SHELL / Admin Control" sidebar header, "NT" avatar, and the "TAILADMIN MIGRATION" banner are copy/branding from the admin template; replacing them is a content decision (`src/components/admin-panel/AdminShell.jsx`, `sections/AdminDashboardSection.jsx`).
2. **User dashboard surfaces not visually verified** (dashboard home, My Properties, Wallets, Withdrawals, Add/Edit Property, Buy Credits, Order Home). They were converted to the shared primitives and lint-clean, but need a real login on a machine that can reach Supabase.
3. **404 page** has no site chrome; consider rendering it inside `SiteChrome` so users can navigate away.
4. **Deferred home sections** show a single grey panel for a few hundred milliseconds before card skeletons mount; acceptable, but a card-shaped placeholder in `DeferredSection`'s fallback would be smoother.
5. **Fixture images** are 4:3 SVG tiles, so the 16:9 gallery on the detail page shows a white strip on the right; real photos (`object-cover`) will not. Worth re-checking with production images.
6. **Dark mode remains an admin-only setting**: brand blue text on the dark canvas measures 3.6:1; if dark mode is turned on for users, lighten `--color-brand` under `html[data-theme='dark']`.

---

## 5. Final recommended improvements

1. Log in with real credentials on a networked machine and walk the dashboard, forms and payment screens once; fix anything the primitives did not cover.
2. Replace the admin template branding with the NewTolet mark and remove the migration banner.
3. Move the 404 route under the site layout.
4. Put a card-shaped fallback inside `DeferredSection` on the homepage.
5. Re-run the harness touch-target probe at 390 (`node scripts/qa/responsive-check.mjs --phase after-touch --widths 390 --channel chrome --fixture --base http://localhost:3000`) to confirm the coarse-pointer rule in the metrics.
6. Commit this work on a dedicated branch so the design polish can be reviewed separately from the Bengali localisation changes it sits on.

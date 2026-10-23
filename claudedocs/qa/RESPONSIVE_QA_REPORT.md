# NewToLet responsive QA report (live application)

**Date:** 21 October 2026
**Branch:** `qa/responsive-fixes` (created from the dirty working tree; nothing stashed or committed)
**Scope:** The real Next.js 16 application in this repository. The earlier report (`~/Downloads/newtolet-responsive-qa.md`) described a standalone HTML redesign prototype that could not be located on disk; its findings were used only as a checklist to re-verify against the live code.

_This file is updated in place as the run progresses. Sections marked "pending" are not yet verified._

## 1. Prototype findings reconciled against the live app

| Prototype finding | Live app state (verified in source) | Outcome |
|---|---|---|
| Invalid `..detail-layout` CSS selector | Not present anywhere in the repo. | N/A |
| Search copy implying live listings were connected | No such copy exists. Listings are fetched live from Supabase; the footer says "browse verified listings", which is a product claim outside this task. | No change |
| Mobile hero order (headline → search → popular areas → illustration) | The homepage has no hero search form. Order is category bar → cover carousel → tagline → category grids; search opens from the navbar or floating rail. | N/A |
| Small tap targets on chips and checkboxes | No checkboxes exist. Category chips ~36-42 px, mobile search-overlay chips ~28 px, card "⋮" button 32 px, clear-search "×" ~20 px. | Fixed (see §3) |
| Card link / save feedback | The whole card is already a labelled link. Save lives inside the "⋮" menu with no feedback and no error handling. | Fixed (see §3) |
| Reduced-motion scroll value | No `prefers-reduced-motion` handling existed anywhere. | Fixed (see §3) |

## 2. Environment and limitations discovered during the run

- **Supabase project unreachable.** The host in `.env.local` (`ohzpdfui….supabase.co`) does not resolve via the configured AdGuard DNS, Google DNS, or Cloudflare DNS, while `supabase.com` resolves and general internet works. Older dev-server logs (Sep/Oct) show no such failures, so the project reference appears to have been deleted or changed. **No live listing, search result, detail page, login, or dashboard data could be loaded.** Only the user can supply a new project URL/key.
- **Test-only fixture for layout checks.** To still verify card grids, the detail page, and search layouts, the harness seeds an obviously fake listing set (ids `qa-fixture-0001…`, inline SVG images, Bangla and long English area names) into the app's own localStorage snapshot cache for the duration of a browser context. The app reads that cache only when the network fails. Nothing is written to source, the database, or any build. Results from fixture runs are labelled `fixture=true`.
- **No test credentials were present** in the environment (`QA_TEST_EMAIL` / `QA_TEST_PASSWORD`), and with Supabase unreachable a login could not succeed anyway. Authenticated screens (Add Property, Dashboard, My Properties, contact unlock) were code-reviewed and fixed but **not browser-tested as a logged-in user**; only their logged-out redirect was exercised.
- **Concurrent i18n work.** A separate session (`bengali-font-localization`) was converting most components to an EN/বাং dictionary during this run. Edits were coordinated file-by-file so neither side overwrote the other; new strings added here use the same dictionary.
- **Memory pressure.** The machine has 7.5 GB RAM. With two Next dev servers (live tree on :3001, frozen pre-fix copy on :3002 for the baseline), the i18n session's processes, and one Chrome, free memory fell below 1 GB and Claude Code stopped the background runs once. The baseline was interrupted at 84 of 90 cells (its summary metrics were rebuilt from the run log; the six missing cells are at 1920 px) and the fixture "before" pass had not started. Remaining runs were executed one at a time with the user's approval.
- **Clear-and-build.** At the user's request `dist-next/`, `out/`, `out-static/` and `.next/` were deleted and `npm run build` (static export) was run on the fixed tree; the result is recorded in §6.
- **Browser tooling.** Playwright is not a project dependency. `playwright-core@1.64.1` was installed with `--no-save` (no `package.json`/lockfile change) and driven against the installed Google Chrome (`channel: 'chrome'`) because the matching headless-shell build was not downloaded. The `chrome-devtools` MCP server failed to connect this session.

## 3. Issues found and fixed

Status key: **applied** = change made in this run; **held** = file was being converted by the i18n session when this run ended, change not made.

### Global (`src/index.css`, `src/Component/Route/Login.css`, `components/app/SiteChrome.jsx`, skeletons)
| # | Issue | Fix | Status |
|---|---|---|---|
| G1 | No `prefers-reduced-motion` handling; ~20 keyframe loops in `index.css` and five infinite loops in `Login.css`; cover carousel autoplays. | Reduced-motion block at the end of `index.css` (animations/transitions collapsed, scroll-behavior auto, hover lifts removed); `Login.css` block stops wave/dots/spin/pulse/bounce; cover autoplay disabled when the OS preference is set. | applied (CSS); cover: see Cover |
| G2 | No `:focus-visible` style anywhere; several inputs use `outline-none` with no replacement. | Global `:focus-visible` outline using the brand accent; fields that already draw a ring opt out. | applied |
| G3 | Long unbroken strings (emails, addresses) could force horizontal overflow. | `overflow-wrap: break-word` on `body`. Bengali font fallback was already added by the i18n session (Hind Siliguri via `next/font`). | applied |
| G4 | `Login.css` applied `* { backface-visibility: hidden }` to the whole site (component CSS is global in the App Router). | Scoped to `.auth-shell *`. | applied |
| G5 | No `<main>` landmark, no skip link, homepage has no `<h1>`. | `SiteChrome` wraps pages in `<main id="main-content">` with a skip link; `Home` gets a visually hidden `<h1>` using the existing tagline. | pending |
| G6 | Fixed mobile bottom nav (≈94 px) covered the footer's last rows; nothing reserved space. | `.site-main` bottom padding below 640 px (safe-area aware). | pending |
| G7 | Cover skeletons were 260 px on phones while the real cover is 180 px (layout shift); skeleton grid did not match the real grid below 360 px. | Skeleton heights/grid aligned. | applied |
| G8 | Sticky category bars used `-mx-4/-mx-5/-mx-8` which overshoot the shell's `clamp()` padding by ~1.6 px at 320-430 px (measured). | `.site-shell-bleed` helper mirrors the shell padding exactly. | pending |

### Navigation (`Navber.jsx`, `FloatingQuickRail.jsx`, `Footer.jsx`)
| # | Issue | Fix | Status |
|---|---|---|---|
| N1 | Hamburger and drawer-close were `<span onClick>` (not keyboard reachable). | Real `<button type="button">` with `aria-expanded`/`aria-controls`. | pending |
| N2 | Drawer had no dialog semantics, no focus move/return, Escape did not close it. | `role="dialog" aria-modal aria-label`, focus moves to the close button on open and returns to the hamburger on close, Escape closes, Tab is trapped inside. | pending |
| N3 | Invalid nesting: logout `<button>` as a direct `<ul>` child; login `<Link>` wrapping a `<button>`. | Wrapped in `<li>`; login link styled as the button. | pending |
| F1 | Right-hand floating rail links (Saved, Call, Earn) were icon-only with no accessible name. | `aria-label` from existing `quickRail.*` keys; `aria-current="page"` on the active bottom-nav item. | pending |
| FT1 | Footer "Property Types" linked to `/propertylist?type=…`, a page that ignores query params; three of the five types do not exist in the app. | Links now target `/propertylist2?propertyType=<valid type>` built with the search helper; non-existent types dropped (no invented data). | pending |
| FT2 | Phone and email were plain text; footer links ~20 px tall; scroll-to-top button lacked `type`. | `tel:`/`mailto:` links, `min-h` on link rows, `type="button"`. | pending |

### Search, results and cards (`NavSearchOverlay.jsx`, `Homelist.jsx`, `Propertylist2.jsx`, `Home.jsx`, `PropertyListingCard.jsx`, `Cover.jsx`)
| # | Issue | Fix | Status |
|---|---|---|---|
| S1 | Overlay keyword inputs had no accessible name; every `<label>` was unassociated; category chips had no pressed state; mobile chips ≈28 px tall; clear "×" ≈20 px, unlabelled; mobile input used `outline-none`. | `id`/`htmlFor` per form (prefixed so desktop and mobile forms do not collide), `aria-label` on keyword inputs and clear button, `aria-pressed` on chips, 40 px minimum chips/buttons, focus ring restored. | pending |
| R1 | Results list rendered nothing at all when there were zero results and no filters. | Neutral empty state shown whenever the list is empty; wording differs with/without filters. | pending |
| R2 | Result count line was not announced to screen readers. | `role="status" aria-live="polite"`. | pending |
| R3 | Mobile "Show Filters" toggle had no `aria-expanded`/`aria-controls`. | Added. | pending |
| C1 | At 320-360 px with two columns the card text area is ~85 px wide; every line was `line-clamp-1` plus `pr-10`, clipping title, area and rent. | One column below 360 px, two-line title/area with matching `min-h` so rows stay equal, "⋮" moved out of the text flow. | pending |
| C2 | Save had no feedback (menu closed instantly), no error handling; overlay link labels were not unique. | `role="status"` message on the card, `try/catch` with error text, display label appended to the link name. | pending |
| C3 | "⋮" button was 32 px; report dialog had no dialog semantics, Escape only worked while the menu was open, close button text was a literal "x". | 44 px hit area; `role="dialog" aria-modal aria-labelledby`, Escape, icon close, initial focus. | pending |
| CV1 | Cover carousel prev/next were `<div>`s; every slide used the same alt text. | `<button>`s with labels; alt text numbered per slide. | pending |

### Property detail (`Listdetails.jsx`)
| # | Issue | Fix | Status |
|---|---|---|---|
| D1 | Grid children used `lg:col-span-*` inside an `xl:` grid, giving an implicit extra column between 1024 and 1279 px. | Removed the col-span classes. | held |
| D2 | Share button had no click handler (looked functional, did nothing); heart and share were unlabelled. | Share uses `navigator.share`, falling back to copying the link with a status message; labels and `aria-pressed` added. | held |
| D3 | "Call Now" rendered as a button-styled `<a>` with no `href` when no number existed. | Rendered only when a number exists. | held |
| D4 | Logged-out contact panel explained that details are protected but offered no login path. | Login link with return path; terms text links to `/terms`. | held |
| D5 | Gallery dots were 8 px, unlabelled; prev/next unlabelled; modals lacked dialog roles, Escape, and labelled close buttons. | Labelled 24 px dots with `aria-current`, labelled arrows, dialog semantics, Escape, icon close. | held |

### Add Property (`Addproperty.jsx`, `AddPropertyContext.jsx`, `ImageUploader.jsx`, `formValidation.js`, `propertyService.js`)
| # | Issue | Fix | Status |
|---|---|---|---|
| P1 | **Every submission was blocked**: validation required a Deadline the form no longer renders (removed in commit 57e908d; Edit Property still has it; DB column is nullable). | Deadline optional on Add Property (ordering check only when both dates exist); submit sends `null` instead of `''`. Edit Property unchanged. | service: applied; validation: pending |
| P2 | **Draft restore crashed the page**: `File` objects were JSON-serialised into localStorage and came back as `{}`, then `URL.createObjectURL({})` threw on reload. | Files excluded from the persisted draft, non-File entries dropped on load, object URLs created once and revoked. | pending |
| P3 | 19 labels, 0 `htmlFor`; errors were colour-only; summary listed raw field keys (`deadline: …`); scroll-to-error used a class-name query that missed category/period/image errors. | Labelled fields, `aria-invalid`/`aria-describedby`, `role="alert"` summary with human field names, first invalid field focused. | pending |
| P4 | Counter −/+ announced only "−"/"+"; category and rent-period choices had no pressed state; drop zone was a clickable `<div>`; invalid files used `alert()`. | Labels on counters, `aria-pressed` on choices, keyboard-operable drop zone, inline error text. | pending |

### Auth and dashboard
| # | Issue | Fix | Status |
|---|---|---|---|
| A1 | Auth labels were `<p>` elements; inputs had no `id`, no `autocomplete`; errors unlinked; page title not a heading. | `<label htmlFor>`, ids, `autocomplete`, `aria-invalid`/`aria-describedby`, `role="alert"`, `<h1>`. | pending |
| A2 | No show/hide password control. | Toggle with `aria-pressed` and label. | pending |
| DB1 | Dashboard off-canvas sidebar stayed tabbable and exposed when closed; menu/close buttons unlabelled; no Escape; no `aria-current`. | `inert` on the closed drawer, labels passed via props (shell stays translation-free), Escape, `aria-current`. | pending |
| DB2 | "Property Saveds" typo; refund modal lacked dialog role, Escape, max height. | Copy fixed in the dictionary; dialog semantics and scrollable height. | copy: applied; modal: pending |
| DB3 | My Properties analytics showed the same "recent views" number twice under two labels. | Duplicate card removed (the service has no separate total). | pending |

## 7. Remaining findings not changed

- The About section shows headline figures (500+ properties, 10K+ happy customers, 15+ years, 98% satisfaction) that nothing in the app verifies. Left in place because removing the owner's marketing claims is a content decision; recommend verifying or removing.
- Footer social links point to the networks' home pages, not NewToLet profiles. Left as-is; real URLs are needed from the owner.
- Sticky offsets `top-[72px] md:top-[118px]` are hard-coded; the measured mobile navbar is 77 px (5 px overlap when the navbar is visible). Adjusted only if the after-run confirms the measurement on all mobile widths.
- `ResetPassword.jsx` logs URL/token details to the console (not a layout issue; should be removed before release).
- Dead files are not imported anywhere and were not touched: `ModalSearchForm.jsx`, `Homelist2.jsx`, `HomePropertySection.jsx`, the unused `AddProperty/Screen*` wizard components.
- The Adsterra slots request a 320 px banner inside a ~291 px container at 320 px, so the ad is clipped; this is the ad network's fixed size.

## 4. Viewports and journeys tested

**Harness:** `scripts/qa/responsive-check.mjs` (+ `lib.mjs`, `journeys.mjs`, `fixture.mjs`), Playwright 1.64 driving Google Chrome 155, `deviceScaleFactor 1`, touch emulation at ≤430 px, a fresh browser context per viewport. Per cell: load, wait for fonts and skeletons, scroll sweep (triggers deferred sections), DOM metrics, overlap probes, full-page + first-screen screenshots, console/page-error capture.

**Viewport widths (all ten requested):** 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920 px.

**Routes per width (logged-out):** `/`, `/propertylist2/`, `/propertylist2/?category=Family`, `/listdetails/?id=…` (fixture listing), `/login/`, `/registration/`, `/about/`, `/contact/`, `/addproperty/` (expects redirect to login).

**Metrics per cell:** horizontal-overflow offenders by element rect (window `scrollWidth` is masked by `overflow-x: hidden`), sticky-bar/navbar overlap, fixed bottom-nav/footer overlap (≤639 px), card row-height deltas, tap targets under 44 px (≤430 px), clamped text actually clipped, images without alt, controls without an accessible name, inputs without a label, `<main>` present, `<h1>` count, console errors.

**Journeys (390 and 1280 px, fixture data, logged out):**
- J1 Search: open the search overlay, type a location, pick the Family chip, submit with Enter → results URL carries `search` and `category`; cards or empty state render.
- J2 Filters: open "Show Filters" (390 only), set Division and Sort, submit → URL carries `sort`; count line or empty state present.
- J3 Detail: open the first card, step the gallery, toggle the save heart twice, use Share, check the guest contact panel (login link present) and that "Call Now" never renders without a number.
- J5 Auth: login page label association, empty submit → two inline errors, invalid email → error, password show/hide toggle, logged-out `/addproperty/` → `/login/`.
- J6 Mobile nav (390): hamburger is a labelled button, keyboard opens the drawer and focus moves inside, Tab stays inside, Escape closes and focus returns, bottom nav has ≥5 links.
- J4 (post form validation + previews) requires a logged-in session and was **not run** (no credentials; Supabase unreachable).
- Reduced motion: `/` with `prefers-reduced-motion: reduce` emulated, cover slide index checked after 6 s.

## 5. Before → after metrics

_pending (filled from `--compare` once the after-run completes)_

## 6. Checks run

| Check | Result |
|---|---|
| `npx eslint src components app` (baseline) | 0 errors, 19 warnings |
| `npx eslint <each changed file>` after edits | 0 errors; warnings only where they pre-existed (`Footer.jsx` unused `Icon`, `Registration.jsx` hook deps, `Addproperty.jsx` unused optional-location state) |
| `node scripts/i18n-check-keys.mjs` | EN and BN key sets match (1428 keys each) after adding 38 keys |
| `node --check` on harness scripts | pass |
| `npm run build` (static export) after clearing `dist-next/`, `out/`, `out-static/`, `.next/` | exit 0, compiled in 25.9 s, all 33 routes exported, `out/` regenerated; only the pre-existing workspace-root lockfile warning |
| Note on `npm run lint` | `eslint.config.js` ignores only `dist` and `.next`, so the package script also lints `dist-next/` and `out/` build output; use the source-folder invocation above |

## 7. Remaining findings not changed

_pending_

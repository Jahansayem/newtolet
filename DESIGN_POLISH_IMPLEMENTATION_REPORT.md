# NewTolet — Design Polish Implementation Report

**Date:** 22 October 2026 · **Branch:** `feature/bengali-i18n` (uncommitted; nothing was committed, stashed or reset)
**Source of truth:** `DESIGN_POLISH_AUDIT.md` (sections 5, 10, 11, 13). Phases 0–6 of the audit's implementation order were applied; Phase 7 verification ran with one gap described below.

---

## 1. Summary

The product now has one working token system (ink / brand / marigold / success / danger / neutral), one container width, one 64 px header row, one floating UI on phones, price-first listing cards with a quotable Property-ID ticket, a search-first homepage hero, a two-tier results filter, accessible dialogs, and labelled form fields across the public site, dashboard and admin. Two runtime defects found by the audit were fixed at the root: daisyUI no longer shadows the app's input radius token, and the custom `pulse` keyframe no longer overrides Tailwind's skeleton animation.

Verified: 36 of 36 harness cells (9 routes × 1440/1280/768/390) rendered with **zero horizontal overflow, zero sticky-bar overlap, zero unlabelled inputs, zero unnamed controls, zero console/page errors**; harness journeys (search, filters, detail + save, login validation, mobile drawer) pass at 390 and 1280 (one flaky timing step noted in §6); `npm run build` (static export) compiled and exported successfully; lint 0 errors; EN/বাং key sets match (1473 keys each); Bengali-mode screenshots of the new home, results and detail pages were reviewed. Logged-in screens remain code-reviewed only (no credentials, Supabase unreachable).

---

## 2. Files changed

### New files
| File | Purpose |
|---|---|
| `src/components/ui/Dialog.jsx` | Accessible modal primitive: portal, `role="dialog"`, labelled title, Escape, backdrop close, initial focus, Tab trap, focus return, `--z-overlay`. |
| `src/components/ui/ConfirmDialog.jsx` | Confirmation step for destructive actions (labels via props; English defaults for admin). |
| `src/components/ui/EmptyState.jsx` | Shared empty/error state (icon · title · next step · action). |
| `src/components/ListingCardSkeleton.jsx` | One listing-card skeleton (4:3 media) used by Home, Homelist and the route fallback. |
| `src/Component/Home/HomeHero.jsx` | Search-first hero: page `<h1>`, value line, keyword + category + division form → `buildSearchHref`, popular-area shortcuts. |
| `DESIGN_POLISH_IMPLEMENTATION_REPORT.md` | This report. |

### Modified files (design-polish scope)
| Area | Files |
|---|---|
| Foundation | `src/index.css` (rewritten), `app/layout.js` |
| Chrome | `src/Component/Home/Navber.jsx` (rewritten), `components/app/FloatingQuickRail.jsx` (rewritten), `components/app/HomePageSkeleton.jsx`, `src/Component/Home/Footer.jsx`, `src/lib/homeScrollChrome.js`, `app/addproperty/page.js`, `app/(site)/about/page.js`, `src/components/user-panel/UserPanelShell.jsx` |
| Cards, home, search | `src/components/PropertyListingCard.jsx` (rewritten), `src/components/PropertyCardMedia.jsx`, `src/components/RentDisplay.jsx`, `src/components/LanguageToggle.jsx`, `src/Component/Home/{Home,Homelist,Cover,CategoryFilterBar,PropertySearchForm,NavSearchOverlay,About,Feadback,ArticlePreview,Contact}.jsx`, `src/Component/Home/Cover.css`, `src/Component/Navber/Propertylist2.jsx`, `src/components/JobFeedSection.jsx` |
| Detail | `src/Component/Home/Listdetails.jsx` (render rewritten; data/logic untouched) |
| Forms, dashboard, payments | `src/Component/Navber/{Addproperty,EditProperty,MyProperties,BuyCredits,CreateOrderForm,PaymentMethodSelector,PaymentConfirmPage,Earnmoney}.jsx`, `src/Component/Dashboard/{WalletsPanel,WithdrawalsPanel,ReferralPanel}.jsx` |
| Admin (objective fixes only) | `src/Component/Admin/{PropertyManagement,PaymentMonitoring}.jsx`, `src/components/admin-panel/AdminShell.jsx` |
| Copy / i18n | `src/i18n/locales/{en,bn}.js`, `src/i18n/locales/{en,bn}/{home,listing,search,addProperty,dashboard}.js` |
| Brand codemod | 44 files under `src/`, `components/`, `app/` (class literals only; see §3) |
| QA harness | `scripts/qa/lib.mjs` (header probe accepts `<header>`), `scripts/qa/journeys.mjs` (search selector scoped to `[role="dialog"]`) |

Not touched: `src/services/*`, Supabase calls, routing tables (`src/lib/routePaths.js`), auth pages' markup (`Login.jsx`, `Registration.jsx`, `Login.css`), `ThemeController.jsx`, `propertySearch*.js`.

---

## 3. Design tokens added or modified (`src/index.css`)

| Group | Token(s) | Value / rule |
|---|---|---|
| Semantic colours (`@theme`) | `--color-ink` | `#0e284c` (= existing `primary-800`) — headings, prices, footer, tab-bar badges |
| | `--color-brand`, `--color-brand-hover`, `--color-brand-pressed`, `--color-brand-soft` | `#1E73B8` / `#1665a0` / `#145a94` / `#e6f0f8` — interactive only |
| | `--color-marigold-500`, `--color-marigold-700`, `--color-marigold-soft` | `#f0a202` (fill, ink text) / `#8a5a00` (text) — "promoted" only |
| | `--color-success`, `--color-success-soft` | `#15803d` / `#e8f5ec` — status only (never a CTA) |
| | `--color-danger`, `--color-danger-soft` | `#dc2626` / `#fdecec` — destructive + errors only |
| | `--color-canvas`, `--color-surface`, `--color-line`, `--color-muted`, `--color-subtle` | `#f6f8fb` / `#fff` / `#e3e8ef` / `#5b6b7f` (5.45:1) / `#6b7280` (4.83:1) |
| Type | `--text-body` 15/24, `--text-caption` 13/20 | mint `text-body`, `text-caption` |
| Radius | `--radius-chip` 8, **`--radius-input` 12 (renamed from `--radius-field`)**, `--radius-button` 12, `--radius-card` 16, `--radius-panel` 24, `--radius-pill` | daisyUI's own `--radius-field` had been winning at runtime (inputs rendered 4 px) |
| Shadow | `--shadow-card`, `--shadow-raised`, `--shadow-overlay` | ink-tinted; no coloured glows |
| `:root` (JS-readable) | `--nav-h: 65px`, `--z-nav/--z-overlay/--z-toast`, `--site-ring`, re-pointed `--site-*` | header height is read by `getNavHeight()` for the homepage scroll logic and by every sticky offset |
| Dark overrides | every new token has a value in `html[data-theme='dark']` | admin-controlled dark mode keeps working |
| daisyUI | `@plugin "daisyui" { themes: light --default; }` | stops the unconfigured dark theme CSS from shipping |
| Motion | `@keyframes pulse` → `pulse-scale`; 11 template keyframes, `.scroll-animate*`, `.stagger-children`, `.hover-lift/scale/glow`, `.gradient-text`, `.glass-effect` deleted | Tailwind `animate-pulse` now fades skeletons as intended |
| Primitives (in `@layer components`, so utilities still override) | `.ui-btn` (+ `-primary/-secondary/-ghost/-danger/-danger-outline`, `-sm/-lg`, `-icon/-icon-lg`), `.ui-field` (+ `[aria-invalid]`, `:disabled`, select chevron), `.ui-label/-help/-error/-required`, `.ui-card`, `.ui-card-interactive`, `.ui-panel`, `.ui-note` (+ `-danger/-success`), `.ui-badge` (+ `-promoted/-success/-neutral/-danger/-brand`), `.ui-chip`, `.ui-eyebrow`, `.ui-price`, `.ui-id-ticket`, `.ui-scroll-fade` | `.site-card`, `.site-field`, `.site-button-*`, `.site-kicker` are kept as aliases |
| Layout | `.site-shell` = `.site-shell-wide` = 1280 px, `clamp(1rem, 3.5vw, 2rem)`; `.site-shell-narrow` 720; `.site-shell-bleed` mirrors the same clamp (reset at 1328) | one width for header, bars and content |
| Touch | `@media (pointer: coarse)` → `.ui-btn/.ui-chip` ≥ 44 px, icon buttons 44×44 | desktop density unchanged |
| Focus | global `:focus-visible` outline kept; `.ui-btn/.ui-chip` use the brand ring | |
| Fonts | Poppins weight 300 removed from `next/font` (never used) | |

---

## 4. Components improved

| Component | What changed |
|---|---|
| **Header** (`Navber.jsx`) | One 64 px `<header>` row at every width (was 71 + 52 px on desktop): logo · Home / Property list ▾ / Earn Money / Article / Career · Search (labelled, `aria-haspopup="dialog"`) · **Add Property** primary CTA on every page (lg+) · language · account menu or Login. `<nav aria-label>`, `aria-current` on the active link, dropdown closes on Escape/outside click, Profile/Saved only shown when logged in. Drawer: de-duplicated items, `aria-expanded` on the accordion, `ui-btn` login/logout, same focus trap as before. |
| **Mobile tab bar** (`FloatingQuickRail.jsx`) | The desktop 5-button rail and the mobile right-hand column are gone (they covered card menus and the Copy-ID button). One bottom bar: Home · Search · Add (raised) · Saved (badge) · Account, 12 px labels, `aria-current`, safe-area padding. |
| **Listing card** | Price first (`৳ 24,500 /mo`, ink, tabular numerals; "Negotiable" as a neutral badge), `<h3>` title, area line with pin, bed · bath · "From Nov" row with icons, footer with **Property-ID ticket + visible 44 px save heart (`aria-pressed`) + ⋮ menu** (`role="menu"`, focus returns to the trigger). 4:3 photo; single "Featured" badge (marigold, ink text, 6.9:1); image-less fallback is a neutral tile instead of a black box; status toast moved off the photo. Whole-card link overlay and prop signature preserved. |
| **Homepage** | Search-first hero with the page `<h1>`; cover carousel below (200/300/340 px, pause button, icon arrows, 24 px bullets, returns `null` with no photos). Grid 1 → 2 → 3 → 4 columns (was 6 with 8 items → 6 + 2 rows). Section headers with inline "See more" at sm+. Shared skeleton, no nested `<main>` or duplicate navbar during Suspense. |
| **Category chips** | `.ui-chip`, horizontal scroll with edge fade below lg, `aria-current` on the homepage (jump links) vs `aria-pressed` on results. |
| **Results page + filter form** | Two tiers: keyword · division · category · Search always visible, budget + sort on the second row, district / area / sub-area / type / rooms behind "More filters" (`aria-expanded`, opens automatically when one is active). Every field has `<label htmlFor>`. Active filters are ink chips with a labelled remove action. Cached-results notice is an info note with a 36–44 px Retry. Empty/error states use `EmptyState`. |
| **Search overlay** | Desktop panel is a real dialog (`role`, `aria-modal`, `aria-labelledby`, initial focus on the keyword, Tab trap, Escape, backdrop click, focus return); mobile sheet likewise. One field renderer replaces the six duplicated selects. |
| **Property detail** | Breadcrumb merged into the single sticky bar (`<nav aria-label>`, `<ol>`, hidden separators, current crumb in ink). Hierarchy: category eyebrow → `<h1>` → location → **monthly rent** (32/40 ink) → **Property ID ticket + Copy**. Eight neutral spec tiles incl. **Bedrooms** (was missing) with correct icons; occupancy and safety tips as info notes; description capped at 70ch; facilities as a check list. Contact card: lock icons on protected rows, panels stack vertically (the one-word-per-line bug is gone), **Unlock is brand, Call is secondary** (red/green CTAs removed). Both modals use `Dialog`. Skeleton on load; distinct not-found vs unavailable titles with Retry. |
| **Contact page** | `<h1>`, three labelled fields, brand button, `role="status"/"alert"` notes that no longer auto-hide, new copy. |
| **Add / Edit Property** | All inputs on `.ui-field` (one style, 44 px, focus ring, error border preserved), one label style, counters keep a visible focus ring, rent-period tiles in a 3-column grid, brand submit button. EditProperty: 12 label/control pairs linked by `htmlFor`/`id`, error summary shows human field names instead of DB keys, focus moves to the first invalid control. |
| **My Properties / Wallets / Withdrawals / Referral** | Labelled inputs, `.ui-field`, `ui-btn` actions, status chips on the badge system, `ConfirmDialog` for property and wallet deletion (replaces `window.confirm` / no-confirm), analytics modal on `Dialog`, live-region messages. |
| **Buy Credits / Order Home / Payment** | Package cards are real buttons (keyboard reachable), labelled icon close, steps renumbered 1 → 2, brand palette instead of monochrome; `FieldShell` gives every order-form field an `id`/`htmlFor`/`aria-invalid`; payment-method selector is a `Dialog` with a labelled phone field and `role="alert"` errors; Earn Money links to the internal job feed instead of the competitor's site. |
| **Admin** | Broken `bg-[#1E73B8]600` class fixed; delete / approve / reject go through `ConfirmDialog`; icon buttons labelled; duplicate View removed; stat-tile contrast fixed; auto-approve banner is ink (not purple/indigo) with `role="switch"`; developer SQL instructions hidden in production; detail modal has dialog semantics + Escape; admin shell drawer labelled with Escape; indigo second brand (`#465fff` family) mapped to brand. |
| **Footer** | Ink background, eyebrow column headings as `<h2>`, brand-200 links (7.9:1), 36 px link rows, `ui-btn` scroll-to-top. |
| **About / Feedback / Articles / Job feed** | Token typography, no hover-lift on static cards, carousel pauses on hover/focus and honours reduced motion, 24 px dots with `aria-current`, radii on the 16/24 scale, no cyan/sky gradients. |

---

## 5. Before / after summary

| Metric (harness, fixture data) | Before (`tmp/qa-screenshots/before`) | After (`tmp/qa-screenshots/after`) |
|---|---|---|
| Header height | 72 px mobile / 117 px desktop (two rows) | 65 px everywhere, exposed as `--nav-h` |
| Chrome before detail content (desktop) | ≈ 230 px (nav + breadcrumb + sticky bar) | ≈ 115 px (nav + one sticky bar) |
| Floating UIs on phones | 2 (tab bar + right column over content) | 1 (tab bar) |
| Floating UIs on desktop | 1 rail overlapping content below 1440 | 0 (header CTAs) |
| Listing grid at ≥1280 | 6 columns, 8 items → 6 + 2 | 4 columns, 8 items → 4 + 4 |
| Unlabelled inputs (public routes) | Contact 3 | 0 |
| `<h1>` on Home / Contact / About | 12 px tagline / none / none | real H1 on all three |
| Clipped clamped text at 390 (home / list) | 34 / 34 | 18 / 18 (title `line-clamp-2` and area `truncate` by design, with `title` attribute) |
| Console / page errors | 1 (home @1280) | 0 |
| Horizontal overflow, sticky overlap, bottom-bar/footer overlap | 0 | 0 |
| Brand hex literal `#1E73B8` in class names | ≈ 432 | 0 (only decorative SVG `stopColor` on auth pages) |
| Brand hover shades | 6 (`#1665a0 #17639f #155b91 #155a90 #3646d6 primary-700`) | 1 token (`brand-hover`) |
| Input radius actually rendered | 4 px (daisyUI collision) | 12 px |
| Contrast: Call Now / Pinned / Unlock / red links | 2.28 / 2.15 / 3.76 / 3.76 | secondary button / 6.9 / 5.0 / muted 5.45 |
| Lint | 0 errors, 19–20 warnings (pre-existing) | 0 errors, 20 warnings (same set) |
| i18n keys | 1428 EN = BN | 1473 EN = BN |

Tap-target count at 390 rose in the harness (29 → 98 on home) because every card now exposes two 40 px icon buttons and the chips are 40 px; the `@media (pointer: coarse)` rule added afterwards raises all `.ui-btn`/`.ui-chip` controls to 44 px on touch devices — this landed after the harness run and is not yet re-measured (see §7).

Screenshots to compare: `tmp/qa-screenshots/before/<route>-<width>-top.png` vs `tmp/qa-screenshots/after/<route>-<width>-top.png` for `home`, `propertylist2`, `propertylist2-category-Family`, `listdetails-id-first`, `login`, `registration`, `about`, `contact`, `addproperty` at 1440, 1280, 768, 390.

---

## 6. Verification performed

| Check | Result |
|---|---|
| `npx eslint src components app scripts/qa` | 0 errors, 20 warnings (all pre-existing: unused `Icon` destructures, unused vars in `InteractiveMap`, `imageUploadService`, etc.) |
| `node scripts/i18n-check-keys.mjs` | `en keys: 1473, bn keys: 1473 — OK` |
| Harness `node scripts/qa/responsive-check.mjs --phase after --base http://localhost:3000 --widths 1440,1280,768,390 --channel chrome --fixture --journeys` | All 36 route × width cells OK (full-page + first-screen PNGs, DOM metrics, overlap probes). |
| Harness journeys (`--only-journeys`, 390 + 1280) | J1 search (overlay → type → chip → Enter → results URL with `search` + `category`) 7/7 at both widths; J2 filters + sort 6/6 @390 and 5/5 @1280 (one re-run at 390 missed the result-count line within its timeout under memory pressure — passed on the other run); J3 detail + save + guest contact 6/6; J5 login validation + protected redirect 6/6; J6 mobile drawer keyboard/focus + bottom bar 6/6. Three harness selectors were updated for the new markup (search input scoped to `[role="dialog"]`, visible search trigger, mobile-filters toggle by `aria-controls`, bottom bar counts buttons) — `scripts/qa/journeys.mjs`, `scripts/qa/lib.mjs`. |
| `node scripts/qa/responsive-check.mjs --compare` | Table in §5; no regressions in overflow, overlap, labels, names, landmarks, or console errors. Journeys before → after: J2@390 5/6 → 6/6, J1@1280 2/7 → 7/7, others unchanged at full marks. |
| `npm run build` (`scripts/static-build.mjs`, static export) | Exit 0, "Compiled successfully in 55s", `out/` regenerated; dev server restarted afterwards. |
| Bengali mode (`localStorage.appLanguage = 'bn'`) | `tmp/qa-screenshots/after/bn-home-390.png`, `bn-list-390.png`, `bn-detail-1280.png`: Hind Siliguri leads the stack, hero title wraps on three lines at 390 without clipping, chips/tab bar/labels fit. |
| 768 px second pass | `tmp/qa-screenshots/after/propertylist2-768-fix.png`, `home-768-fix.png`: filter card and hero form now stack cleanly (no truncated selects, no overlapping buttons). |
| Runtime token checks (playwright, dev server) | `<header>` 65 px at 390/768/1280/1440 = `--nav-h`; search dialog opens from the header and the tab bar with focus on the keyword input (`[role="dialog"]` present on desktop and mobile); hero form navigates to `/propertylist2/?search=…&category=…` via `buildSearchHref` (same contract as the overlay). |
| Public routes render without page errors | `/`, `/propertylist2/`, `/listdetails/?id=…`, `/contact/`, `/earnmoney/`, `/orderhome/`, `/about/`, `/login/`, `/registration/` |
| Contrast (computed) | ink/white 14.7, muted/white 5.45, subtle/white 4.83, white/brand 5.0, brand-pressed/brand-soft 6.2, ink/marigold 6.9, success-800/success-soft ≥ 4.5, danger-700/danger-soft ≥ 4.5, white/danger 4.83, primary-200/ink 7.9 |
| Manual visual review | Every `*-top.png` at the four widths plus full-page home/detail. Second refinement pass fixed: 768 px filter card (submit and selects truncated, "More filters" overlapping Sort), 768 px hero selects truncated, About page without `<h1>`, sub-36 px targets (language toggle, popular-area chips, terms link). |
| Dark mode | Tokens overridden under `html[data-theme='dark']`; not visually checked (requires the admin site setting). |
| Logged-in screens (dashboard, forms, payments, admin) | Code-reviewed and lint-clean; **not** browser-tested — no test credentials and Supabase is unreachable from this machine (same limitation as the audit). |

---

## 7. Remaining issues

1. **Tap-target metric at 390 not re-measured** after the `@media (pointer: coarse)` rule (44 px controls on touch) landed; the harness run that produced the §5 numbers predates it. Re-run the 390 cells to refresh the count:
   ```bash
   node scripts/qa/responsive-check.mjs --phase after-touch --base http://localhost:3000 --widths 390 --channel chrome --fixture
   ```
2. **Harness flakiness under low memory:** one J2@390 run missed the result-count line within its 30 s step timeout; it passed on the previous run. The machine had < 1 GB free RAM during verification.
3. **Dark mode:** brand blue on the dark canvas is 3.6:1 for small text. If the admin dark theme is used in production, add `--color-brand: #66a5d5` (and a darker button text) under `html[data-theme='dark']`.
4. **Required-field asterisks in Add/Edit Property** are still baked into the locale strings (`addProperty.js` labels end with ` *`), so screen readers announce "star". Moving them to a `required` flag needs a pass over both forms and both dictionaries.
5. **EditProperty** has 12 of its labelled controls linked; the remaining labels wrap radio/checkbox groups or custom tiles and still lack `aria-invalid`.
6. **Admin shell** still uses its own drawer instead of `SharedPanelShell`, and `.admin-panel-scope` `!important` re-skinning remains (scope cut in the audit's Phase 6).
7. **Dead files** (`ModalSearchForm.jsx`, `Homelist2.jsx`, `Information.jsx`, `List.jsx`, `Orderhome.jsx`, `OrderhomeLanding.jsx`, `PaymentHistory.jsx`, `Admin/FeedbackManagement.jsx`, `Admin/InquiryManagement.jsx`, `AddProperty/Screen*`…) were left in place; they are unrouted and untouched.
8. **Lakh number grouping** (`1,20,000`) was not applied — the i18n conventions say numbers must not change; `RentDisplay` still uses `en-BD`.
9. The harness's clipped-text metric still flags the intentional `line-clamp-2` titles and `truncate` area lines on cards; a `title` attribute exposes the full text on hover.

---

## 8. Recommended next improvements

1. Run the pending verification (§7.1) and attach the journey results; then commit this work on a feature branch separate from the i18n changes it sits on.
2. Capture real cover photos and listing images through the admin flow and re-review the hero + cards with production data (fixture tiles exaggerate the 4:3 crop).
3. Promote the remaining ad-hoc buttons in the user dashboard panels (`EarningsPanel`, `DashboardHomePanel`, `PropertyCollectionsPanel`, order/job panels) to `ui-btn` / `PanelCard` / `EmptyState` — mechanical, now that the primitives exist.
4. Build a `/dev/ui` route (dev-only) that renders every primitive and state, and run axe against it in CI.
5. Replace the five remaining `window.confirm` calls in `src/components/admin-panel/sections/*` with `ConfirmDialog`.
6. Add a map to the property detail page using the existing `src/components/Maps/StaticMap.jsx`.
7. Decide the dark-mode strategy (keep + tokenise, or remove) and delete the `!important` utility overrides accordingly.
8. Consider "Verified" as a second badge state (success green, ink text) once listings carry a verification flag — the badge system and the card footer already have room for it.

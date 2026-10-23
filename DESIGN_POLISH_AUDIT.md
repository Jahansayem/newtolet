# NewTolet — Design Polish Audit

**Date:** 22 October 2026 · **Branch:** `feature/bengali-i18n` (dirty working tree, nothing modified by this audit)
**Scope:** The live Next.js 16 / React 19 / Tailwind v4 + daisyUI 5 application in this repository. Public site, auth, user dashboard, listing forms, payments, admin.
**Benchmark:** thetolet.com (homepage and login fetched 22 Oct 2026). Used only as a yardstick, not as a target.
**Evidence:** Every finding cites `file:line` from the current tree and/or a screenshot under `tmp/qa-screenshots/audit/` (produced by the repo's own harness `scripts/qa/responsive-check.mjs --phase audit --fixture` at 1440×900, 1280×800, 768×1024 and 390×844, plus six Bengali-mode shots `bn-*.png`). Contrast ratios were computed, not estimated.

**Legend used throughout**
- **Type:** `O` = objective, verifiable defect (contrast maths, broken class, missing label, layout bug, measured overlap). `S` = subjective design recommendation (hierarchy, identity, tone).
- **Priority:** Critical / High / Medium / Low. **Effort:** S (<½ day) / M (1–3 days) / L (>3 days).

---

## Method and limitations (read first)

| Item | Detail |
|---|---|
| Data | Supabase host does not resolve from this machine, so every screenshot uses the harness fixture (30 synthetic listings, solid-colour "QA fixture n" images, Bengali + long English area names). Card and detail *layout* is real; photos and copy inside cards are synthetic. |
| Logged-in screens | No test credentials. Dashboard, My Properties, Add/Edit Property, Buy Credits, Order Home, payment and admin screens were audited **from code only** (line-cited), not from screenshots. |
| Dev server | Screenshots come from `next dev`; the black "N" badge bottom-left and one captured runtime-error overlay (`home-1280-top.png`, "UNKNOWN: unknown error, read") are dev-only artefacts, not product findings. |
| Fixture quirks | "1th Floor" on the detail page is fixture data (`scripts/qa/fixture.mjs:56`), not an app bug. |
| Harness journeys | J1@1280 and J2@390 steps timed out on harness locators (hidden duplicate buttons), not on product behaviour; they are excluded. |
| Counts | Class/colour counts are `grep -o` approximations across `src/`, `components/`, `app/`; treat them as ±5 %. |

---

## 1. Executive summary

NewTolet is a **faithful structural clone of thetolet.com rendered with Tailwind defaults**. The information architecture, the category row under the header, the image-only hero, the card anatomy ("Family Flat Rent" → area → "Bed: 1, Bath: 1" → "To-Let from: November" → "Rent : 14000 BDT") and even the kebab actions (Save / Compare / Report) are the competitor's. The codebase contains a *proto* design system — a `@theme` colour scale, radius tokens, `.site-card` / `.site-field` / `.site-button-*` classes, and a well-built auth CSS — but almost nothing uses it. The result is competent, readable, and generic.

Six numbers describe the gap:

| Metric | Value | Where |
|---|---|---|
| Brand hex `#1E73B8` written as a literal vs. uses of the `primary-*` token | **≈432 vs 90** (52 files) | `src/index.css:4-21` defines the scale |
| Text set in `gray-400` / `slate-400` (2.5:1 on white, fails AA) | **94 occurrences, 44 files** | e.g. `src/components/user-panel/UserPanelPrimitives.jsx:18` |
| Distinct page container widths / padding systems | **7+ / 3** | `index.css:606-620`, `Navber.jsx:307`, `Propertylist.jsx:12`, `Homelist.jsx:20` |
| Distinct ad-hoc button class strings in public components | **≈56**; no shared Button, Field, Dialog, Badge, Toast | — |
| Vertical chrome before content on the property detail page (desktop) | **≈230 px** (117 nav + 40 breadcrumb + 72 sticky bar) | `Navber.jsx:307-314`, `Listdetails.jsx:489-548` |
| `--radius-field` token resolved at runtime | **0.25rem (daisyUI's), not the app's 12px** → every `.site-field` input renders with 4 px corners | `index.css:2,18`; runtime check below |

What already works and must be kept: the auth pages (labels, `aria-invalid`, `role="alert"`, password toggle, reduced-motion), the Homelist loading/error/cached/empty states, the card and detail dialogs (role, Escape, 44 px close), the skip link + `<main>`, the global `:focus-visible` outline, the Poppins + Hind Siliguri pairing with Bengali baseline tuning, zero images without `alt`, and zero horizontal overflow at any tested width.

**Three decisions only the owner can make** (the report recommends, but does not assume):
1. **Dark mode** — currently implemented by `!important` overrides of raw utilities (`index.css:133-175`) and not exposed in the product UI. Recommendation: delete it; rebuilding it on tokens is a separate project.
2. **Visual signature** — Option A (recommended): *Quotable Property-ID ticket + price-first ink numerals as the first body line of every card.* Option B: rent tag overlaid on the photo. A is cheaper, survives image-less and negotiable listings, and is the one thing thetolet.com does not do.
3. **Homepage hero** — keep the image carousel, or replace with a search-first hero (location + category + budget). The carousel currently has no photos in production data paths and renders a 400 px "Welcome to NewTolet.Com" block.

---

## 2. Current design strengths

| Strength | Evidence |
|---|---|
| Auth screens are the best-built surface: `<label htmlFor>`, `aria-invalid`/`aria-describedby`, `role="alert"`, `role="status"`, show/hide password with `aria-pressed`, reduced-motion handled, a coherent CSS system (`.auth-card`, `.auth-input`, `.auth-submit`) | `src/Component/Route/Login.jsx`, `Registration.jsx`, `PasswordInput.jsx:28-37`, `Login.css:100-328`; `login-1280-top.png`, `registration-390-top.png`; harness J5 6/6 at 390 and 1280 |
| Results list has every state: skeleton, live result count (`role="status"`), hard error with Retry (`role="alert"`), "cached results" notice, filtered/unfiltered empty states | `src/Component/Home/Homelist.jsx:163-240` |
| Dialogs on the card report flow and the detail page carry `role="dialog" aria-modal aria-labelledby`, Escape, 44 px labelled close buttons | `src/components/PropertyListingCard.jsx:467-551`; `src/Component/Home/Listdetails.jsx:848-999` |
| Mobile drawer is a real dialog with focus trap, Escape, focus return, body scroll lock | `src/Component/Home/Navber.jsx:157-249`; harness J6 6/6 |
| A token foundation exists: `--color-primary-50..900`, `--radius-card/field/button/pill`, `--site-*` surface/text vars, `.site-shell`, `.site-card`, `.site-field`, `.site-button-*`, `.site-kicker` | `src/index.css:4-40, 606-694` |
| Accessibility foundation: skip link, `<main id="main-content" tabIndex={-1}>`, global `:focus-visible` outline, `prefers-reduced-motion` block, `overflow-wrap` | `components/app/SiteChrome.jsx:52-61`; `src/index.css:696-787` |
| Typography pairing is correct for the market: Poppins (Latin) + Hind Siliguri (Bengali) via `next/font`, Bengali gets a taller line-height and tracking reset | `app/layout.js:7-20`; `src/index.css:56-83`; `bn-home-390.png`, `bn-detail-1280.png` |
| Measured hygiene: 0 images without `alt`, 0 unnamed controls on public pages, no horizontal overflow at 390/768/1280/1440 | harness `results.json`, all cells |
| A fixture-driven responsive QA harness already exists and can be reused as the regression gate for every recommendation below | `scripts/qa/{responsive-check,lib,journeys,fixture}.mjs` |

---

## 3. Current design weaknesses

Grouped; each item is expanded with evidence in sections 6–9.

1. **No point of view.** IA, card anatomy and copy patterns are thetolet.com's. Card titles are link-blue category labels, the price is the *last* line of metadata at `text-sm`, and the homepage `<h1>` is a 12 px tracked tagline. (`PropertyListingCard.jsx:440-462`, `Home.jsx:397`)
2. **Tokens defined, not adopted.** 432 brand literals, six competing hover shades (`#1665A0`, `#17639F`, `#155B91`, `#155A90`, `primary-700`, admin `#3646D6`), a second brand (`#465FFF` indigo ×42 in admin), a logo drawn in Tailwind blues (`#3B82F6`, `#1D4ED8`, `#2563EB`), map pins in indigo `#4F46E5`. (`NewToletLogo.jsx:35-53`, `mapService.js:67`, `AdminShell.jsx:42`)
3. **Two neutral families.** `gray-*` ≈1,500 uses vs `slate-*` ≈550, often in the same file; the skeleton is slate while pages are gray.
4. **Chrome overload.** Two-row 117 px navbar + sticky category bar + (on detail) breadcrumb bar + sticky action bar; a desktop floating rail of five circles that collides with content below 1440 px; on phones a bottom tab bar **plus** a second right-hand floating column that covers card menus. (`FloatingQuickRail.jsx:198, 278, 357`; `propertylist2-1280-top.png`, `home-390-top.png`)
5. **Broken hierarchy on the detail page.** Property ID (3xl, blue) sits above and louder than the `<h1>`; rent is 4xl blue in a grey box; spec tiles use five pastel colour families; bedrooms are missing from the tiles while "Rooms" shows dining rooms. (`Listdetails.jsx:638-746`)
6. **Colour semantics inverted.** The primary conversion action "Unlock" is danger-red; "Call Now" is green-500 (2.28:1 with white); "Featured/Pinned" is amber-500 with white text (2.15:1). (`Listdetails.jsx:477, 822, 984`; `PropertyCardMedia.jsx:148`)
7. **Consistency sprawl.** 8 radius sizes incl. 41 arbitrary px values; 6 shadow sizes + ≥8 literal shadows; 10 focus-ring colours; 10 distinct `<h1>` class strings across 11 h1s; 5 input class variants inside one form (`Addproperty.jsx:571, 639, 718, 1011, 160`).
8. **Runtime token defect.** daisyUI's own `--radius-field` (0.25rem) shadows the app's 12 px token; custom `@keyframes pulse` shadows Tailwind's so 18 skeletons scale instead of fade. (`index.css:2, 18, 299-306`)
9. **Accessibility gaps outside auth.** Unlabelled inputs on Contact, EditProperty (23 labels / 0 `htmlFor`), Wallets, Withdrawals, MyProperties, Referral and all admin search fields; 25 `fixed inset-0` overlays but only 6 `role="dialog"`, 4 Escape handlers and 0 focus traps; `<div onClick>` cards in Buy Credits; admin destructive actions without confirmation; a 4 s autoplay carousel with no pause.
10. **Copy has no system.** Currency written four ways ("Rent : 14000 BDT", "৳", "BDT ", "Tk"); "Credits" vs "Points" for the same thing; "Property list" / "Property List" / "All property"; placeholder "e.g., Dhaka, Mumbai, New York"; "You have contact any time."; raw `error.message` shown to users.
11. **Dead weight.** ≈15 unrouted files (one with a real bug), 14 template keyframes, scroll-reveal/stagger utilities with 0 uses, an 80-line commented-out rail, a purple `.gradient-text`.

---

## 4. Recommended visual direction

### 4.1 Positioning
A **trusted, broker-free rental marketplace for Bangladesh** whose interface is organised around the two things a tenant actually does: *compare rent fast* and *quote a listing on the phone*. thetolet.com optimises for density and volume signals ("120K+ listings"). NewTolet should optimise for **clarity and quotability**.

### 4.2 The single distinctive signature (recommended: Option A)

**"Quotable ID + price-first ink numerals."**
- Every listing shows its rent as the **first body line** of the card, in ink (`#0E284C`), 20/28 700, `font-variant-numeric: tabular-nums`, with the Taka sign and lakh grouping: `৳ 24,500 /mo` · `৳ 1,20,000 /mo` · `Negotiable` as a muted pill.
- Every listing shows its **Property ID as a ticket**: monospaced/tabular digits in a bordered chip (`ID 100042`) with a copy affordance on the detail page, the same treatment on cards, compare, dashboard rows, admin rows and SMS/WhatsApp copy text. The code already treats the ID as "the public number tenants quote on the phone" (`Listdetails.jsx:637`); nothing on thetolet.com surfaces it.
- Photo overlays are capped at **two**: a status badge top-left (Featured / Verified / New) and, optionally, nothing else. Overlays beyond that produce badge soup at 190–290 px card widths.

**Option B (not recommended by default):** the rent as a solid ink tag overlaid bottom-left on the photo. Feasible (`PropertyCardMedia` already receives `pricing`, `PropertyCardMedia.jsx:134-152`), but it must also suppress the rent printed inside the black fallback thumbnail (`:52-61`), move the save-status toast off the `left-2 top-2` slot it shares with the Pinned badge (`PropertyListingCard.jsx:359`), and the Bengali negotiable label `আলোচনা সাপেক্ষে` does not fit a 190 px card — the grid change in §10 #6 is a hard prerequisite.

### 4.3 Palette rules are the differentiator, not the hexes
- **Ink** carries headings, prices, the footer and primary text. Not gray-900, not slate-950.
- **Brand blue** is for interactive affordances (links, primary buttons, selected chips) — *never* for non-interactive titles or breadcrumb text.
- **Marigold** means exactly one thing: *promoted* (Featured/Pinned). Fill only, ink text on it. Never used for warnings, never as text on white.
- **Verified green** is a *status* (verified, active, success). Never a call-to-action.
- **Danger red** is for destructive actions and errors only. "Unlock contact" is a purchase, not a danger: it becomes brand blue.
- **One neutral family.** `*-400` is never used for text.

### 4.4 What is deliberately *not* distinctive
Poppins + Hind Siliguri is the most common Bangladeshi web pairing; swapping fonts is out of scope (static export, `next/font`, Bengali baseline tuning already done). Voice comes from **scale, ink, tabular numerals and the ID ticket**, not from the typeface. The 4-pt spacing scale and Tailwind breakpoints are generic on purpose — they are plumbing.

---

## 5. Proposed design tokens (as a diff against `src/index.css:4-40`)

### 5.1 Colours (6 core)

| Role | Token | Hex | Contrast | Change vs today |
|---|---|---|---|---|
| Ink | `--color-ink` = existing `--color-primary-800` | `#0E284C` | white on ink 14.7:1 | Replaces `gray-900`/`slate-950`/`text-black` mix; no new hex |
| Brand | `--color-brand` = `--color-primary-500` | `#1E73B8` | white on brand 5.0:1 ✓ | Keep. **Hover = `primary-600 #1665A0`** (keeps the 35 existing `#1665A0` uses correct after codemod); **pressed = `primary-700 #145A94`**. Retire `#17639F`, `#155B91`, `#155A90`, `#42A5F5`, `#67AEE2`, `#465FFF`, `#3646D6`, `#6577FF`, `blue-600`. |
| Marigold (promoted) | `--color-marigold-500` / `-700` | `#F0A202` / `#8A5A00` | ink on marigold-500 ≈7.1:1 ✓; marigold-700 on white 5.9:1 ✓; **marigold-500 as text on white 2.1:1 ✗ (never)** | Replaces `amber-500` white-text badge (2.15:1 ✗) |
| Verified / success | `--color-success` | `#15803D` (= Tailwind green-700) | white on it 5.0:1 ✓ | Replaces `green-500` buttons (2.28:1 ✗) |
| Danger | `--color-danger` | `#DC2626` (= red-600) | white on it 4.8:1 ✓ | Replaces `red-500` (3.76:1 ✗ as button text/as text on white) |
| Neutrals | `--site-bg #F6F8FB`, `--site-surface #FFF`, `--site-border #E3E8EF`, `--site-text` = ink, `--site-text-muted #5B6B7F` (5.4:1 ✓), `--site-text-subtle #6B7280` (4.8:1 ✓, small text only) | | | Re-point the existing `--site-*` names (`index.css:25-31`); forbid `text-gray-400`/`text-slate-400` (2.5:1 ✗) |

Warnings/info (the safety box, cached-results notice) move to a **neutral ink-tinted info style** (ink text on `#EEF3F8`, left border brand) so yellow/amber stops competing with marigold.

### 5.2 Typography

Fonts unchanged: Poppins (drop weight 300 — never loaded, `app/layout.js:9`) + Hind Siliguri. Declare `--text-body: 15px` / `--text-body--line-height: 24px` in `@theme` so `text-body` exists and nobody writes `text-[15px]`.

| Role | Size / line | Weight | Tracking | Notes |
|---|---|---|---|---|
| Display | 36/44 (mobile 28/36) | 700 | 0 (not negative — breaks Bengali conjuncts) | Homepage hero only |
| H1 | 30/38 (mobile 24/32) | 700 | 0 | **Must be the largest text on the page** |
| H2 | 24/32 | 700 | 0 | Section titles |
| H3 | 18/28 (card title 15/22) | 600 | 0 | Card titles become `<h3>` |
| Body | 15/24 (inputs 16 px to stop iOS zoom) | 400 | 0 | |
| Small | 13/20 | 400/500 | 0 | Metadata |
| Caption / eyebrow | 12/16 (bn: 13/20) | 600 | ≤0.06em | Current kickers use 0.28–0.35em (`index.css:639`, `JobFeedSection.jsx:102`) — reduce |
| Price | card 20/28 · detail 32/40 | 700 | 0 | `tabular-nums`; lakh grouping via `bn-BD`/`en-IN` formatter (verified: `en-BD` → `120,000`; `bn-BD` latn → `1,20,000`) |

Bengali rules: minimum 13 px, form labels 14/600, no negative tracking (add `.tracking-tight` to the bn reset at `index.css:78-83`), eyebrows differentiated by weight + colour, not uppercase (Bengali has no case). No `text-[10px]` / `text-[11px]` anywhere.

### 5.3 Spacing
4-pt scale: 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64 · 96. Section rhythm 48 (mobile) / 80 (desktop). Listing-card body padding 12; panel-card padding 20 / 24. Grid gap 16 / 24. Form field gap 20, field-group gap 32.

### 5.4 Containers

| Token | Width | Use | Replaces |
|---|---|---|---|
| `--shell` | 1280 px, `padding-inline: clamp(16px, 4vw, 32px)` | nav, sticky bars, all page content | `site-shell-wide` 1320 (exists only as rail gutter, `index.css:612-615`), navbar `max-w-[1420px]` (`Navber.jsx:307`), `max-w-[1520px]` (`Propertylist.jsx:12`), `max-w-7xl` (`Homelist.jsx:20`), `max-w-6xl/5xl/4xl` |
| `--shell-narrow` | 720 px | forms, policy/article reading | `max-w-2xl` (`Addproperty.jsx:494`), `max-w-5xl` (`PolicyPage.jsx:56`) |
| `--shell-panel` | 1440 px | dashboard + admin only | 1680 (`SharedPanelShell.jsx:172`), 1720 (`AdminShell.jsx:142`) |
| `--nav-h` | SSR default 72 / 117, updated by a `ResizeObserver` on the header | every `sticky top-*` and `scroll-mt-*` | hard-coded `top-[72px] md:top-[118px]` (`Home.jsx:385`, `Propertylist2.jsx:199`, `Listdetails.jsx:515,781`; measured nav is 117, not 118) |

`--shell` at 1280 only works **after** the desktop rail is removed or moved into the header. `.site-shell-bleed` (`index.css:737-747`) must mirror the same clamp.

### 5.5 Radius
8 (chips, small inputs) · 12 (fields, buttons) · 16 (cards) · 24 (dialogs, panels) · 999 (pills). These are the existing `@theme` values (`index.css:17-20`) — **adopt, don't redesign** — with one fix: **rename `--radius-field` → `--radius-input`**, because daisyUI 5 defines its own `--radius-field` (0.25rem) and wins at runtime (verified: `getComputedStyle(document.documentElement).getPropertyValue('--radius-field')` = `0.25rem`; `.site-field` computed `border-radius` = `4px`; built CSS contains `--radius-field:.25rem` ×4 and `--radius-field:12px` ×0). Delete the 41 arbitrary `rounded-[24|28|32px]` values and the admin `0.9rem`/`1.5rem` overrides (`index.css:382-398`).

### 5.6 Shadow
`--shadow-sm 0 1px 2px rgba(14,40,76,.06)` · `--shadow-md 0 4px 12px rgba(14,40,76,.08)` · `--shadow-lg 0 16px 40px rgba(14,40,76,.12)` · `--ring 0 0 0 4px rgba(30,115,184,.18)`. Cards: border + sm at rest, md on hover, **no translate**. No coloured glows (removes `.hover-glow` indigo and the 28 px blue glow on `.site-button-primary`, `index.css:495-501, 676`). Delete the dark-mode `!important` shadow override (`:169-175`) or the token has no effect.

### 5.7 Buttons
Sizes: `sm` 36 · `md` 40 (desktop default) · `touch` 44 (`min-h` under `pointer: coarse` and in the mobile tab bar) · `lg` 48 (primary CTAs). Icon buttons: 36 / 40 / 44.
Variants: **primary** (brand → `primary-600` hover → `primary-700` pressed, `scale(.98)` active, 50 % opacity + no shadow disabled, loading = spinner + label, never a text swap alone) · **secondary** (surface, ink text, border) · **ghost** · **danger** (red-600; destructive only) · **tag** (ink fill). Every variant defines hover / active / `focus-visible` / disabled / loading. Replaces the gradient+glow `.site-button-*` (`index.css:660-694`, which has no `:disabled` or `:active`) and the ≈56 ad-hoc strings.

### 5.8 Inputs
Height 44 (40 inside dense admin tables), radius 12, border `#CBD5E1`, surface white, placeholder `--site-text-subtle`, focus = brand border + `--ring`, error = red-600 border + 13 px message with icon and `aria-describedby`, `[aria-invalid="true"]` styled. Label 13/600 ink above (14/600 in Bengali); required marker is a styled `*` with `aria-hidden`, optional fields get an "(Optional)" suffix — **not** asterisks baked into locale strings (`src/i18n/locales/en/addProperty.js:27-65`). Adopt `.site-field` (`index.css:644-658`) as the single `Field` primitive.

### 5.9 Cards
- **Listing card:** 4:3 photo (phone cameras shoot 4:3, so uploads crop less than today's 3:2, `PropertyCardMedia.jsx:145`); status badge top-left; body padding 12: **price line first** (20/700 ink tabular + `/mo`), title `<h3>` 15/600 ink = "{Type} in {Area}", meta row with icons (bed · bath · floor), footer row "Available Nov" + ID ticket + a **visible** 44 px save heart. Hover: border `brand/20` + shadow md. No `hover:-translate-y`.
- **Panel card (dashboard/admin):** radius 24, padding 24, header = H2 + subtitle + action slot (= existing `PanelCard`/`PanelCardHeader`, `UserPanelPrimitives.jsx:7-22`, adopted everywhere).

### 5.10 Responsive principles
Breakpoints: Tailwind `sm 640 / md 768 / lg 1024 / xl 1280`. Listing grid **1 (<360) → 2 → 3 (md) → 4 (lg+)**, never 6. Category chips scroll horizontally below `lg` with an edge fade. Nav: single row at `lg+`, drawer below. **One** floating UI per viewport: the bottom tab bar on phones (Home · Search · Add · Saved · Account), header CTAs on desktop; delete the right-hand mobile column and the five-button desktop rail. Tables stack into labelled rows below `md`. Touch targets ≥44 px on coarse pointers.

### 5.11 Motion principles
150 ms ease-out for colour/shadow; 200 ms for chip/menu transforms; 250 ms ease-in-out for drawer/dialog. No scroll-reveal, stagger or float utilities (0 uses today). Carousels pause on hover/focus, expose a pause control, and respect `prefers-reduced-motion` (keep `index.css:761-787`). Keyframes kept: `fadeIn`, `shimmer`, Tailwind `spin`/`pulse`. **Rename the custom `pulse` → `pulse-scale`** (`index.css:299, 428`) and delete the other 11 template keyframes and `.scroll-animate*`/`.stagger-children` (`:186-566`).

### 5.12 daisyUI
Either remove `@plugin "daisyui"` (`index.css:2`; it is used by one dead file's `btn` and two spinners) and write a 10-line Spinner, or configure it: `@plugin "daisyui" { themes: light --default; }`. Today the unconfigured plugin ships a `dark` theme bound to `prefers-color-scheme` and `[data-theme=dark]` (present in built CSS) alongside the app's own `html[data-theme='dark']` switch.

---

## 6. Page-by-page findings

Each block: screenshot refs · what works · defects (O) · recommendations (S).

### 6.1 Home (`/`, `src/Component/Home/Home.jsx`)
Refs: `home-1440-top.png`, `home-1440.png`, `home-768-top.png`, `home-390-top.png`, `home-390.png`, `bn-home-390.png`.
Works: sticky category bar hides with the navbar on scroll-down; skeletons match the real grid proportions (`:51-78`); search badge with labelled clear button (`:418-427`); section empty state (`:435-438`).

| # | Type | Problem | Why it matters | Recommended solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| H1 | O | The page `<h1>` is a 12 px (16 px desktop) uppercase tagline with 0.32em tracking — the smallest text on the page | Heading hierarchy inverted for SR users and SEO; no value proposition | Real `<h1>` ("Find a home to rent in Bangladesh, broker-free") using the commented copy at `:410-416`; tagline becomes `<p>` | High | S | `Home.jsx:397`; measured 12 px @390, 16 px @1440 |
| H2 | O | `xl:grid-cols-6` while sections are `slice(0, 8)` → rows of 6 + 2, ~190 px cards; with 5 items the 6th column is empty every row | Orphan rows, unreadable card widths, Bengali titles cannot fit | `grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4`; keep slice 8 → two full rows | High | S | `Home.jsx:132, 454`; skeleton `:60`; `home-1440.png` |
| H3 | S | No search on the homepage; hero is a 400 px empty-state block ("Welcome to NewTolet.Com") when no cover photos exist; first listing ≈830 px down at 1440 | Primary task (search) hidden behind a nav icon; hero conveys nothing | Search-first hero (keyword/area + category + budget) with the carousel as backdrop; or reduce cover to 240 px | High | L | `Home.jsx:394-401`; `Cover.jsx:118-131`; `home-1440-top.png` |
| H4 | O | Two Adsterra slots on the homepage, invisible offline, requesting 320 px banners | Layout reflow when ads load; brand dilution | Reserve fixed-height slots with a labelled placeholder, or remove from the first viewport | Medium | S | `Home.jsx:506, 521` |
| H5 | S | Section rhythm uneven: category sections 48–56 px apart, then a 32 px-radius Articles card, a Job-feed card, About, Feedback; large dead space between About and Feedback when empty | No consistent vertical cadence | Apply 48/80 section rhythm; hide empty Feedback/Job-feed sections instead of rendering empty cards | Medium | S | `home-1440.png`; `JobFeedSection.jsx:99`; `Feadback.jsx:165-167` |
| H6 | O | Dead commented heading block; `CategorySectionsFallback` uses `bg-gray-50` while skeleton elsewhere uses slate | Hygiene; skeleton colour mismatch | Delete; single Skeleton primitive | Low | S | `Home.jsx:410-416, 51-78`; `HomePageSkeleton.jsx:1-13` |

### 6.2 Property list (`/propertylist2`, `src/Component/Navber/Propertylist2.jsx` + `Homelist.jsx` + `PropertySearchForm.jsx`)
Refs: `propertylist2-1280-top.png`, `propertylist2-category-Family-1280.png`, `propertylist2-768-top.png`, `propertylist2-390-top.png`, `bn-list-390.png`.
Works: filter chips with clear-all; `role="status"` count; error/cached/empty states; `aria-expanded` on mobile "Show Filters".

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| L1 | O | Desktop floating rail's left edge (~1208 px) overlaps the filter card's right edge (1210 px) at 1280; overlaps the 3rd card column at 768 | Covers the Sub-area select and card menus | Remove rail (§10 #4) or inset content by rail width below 1440 | High | S | `FloatingQuickRail.jsx:198`; `index.css:612-615` comment; `propertylist2-1280-top.png` |
| L2 | S | A 10-field filter card (~340 px tall) sits above results; on phones it is hidden behind "Show Filters" | Results pushed below the fold; filters feel like a form, not a search | Two-tier filters: a compact bar (keyword · location · category · budget) + "More filters" sheet; move sort to the results header | High | M | `Propertylist2.jsx:228-264`; `PropertySearchForm.jsx` |
| L3 | S | Price is the last line of each card, same size as "Bed: 1, Bath: 1"; title is link-blue | Users scan price first; blue title reads as a link but the whole card is the link | Price-first card (§5.9) | Critical | M | `PropertyListingCard.jsx:440-462`; `propertylist2-category-Family-1280.png` |
| L4 | O | Results container is `max-w-7xl` (1280) inside a `site-shell-wide` (1320) page | Misaligned left edges between filter card and grid | Use `--shell` | Medium | S | `Homelist.jsx:20, 193` |
| L5 | O | Empty-state heading is `text-gray-500 text-lg` (not bold) while the error heading is bold `text-gray-700` | Inconsistent state hierarchy | One `EmptyState` primitive (exists: `UserPanelPrimitives.jsx:24-30`) | Low | S | `Homelist.jsx:208-240` |
| L6 | O | "Showing saved results. Live search is unavailable right now." uses amber text on `bg-yellow-50` with a 20 px-tall Retry link | Fine contrast (4.76:1) but Retry is a 35×20 px target | Info style + 44 px Retry button | Medium | S | `Homelist.jsx:222-231`; tap sample "Retry 35.4x20" @390 |

### 6.3 Property detail (`/listdetails`, `src/Component/Home/Listdetails.jsx`)
Refs: `listdetails-id-first-1440-top.png`, `listdetails-id-first-1280.png`, `listdetails-id-first-390.png`, `bn-detail-1280.png`.
Works: sticky save/share bar with labelled 44 px buttons; gallery dots with `aria-current`; both dialogs have roles, Escape, labelled close; Copy-ID with `role="status"` feedback.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| D1 | O | Guest contact panel uses `md:flex-row md:items-center md:justify-between` inside the 320 px xl sidebar → "Property details are visible." wraps one word per line beside the Login button | Broken layout on every desktop width ≥1280 | Stack vertically inside the sidebar (`flex-col`); same for the locked panel | High | S | `Listdetails.jsx:429, 452`; `listdetails-id-first-1280.png` |
| D2 | S | Hierarchy: Property ID card (ID at 2xl/3xl blue) sits above the title card; rent is 4xl blue in a grey box; `<h1>` is 2xl/3xl | ID louder than the property; price competes with ID | Order: title (H1) → price (32/40 ink tabular) → ID ticket (small, copyable) in the same card | High | M | `Listdetails.jsx:638-696` |
| D3 | S | Spec tiles in five pastel families (blue ×4, green, yellow, purple, orange); bedrooms missing; "Rooms" tile shows `dining_rooms`; Floor icon is `FiUsers`, Bathrooms icon is `FiMaximize2` | Rainbow = no meaning; the key spec (bedrooms) absent; wrong icons mislead | One neutral tile style; tiles: Bedrooms · Bathrooms · Floor · Size/Balcony; correct icons; category/type move to the title line | High | M | `Listdetails.jsx:698-746, 710, 715, 725` |
| D4 | O | "Unlock" CTA is `bg-red-500` (3.76:1 with white, fails AA for 16 px); description `text-red-500`; terms link `text-xs text-red-500` (3.76:1) | Danger colour on the main purchase action; two contrast failures | Unlock → primary brand button; description muted; terms link muted underline | Critical | S | `Listdetails.jsx:435, 458, 477, 984` |
| D5 | O | "Call Now" is `bg-green-500` with white text (2.28:1) | Fails AA by a wide margin | Secondary button with phone icon, or `--color-success` (5.0:1) if green must stay | Critical | S | `Listdetails.jsx:822` |
| D6 | S | Three stacked bars (nav 117 + breadcrumb 40 + sticky back/heart/share 72 ≈ 230 px) before a 21:9 gallery (~450 px) | Title and price below the fold at 1280×800 | Merge breadcrumb into the sticky bar; gallery 16:9 max 420 px; single-row navbar (§12) | High | M | `Listdetails.jsx:489-553`; `listdetails-id-first-1280.png` |
| D7 | O | Breadcrumb `>` separators not `aria-hidden`; non-link crumbs styled `text-[#1E73B8]` like links; `<nav>` lacks `aria-label` | SR reads "greater than"; false affordance | `<nav aria-label="Breadcrumb">`, `<ol>`, hidden separators, ink text for current crumb | Medium | S | `Listdetails.jsx:491-511` |
| D8 | O | Occupancy "No Restriction" rendered inside a red danger box; Safety Tips in `text-xs text-yellow-700` with literal "- " bullets | Neutral/positive info presented as a warning; sub-13 px text | Info style; `<ul>` with real bullets, 13 px | Medium | S | `Listdetails.jsx:748-753, 835-842`; `listdetails-id-first-1280.png` |
| D9 | O | Error state title is always "Property not found", even for "temporarily unavailable"; loading is a spinner with no `role="status"`; CTA link has no hover | Misleading error; no layout skeleton | Distinct not-found vs unavailable copy with Retry; page skeleton | Medium | S | `Listdetails.jsx:372-392` |
| D10 | O | `<div onClick>` backdrop without keyboard path is fine, but dialogs have no focus trap and no initial focus; modals are `z-50`, equal to the navbar | Focus can escape behind the overlay | `Dialog` primitive with trap + initial focus; z-index scale | Medium | M | `Listdetails.jsx:848-999` |
| D11 | S | No map although `src/components/Maps/*` exists | Location is a top-3 rental criterion | Static map with area-level marker below Description | Medium | M | `src/components/Maps/StaticMap.jsx` |

### 6.4 Login / Registration / Forgot / Reset (`src/Component/Route/*`, `Login.css`)
Refs: `login-1280-top.png`, `login-390-top.png`, `registration-1280-top.png`, `registration-390-top.png`.
Works: see §2 (best surface in the product).

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| A1 | S | No logo or way back to the site; the only navigation is the browser back button | Users land here from "Login to unlock" and lose context | Logo link to `/` above the card + "← Back" | Medium | S | `login-1280-top.png`; `SiteChrome.jsx:12-21` (standalone pages) |
| A2 | S | Copy "Login Here" / "Registration Here" | Generic | "Welcome back" / "Create your account"; button "Log in" | Low | S | `Login.jsx`, `Registration.jsx` h1 |
| A3 | S | Auth shapes (16 px inputs, pill gradient buttons) differ from the rest of the site (12 px fields, 8–16 px buttons) | Two visual systems | Auth adopts the shared Button/Field primitives (keeps its backdrop) | Low | M | `Login.css:122-168` |
| A4 | O | `.login-card-border` applies `backdrop-filter: blur(18px)` while `LOGIN_ANIMATION_SUMMARY.md` says "no blur" | Doc/code drift; blur costs paint on low-end phones | Pick one; update the doc | Low | S | `Login.css:92-98` |
| A5 | O | Decorative shapes use `#42a5f5` (2.65:1 if ever used for text) and five infinite loops | Fine under reduced-motion (handled `Login.css:320-328`); watch CPU | Keep; ensure shapes stay decorative only | Low | — | `Registration.jsx:310-312` |

### 6.5 Contact (`src/Component/Home/Contact.jsx`)
Refs: `contact-1280-top.png`, `contact-390-top.png`.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| C1 | O | Three inputs have no `<label>`; captions are bare text nodes; accessible name comes from the placeholder only | Fails WCAG 1.3.1/3.3.2; harness reports 3 unlabelled inputs at every width | `<label htmlFor>` | Critical | S | `Contact.jsx:79, 90, 102-103`; `results.json` contact cells |
| C2 | O | Inputs are 4 px radius with no focus style; submit is Tailwind `bg-blue-600` (#2563EB), not the brand | Off-brand; no focus feedback | Field + Button primitives | High | S | `Contact.jsx:81, 92, 105, 116`; `contact-1280-top.png` |
| C3 | O | Page has no `<h1>`; "CONTACT" is an uppercase `h2`; subtitle "You have contact any time." | Heading structure; ungrammatical copy | `<h1>Contact us</h1>`, "We reply within one working day." | Medium | S | `Contact.jsx:58`; `home.js:75` |
| C4 | O | Success says "Thank you for your feedback!" (form submits via `submitFeedback`); banners have no `role`, auto-hide after 5 s | Wrong word; SR never hears it | "Message sent — we'll reply to {email}."; `role="status"`, no auto-hide | Medium | S | `Contact.jsx:44-75, 81` |

### 6.6 About (`src/Component/Home/About.jsx`)
Refs: `about-1280-top.png`, `about-390-top.png`.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| AB1 | O | "500+ properties, 10K+ customers, 15+ years, 98% satisfaction" are hard-coded and unverified; stat cards use `hover-lift` though not interactive | Trust claims that cannot be backed; false affordance | Compute counts from data or remove; no hover on static cards | High | S | `About.jsx:9-12`, `:hover-lift` |
| AB2 | O | `/about` page is the homepage section + footer only; no `<h1>` | Thin page; heading structure | Promote section title to `<h1>` on the standalone route; add mission/how-it-works/safety | Medium | M | `app/(site)/about/page.js`; harness h1=0 |

### 6.7 Add Property (`src/Component/Navber/Addproperty.jsx`, `src/components/AddProperty/ImageUploader.jsx`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| F1 | O | Five input class variants in one form (1 px border/20 % ring; 2 px border; inline `style` colour-scheme; counters with `focus:outline-none` and no replacement) | No visible focus on numeric counters; inconsistent weight | Single `Field` primitive | High | M | `Addproperty.jsx:571, 639, 718, 1011-1016, 160, 240` |
| F2 | O | Required asterisks baked into locale strings ("Floor Level *"); `CounterInput` appends `*` itself; `'⚠️ Validation Errors'` with an emoji in the string | SR reads "star"; untranslatable emoji | `required` prop → styled `*` `aria-hidden`; plain heading text | Medium | S | `addProperty.js:27-65, 272`; `Addproperty.jsx:132, 704` |
| F3 | O | Two label sizes in one form (`text-base md:text-lg` vs `text-xs md:text-sm`); rent-period shows 3 tiles in a 4-column grid | Visual noise; orphan cell | One label style; `grid-cols-3` | Low | S | `Addproperty.jsx:753` |
| F4 | S | Submit shows "Submitting..." text only; success replaces the whole page then auto-redirects after 2 s | No spinner; redirect yanks focus | Button loading state; success toast + stay on page with "View listing" | Medium | S | `Addproperty.jsx:467-488, 1048-1052` |
| F5 | O | Location picker is unreachable (its button was removed) and uses six `alert()` calls | Dead UI; blocking native alerts | Re-add entry point or remove; inline errors | Medium | S | `Addproperty.jsx:959`; `LocationPicker.jsx:227-267` |
| F6 | O | Placeholders "e.g., Dhaka, Mumbai, New York" / "Uttara, Kafrul, Chinatown" in a Bangladesh-only product | Erodes trust | "e.g., Dhaka, Chattogram, Sylhet" | Low | S | `addProperty.js:77-78` |
| F7 | O | Image drop zone uses generic `border-blue-500 bg-blue-50` drag state | Off-brand | Brand token | Low | S | `ImageUploader.jsx:119-140` |

### 6.8 Edit Property (`src/Component/Navber/EditProperty.jsx`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| E1 | O | 23 `<label>`s, 0 `htmlFor`; no `aria-invalid`, no `role="alert"`, counter buttons unlabelled — Add Property has all of these | Regression between twin forms; screen-reader users cannot edit | Share one form component between Add and Edit | Critical | M | `EditProperty.jsx:715-1233`, `:107-122` |
| E2 | O | Error summary prints raw field keys (`rent_amount_bdt: …`); scroll-to-error queries a class name | Developer strings shown to users | Reuse Add's label map and focus-first-invalid (`Addproperty.jsx:376-393`) | High | S | `EditProperty.jsx:565, 569` |
| E3 | O | Drift: labels `text-gray-700` vs Add's `text-black`; spec grid `lg:grid-cols-6` vs 4; selected tile `/5` vs `/10`; load-error button `bg-primary-600` (darker than every other button) | Two versions of the same screen | Single source | Medium | M | `EditProperty.jsx:103, 636, 726, 759, 907` |

### 6.9 My Properties (`src/Component/Navber/MyProperties.jsx`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| M1 | O | Search input has placeholder only; focus = border colour change only | Unlabelled; weak focus | Label + `--ring` | High | S | `MyProperties.jsx:232-238` |
| M2 | O | Analytics modal: `<div onClick>` backdrop, no `role="dialog"`, no Escape, no focus management; 3 stat tiles in a 2-column grid | Keyboard trap risk; orphan tile | `Dialog` primitive; 3-column grid | Medium | S | `MyProperties.jsx:34-81` |
| M3 | O | Delete uses `window.confirm`; Deactivate has no confirm; feedback `<p>` has no role and never dismisses | Inconsistent, un-announced | `ConfirmDialog` + `Toast` | Medium | S | `MyProperties.jsx:184, 248` |
| M4 | S | Six action buttons per row (`rounded-2xl`), primary hover `#17639f` (a 3rd hover shade) | Row clutter; drift | Primary + overflow menu; token hover | Low | S | `MyProperties.jsx:205, 327-375` |

### 6.10 Dashboard (`app/dashboard/page.js`, `src/components/panel/SharedPanelShell.jsx`, `src/Component/Dashboard/*`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| DB1 | S | Shell is `rounded-3xl` slate; the four panels are `rounded-xl/2xl` gray and do not use `PanelCard`/`EmptyState`; loading is plain text | Two visual systems inside one screen | Panels adopt the primitives | Medium | M | `UserPanelPrimitives.jsx:7-30`; `EarningsPanel.jsx`, `ReferralPanel.jsx`, `WalletsPanel.jsx`, `WithdrawalsPanel.jsx` |
| DB2 | O | Wallets: 4 labels without `htmlFor`, same input string ×4, unstyled default checkbox; Withdrawals: 2 labels without `htmlFor`; Referral username input has no label | Unlabelled fields | `Field` primitive | High | S | `WalletsPanel.jsx:418-473`; `WithdrawalsPanel.jsx:104, 120`; `ReferralPanel.jsx:208-215` |
| DB3 | O | Wallet delete has no confirmation | Irreversible | `ConfirmDialog` | High | S | `WalletsPanel.jsx:217` |
| DB4 | S | Referral "Buy credits" is `bg-gray-900` (a different primary inside the same panel); gradient hero `to-cyan-50`; notice rendered twice | Drift | Brand button; one notice | Low | S | `ReferralPanel.jsx:140, 217, 259, 271` |
| DB5 | O | Sidebar only at `xl` (`w-[320px] hidden xl:block`), so 1024–1279 px laptops get the drawer; drawer has dialog/inert/Escape but no focus move or trap | Awkward on common laptops; a11y gap | Sidebar at `lg`; focus handling | Medium | S | `SharedPanelShell.jsx:173, 152-207` |
| DB6 | O | Section headings `text-[11px]`; `PanelCardHeader` status `text-xs text-slate-400` (2.56:1) | Sub-12 px and failing contrast | 12 px / muted token | Medium | S | `SharedPanelShell.jsx`; `UserPanelPrimitives.jsx:18` |
| DB7 | O | Tables are `overflow-x-auto` only | Horizontal scroll on phones | Stack rows below `md` | Medium | M | all four panels |

### 6.11 Buy Credits (`src/Component/Navber/BuyCredits.jsx`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| BC1 | O | Package cards are `<div onClick>` with no role/tabIndex/keyboard handler | Unreachable by keyboard; purchase flow blocked | `<button>` or radio group | Critical | S | `BuyCredits.jsx:247-255` |
| BC2 | O | Step 1 jumps to step 3 (no step 2); badges read "1" then "3" | Confusing progress | Two steps, or remove numbering | Medium | S | `BuyCredits.jsx:113, 231, 310` |
| BC3 | O | Close control is a literal "X" text button without `aria-label` | Unnamed control | Icon button + label | Medium | S | `BuyCredits.jsx:202-207` |
| BC4 | S | Whole page is monochrome gray-900 (balance banner, "popular" ring, CTA) | Off-brand on a money screen that needs trust | Brand primary + ink | Medium | S | `BuyCredits.jsx:211, 252, 348` |

### 6.12 Order Home form + payment selector (`CreateOrderForm.jsx`, `PaymentMethodSelector.jsx`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| OH1 | O | `FieldShell` label is a sibling with no `htmlFor` → every field unlabelled despite the reusable component | Same fix unlocks 20+ fields | Add `id`/`htmlFor` to `FieldShell` | High | S | `CreateOrderForm.jsx:106-169` |
| OH2 | O | Payment modal: no `role="dialog"`, no Escape, no backdrop close; close icon unlabelled; "BK/NG/RK" text at `text-4xl` used as gateway icons; error and valid phone states both `border-gray-900`; error box is grey, not a live region; CTA `bg-blue-600` | Inaccessible, ambiguous validation, off-brand | `Dialog` primitive; real gateway logos; red-600 error state with `role="alert"`; brand button | High | M | `PaymentMethodSelector.jsx:56-62, 95, 131-149, 179` |
| OH3 | O | "Continue" in the payment modal marks the order `confirmed` immediately | Product/UX risk: no gateway step is visible | Show a pending state until the gateway callback | High | M | `CreateOrderForm.jsx:370-375` |
| OH4 | O | Remove button `rounded-xl` vs Add `rounded-2xl`; no focus moves to the first error | Drift | Primitives | Low | S | `CreateOrderForm.jsx:493, 535` |

### 6.13 Payment confirm, Earn Money, Policy, 404

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| PC1 | O | Double spinner (ring + spinning icon); status title not `aria-live`; hover `#155a90` (4th hover shade) | Noise; un-announced status | One spinner; `role="status"`; token | Low | S | `PaymentConfirmPage.jsx:149-151, 237` |
| EM1 | O | "Earn now" links to `https://www.thetolet.com/bd/user-panel/job-feeds` (the competitor) in a new tab | Sends users off-product | Link to the internal job-feed tab | High | S | `Earnmoney.jsx:15` |
| PP1 | O | Every policy section renders `<h2>` regardless of `level`; breadcrumb without `aria-label`; `max-w-5xl` is a 3rd reading width | Heading structure; drift | Map level → tag; `--shell-narrow` | Low | S | `PolicyPage.jsx:40, 56-57` |
| NF1 | S | 404 is rendered outside SiteChrome (no nav/footer); hard-coded hex button | Dead end | Render inside chrome; Button primitive | Low | S | `app/not-found.js:10-16` |

### 6.14 Admin (`src/components/admin-panel/AdminShell.jsx`, `src/Component/Admin/*`) — code review only

| # | Type | Problem | Why | Solution | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| AD1 | O | Delete, Approve, Reject fire with no confirmation (card and modal) | Irreversible admin actions | `ConfirmDialog` | Critical | S | `PropertyManagement.jsx:1071, 1105-1120` |
| AD2 | S | Admin runs on a second brand: indigo `#465fff` ×42 (+`#3646d6`, `#6577ff`, `#7a8aff`, `#eef2ff`) in its own `AdminShell`, while the user dashboard uses `SharedPanelShell` in brand blue | Two products | Merge into `SharedPanelShell`; one brand | High | L | `AdminShell.jsx:42, 66, 210, 229` |
| AD3 | O | `AdminShell` drawer: no `aria-label` on menu/close, no Escape, no dialog role | A11y regression vs the user shell | Reuse `SharedPanelShell` | High | S | `AdminShell.jsx:164-169, 184-189` |
| AD4 | O | Broken class `bg-[#1E73B8]600` | Invisible/incorrect colour | `text-primary-600` | High | S | `PaymentMonitoring.jsx:335` (and six in dead `PaymentHistory.jsx:91-241`) |
| AD5 | O | "Total Users" label `text-gray-900` on a `from-blue-500` gradient tile; five gradient stat tiles (blue, green, yellow→orange, red, rose→pink); purple/indigo auto-approve banner with a toggle that has no `role="switch"`/`aria-checked` | Contrast and semantics | Neutral stat tiles; real switch | Medium | S | `PropertyManagement.jsx:701-812, 751` |
| AD6 | O | Icon-only View/Edit/Delete have `title` only; a duplicate View button; Edit is a full-page `<a href>` | Unnamed controls; reload | `aria-label`; router Link | Medium | S | `PropertyManagement.jsx:1056-1077` |
| AD7 | O | Developer instructions shown to admins ("Run CREATE_SITE_SETTINGS_TABLE.sql…"); detail modal reads `property.bedrooms` / `full_description` that the form never sets (shows N/A) | Leaks implementation; wrong data | Hide behind a dev flag; map to `total_rooms` / `short_description` | Medium | S | `PropertyManagement.jsx:695-697, 1241-1249` |
| AD8 | O | Legacy `bg-white rounded-lg shadow` markup is re-skinned globally by `.admin-panel-scope` `!important` rules (radius 1.5rem/0.9rem, text colours) | What the JSX says is not what renders; blocks token adoption | Delete the block once admin is on tokens | Medium | M | `index.css:378-426` |
| AD9 | O | Admin is untranslated (no `useLanguage` in any admin file); dates `toLocaleDateString('en-US')` | Bengali admins get English | Out of i18n scope by decision; note it | Low | L | `ContactUnlockRefundReview.jsx:19-31` |
| AD10 | O | Modals without role/Escape | Keyboard trap | `Dialog` | Medium | M | `UserManagement.jsx:478, 504, 634`; `PaymentMonitoring.jsx:310`; `PropertyManagement.jsx:1188` |

---

## 7. Component-by-component findings

### 7.1 Header / navigation (`src/Component/Home/Navber.jsx`)
Refs: all `*-top.png`.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line |
|---|---|---|---|---|---|---|---|
| N1 | S | Two rows (71 + 52 = 117 px measured) on every page ≥768: logo row with CTAs, then 7 links + Search | 117 px of permanent chrome; detail page loses ~45 px vs a single row | Single 64–72 px row at `lg+`: logo · Search (prominent) · Property list · Earn · Article · Add Property (primary) · Login/avatar; secondary links (Career, Profile, Saved) to the account menu/footer | High | L | `Navber.jsx:307-314` |
| N2 | O | Root is `<div>` not `<header>`; `<nav>` lacks `aria-label`; Search button lacks `aria-haspopup`/`aria-expanded`; Property dropdown has no Escape or arrow keys and is only `invisible opacity-0` when closed | Landmarks and menu semantics | `<header>`, labelled nav, proper disclosure | Medium | S | `Navber.jsx:302, 314, 332-365, 401` |
| N3 | O | Profile and Saved links shown to logged-out users | Dead ends to login | Hide until authenticated | Medium | S | `Navber.jsx:367-382` |
| N4 | O | Login styled as an outline pill on desktop and as a `rounded-lg` filled block in the drawer; logout is an icon-only red circle | Same action, three looks | Button primitive | Low | S | `Navber.jsx:479-496, 715, 725` |
| N5 | O | Container `max-w-[1420px] px-3 md:px-6 xl:px-8` ≠ page `site-shell-wide` 1320 → logo and content left edges differ by ~50 px at 1440 | Misalignment | `--shell` | Medium | S | `Navber.jsx:307`; `home-1440-top.png` |
| N6 | O | Logo SVG uses `#1a1a2e` text and Tailwind blues `#3b82f6/#1d4ed8/#2563eb/#1e40af/#60a5fa`, not the brand | The brand mark is off-brand | Redraw in ink + brand | Medium | S | `src/assets/NewToletLogo.jsx:22-53` |

### 7.2 Mobile drawer (`Navber.jsx:521-740`)
Works: dialog semantics, focus trap, Escape, scroll lock (harness J6 6/6).

| # | Type | Problem | Solution | Pri | Effort | File:line |
|---|---|---|---|---|---|---|
| MD1 | O | "Career" listed twice; on the homepage "Add Property" listed twice | De-duplicate | Low | S | `Navber.jsx:570-573, 684-687, 577, 619` |
| MD2 | O | Inline `style={{ zIndex: 9998/9999 }}`; `<li>` carries padding/`cursor-pointer` while the `<Link>` is a child (dead tap area); accordion button lacks `aria-expanded` | z-index scale; link fills row; `aria-expanded` | Low | S | `Navber.jsx:531, 543, 565, 600` |

### 7.3 Floating rail + bottom tab bar (`components/app/FloatingQuickRail.jsx`)
Refs: `home-390-top.png`, `listdetails-id-first-390.png`, `propertylist2-768-top.png`, `propertylist2-1280-top.png`.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line |
|---|---|---|---|---|---|---|---|
| R1 | O | Three floating UIs: desktop 5-button rail (`sm+`), mobile bottom tab bar, **and** a mobile right-hand column (Search/Saved/Call) that overlaps the second card's menu button and the detail page's "Copy ID" | Content covered; two search entry points on phones | Delete the mobile right column; bottom tab bar = Home · Search · Add · Saved · Account; desktop rail removed (header CTAs) | High | S | `FloatingQuickRail.jsx:198, 278, 357-390` |
| R2 | O | Tab labels `text-[10px]` / `text-[11px]`; badges `text-[10px]` | Sub-12 px text | 12 px | Medium | S | `FloatingQuickRail.jsx:292, 306, 317, 332, 348, 220, 234, 376` |
| R3 | O | Same feature, different routes: Saved → `dashboard` on desktop vs `dashboard?tab=saved` on mobile; Order Home → `my-orders` (popover) vs `orderhome` (tab bar); badge count from `localStorage.savedProperties` only (wrong for server-side saves) | Inconsistent destinations | One route map; count from the service | Medium | S | `FloatingQuickRail.jsx:23, 50, 169, 300, 370` |
| R4 | O | 80-line commented-out older rail; mixes `next/link` with `react-router` `Link` used everywhere else | Hygiene | Delete; one Link | Low | S | `FloatingQuickRail.jsx:393-475` |

### 7.4 Search overlay (`NavSearchOverlay.jsx`) and search forms

| # | Type | Problem | Solution | Pri | Effort | File:line |
|---|---|---|---|---|---|---|
| SO1 | O | Desktop modal has no `role="dialog"`, `aria-modal`, focus trap, initial focus or backdrop-click close; mobile overlay likewise | `Dialog` primitive | High | M | `NavSearchOverlay.jsx:116, 324-333` |
| SO2 | O | Chevron SVG duplicated six times without `aria-hidden`; two selects lack the custom chevron so one form has two select styles; desktop label "Area / Thana :" with a stray colon | `Select` primitive; copy fix | Low | S | `NavSearchOverlay.jsx:180-286, 409-461`; `search.js:59` |
| SO3 | O | `ModalSearchForm.jsx` (unrouted) binds two inputs to `filters.search`, uses `blue-500/600/700`, labels without `htmlFor` | Delete the file | Low | S | `ModalSearchForm.jsx:71, 82, 74, 99-157` |
| SO4 | S | Category chips are styled three different ways (CategoryFilterBar, overlay chips, legacy `List.jsx`) | One `Chip` | Low | S | `CategoryFilterBar.jsx:43`; `List.jsx:24-53` |

### 7.5 Category bar (`CategoryFilterBar.jsx`)
Works: 44 px chips, `aria-pressed`, selected state. Issues: chips wrap to a second row with an orphan "Shop" at 768 (`home-768-top.png`); on phones the horizontal scroll has no fade/affordance (`scrollbar-hide`); on the homepage the chips are *jump links* but announce as toggles (`aria-pressed`). Fix: horizontal scroll with edge fade below `lg`; `aria-current` on the homepage. (S/O, Medium, S, `CategoryFilterBar.jsx:42-49`)

### 7.6 Cover / hero (`Cover.jsx`, `Cover.css`)
Fixed heights 180/350/400 px; empty state renders an `h2` before the page `h1`; slide alt is "Cover photo N"; pagination bullets 8 px (not tappable); loading text has no `role="status"`; autoplay respects reduced-motion (good) but has no pause control. Fix: 16:9 max 420 px, descriptive alt from admin upload, 24 px bullets, pause button. (O, Medium, S, `Cover.jsx:110-131, 160`; `Cover.css:22-28`)

### 7.7 Property card (`src/components/PropertyListingCard.jsx`, `PropertyCardMedia.jsx`, `RentDisplay.jsx`)
Refs: `propertylist2-category-Family-1280.png`, `home-390-top.png`, `bn-list-390.png`.

| # | Type | Problem | Why | Solution | Pri | Effort | File:line |
|---|---|---|---|---|---|---|---|
| PC1 | S | Anatomy = competitor's; price last at `text-sm`; title is a blue `<p>` ("Family Apartment Rent"); no visible CTA or save control (buried in the ⋮ menu) | Scanning price requires reading five lines; blue non-link text; save needs two taps | §5.9 card: price first (ink tabular), `<h3>` title "{Type} in {Area}", icon meta row, footer with ID ticket + 44 px heart | Critical | M | `PropertyListingCard.jsx:387-462` |
| PC2 | O | Save-status toast and the Pinned badge share `left-2 top-2` (toast covers badge) | Overlap | Toast off-image or global | Medium | S | `PropertyListingCard.jsx:359`; `PropertyCardMedia.jsx:148` |
| PC3 | O | Pinned badge white on `amber-500` = 2.15:1 | Fails AA | Marigold fill + ink text | Critical | S | `PropertyCardMedia.jsx:148` |
| PC4 | O | Menu panel `rounded-md` inside a `rounded-2xl` card; items are plain buttons without `role="menuitem"`; focus not returned to the trigger on close | Drift; keyboard | `Menu` primitive | Low | S | `PropertyListingCard.jsx:409-437` |
| PC5 | O | Image-less fallback is a solid black box with white type and rent text at `text-[0.5rem]` in compact mode (8 px) | Harsh; illegible | Neutral placeholder illustration in `--site-surface-muted`; no sub-12 px text | Medium | S | `PropertyCardMedia.jsx:40-63` |
| PC6 | O | Area line `line-clamp-2` clips "Bashundhara Residential Area Block I, Dhaka" at 1440 (4 cards) and "To-Let from: November" at 390 (10 cards) | Measured clipping | Wider cards (grid fix) + ellipsis with `title` | Medium | S | harness `textClip` samples; `home-1440.png`, `propertylist2-390-top.png` |
| PC7 | O | Hover `#155b91` is a 3rd brand hover; `hover:-translate-y-0.5` on a link overlay | Drift; motion on every card | Token; shadow-only hover | Low | S | `PropertyListingCard.jsx:348, 545` |

### 7.8 Detail gallery, spec tiles, contact/unlock panel — see §6.3 D1–D8.

### 7.9 Buttons
No shared component. Public files contain ≈56 distinct class strings; `.site-button-*` (`index.css:660-694`) is used in 8 places and lacks `:disabled`/`:active`; daisyUI `btn` appears once in a dead file (`Information.jsx:95`, a button with no `onClick` and no `type`). Six brand hover shades. Buttons without `type` at `Feadback.jsx:175`, `List.jsx:24-53`, `Listdetails.jsx:471, 812`. **Fix:** `Button` primitive (§5.7). (S, High, M)

### 7.10 Inputs and selects
`.site-field` (12 px intended, **4 px rendered** because of the daisyUI collision) is used once; Add Property alone has five variants; `focus:ring-*` appears in ten colours (`[#1E73B8]` 41, `red-500` 24, `blue-500` 19, `primary-600` 14, `purple-200` 4 …); `focus-visible:` 2 uses vs `outline-none` 121. **Fix:** `Field`/`Select`/`Textarea` primitives + rename `--radius-field`. (O, Critical, M)

### 7.11 Modals and overlays
Inventory: 25 `fixed inset-0` overlays; 6 with `role="dialog"` (card report, detail ×2, Navber drawer, SharedPanelShell, PropertyCollectionsPanel); 4 files handle Escape; **0 focus traps outside the drawer**; no shared component. Native `alert()` ×12 (6 in dead files), `window.confirm` ×5. **Fix:** `Dialog` + `ConfirmDialog` + `Toast` primitives; z-index scale (`--z-nav 50 / --z-overlay 100 / --z-toast 110`). (O, High, M)

### 7.12 Badges and status indicators
Status chips are hand-rolled per file (`green/blue/red/yellow-100` in dashboard, `sky/emerald/red/amber` in MyProperties, gradients in admin). Pinned badge fails contrast. **Fix:** `Badge` with `promoted` (marigold), `verified`/`active` (success), `pending` (neutral), `rejected` (danger) variants. (S, Medium, S)

### 7.13 Empty states
`EmptyState` exists (`UserPanelPrimitives.jsx:24-30`) but only the user panel uses it; Home, Homelist, JobFeed, Feedback, dashboard panels and admin each hand-roll one with different weights and radii (`Home.jsx:435-438`; `Homelist.jsx:234-240`; `JobFeedSection.jsx:191-202`; admin `<p className="text-gray-600 text-lg">No … found</p>`). Copy is passive ("No feedback yet"). **Fix:** one primitive with icon + title + one-line next step + action. (S, Medium, S)

### 7.14 Error states
Homelist is the model (`role="alert"` + Retry). Elsewhere: raw `error.message` surfaced (`PropertyListingCard.jsx:298`, `Listdetails.jsx:317`); "Property not found" for every detail error (`Listdetails.jsx:385`); grey error box in the payment selector (`PaymentMethodSelector.jsx:149`); Contact banners without roles. **Fix:** `InlineError`/`Toast` with human copy map. (O, Medium, S)

### 7.15 Loading skeletons
Custom `@keyframes pulse` (scale 1→1.05) shadows Tailwind's opacity pulse — confirmed in-browser: both keyframes present, `.animate-pulse` resolves to the scale version → 18 skeletons *scale* (`index.css:299-306, 428`). The card skeleton is copied three times (`HomePageSkeleton.jsx:1-13`, `Home.jsx:62-72`, `Homelist.jsx:171-185`). `HomePageSkeleton` renders its own navbar and `<main>` and is used as the Suspense fallback **inside** SiteChrome's `<main>` → nested `<main>` and a second navbar while Home suspends (`HomePageSkeleton.jsx:18-32`; `SiteChrome.jsx:68`). Detail page loads with a spinner, no skeleton. **Fix:** rename keyframe; one `Skeleton` primitive; content-only fallback. (O, Medium, S)

### 7.16 Toast / notifications
None exist. **Fix:** `Toast` (bottom-centre on phones above the tab bar, top-right on desktop, `role="status"`, 5 s, dismissible). (S, Medium, S)

### 7.17 Tables
All dashboard/admin tables are `overflow-x-auto` with `px-6 py-3 text-xs uppercase` headers. **Fix:** `DataTable` that stacks rows into labelled definition lists below `md`. (S, Medium, M)

### 7.18 Footer (`Footer.jsx`)
Works: `site-shell-wide`, labelled social links, scroll-to-top with `aria-label`, `tel:`/`mailto:`. Issues: hover `#67aee2` (a 4th blue); column headings are `h3` with no `h2`; social links go to `facebook.com` etc., not NewTolet profiles; logo alt "Company Logo"; `mt-16` fixed gap. (O, Low, S, `Footer.jsx:30-33, 81, 94, 106`)

### 7.19 Language toggle (`LanguageToggle.jsx`)
Works: `role="group"`, `aria-pressed`, `lang` attributes. Issues: `xs` size is 28 px tall with 11 px text (`:6`); appears three times on mobile (header, drawer, auth card). **Fix:** one 36 px toggle in the header only. (O, Low, S)

### 7.20 Job feed section (`JobFeedSection.jsx`)
`rounded-[32px]` section, `rounded-[28px]` skeleton, gradient `from-[#1E73B8] via-sky-600 to-cyan-500` tiles (two off-brand blues), kicker tracking 0.35em, blank lines in JSX (`:161-169`). **Fix:** radius 24, brand/ink tile, 0.06em. (S, Low, S)

---

## 8. Responsive findings

Measured with the harness (fixture data). No horizontal overflow at any width.

| Width | Findings | Type | Pri | Evidence |
|---|---|---|---|---|
| 1440 | Content 1320 wide with the rail in the 60 px gutter; navbar container 1420 → logo 50 px left of content; 6-column grid leaves the 6th column empty with 5 items; 4 area lines clipped | O | Medium | `home-1440-top.png`, `home-1440.png`; harness clip samples |
| 1280 | Rail's left edge (1208) touches the filter card's right edge (1210); sticky bar `top:118px` vs measured nav 117 (1 px gap); filter card ~340 px tall before results; detail: ~230 px chrome + 450 px gallery → title/price below the fold | O | High | `propertylist2-1280-top.png`, `listdetails-id-first-1280.png` |
| 768 | Category chips wrap to two rows with "Shop" orphaned and centred; rail overlaps the 3rd card column; 7 nav links + Search on one 52 px row; sidebar layouts (`md:flex-row`) start here | O | Medium | `home-768-top.png`, `propertylist2-768-top.png` |
| 390 | **Right-hand floating column covers the second card's ⋮ button and the detail page's "Copy ID"**; bottom tab labels 10–11 px; 29 / 23 / 25 tap targets under 44 px on home / list / detail (samples: `EN 35×28`, `Open menu 32×32`, `Retry 35×20`, `(Terms & conditions apply) 166×16`, footer links 32 px tall, `Register here 93×20`); 10 clipped `line-clamp` strings per page; homepage is 12,093 px tall (30 cards in 2 columns + 5 sections); bottom bar reserves space correctly (0 px footer overlap) | O | High | `home-390-top.png`, `listdetails-id-first-390.png`, `propertylist2-390-top.png`; `results.json` tapTargets |
| Bengali (390/1280) | Hind Siliguri loads and leads the stack; Bengali card titles need two lines and are additionally hidden by the right column; breadcrumb mixes Bengali UI with English place names (data); eyebrow uppercase has no effect | O/S | Medium | `bn-list-390.png`, `bn-detail-1280.png`, `bn-home-390.png` |
| Cross-cutting | Sticky offsets hard-coded in five places (`72/118`); `scroll-mt-[220px]`; `.site-shell-bleed` clamp ≠ `.site-shell-wide` clamp (`index.css:738` vs `:619`); `addproperty` and `dashboard` routes build their own chrome without `.site-main` bottom padding (`app/addproperty/page.js:14-26`, `app/dashboard/page.js:13-21`) | O | Medium | code |

**Content priority on mobile (S):** the first screen should show search → category chips → first cards. Today it shows chips → 180 px hero → tagline → section heading, with cards starting ~550 px down (`home-390-top.png`).

---

## 9. Accessibility findings

### 9.1 Contrast (computed, WCAG 2.x AA = 4.5:1 normal text, 3:1 large/UI)

| Pair | Ratio | Result | Where |
|---|---|---|---|
| white on `green-500` #22C55E | **2.28** | ✗ | "Call Now" `Listdetails.jsx:822` |
| white on `amber-500` #F59E0B | **2.15** | ✗ | Pinned badge `PropertyCardMedia.jsx:148` |
| white on `red-500` #EF4444 | **3.76** | ✗ (16 px text) | Unlock buttons `Listdetails.jsx:477, 984`; drawer logout `Navber.jsx:715` |
| `red-500` on white | **3.76** | ✗ | terms link + unlock description `Listdetails.jsx:435, 458`; validation text `Addproperty.jsx` (`text-red-500`) |
| `gray-400` / `slate-400` on white | **2.54 / 2.56** | ✗ | 94 occurrences, 44 files (e.g. `UserPanelPrimitives.jsx:18`, `SharedPanelShell.jsx` section headings) |
| white/80 on brand (card toast, chips) | **3.81** | ✗ small text | `Propertylist2.jsx:251`, `JobFeedSection.jsx:155` |
| white on `#42a5f5` | **2.65** | ✗ | decorative only today (`ForgotPassword.jsx:52`) |
| `red-600` on `red-50` (14 px error text) | **≈4.4** | borderline ✗ | error boxes `Listdetails.jsx:465, 966` (use red-700 on red-50, 6.0:1) |
| brand `#1E73B8` on white / on `blue-50` | 5.00 / 4.59 | ✓ | |
| `gray-500` on white · `yellow-700` on `yellow-50` · `#67aee2` on `slate-950` | 4.83 · 4.76 · 8.39 | ✓ | |

### 9.2 Labels and names (O)
- Unlabelled inputs: Contact ×3 (harness-confirmed), EditProperty 23 labels / 0 `htmlFor`, Wallets ×4, Withdrawals ×2, MyProperties search, Referral username, PaymentMethodSelector phone, every admin search/select, `CreateOrderForm` via `FieldShell`.
- Unnamed controls: BuyCredits "X" close (`:202-207`), PropertyManagement "x" close (`:1198-1204`), PaymentMethodSelector close (`:60-62`), admin icon buttons with `title` only (`PropertyManagement.jsx:1056-1077`), detail thumbnails without `aria-pressed` (`Listdetails.jsx:613`).
- Harness confirms **0** unnamed controls and **0** images without alt on public pages — the gaps are in authenticated screens.

### 9.3 Keyboard and focus (O)
- `<div onClick>` with no keyboard path: `BuyCredits.jsx:249` (package cards), `CoverPhotoManagement.jsx:314`, `Listdetails.jsx:908`, `PropertyListingCard.jsx:410` (menu wrapper).
- Focus visibility relies entirely on the global `:focus-visible` outline (`index.css:704-707`); no per-element `focus-visible:` styling; 121 `outline-none`/`focus:outline-none` uses, two of which (`Addproperty.jsx:160, 240` counters) remove focus with no replacement. The harness confirmed a visible 2 px outline on the search input (J1@390).
- Card ⋮ menu: Escape closes but focus is not returned (`PropertyListingCard.jsx:176-206`); Property dropdown has no keyboard close (`Navber.jsx:332-365`).
- Dialogs: 25 overlays, 6 roles, 4 Escape handlers, 0 focus traps outside the drawer (§7.11).

### 9.4 Headings and landmarks (O)
- Home `<h1>` is 12 px (`Home.jsx:397`); About and Contact pages have no `<h1>` (harness h1=0); card titles are `<p>` (`PropertyListingCard.jsx:440`); 11 `<h1>`s use 10 different class strings; Cover empty state renders an `<h2>` before the `<h1>`; PolicyPage renders every level as `<h2>` (`:40`); Footer `h3`s with no `h2`.
- Navbar root is a `<div>` (`Navber.jsx:302`); `<nav>` without `aria-label` (`:314`); HomePageSkeleton nests a second `<main>` and navbar (`HomePageSkeleton.jsx:18-32`); breadcrumbs without `aria-label` (`Listdetails.jsx:491`, `PolicyPage.jsx:57`).

### 9.5 Motion (O)
Feedback carousel auto-advances every 4 s with no pause and ignores reduced-motion (`Feadback.jsx:88-113`) — WCAG 2.2.2. Cover carousel respects reduced-motion but has no pause control. Global reduced-motion block is good (`index.css:761-787`).

### 9.6 Touch targets (O)
At 390 px: 29 (home), 23 (list), 25 (detail) interactive elements under 44 px. Recurrent offenders: language toggle 35×28, hamburger 32×32, footer links 32 px tall, text links 16–23 px tall, carousel dots 8 px, "Retry" 35×20.

### 9.7 Screen-reader copy and i18n (O)
Asterisks inside locale strings (`addProperty.js:27-65`); emoji in a heading string (`:272`); raw `error.message` (`PropertyListingCard.jsx:298`, `Listdetails.jsx:317`); "Click to …" hints (`dashboard.js:55-59`); admin untranslated; Bengali labels at 12–13 px are below the comfortable size for matras; `en-BD` number formatting yields Western grouping where users expect lakh grouping (`rentDisplay.js:16`).

---

## 10. The 20 highest-impact improvements

Ranked by user impact × breadth × feasibility. **O** objective / **S** subjective.

| # | Problem | Why it matters | Recommended solution | Type | Pri | Effort | File:line · Evidence |
|---|---|---|---|---|---|---|---|
| 1 | Contrast failures on conversion elements and muted text: white/green-500 Call Now, white/amber-500 Pinned, white/red-500 Unlock, red-500 text, 94× `*-400` text | Fails WCAG AA on the two actions that make money and on every "muted" label | Token swap: success `#15803D`, marigold+ink badge, Unlock → brand, red-600/700 for text, `--site-text-muted` for all `*-400` | O | Critical | M | `Listdetails.jsx:435, 458, 477, 822, 984`; `PropertyCardMedia.jsx:148`; §9.1 |
| 2 | Unlabelled inputs across Contact, EditProperty (23/0), Wallets, Withdrawals, MyProperties, Referral, admin, Order form | Screen-reader users cannot complete forms; harness-confirmed on Contact | `Field` primitive with `id`/`htmlFor`; fix `FieldShell` | O | Critical | M | `Contact.jsx:79-103`; `EditProperty.jsx:715-1233`; `WalletsPanel.jsx:418-460`; `CreateOrderForm.jsx:106` |
| 3 | Card price is the last `text-sm` line; title is a blue `<p>`; no visible save | The product's core object does not communicate its primary fact | Price-first card, `<h3>` ink title, ID ticket, visible heart (§5.9) | S | Critical | M | `PropertyListingCard.jsx:387-462`; `propertylist2-category-Family-1280.png` |
| 4 | daisyUI's `--radius-field` (0.25rem) shadows the app's 12 px token → inputs render 4 px; daisyUI dark theme CSS shipped unconfigured; app dark mode via `!important` utility overrides | The token system silently does not work; dark-mode CSS blocks token adoption | Rename `--radius-field` → `--radius-input`; `@plugin "daisyui" { themes: light --default; }` or remove; delete/replace dark-mode block (owner decision) | O | Critical | S | `index.css:2, 18, 133-175`; runtime check |
| 5 | Three floating UIs; desktop rail overlaps content <1440; mobile right column covers card menus and Copy ID; duplicate search entry | Covered controls on every phone; collisions on common laptops | Delete mobile right column and desktop rail; bottom tab bar + header CTAs | O+S | High | S | `FloatingQuickRail.jsx:198, 278, 357-390`; `home-390-top.png`, `propertylist2-1280-top.png` |
| 6 | Home `<h1>` is a 12 px tagline; no search on the homepage; first listing ~830 px down | Primary task hidden; SEO/a11y hierarchy inverted | Real H1 now (S); search-first hero (L) | O+S | High | S / L | `Home.jsx:394-416`; `home-1440-top.png` |
| 7 | `xl:grid-cols-6` + `slice(0,8)` → 6+2 rows, 190 px cards, empty 6th column with 5 items | Orphans and illegible cards; blocks Bengali titles and any price-first layout | `lg:grid-cols-4` in Home grid + both skeletons | O | High | S | `Home.jsx:60, 132, 454`; `home-1440.png` |
| 8 | Guest contact panel `md:flex-row` inside the 320 px xl sidebar → one word per line | Visibly broken on every desktop | `flex-col` inside the sidebar | O | High | S | `Listdetails.jsx:429, 452`; `listdetails-id-first-1280.png` |
| 9 | Detail hierarchy ID > price > title; rainbow spec tiles; bedrooms missing; wrong icons; red Unlock / green Call | The page tenants decide on reads as a form dump | Title → price → ID; neutral tiles with bedrooms; brand Unlock, secondary Call | S+O | High | M | `Listdetails.jsx:638-746, 710, 715, 725` |
| 10 | Dialogs without role/Escape/focus trap (search overlay, payment selector, analytics, admin ×5); admin destructive actions with no confirmation | Keyboard traps; irreversible admin mistakes | `Dialog` + `ConfirmDialog` primitives | O | High | M | `NavSearchOverlay.jsx:116`; `PaymentMethodSelector.jsx:56`; `PropertyManagement.jsx:1071, 1105-1120, 1188`; `WalletsPanel.jsx:217` |
| 11 | Broken class `bg-[#1E73B8]600`; "Earn now" links to the competitor's site | Wrong colour; users sent off-product | Fix class; internal link | O | High | S | `PaymentMonitoring.jsx:335`; `Earnmoney.jsx:15` |
| 12 | Brand drift: 432 literals, 6 hover shades, admin indigo ×42, logo in Tailwind blue, map pins indigo | Two brands and a dozen blues; every future change is a grep | Codemod literals → tokens; redraw logo; one hover | S | High | M | `index.css:4-21`; `NewToletLogo.jsx:22-53`; `AdminShell.jsx:42`; `mapService.js:67` |
| 13 | Two-row 117 px navbar; + breadcrumb + sticky bar ≈ 230 px on detail; offsets hard-coded 118 vs measured 117 | Content below the fold on 1280×800; brittle sticky maths | Single-row nav at `lg+`; `--nav-h`; merge breadcrumb into the sticky bar | O+S | High | L | `Navber.jsx:307-314`; `Home.jsx:255, 353, 385`; `Listdetails.jsx:515, 781` |
| 14 | `@keyframes pulse` collision (18 skeletons scale); HomePageSkeleton nests `<main>` + second navbar | Wrong skeleton motion; invalid landmarks during load | Rename keyframe; content-only fallback | O | Medium | S | `index.css:299-306, 428`; `HomePageSkeleton.jsx:18-32` |
| 15 | No shared Button / Field / Dialog / Badge / Toast / Skeleton / EmptyState (56 button strings, 5 input variants, `alert()` ×12, `confirm()` ×5) | Every fix above must be made N times without this | `src/components/ui/*` primitives (§5.7–5.9) | S | Medium | L | `index.css:644-694`; `UserPanelPrimitives.jsx` |
| 16 | 7 container widths, 3 padding systems, bleed clamp ≠ shell clamp | Misaligned edges between nav, bars and content | `--shell` / `--shell-narrow` / `--shell-panel` | O | Medium | M | `index.css:606-620, 737-747`; `Navber.jsx:307`; `Propertylist.jsx:12`; `Homelist.jsx:20` |
| 17 | Card overlay collision (toast vs Pinned); save buried in ⋮; menu without roles; focus not returned | Hidden badge; two-tap save | Toast off-image; visible heart; `Menu` primitive | O | Medium | S | `PropertyListingCard.jsx:359, 392-437` |
| 18 | Feedback carousel autoplays, no pause, ignores reduced-motion | WCAG 2.2.2 | Pause on hover/focus + control + media query | O | Medium | S | `Feadback.jsx:88-113` |
| 19 | Copy without a system: currency ×4, Credits vs Points, "Property list/List/All property", raw errors, "Property not found" for all errors, "You have contact any time." | Erodes trust; untranslatable patterns | Copy guide + `formatMoney()` (`৳ 1,20,000`), one term "Credits", error copy map | O+S | Medium | S–M | `listing.js:15, 154-170`; `home.js:9, 32, 75`; `PropertyListingCard.jsx:298`; `Listdetails.jsx:317, 385` |
| 20 | Dead files (~15, incl. buggy `ModalSearchForm`, purple `Orderhome`, six broken classes in `PaymentHistory`), 14 template keyframes, scroll-reveal utilities with 0 uses, 80 commented lines | Inflates every grep, codemod and bundle | Delete after import-graph check | O | Medium | S | `index.css:186-566`; `FloatingQuickRail.jsx:393-475`; `ModalSearchForm.jsx:71, 82`; `Orderhome.jsx:230` |

---

## 11. Quick wins under one hour

Each is a single-file, low-risk change verified in scope.

| Win | File:line |
|---|---|
| Guest/locked contact panel: remove `md:flex-row md:items-center md:justify-between` | `Listdetails.jsx:429, 452` |
| Rename custom `@keyframes pulse` → `pulse-scale`; update `.animate-pulse-slow` | `index.css:299, 428` |
| Fix `bg-[#1E73B8]600` → `text-primary-600` | `PaymentMonitoring.jsx:335` |
| Grid `xl:grid-cols-6` → `lg:grid-cols-4` (grid + two skeletons) | `Home.jsx:60, 454`; `HomePageSkeleton.jsx:51` |
| Pinned badge: `bg-amber-500 text-white` → marigold fill + ink text | `PropertyCardMedia.jsx:148` |
| Call Now `green-500` → `green-700`; Unlock `red-500` → brand; terms link → muted; descriptions off red | `Listdetails.jsx:435, 458, 477, 822, 984` |
| Breadcrumb: `aria-hidden` separators, `aria-label`, current crumb in ink | `Listdetails.jsx:491-511` |
| Sticky offsets `118px` → `117px` (interim) in five places | `Home.jsx:255, 353, 385`; `Listdetails.jsx:515, 781`; `Propertylist2.jsx:199` |
| Navbar root `<div>` → `<header>`; `<nav aria-label="Main">` | `Navber.jsx:302, 314` |
| Delete the mobile right-hand rail and the commented-out block | `FloatingQuickRail.jsx:357-390, 393-475` |
| Tab-bar and badge labels `text-[10px]/[11px]` → `text-xs` | `FloatingQuickRail.jsx:220, 234, 292, 306, 317, 332, 348, 376` |
| Feedback carousel: pause on hover/focus + `matchMedia('(prefers-reduced-motion: reduce)')` guard | `Feadback.jsx:88-113` |
| daisyUI: `@plugin "daisyui" { themes: light --default; }`; rename `--radius-field` → `--radius-input` | `index.css:2, 18, 647` |
| Contact: three `<label htmlFor>`; submit `bg-blue-600` → brand; `<h1>` | `Contact.jsx:58, 79-116` |
| Card title `<p>` → `<h3>`; hover `#155b91` → `primary-600` | `PropertyListingCard.jsx:440, 545` |
| Home: tagline → `<p>`, real `<h1>` from the commented copy | `Home.jsx:397, 410-416` |
| Close "X"/"x" text buttons → icon + `aria-label` | `BuyCredits.jsx:202-207`; `PropertyManagement.jsx:1198-1204`; `PaymentMethodSelector.jsx:60-62` |
| Earn Money external link → internal job-feed tab | `Earnmoney.jsx:15` |
| Hide Profile/Saved nav links when logged out; de-duplicate "Career"/"Add Property" in the drawer | `Navber.jsx:367-382, 570-573, 577, 619, 684-687` |
| Placeholders "Dhaka, Mumbai, New York" → Bangladeshi examples; "You have contact any time." → real copy | `addProperty.js:77-78`; `home.js:75` |

**Looks small but is not under one hour:** the 94 `*-400` replacements (each needs a muted-vs-disabled judgement); EditProperty's 23 labels; the 432-site brand codemod across 52 files; any focus-trap work; the single-row navbar; dead-file deletion (verify the import graph first); the `--nav-h` ResizeObserver under static export.

---

## 12. Improvements requiring larger refactors

| Refactor | What | Depends on | Effort |
|---|---|---|---|
| **UI primitives library** `src/components/ui/` | `Button` (6 variants × 4 sizes, all states), `IconButton`, `Field`/`Select`/`Textarea`/`Label`/`FieldError`, `Dialog`/`ConfirmDialog` (role, Escape, focus trap, return focus, z-scale), `Toast`, `Badge`, `Chip`, `Skeleton`, `EmptyState`, `Breadcrumb`, `DataTable` (stacking), `Container` | Tokens (Phase 0) | L |
| **Single-row navbar + `--nav-h`** | One 64–72 px row at `lg+`, search as a prominent control, account menu; CSS variable with SSR default and a ResizeObserver; all sticky/scroll-margin values consume it | Rail removal | L |
| **Rail removal + container unification** | Delete desktop rail and mobile right column; bottom tab bar (Home · Search · Add · Saved · Account); `--shell 1280` for nav, bars and content; fix `.site-shell-bleed`; `addproperty`/`dashboard` routes use `SiteChrome` | — | M |
| **Brand-literal codemod** | `#1E73B8` → `bg-brand`/`text-brand`; six hover shades → `primary-600`; admin indigo → brand; logo SVG redraw; map marker colour | Tokens | M |
| **Price-first card + ID ticket** | New `ListingCard` with `PriceLine`, `IdTicket`, `StatusBadge`, visible save; one skeleton; used by Home, Homelist, compare, dashboard collections | Grid fix, Badge, Button | M |
| **Detail page reflow** | Title → price → ID; neutral spec tiles with bedrooms; sticky bar absorbs breadcrumb; 16:9 gallery; map; guest/locked panels stacked; Unlock/Call recoloured | Dialog, Badge | M |
| **Form parity** | One `PropertyForm` shared by Add and Edit (labels, `aria-invalid`, error map, focus-first-invalid, submit spinner, success toast); asterisks out of locale strings; location picker restored or removed | Field, Toast | L |
| **Admin consolidation** | `AdminShell` → `SharedPanelShell`; delete `.admin-panel-scope`; confirm dialogs; stacking tables; neutral stat tiles | Primitives | L |
| **Dark mode decision** | Delete the `!important` block and daisyUI dark theme, or rebuild on semantic tokens with a visible toggle | Owner decision | S (delete) / L (rebuild) |
| **Copy system** | `formatMoney()` with lakh grouping, one currency style (`৳ 24,500 /mo`), "Credits" everywhere, error copy map, terminology sheet (Property / Listing / Rent / To-let) applied to `en/*.js` and `bn/*.js`, `node scripts/i18n-check-keys.mjs` as the gate | — | M |
| **Dead code removal** | `ModalSearchForm`, `Homelist2`, `Information`, `List`, `Propertylist`(?), `Orderhome`, `OrderhomeLanding`, `PaymentHistory`, `Admin/FeedbackManagement`, `Admin/InquiryManagement`, `AddProperty/{ProgressIndicator,Screen1-4,FormNavigation,IDVerification}`, `OptimizedImage_DEBUG`; 11 template keyframes; `.scroll-animate*`, `.stagger-children`, `.gradient-text`, `.glass-effect`, `.hover-*` | Import-graph check | S–M |

---

## 13. Recommended implementation order

| Phase | Scope | Why this order | Verify by |
|---|---|---|---|
| **0 — Foundation** (no intended visual change) | Semantic tokens in `@theme`/`:root` (ink = `primary-800`, marigold 500/700, success, danger, neutral re-point, `--text-body`, shadows, z-scale); rename `--radius-field` → `--radius-input`; configure or remove daisyUI; rename `pulse` keyframe; fix `bg-[#1E73B8]600`; delete dead files and template keyframes; **decide dark mode** | Everything later references these; dead files otherwise inflate every codemod | `npm run build`; `node scripts/qa/responsive-check.mjs --phase after --fixture --channel chrome` then `--compare` against phase `audit`; `npx eslint src components app` |
| **1 — Primitives** | `Button`, `IconButton`, `Field`/`Select`/`Textarea`, `Dialog`/`ConfirmDialog`, `Toast`, `Badge`, `Chip`, `Skeleton`, `EmptyState`, `Breadcrumb`, `Container`; codemod `#1E73B8` → tokens and `rounded-lg` → `rounded-xl` on controls | Unblocks every page; fixes #2, #10, #15 and most of #1/#12 mechanically | Storybook-free: a `/dev/ui` route (dev only) rendering every variant/state; axe on it |
| **2 — Chrome** | Single-row navbar at `lg+`, `<header>`/`aria-label`, drawer de-dupe, hide logged-out links; remove desktop rail + mobile right column; bottom tab bar; `--shell` everywhere; `--nav-h`; footer hover colour; logo redraw | Grid widths, sticky offsets and the 1320 gutter all depend on rail removal; cards must not be sized against a container about to change | Harness overlap probes (`stkOvl`, `btmOvl`) = 0; tap-target count at 390 drops |
| **3 — Cards, home, search** | `ListingCard` price-first + ID ticket + visible save; grid 4-col; real `<h1>` + search-first hero; results page two-tier filters; one skeleton; overlay collision fixed; category chips scroll <lg | Needs Badge/Button/Skeleton (1) and container (2). Highest-visibility user win | `textClip` = 0 at 390/1440; card row-height deltas = 0; journeys J1/J3 pass |
| **4 — Detail** | Title → price → ID; neutral spec tiles with bedrooms; guest/locked panel stacked; Unlock → brand, Call → secondary; breadcrumb semantics in the sticky bar; 16:9 gallery; map; skeleton; distinct error copy | Needs Dialog/Badge; shares `IdTicket` with Phase 3 | Contrast table all ✓; `listdetails` cell at 1280 shows price above the fold |
| **5 — Forms, payments, dashboard** | Shared `PropertyForm` for Add/Edit; `FieldShell` ids; payment selector as `Dialog` with real logos and red error state; Buy Credits keyboardable + brand; dashboard panels on `PanelCard`/`EmptyState`; wallet delete confirm; stacking tables; sidebar at `lg` | Largest surface, lowest traffic; waits for stable primitives so it is written once | Label association count = fields count per file; needs test credentials for browser verification |
| **6 — Admin** | `AdminShell` → `SharedPanelShell`; remove indigo; delete `.admin-panel-scope` **after** admin is on tokens; confirm dialogs; `role="switch"`; neutral stat tiles; hide dev instructions; tables stack | Lowest breadth; depends on everything above | Admin smoke with an admin account |
| **7 — Polish** | Copy system (`formatMoney`, Credits, error map, terminology), Bengali type rules (13 px min, 14/600 labels, no negative tracking), motion cleanup, About stats from data, 404 inside chrome, auth logo/back link | Cross-cutting and cheap once components are centralised | `node scripts/i18n-check-keys.mjs`; `bn` screenshots at 390/1280 |

**Regression gate for every phase:** `node scripts/qa/responsive-check.mjs --phase after --fixture --channel chrome --widths 390,768,1280,1440 --journeys` followed by `--compare`, plus the contrast table in §9.1 recomputed for any new colour pair.

---

### Appendix A — Evidence index
- Screenshots: `tmp/qa-screenshots/audit/{home,propertylist2,propertylist2-category-Family,listdetails-id-first,login,registration,about,contact,addproperty}-{1440,1280,768,390}[-top].png`, `bn-{home,detail,list}-{390,1280}.png`, `results.json`, `run.log`.
- Runtime checks (playwright-core against `localhost:3000`, 22 Oct 2026): navbar 72 px @390 / 117 px @≥768; home `<h1>` 12 px @390, 16 px @1440; two `@keyframes pulse` in the cascade; `--radius-field` = `0.25rem`, `.site-field` border-radius = `4px`; fonts loaded Poppins 400–700 + Hind Siliguri 400; containers 390/768/1280/1320 px at the four widths; `document.documentElement.lang = 'bn'` with Hind Siliguri leading in Bengali mode.
- Built CSS (`.next/static/css/3825977c3074f3de.css`): `--radius-field:.25rem` ×4, `--radius-field:12px` ×0, `prefers-color-scheme:dark` ×1, `data-theme=dark` present, Tailwind `@keyframes pulse{50%{opacity:.5}}` present.
- Benchmark: thetolet.com homepage and `/login` fetched 22 Oct 2026 (sections, card anatomy, CTA labels recorded in §1 and §4).
- Prior QA: `claudedocs/qa/RESPONSIVE_QA_REPORT.md` (21 Oct 2026) — items it marked "applied" (reduced-motion, `:focus-visible`, skip link, `<main>`, drawer semantics, card ⋮ 44 px, dialog roles) were re-verified as present in the current tree and are listed as strengths above.

# Homepage "jumps to top on first visit" — root cause and fix

**Date:** 21 October 2026 · **Reported on:** desktop, dev server, UI in Bangla · **Symptom:** first time after a page load, scrolling down to the articles / job-feed area snaps the page back to the top; after one reload it stops. The dev overlay showed "1 Issue".

## Root causes (two, both confirmed in code; one reproduced in the browser)

**1. The Feedback section could suspend the whole page.**
`src/Component/Home/Home.jsx` loaded `Feedback` with `next/dynamic` but without a `loading` fallback, so it had no Suspense boundary of its own, and `src/components/DeferredSection.jsx` mounted children without one either. On a first visit the Feedback chunk is not cached; when the section scrolled near the viewport the mount suspended up to the nearest boundary, which is the **page-level** `<Suspense fallback={<HomePageSkeleton/>}>` in `components/app/HomeShellRouter.jsx`. The whole page was replaced by a one-screen skeleton, the document height collapsed, the browser clamped the scroll position to the top, and the page came back at the top. On later visits the chunk is cached (instant) and the page is taller (cached listings), so it never showed. Also, `Home.jsx` showed the small "no listings" box while the catalogue was still loading, making first-visit pages short enough that the Feedback section was reached right after the articles/job feed.

**2. Hydration mismatch in Bangla mode (the "1 Issue").**
Reproduced headlessly with `localStorage.appLanguage = 'bn'`: "Hydration failed because the server rendered text didn't match the client… this tree will be regenerated on the client" at `Home › CategoryFilterBar` (client `ফ্যামিলি`, server `Family`); 0 errors in English. The provider resolved the language once; React hydrated the root with `'en'`, switched the provider to `'bn'`, and then hydrated the `Home` Suspense boundary later, so everything inside rendered Bangla against English HTML. React answers a mismatch by regenerating the boundary on the client, which is another skeleton swap.

## Changes (4 files, no UI or translation changes)

| File | Change |
|---|---|
| `src/components/DeferredSection.jsx` | Children render inside their own `<Suspense fallback={fallback}>`; visibility flips inside `startTransition`. A cold chunk now suspends within its own section at the same placeholder height. |
| `src/Component/Home/Home.jsx` | `Feedback` gets a `loading` fallback like its siblings; while the catalogue is still loading and no sections exist, the category skeleton is shown instead of the "no listings" box. |
| `src/i18n/useLanguage.js` | The hook reads the language with `useSyncExternalStore` itself and composes `t/tv/tc/fd/fdt/dict`; hook API unchanged. Every consumer hydrates with `'en'` (matching the HTML) and switches right after its own hydration, including inside late-hydrating boundaries. |
| `src/i18n/LanguageContext.jsx` | Provider keeps only the setters and the `<html lang>` effect; its context value no longer changes with the language. |

## Verification

Headless Chrome against the dev server on `:3000`, fresh browser context per case (first-visit conditions, empty storage), with the Feedback chunk artificially delayed by 3 s to force the race:

| Check | Result |
|---|---|
| Hydration errors with `appLanguage='bn'` on `/`, `/propertylist2/`, `/login/` | 0 (was 1 on `/`); `<html lang="bn">` and Bangla text rendered |
| Scroll-through of `/` at 1280 and 390 px, English and Bangla | page never collapsed to the skeleton (minimum document height while scrolled 3,472-5,068 px, versus ~1 screen before); no page errors |
| Backwards scroll steps | one benign clamp per run at the very bottom of the page when the Feedback placeholder (280 px) is replaced by its slightly shorter content; the same block stays at the top of the viewport, no jump to the top |
| Navbar EN → বাং → EN toggle | switches `<html lang>`, stored value and page text both ways |
| `npx eslint` on the four files | 0 errors |
| `node scripts/i18n-check-keys.mjs` | unchanged, EN/BN parity intact |
| `npm run build` (isolated copy of the patched tree, so the running dev server was not disturbed) | exit 0, compiled successfully in 32.6 s |

## Notes and limitations

- In the production static export every `(site)` page is already client-rendered (skeleton-only HTML), so cause 2 only showed in `next dev` or an SSR deployment; cause 1 applied to production as well (first-visit chunk fetch).
- Placeholder heights for the deferred sections are approximations (280 px for Feedback, 180 px for ad slots); a small bottom-of-page clamp remains when real content is shorter than its placeholder. Harmless, but the heights can be tuned once real content sizes are known.
- With Supabase still unreachable, the category area ends in the "no listings" box after loading; with a live backend it fills with sections, which pushes content below it further down as before.

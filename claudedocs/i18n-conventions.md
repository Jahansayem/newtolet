# NewTolet i18n conventions (English / Bengali)

The site has a client-side language toggle (EN / বাং) persisted in `localStorage.appLanguage`.
Infrastructure lives in `src/i18n/`. Follow these rules exactly when translating a component.

## Using translations in a component

```jsx
import { useLanguage } from '../../i18n/useLanguage'   // adjust relative path

const MyComponent = () => {
  const { t, tv, tc, fd, language } = useLanguage()
  ...
  <h2>{t('listing.detail.title')}</h2>
  <p>{t('search.resultsCount', { count: 12 })}</p>       // {var} interpolation
  <span>{tv('categories', property.category)}</span>      // DB enum value -> label
  <span>{tc('search.resultsCount', total)}</span>         // plural: key_one / key_other
  <time>{fd(order.created_at, { year: 'numeric', month: 'short', day: 'numeric' })}</time>
```

- `t(key, vars)`: dot-path lookup, falls back bn → en → key string.
- `tv(namespace, rawValue)`: looks up `values.<namespace>.<rawValue>`; returns rawValue unchanged if unmapped. Use for DB enums (categories, propertyTypes, divisions, status, amenities). **Never** translate DB values that are sent back to the server; only translate at render.
- `tc(key, count, vars)`: looks for `key_one` / `key_other`, then `key`. `{count}` is injected.
- `fd(date, options)` / `fdt(date, options)`: locale-aware dates with **Western digits** (`bn-BD` + `numberingSystem: 'latn'`). Replace hard-coded `toLocaleDateString('en-US', …)` in user-facing (non-admin) code with these.
- Numbers / currency: **do not change**. Keep `toLocaleString('en-BD')`, `Intl.NumberFormat('en-BD')`, `৳`. Western digits in both languages is a product decision.
- Only `'use client'` components (or components rendered by them) can call `useLanguage`. If a file is a server component (no hooks, in `app/`), add `'use client'` or move the markup into a client component.
- Components must never read `localStorage` for language during render. For rare imperative code outside React (e.g. `alert()`), use:
  ```js
  import { translate, readStoredLanguage } from '../../i18n'
  alert(translate(readStoredLanguage(), 'addProperty.alerts.locationRequired'))
  ```
- Module-level constants must hold `labelKey` (or raw DB values), **never** translated strings:
  ```js
  const SORT_OPTIONS = [{ value: 'newest', labelKey: 'search.sort.newest' }, ...]
  // in JSX: {t(option.labelKey)}
  ```
- `useMemo`/`useCallback` that build labels must include `t` (or `tv`) in their dependency array. `t` changes identity when the language changes.
- Strings built by concatenation (`` `${n} rooms` ``, `'Posted: ' + x`) must become one dictionary string with `{vars}`. Bengali word order differs, so never join translated fragments.
- Translate attributes too: `placeholder`, `aria-label`, `title`, `alt`, `<option>` labels, react-hook-form `message:` strings (compute inside the component so `t` is in scope), fallback literals like `|| 'N/A'` (use `t('common.na')`).
- English output must remain byte-identical after conversion. Do not reword English copy, do not refactor structure, do not change styling. Only swap literals for `t()` calls.
- `src/services/*` error messages stay English. Admin components (`src/Component/Admin`, `src/components/admin-panel`, `app/admin*`) stay English. `src/components/panel/SharedPanelShell.jsx` is shared with admin: it must not call `useLanguage`; pass labels in via props with English defaults.

## Dictionaries

- Core strings: `src/i18n/locales/en.js` and `bn.js` (namespaces `common`, `nav`, `footer`, `quickRail`, `notFound`, `values.divisions`, `values.categories`). Reuse `common.*` keys (`save`, `cancel`, `close`, `back`, `next`, `loading`, `retry`, `search`, `viewAll`, `na`, `yes`, `no`, `perMonth`, `edit`, `delete`, `confirm`, `optional`, `required`, `all`, `status`, `date`, `amount`, `actions`, `details`) rather than duplicating.
- Per-phase namespaces live in `src/i18n/locales/en/<ns>.js` and `src/i18n/locales/bn/<ns>.js` and are merged automatically by `locales/merge.js`. Each module default-exports an object whose top-level keys are namespaces, e.g.
  ```js
  const listing = {
    listing: { negotiable: 'Negotiable', card: { ... }, detail: { ... } },
    values: { propertyTypes: { Apartment: 'Apartment', ... }, status: { pending: 'Pending' } },
  }
  export default listing
  ```
  `values.*` from every module are deep-merged, so a module may add value maps. Keys inside `values.*` are the **exact DB strings** (case-sensitive).
- Namespaces: `common, nav, footer, quickRail, notFound, home, search, listing, orders, auth, payments, dashboard, addProperty, policy, earn, errors, values`.
- Key naming: camelCase, named by **meaning** not by English text (`listing.detail.backToHome`, not `backToHomeText`). Group by component section inside a namespace (`dashboard.profile.*`). Plurals: `key_one` / `key_other` in en; bn usually needs only `key` (Bengali nouns don't inflect for number).
- `en` is the source of truth; every key added to `en/<ns>.js` must also be added to `bn/<ns>.js`. Run `node scripts/i18n-check-keys.mjs` to diff key sets.
- Bengali style: natural, modern Bangladeshi web Bengali (the register used by bdjobs / Bikroy / Pathao). Keep brand names (NewTolet, Wavezly, bKash, Nagad) in Latin. Use common loanwords where they are standard (প্রপার্টি, অ্যাপার্টমেন্ট, লগইন, প্রোফাইল, ক্রেডিট). Use the respectful imperative (করুন, দিন, দেখুন). Use `৳` as-is. Keep `{vars}` tokens untouched.

## Verification per phase

1. `npx eslint <changed files>` is clean.
2. `node scripts/i18n-check-keys.mjs` reports no missing bn keys for your namespaces.
3. Grep each converted file for leftovers: `grep -nE '>[A-Z][a-z]+|placeholder="[A-Z]|aria-label="[A-Z]|title="[A-Z]|\|\| '\''[A-Z]' <file>`.
4. The dev server on http://localhost:3001 hot-reloads. Toggle EN / বাং in the navbar and confirm your pages switch without console errors.

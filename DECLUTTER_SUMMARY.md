# Declutter Summary

## Size Change
- Original size: `3.86 GB` (`3950.83 MB`)
- New size: `0.45 GB` (`455.91 MB`)
- Net space recovered: `3494.92 MB` (`3.41 GB`)

## What Was Deleted
| Item | Type | Space recovered |
| --- | --- | ---: |
| `.next` | generated Next.js output and Turbopack cache | `2109 MB` |
| `.next.zip` | archived build output | `1328.39 MB` |
| `node_modules/.vite` | stale Vite cache | `57.54 MB` |

Notes:
- `.next` was regenerated once during build validation and then removed again so the repo remains clean.
- The gross savings from deleted artifacts total about `3494.93 MB`. The final net repo reduction is `3494.92 MB` after adding the new report files and one small route-wrapper code change.

## What Was Kept Intentionally
- `app/` and `src/` because the current Next.js routes still import active application code from `src/Component/...`
- `components/`, `public/`, `package.json`, `package-lock.json`, and `next.config.mjs`
- root markdown and SQL files because they are small and may still be useful project artifacts
- local tool folders `.claude`, `.serena`, and `claudedocs` because they are tiny and not the source of bloat

## Additional Changes Made
- Updated `.gitignore` to block `.next.zip`, `*.zip`, `.turbo`, `.cache`, `coverage`, `tmp`, `temp`, `.serena/cache`, and `.claude/cache`.
- Fixed a pre-existing Next.js build issue in `app/(site)/propertylist2/page.js` by wrapping the page content in `Suspense`. This was required because the migrated component tree uses `useSearchParams()`.

## Manual Review Still Needed
- Review whether `eslint-plugin-react-refresh` is still needed.
- Review whether the many root `.md` and `.sql` files should be reorganized into a `docs/` or `database/` folder for maintainability.
- Review duplicate-looking logo files under `src/assets/` and `public/`; they are not identical, so no safe auto-dedup was performed.

## Risk Areas
- The repo has many pre-existing user changes unrelated to this cleanup. None of them were reverted.
- The `src/` tree may look legacy, but it is still active. Removing it would break the app.

## Recommended Next Cleanup Step
- Run a focused dependency/config review next: start with `eslint-plugin-react-refresh`, then review whether the compatibility layer around `react-router-dom` can eventually be phased out as components are rewritten for native Next.js patterns.

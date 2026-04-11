# Repository Hygiene Notes

## Recommended `.gitignore` Entries
- `node_modules`
- `.next`
- `.next.zip`
- `*.zip`
- `.turbo`
- `.cache`
- `coverage`
- `tmp`
- `temp`
- `.serena/cache`
- `.claude/cache`
- `out`
- `dist`
- `*.log`
- `.env`
- `.env.local`

## Package Manager Recommendation
- Standardize on `npm`.
- Keep `package-lock.json` as the single lockfile.
- Current audit found no `yarn.lock` or `pnpm-lock.yaml`, so there is no active package-manager duplication.

## Folders That Should Never Be Committed
- `node_modules/`
- `.next/`
- `.turbo/`
- cache folders under local tooling such as `.serena/cache`
- temporary folders such as `tmp/`, `temp/`
- coverage output and test artifacts
- local archives of generated output such as `.next.zip`

## Large Asset Recommendations
- Large media is not the current repo-size problem. Runtime assets are small; the biggest current logos are only a few hundred KB.
- `src/assets/logo*.png` and `public/logo*.png` share names but are not byte-identical. Review them manually before any deduplication.
- If future media uploads are added to the repo, move large photos/videos to object storage or a CDN instead of storing them in git.

## Dependency Cleanup Recommendations
- Review `eslint-plugin-react-refresh`; it looks like leftover Vite-era tooling and may no longer be needed.
- Review `react-icons` usage for bundle size, not repo disk size. Importing only the icons used can reduce generated build output.
- Do not remove `src/lib/react-router-dom.jsx` yet. It is part of the migration compatibility layer and still supports active code paths.

## Future Migration Cleanup Practices
- After framework migrations, remove old tool caches immediately: `.next/`, `.vite/`, `dist/`, `build/`, `coverage/`.
- Do not archive build output inside the repo. If a snapshot is needed, store it outside the project workspace.
- Validate route wrappers for Next.js requirements early. Client components using `useSearchParams()` need a `Suspense` boundary.
- Avoid Windows reserved filenames such as `nul`, `con`, `prn`, `aux`, and `com1`-`com9` anywhere in the repo, including accidental junk files, because tooling and file watchers can fail unpredictably.
- Keep source migration notes if they are useful, but move long-lived operational docs into a dedicated `docs/` folder if they start accumulating.

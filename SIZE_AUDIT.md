# Size Audit

## Total Size
- Total repository size at audit time: `3.86 GB` (`3950.83 MB`)

## Largest Top-Level Directories and Files
| Item | Type | Size |
| --- | --- | ---: |
| `.next` | generated Next.js build/dev output | `2109 MB` |
| `.next.zip` | archived copy of `.next` | `1328.39 MB` |
| `node_modules` | installed dependencies | `510.67 MB` |
| `src` | active app source | `1.46 MB` |
| `.git` | git metadata | `0.46 MB` |
| `public` | runtime public assets | `0.28 MB` |

## Largest Nested Directories and Files
### Large nested directories
| Item | Size |
| --- | ---: |
| `.next/dev` | `2066.76 MB` |
| `.next/dev/cache/turbopack/52faae3d` | `1848.20 MB` |
| `.next/dev/static` | `114.52 MB` |
| `.next/dev/server` | `102.59 MB` |
| `node_modules/.vite` | `57.54 MB` |

### Largest files
| Item | Size |
| --- | ---: |
| `.next.zip` | `1328.39 MB` |
| `.next/dev/cache/turbopack/52faae3d/00001629.sst` | `259.99 MB` |
| `.next/dev/cache/turbopack/52faae3d/00001726.sst` | `254.52 MB` |
| `.next/dev/cache/turbopack/52faae3d/00000666.sst` | `253.33 MB` |
| `.next/dev/cache/turbopack/52faae3d/00000182.sst` | `252.12 MB` |
| `.next/dev/cache/turbopack/52faae3d/00000138.sst` | `251.09 MB` |
| `.next/dev/cache/turbopack/52faae3d/00002682.sst` | `208.49 MB` |
| `node_modules/@next/swc-win32-x64-msvc/next-swc.win32-x64-msvc.node` | `130.37 MB` |
| `.next/dev/cache/turbopack/52faae3d/00002681.sst` | `100.29 MB` |

## Ranked Root Causes of Size Bloat
1. `Next.js / Turbopack dev cache` in `.next/dev/cache/turbopack` is the main cause. This alone accounts for about `1.85 GB`.
2. `.next.zip` is a retained archive of generated build output and duplicates the `.next` footprint by another `1.33 GB`.
3. `node_modules` is a normal installed dependency tree, but still large at `510.67 MB`.
4. `node_modules/.vite` is leftover Vite cache from the previous React toolchain and adds about `57.54 MB`.

## Migration-Specific Findings
- The repo does **not** have both old and new app entrypoints active. Old CRA/Vite entry files such as `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, and `src/App.css` are already gone.
- The repo **does** use a migration-wrapper structure:
  - `app/` contains Next.js routes.
  - Those route files import active UI and logic from `src/Component/...`.
- `src/` is therefore not dead code by default and must be treated as active application code.
- There is no duplicate root lockfile setup. Only `package-lock.json` exists.
- No large media library was found. Public and source assets are small.
- Duplicate-looking assets such as `src/assets/logo*.png` and `public/logo*.png` are **not identical files** and should not be auto-removed.

## Safe-to-Delete Items
| Item | Why safe | Est. savings |
| --- | --- | ---: |
| `.next` | generated Next.js output; regenerates on build/dev | `2109 MB` |
| `.next.zip` | archived copy of generated output; not runtime input | `1328.39 MB` |
| `node_modules/.vite` | stale Vite cache; recreated only if Vite is used again | `57.54 MB` |
| stray `nul` file if present | zero-byte junk file | negligible |

## Review-Before-Delete Items
| Item | Reason |
| --- | --- |
| `.claude`, `.serena`, `claudedocs` | local tooling metadata/docs; tiny and not driving size |
| root `.md` and `.sql` files | numerous but small; may still be useful project documentation/migrations |
| `eslint-plugin-react-refresh` dependency | likely Vite-era leftover, but should be checked against ESLint config before removal |
| any `src/` subtree | active code is still imported from `app/` |
| compatibility shim `src/lib/react-router-dom.jsx` | actively supports migrated components |

## Keep Items
- `app/`
- `src/`
- `components/`
- `public/`
- `package.json`
- `package-lock.json`
- `next.config.mjs`
- `.env.local.example`

## Immediate Quick Wins
1. Delete `.next`.
2. Delete `.next.zip`.
3. Delete `node_modules/.vite`.
4. Extend `.gitignore` to block archives and additional cache folders from being committed or retained accidentally.

## Estimated Recoverable Space
- High-confidence immediate recovery: about `3494.93 MB` (`3.41 GB`)
- Additional savings from tiny junk/cache cleanup: negligible

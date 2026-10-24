# Deployed database snapshots

Schema-only snapshots of the **deployed** self-hosted Supabase database on the
VPS, taken with `scripts/deploy/supabase-selfhost/dump-schema.sh`. They exist
because `DATABASE_SCHEMA.sql` was synced against the old hosted project in April
2026 and the repo migrations were applied by hand afterwards, so neither file
alone describes what is actually running.

Files per snapshot date (`YYYYMMDD`):

| File | Contents |
|---|---|
| `schema-public-*.sql` | `pg_dump --schema-only -n public` (no owners, no grants) |
| `policies-*.txt` | every RLS policy in `public` and `storage` with USING / WITH CHECK |
| `rls-*.txt` | RLS flag, owner and policy count per public table |
| `functions-*.txt` | public functions with SECURITY DEFINER flag, ACL and `search_path` |
| `grants-*.txt` | table privileges held by `anon`, `authenticated`, `service_role`, `PUBLIC` |
| `data-facts-*.txt` | counts, column lists and distinct status values the admin migration relies on |

Regenerate before writing any migration:

```bash
bash scripts/deploy/supabase-selfhost/dump-schema.sh 138.252.125.198
```

The dump is read-only on the VPS and contains no row data or secrets.

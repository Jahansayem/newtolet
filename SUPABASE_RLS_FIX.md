# Supabase Storage RLS Fix

## Problem

Uploads from the browser fail with `new row violates row-level security policy`
(the admin cover-photo upload shows it as `Upload failed: ...`).

Supabase Storage stores every file as a row in `storage.objects`, inserted as the
caller's JWT role (`authenticated` for signed-in users). With RLS enabled and no
policy for the bucket, the insert is rejected. Service-role callers (the
`agent-listings` Edge Function, migration scripts) bypass RLS, so they keep
working even when browser uploads do not.

On the self-hosted VPS stack this happened because the migration restored
`storage.buckets` / `storage.objects` with `pg_restore --data-only`, which
carries rows but not policies.

## Fix

The buckets and policies are versioned in
`supabase/migrations/20261024120000_storage_bucket_policies.sql`:

| Bucket | Read | Write (insert / update / delete) |
|---|---|---|
| `cover-photos` | public | admins only (`public.is_current_user_admin()`) |
| `property-images` | public | any signed-in user |
| `id-documents` | owner folder or admin | owner folder (admins may delete) |

Apply it to the VPS with:

```bash
bash scripts/deploy/supabase-selfhost/apply-storage-policies.sh 138.252.125.198
```

The script prints the bucket and policy state before and after, streams the
migration into `psql`, and fails if any of the 12 expected policies is missing.
It is idempotent. From Claude Code, run it with the `!` prefix because remote DB
writes are blocked by the auto-mode classifier.

Do **not** disable RLS on `storage.objects` as a shortcut: that lets any holder
of the anon key upload or delete files in every bucket.

## Files involved

- `src/services/coverPhotoService.js` - uploads to `cover-photos`
- `src/services/imageUploadService.js` - uploads to `property-images` and `id-documents`
- `supabase/functions/agent-listings/images.ts` - service-role uploads (unaffected)

## Testing

1. Admin panel -> Cover Photos -> upload a file: expect "Cover photo added successfully".
2. As a normal user, add a property with photos and upload an ID document.
3. A `POST` to `/storage/v1/object/cover-photos/...` with only the anon key
   (no user session) must still be rejected.

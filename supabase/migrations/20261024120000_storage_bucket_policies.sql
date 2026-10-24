-- Storage buckets and storage.objects RLS policies for the NewTolet buckets.
--
-- Why: the move to the self-hosted Supabase stack restored storage.buckets /
-- storage.objects with `pg_restore --data-only`, which carries rows but no
-- policies (policies are DDL). The hosted project's policies were created in
-- the dashboard and never versioned, so browser uploads (role `authenticated`)
-- fail with "new row violates row-level security policy" while service-role
-- paths (migration copy, agent-listings Edge Function) keep working.
--
-- Idempotent: buckets are created only if missing (existing settings are left
-- untouched); every policy is dropped and re-created.
--
-- Access model:
--   cover-photos     public read; insert/update/delete only for admins
--                    (public.is_current_user_admin(), same users.is_admin flag
--                    the admin panel gates on)
--   property-images  public read; any signed-in user may insert/update/delete
--                    (objects copied during the migration have no owner_id, so
--                    an owner check would block deleting pre-migration photos)
--   id-documents     private; a user may read/write only objects under a
--                    folder named after their own auth uid; admins may read
--                    and delete any

alter table storage.objects enable row level security;

-- ---------------------------------------------------------------------------
-- Buckets (settings from STORAGE_SETUP.md)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('cover-photos', 'cover-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-images', 'property-images', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'id-documents', 'id-documents', false, 2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- cover-photos
-- ---------------------------------------------------------------------------
drop policy if exists "storage_cover_photos_select" on storage.objects;
create policy "storage_cover_photos_select"
on storage.objects
for select
to public
using (bucket_id = 'cover-photos');

drop policy if exists "storage_cover_photos_insert" on storage.objects;
create policy "storage_cover_photos_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'cover-photos' and public.is_current_user_admin());

drop policy if exists "storage_cover_photos_update" on storage.objects;
create policy "storage_cover_photos_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'cover-photos' and public.is_current_user_admin())
with check (bucket_id = 'cover-photos' and public.is_current_user_admin());

drop policy if exists "storage_cover_photos_delete" on storage.objects;
create policy "storage_cover_photos_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'cover-photos' and public.is_current_user_admin());

-- ---------------------------------------------------------------------------
-- property-images
-- ---------------------------------------------------------------------------
drop policy if exists "storage_property_images_select" on storage.objects;
create policy "storage_property_images_select"
on storage.objects
for select
to public
using (bucket_id = 'property-images');

drop policy if exists "storage_property_images_insert" on storage.objects;
create policy "storage_property_images_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'property-images');

drop policy if exists "storage_property_images_update" on storage.objects;
create policy "storage_property_images_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'property-images')
with check (bucket_id = 'property-images');

drop policy if exists "storage_property_images_delete" on storage.objects;
create policy "storage_property_images_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'property-images');

-- ---------------------------------------------------------------------------
-- id-documents (object path is <auth uid>/<side>-<timestamp>-<name>)
-- ---------------------------------------------------------------------------
drop policy if exists "storage_id_documents_select" on storage.objects;
create policy "storage_id_documents_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'id-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_current_user_admin()
  )
);

drop policy if exists "storage_id_documents_insert" on storage.objects;
create policy "storage_id_documents_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- The client uploads with upsert: true, which becomes an UPDATE when the
-- object already exists, so an update policy is required as well.
drop policy if exists "storage_id_documents_update" on storage.objects;
create policy "storage_id_documents_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'id-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "storage_id_documents_delete" on storage.objects;
create policy "storage_id_documents_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'id-documents'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_current_user_admin()
  )
);

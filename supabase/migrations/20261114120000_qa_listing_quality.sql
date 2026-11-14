-- QA audit 2026-11-14: listing quality and trust.
--
-- 1. Placeholder 1-Taka rents become "Negotiable" (owner decision, 2026-11-14).
-- 2. Listings expire after 60 days unless the owner renews them (existing listings get a fresh
--    60-day window from the day this runs, so nothing disappears at once).
-- 3. Owners can mark their contact number as reachable on WhatsApp.
-- 4. A public, minimal "is the owner verified?" lookup for listing cards and detail pages.
--
-- Safe to re-run: every statement is idempotent.

begin;

-- 1. Placeholder prices --------------------------------------------------------------------------
-- 2,335 approved listings carried a rent of 1 Taka (counted 2026-11-14). The table constraint
-- properties_negotiable_or_priced_chk allows a null amount only when the rent is negotiable.
update public.properties
set is_rent_negotiable = true,
    rent_amount_bdt = null
where rent_amount_bdt is not null
  and rent_amount_bdt <= 1;

-- 2. Expiry -------------------------------------------------------------------------------------
alter table public.properties
  add column if not exists expires_at timestamptz;

update public.properties
set expires_at = now() + interval '60 days'
where expires_at is null;

alter table public.properties
  alter column expires_at set default (now() + interval '60 days');

create index if not exists properties_public_expires_idx
  on public.properties (expires_at)
  where status = 'approved' and deleted_at is null;

-- Owner (or admin) extends a listing by 60 days from now. Security definer so the owner does not
-- need a broad UPDATE grant; never touches status, so moderation triggers do not fire.
create or replace function public.renew_property_listing(p_property_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_expires_at timestamptz;
begin
  select user_id into v_owner
  from public.properties
  where id = p_property_id and deleted_at is null;

  if not found then
    raise exception 'Property not found.';
  end if;

  if v_owner is distinct from auth.uid() and not public.is_current_user_admin() then
    raise exception 'You can only renew your own listings.';
  end if;

  update public.properties
  set expires_at = now() + interval '60 days'
  where id = p_property_id
  returning expires_at into v_expires_at;

  return v_expires_at;
end;
$$;

revoke all on function public.renew_property_listing(uuid) from public;
grant execute on function public.renew_property_listing(uuid) to authenticated;

-- 3. WhatsApp opt-in ----------------------------------------------------------------------------
alter table public.properties
  add column if not exists whatsapp_enabled boolean not null default false;

-- Public catalog view (used by the agent-listings API): also hide soft-deleted and expired
-- listings. Dropped and recreated (not "create or replace"): the live database had an older column
-- order (no pinned_at/pinned_until), which "create or replace" cannot reorder. Nothing depends on
-- this view (checked 2026-11-14), and the transaction keeps it from ever being missing.
drop view if exists public.public_property_catalog;
create view public.public_property_catalog
with (security_invoker = true) as
select
  p.id,
  p.property_id_number,
  p.category,
  p.property_type,
  p.total_rooms,
  p.total_bathrooms,
  p.balcony,
  p.floor_level,
  p.occupancy,
  p.room_size_sqft,
  p.rent_amount_bdt,
  p.rent_period,
  p.state_district,
  p.area,
  p.sub_area,
  p.short_description,
  p.available_from,
  p.deadline,
  p.status,
  p.created_at,
  p.updated_at,
  p.reviewed_at,
  p.is_featured,
  p.is_active,
  p.is_pinned,
  p.pinned_at,
  p.pinned_until,
  p.total_kitchen,
  p.dining_rooms,
  p.living_rooms,
  p.is_rent_negotiable,
  p.lat,
  p.lng,
  p.expires_at,
  p.whatsapp_enabled
from public.properties p
where p.status = 'approved'
  and coalesce(p.is_active, true) = true
  and p.deleted_at is null
  and (p.expires_at is null or p.expires_at > now());

grant select on public.public_property_catalog to anon, authenticated, service_role;

-- 4. Verified owners ----------------------------------------------------------------------------
-- Returns the subset of the given listing ids whose owner has a verified account. Exposes one bit
-- per listing and nothing about the owner, so it is safe for anonymous visitors.
create or replace function public.verified_owner_property_ids(p_property_ids uuid[])
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.properties p
  join public.users u on u.id = p.user_id
  where p.id = any (p_property_ids[1:200])
    and u.verified is true;
$$;

revoke all on function public.verified_owner_property_ids(uuid[]) from public;
grant execute on function public.verified_owner_property_ids(uuid[]) to anon, authenticated;

-- 5. Owner ID verification ----------------------------------------------------------------------
-- The owner uploads front/back images to the private id-documents bucket (own folder, enforced
-- by storage policies) and submits the object paths here. user_verifications.user_id is unique and
-- owners have no UPDATE policy, so (re)submission goes through this function.
create or replace function public.submit_user_verification(p_id_type text, p_front_path text, p_back_path text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'Please log in first.';
  end if;

  if p_id_type not in ('National ID', 'Passport', 'Driving License') then
    raise exception 'Unknown ID type.';
  end if;

  if split_part(coalesce(p_front_path, ''), '/', 1) <> v_uid::text
     or split_part(coalesce(p_back_path, ''), '/', 1) <> v_uid::text then
    raise exception 'ID images must be uploaded to your own folder.';
  end if;

  select verification_status into v_status from public.user_verifications where user_id = v_uid;
  if v_status = 'approved' then
    raise exception 'Your account is already verified.';
  end if;

  insert into public.user_verifications
    (user_id, id_type, front_image_url, back_image_url, verification_status, admin_notes, submitted_at, reviewed_at)
  values
    (v_uid, p_id_type, p_front_path, p_back_path, 'pending', null, now(), null)
  on conflict (user_id) do update
    set id_type = excluded.id_type,
        front_image_url = excluded.front_image_url,
        back_image_url = excluded.back_image_url,
        verification_status = 'pending',
        admin_notes = null,
        submitted_at = now(),
        reviewed_at = null;

  return 'pending';
end;
$$;

revoke all on function public.submit_user_verification(text, text, text) from public;
grant execute on function public.submit_user_verification(text, text, text) to authenticated;

-- Admin approves or rejects; approval sets users.verified, which drives the "Verified owner" badge.
create or replace function public.admin_review_user_verification(
  p_verification_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('users.moderate');
  v_row public.user_verifications%rowtype;
  v_status text;
  v_audit_id bigint;
begin
  select * into v_row from public.user_verifications where id = p_verification_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: verification request not found';
  end if;

  if not p_approve and coalesce(trim(p_note), '') = '' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: a reason is required to reject';
  end if;

  v_status := case when p_approve then 'approved' else 'rejected' end;

  update public.user_verifications
  set verification_status = v_status,
      admin_notes = nullif(trim(coalesce(p_note, '')), ''),
      reviewed_at = now()
  where id = p_verification_id;

  update public.users set verified = p_approve where id = v_row.user_id;

  v_audit_id := public.log_admin_action(
    'user.verification_review',
    'user',
    v_row.user_id::text,
    p_note,
    jsonb_build_object('verification_status', v_row.verification_status),
    jsonb_build_object('verification_status', v_status, 'reviewed_by', v_actor),
    jsonb_build_object('verification_id', p_verification_id)
  );

  return jsonb_build_object('status', v_status, 'audit_id', v_audit_id);
end;
$$;

revoke all on function public.admin_review_user_verification(uuid, boolean, text) from public;
grant execute on function public.admin_review_user_verification(uuid, boolean, text) to authenticated;

-- 6. Listing reports ----------------------------------------------------------------------------
create or replace function public.admin_set_report_status(p_report_id uuid, p_status text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := public.assert_admin_permission('properties.moderate');
  v_before text;
  v_property uuid;
  v_audit_id bigint;
begin
  if p_status not in ('pending', 'resolved', 'dismissed') then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: unknown report status';
  end if;

  select status, property_id into v_before, v_property
  from public.property_reports where id = p_report_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'ADMIN_NOT_FOUND: report not found';
  end if;

  update public.property_reports set status = p_status where id = p_report_id;

  v_audit_id := public.log_admin_action(
    'property_report.set_status',
    'property_report',
    p_report_id::text,
    p_note,
    jsonb_build_object('status', v_before),
    jsonb_build_object('status', p_status, 'reviewed_by', v_actor),
    jsonb_build_object('property_id', v_property)
  );

  return jsonb_build_object('status', p_status, 'audit_id', v_audit_id);
end;
$$;

revoke all on function public.admin_set_report_status(uuid, text, text) from public;
grant execute on function public.admin_set_report_status(uuid, text, text) to authenticated;

-- 7. Saved searches (in-site alerts) ------------------------------------------------------------
-- The site counts listings created after last_seen_at with the same filters and shows the number
-- in the header and the dashboard. No email is sent (owner decision, 2026-11-14).
create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 120),
  filters jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists saved_searches_user_idx on public.saved_searches (user_id, created_at desc);

alter table public.saved_searches enable row level security;

drop policy if exists saved_searches_owner_select on public.saved_searches;
create policy saved_searches_owner_select on public.saved_searches
  for select to authenticated using (user_id = auth.uid());

drop policy if exists saved_searches_owner_insert on public.saved_searches;
create policy saved_searches_owner_insert on public.saved_searches
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and (select count(*) from public.saved_searches s where s.user_id = auth.uid()) < 20
  );

drop policy if exists saved_searches_owner_update on public.saved_searches;
create policy saved_searches_owner_update on public.saved_searches
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists saved_searches_owner_delete on public.saved_searches;
create policy saved_searches_owner_delete on public.saved_searches
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.saved_searches to authenticated;

commit;

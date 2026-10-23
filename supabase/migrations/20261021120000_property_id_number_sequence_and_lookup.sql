-- Property ID number: server-generated, unique, and publicly resolvable.
--
-- Before this migration property_id_number was filled in by the browser with
-- "select max + 1". RLS hides other users' rows, so two people could receive the
-- same number. This migration:
--   1. creates a sequence that continues from the current highest number
--   2. re-numbers duplicates (oldest row keeps its number) and fills in gaps
--   3. makes the column NOT NULL + UNIQUE
--   4. assigns the number in a BEFORE INSERT trigger (ignoring any client value)
--      and freezes it on UPDATE
--   5. adds find_public_property_id_by_number() so visitors can open a listing
--      by its display ID without a public SELECT policy on properties.

begin;

-- Step 1: sequence, continuing from the highest numeric value already stored.
create sequence if not exists public.property_id_number_seq;

do $$
declare
  v_max bigint;
begin
  select greatest(
    coalesce(max(property_id_number::bigint) filter (where property_id_number ~ '^\d+$'), 0),
    99999
  )
  into v_max
  from public.properties;

  -- is_called = true: the next nextval() returns v_max + 1 (100000 on an empty table).
  perform setval('public.property_id_number_seq', v_max, true);
end $$;

-- Step 2a: duplicates. The oldest row keeps its number; later copies get fresh ones.
-- NOTE: the listings re-numbered here change their visible ID. The May 2026 reset
-- made every value unique, so this only touches rows created by the racy client
-- generator since then.
do $$
declare
  v_row record;
  v_changed integer := 0;
begin
  for v_row in
    select id
    from (
      select
        id,
        row_number() over (
          partition by property_id_number
          order by created_at asc, id asc
        ) as rn
      from public.properties
      where property_id_number is not null
    ) ranked
    where rn > 1
    order by id
  loop
    update public.properties
    set property_id_number = nextval('public.property_id_number_seq')::text
    where id = v_row.id;
    v_changed := v_changed + 1;
  end loop;

  raise notice 'Re-numbered % duplicate property_id_number rows', v_changed;
end $$;

-- Step 2b: rows with no number or a non-numeric value, in creation order.
do $$
declare
  v_row record;
  v_filled integer := 0;
begin
  for v_row in
    select id
    from public.properties
    where property_id_number is null
       or property_id_number !~ '^\d+$'
    order by created_at asc, id asc
  loop
    update public.properties
    set property_id_number = nextval('public.property_id_number_seq')::text
    where id = v_row.id;
    v_filled := v_filled + 1;
  end loop;

  raise notice 'Filled % missing property_id_number rows', v_filled;
end $$;

-- Step 3: constraints.
alter table public.properties
  alter column property_id_number set not null;

drop index if exists public.idx_properties_property_id_number;

create unique index if not exists properties_property_id_number_key
  on public.properties (property_id_number);

comment on column public.properties.property_id_number is
  'Public display ID. Sequential number from 100000, assigned by trg_properties_assign_property_id_number. Never set by clients.';

-- Step 4: trigger. INSERT always takes the next number (a stale client that still
-- sends its own value cannot collide); UPDATE keeps the existing one.
create or replace function public.assign_property_id_number()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.property_id_number := nextval('public.property_id_number_seq')::text;
  elsif tg_op = 'UPDATE' then
    new.property_id_number := old.property_id_number;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_properties_assign_property_id_number on public.properties;
create trigger trg_properties_assign_property_id_number
before insert or update on public.properties
for each row
execute function public.assign_property_id_number();

-- Step 5: public lookup by display ID (approved + active listings only).
create or replace function public.find_public_property_id_by_number(p_number text)
returns uuid
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_number text := btrim(coalesce(p_number, ''));
  v_id uuid;
begin
  if v_number !~ '^\d+$' then
    return null;
  end if;

  select p.id
  into v_id
  from public.properties p
  where p.property_id_number = v_number
    and p.status = 'approved'
    and coalesce(p.is_active, true) = true
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.find_public_property_id_by_number(text) from public;
grant execute on function public.find_public_property_id_by_number(text) to anon, authenticated;

commit;

-- Verification (run separately):
-- select property_id_number, count(*) from public.properties group by 1 having count(*) > 1;  -- expect 0 rows
-- select last_value from public.property_id_number_seq;                                       -- expect current max

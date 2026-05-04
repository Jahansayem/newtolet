alter table if exists public.properties
  add column if not exists is_rent_negotiable boolean not null default false;

update public.properties
set is_rent_negotiable = false
where is_rent_negotiable is null;

alter table if exists public.properties
  alter column is_rent_negotiable set default false,
  alter column is_rent_negotiable set not null,
  alter column rent_amount_bdt drop not null;

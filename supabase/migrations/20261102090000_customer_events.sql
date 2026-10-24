-- Customer activity events for the admin "Customers" tab.
--
-- Adds an append-only public.customer_events log fed by
--   * track_customer_event(...)  — public RPC (anon + authenticated) for listing
--     views, phone/WhatsApp taps and searches; the client sends a random browser
--     visitor id and per-tab session id, never an IP or fingerprint;
--   * AFTER INSERT triggers on contact_views, property_inquiries and orders for
--     the server-authoritative events (clients cannot forge those types);
-- and four read RPCs for admins holding users.view.
--
-- Depends on 20261025090000_admin_roles_audit_rpcs.sql (assert_admin_permission,
-- admin_has_permission). Independent of 20261101090000_lock_admin_direct_writes.
-- NOTE: re-running 20261025's EXECUTE sweep would revoke the grants made here;
-- re-apply this file afterwards if that ever happens.
--
-- Apply (user runs with `!`):
--   ssh root@HOST "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -f -" \
--     < supabase/migrations/20261102090000_customer_events.sql
-- Dry run with the assertion suite:
--   bash scripts/deploy/supabase-selfhost/run-rls-tests.sh HOST --dry-run-customers
-- Revert: scripts/deploy/supabase-selfhost/rollback-customer-events.sql

begin;

-- ---------------------------------------------------------------------------
-- 1. Table
-- ---------------------------------------------------------------------------
create table if not exists public.customer_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event_type text not null check (event_type in ('listing_view', 'contact_unlock', 'phone_tap', 'whatsapp_tap', 'search', 'inquiry', 'order')),
  visitor_id uuid,
  session_id uuid,
  user_id uuid references public.users(id) on delete set null,
  property_id uuid,
  page_path text check (page_path is null or char_length(page_path) <= 512),
  referrer text check (referrer is null or char_length(referrer) <= 512),
  metadata jsonb not null default '{}'::jsonb,
  source text not null default 'client' check (source in ('client', 'trigger', 'backfill')),
  constraint customer_events_actor_check check (visitor_id is not null or user_id is not null)
);

create index if not exists idx_customer_events_occurred on public.customer_events (occurred_at desc);
create index if not exists idx_customer_events_user on public.customer_events (user_id, occurred_at desc) where user_id is not null;
create index if not exists idx_customer_events_property on public.customer_events (property_id, occurred_at desc) where property_id is not null;
create index if not exists idx_customer_events_visitor on public.customer_events (visitor_id, occurred_at desc) where visitor_id is not null;
create index if not exists idx_customer_events_type on public.customer_events (event_type, occurred_at desc);

alter table public.customer_events enable row level security;
revoke all on public.customer_events from public, anon, authenticated;
grant select on public.customer_events to authenticated;
grant all on public.customer_events to service_role;

-- Admins may read rows directly (debugging, head counts); every write goes
-- through the definer functions below.
drop policy if exists customer_events_admin_read on public.customer_events;
create policy customer_events_admin_read on public.customer_events for select to authenticated
  using (public.admin_has_permission('users.view'));

-- ---------------------------------------------------------------------------
-- 2. Public tracking RPC
-- ---------------------------------------------------------------------------
create or replace function public.track_customer_event(
  p_event_type text,
  p_visitor_id uuid,
  p_session_id uuid default null,
  p_property_id uuid default null,
  p_page_path text default null,
  p_referrer text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  -- Only the browser-originated types; unlock / inquiry / order come from triggers.
  if p_event_type is null or p_event_type not in ('listing_view', 'phone_tap', 'whatsapp_tap', 'search') then
    return;
  end if;
  if p_visitor_id is null and v_user is null then
    return;
  end if;
  if jsonb_typeof(v_metadata) <> 'object' or pg_column_size(v_metadata) > 4096 then
    v_metadata := '{}'::jsonb;
  end if;

  -- Same visitor, same event, same listing within a minute: a reload or a
  -- double-fired effect, not a new visit.
  if p_event_type <> 'search' and p_visitor_id is not null and exists (
    select 1 from public.customer_events e
    where e.visitor_id = p_visitor_id
      and e.event_type = p_event_type
      and e.property_id is not distinct from p_property_id
      and e.occurred_at > now() - interval '60 seconds'
  ) then
    return;
  end if;

  insert into public.customer_events (event_type, visitor_id, session_id, user_id, property_id, page_path, referrer, metadata, source)
  values (p_event_type, p_visitor_id, p_session_id, v_user, p_property_id, left(p_page_path, 512), left(p_referrer, 512), v_metadata, 'client');
exception
  when others then
    -- Tracking must never surface an error to the visitor.
    null;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Server-authoritative events via triggers (definer; errors swallowed so a
--    tracking problem can never abort the user's unlock, inquiry or order)
-- ---------------------------------------------------------------------------
create or replace function public.customer_events_on_contact_view()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.user_id is not null then
      insert into public.customer_events (occurred_at, event_type, user_id, property_id, metadata, source)
      values (coalesce(new.viewed_at at time zone 'UTC', now()), 'contact_unlock', new.user_id, new.property_id,
              jsonb_build_object('contact_view_id', new.id, 'credits_spent', new.credits_spent), 'trigger');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.customer_events_on_inquiry()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  begin
    v_user := auth.uid();
    if v_user is null and new.email is not null then
      select u.id into v_user from public.users u where lower(u.email) = lower(new.email) limit 1;
    end if;
    if v_user is not null then
      insert into public.customer_events (occurred_at, event_type, user_id, property_id, metadata, source)
      values (coalesce(new.created_at, now()), 'inquiry', v_user, new.property_id,
              jsonb_build_object('inquiry_id', new.id, 'name', new.name, 'email', new.email, 'phone', new.phone), 'trigger');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

create or replace function public.customer_events_on_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    if new.user_id is not null then
      insert into public.customer_events (occurred_at, event_type, user_id, metadata, source)
      values (coalesce(new.created_at, now()), 'order', new.user_id,
              jsonb_build_object('order_id', new.id, 'category', new.category, 'district', new.district, 'area', new.area, 'status', new.status, 'cost', new.cost), 'trigger');
    end if;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists trg_customer_events_contact_view on public.contact_views;
create trigger trg_customer_events_contact_view
  after insert on public.contact_views
  for each row execute function public.customer_events_on_contact_view();

drop trigger if exists trg_customer_events_inquiry on public.property_inquiries;
create trigger trg_customer_events_inquiry
  after insert on public.property_inquiries
  for each row execute function public.customer_events_on_inquiry();

drop trigger if exists trg_customer_events_order on public.orders;
create trigger trg_customer_events_order
  after insert on public.orders
  for each row execute function public.customer_events_on_order();

-- ---------------------------------------------------------------------------
-- 4. Admin read RPCs (users.view). Days are bucketed in p_tz (default Dhaka)
--    so the chart matches the admin's calendar. users.created_at and
--    contact_views.viewed_at are timestamp WITHOUT time zone holding UTC.
-- ---------------------------------------------------------------------------
create or replace function public.admin_customer_daily_stats(
  p_from timestamptz,
  p_to timestamptz,
  p_tz text default 'Asia/Dhaka'
)
returns table(
  day date, visits bigint, unique_visitors bigint, signed_in_visitors bigint, listing_views bigint, contact_unlocks bigint,
  phone_taps bigint, whatsapp_taps bigint, searches bigint, inquiries bigint, orders bigint, signups bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('users.view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A valid date range is required.';
  end if;
  if p_to - p_from > interval '366 days' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Ranges are limited to 366 days.';
  end if;

  return query
  with ev as (
    select (e.occurred_at at time zone p_tz)::date as d, e.*
    from public.customer_events e
    where e.occurred_at >= p_from and e.occurred_at <= p_to
  ),
  agg as (
    select d,
      count(distinct session_id) as visits,
      count(distinct coalesce(visitor_id::text, user_id::text)) as unique_visitors,
      count(distinct user_id) as signed_in_visitors,
      count(*) filter (where event_type = 'listing_view') as listing_views,
      count(*) filter (where event_type = 'contact_unlock') as contact_unlocks,
      count(*) filter (where event_type = 'phone_tap') as phone_taps,
      count(*) filter (where event_type = 'whatsapp_tap') as whatsapp_taps,
      count(*) filter (where event_type = 'search') as searches,
      count(*) filter (where event_type = 'order') as orders
    from ev group by d
  ),
  su as (
    select (((u.created_at at time zone 'UTC') at time zone p_tz))::date as d, count(*) as c
    from public.users u
    where (u.created_at at time zone 'UTC') >= p_from and (u.created_at at time zone 'UTC') <= p_to
    group by 1
  ),
  inq as (
    select (i.created_at at time zone p_tz)::date as d, count(*) as c
    from public.property_inquiries i
    where i.created_at >= p_from and i.created_at <= p_to
    group by 1
  ),
  days as (
    select d from agg union select d from su union select d from inq
  )
  select days.d, coalesce(agg.visits, 0), coalesce(agg.unique_visitors, 0), coalesce(agg.signed_in_visitors, 0),
         coalesce(agg.listing_views, 0), coalesce(agg.contact_unlocks, 0), coalesce(agg.phone_taps, 0), coalesce(agg.whatsapp_taps, 0),
         coalesce(agg.searches, 0), coalesce(inq.c, 0), coalesce(agg.orders, 0), coalesce(su.c, 0)
  from days
  left join agg on agg.d = days.d
  left join su on su.d = days.d
  left join inq on inq.d = days.d
  order by days.d;
end;
$$;

create or replace function public.admin_customer_range_totals(
  p_from timestamptz,
  p_to timestamptz
)
returns table(
  visits bigint, unique_visitors bigint, signed_in_visitors bigint, anonymous_visitors bigint, listing_views bigint, contact_unlocks bigint,
  phone_taps bigint, whatsapp_taps bigint, searches bigint, inquiries bigint, orders bigint, signups bigint, tracking_since timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('users.view');
  if p_from is null or p_to is null or p_to < p_from then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A valid date range is required.';
  end if;
  return query
  with ev as (
    select * from public.customer_events e where e.occurred_at >= p_from and e.occurred_at <= p_to
  )
  select
    (select count(distinct session_id) from ev),
    (select count(distinct coalesce(visitor_id::text, user_id::text)) from ev),
    (select count(distinct user_id) from ev),
    (select count(distinct visitor_id) from ev where user_id is null),
    (select count(*) from ev where event_type = 'listing_view'),
    (select count(*) from ev where event_type = 'contact_unlock'),
    (select count(*) from ev where event_type = 'phone_tap'),
    (select count(*) from ev where event_type = 'whatsapp_tap'),
    (select count(*) from ev where event_type = 'search'),
    (select count(*) from public.property_inquiries i where i.created_at >= p_from and i.created_at <= p_to),
    (select count(*) from ev where event_type = 'order'),
    (select count(*) from public.users u where (u.created_at at time zone 'UTC') >= p_from and (u.created_at at time zone 'UTC') <= p_to),
    (select min(occurred_at) from public.customer_events where source = 'client');
end;
$$;

create or replace function public.admin_customer_list(
  p_search text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_active_only boolean default true,
  p_sort text default 'last_seen',
  p_dir text default 'desc',
  p_limit int default 20,
  p_offset int default 0
)
returns table(
  id uuid, name text, email text, phone text, provider text, created_at timestamptz, last_seen timestamptz,
  views bigint, unlocks bigint, phone_taps bigint, searches bigint, inquiries bigint, orders bigint, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sort text := case p_sort when 'views' then 'views' when 'unlocks' then 'unlocks' when 'created_at' then 'created_at' when 'name' then 'name' when 'orders' then 'orders' else 'last_seen' end;
  v_dir text := case when lower(coalesce(p_dir, 'desc')) = 'asc' then 'asc' else 'desc' end;
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_from timestamptz := coalesce(p_from, now() - interval '30 days');
  v_to timestamptz := coalesce(p_to, now());
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.assert_admin_permission('users.view');
  return query execute format($q$
    with ev as (
      select e.user_id,
        max(e.occurred_at) as last_seen,
        count(*) filter (where e.event_type = 'listing_view') as views,
        count(*) filter (where e.event_type = 'contact_unlock') as unlocks,
        count(*) filter (where e.event_type in ('phone_tap', 'whatsapp_tap')) as phone_taps,
        count(*) filter (where e.event_type = 'search') as searches
      from public.customer_events e
      where e.user_id is not null and e.occurred_at >= $3 and e.occurred_at <= $4
      group by e.user_id
    ),
    inq as (
      select lower(i.email) as em, count(*) as c
      from public.property_inquiries i
      where i.email is not null and i.created_at >= $3 and i.created_at <= $4
      group by 1
    ),
    ord as (
      select o.user_id, count(*) as c
      from public.orders o
      where o.user_id is not null and o.created_at >= $3 and o.created_at <= $4
      group by 1
    ),
    base as (
      select u.id, u.name, u.email, u.phone, u.provider, (u.created_at at time zone 'UTC') as created_at,
        ev.last_seen,
        coalesce(ev.views, 0) as views, coalesce(ev.unlocks, 0) as unlocks, coalesce(ev.phone_taps, 0) as phone_taps,
        coalesce(ev.searches, 0) as searches, coalesce(inq.c, 0) as inquiries, coalesce(ord.c, 0) as orders
      from public.users u
      left join ev on ev.user_id = u.id
      left join inq on u.email is not null and inq.em = lower(u.email)
      left join ord on ord.user_id = u.id
      where ($5::text is null or u.name ilike '%%' || $5 || '%%' or u.email ilike '%%' || $5 || '%%' or u.phone ilike '%%' || $5 || '%%')
        and (not $6 or ev.last_seen is not null or inq.c > 0 or ord.c > 0)
    )
    select b.*, count(*) over() as total_count
    from base b
    order by %I %s nulls last, b.id
    limit $1 offset $2
  $q$, v_sort, v_dir)
  using v_limit, v_offset, v_from, v_to, v_search, coalesce(p_active_only, true);
end;
$$;

create or replace function public.admin_customer_timeline(
  p_user_id uuid,
  p_visitor_id uuid default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table(
  id bigint, occurred_at timestamptz, event_type text, visitor_id uuid, user_id uuid, property_id uuid, property_id_number text,
  property_category text, property_area text, property_district text, page_path text, metadata jsonb, source text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visitor uuid := p_visitor_id;
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
begin
  perform public.assert_admin_permission('users.view');
  if p_user_id is null and p_visitor_id is null then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A user or visitor id is required.';
  end if;
  -- Stitch the browser's anonymous history onto the account it later signed in with.
  if v_visitor is null then
    select e.visitor_id into v_visitor
    from public.customer_events e
    where e.user_id = p_user_id and e.visitor_id is not null
    order by e.occurred_at desc limit 1;
  end if;
  return query
  select e.id, e.occurred_at, e.event_type, e.visitor_id, e.user_id, e.property_id, p.property_id_number, p.category, p.area, p.state_district,
         e.page_path, e.metadata, e.source, count(*) over() as total_count
  from public.customer_events e
  left join public.properties p on p.id = e.property_id
  where (p_user_id is not null and e.user_id = p_user_id)
     or (v_visitor is not null and e.visitor_id = v_visitor)
  order by e.occurred_at desc, e.id desc
  limit v_limit offset v_offset;
end;
$$;

create or replace function public.admin_top_viewed_listings(
  p_from timestamptz,
  p_to timestamptz,
  p_limit int default 20
)
returns table(
  property_id uuid, property_id_number text, category text, area text, state_district text, status text,
  views bigint, unique_viewers bigint, unlocks bigint, phone_taps bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  perform public.assert_admin_permission('users.view');
  return query
  select e.property_id, p.property_id_number, p.category, p.area, p.state_district, p.status,
    count(*) filter (where e.event_type = 'listing_view') as views,
    count(distinct coalesce(e.visitor_id::text, e.user_id::text)) filter (where e.event_type = 'listing_view') as unique_viewers,
    count(*) filter (where e.event_type = 'contact_unlock') as unlocks,
    count(*) filter (where e.event_type in ('phone_tap', 'whatsapp_tap')) as phone_taps
  from public.customer_events e
  left join public.properties p on p.id = e.property_id
  where e.property_id is not null and e.occurred_at >= p_from and e.occurred_at <= p_to
    and e.event_type in ('listing_view', 'contact_unlock', 'phone_tap', 'whatsapp_tap')
  group by e.property_id, p.property_id_number, p.category, p.area, p.state_district, p.status
  order by views desc, unlocks desc
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Grants
-- ---------------------------------------------------------------------------
revoke all on function public.track_customer_event(text, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.track_customer_event(text, uuid, uuid, uuid, text, text, jsonb) to anon, authenticated, service_role;

do $$
declare fn text;
begin
  foreach fn in array array[
    'admin_customer_daily_stats(timestamptz,timestamptz,text)',
    'admin_customer_range_totals(timestamptz,timestamptz)',
    'admin_customer_list(text,timestamptz,timestamptz,boolean,text,text,integer,integer)',
    'admin_customer_timeline(uuid,uuid,integer,integer)',
    'admin_top_viewed_listings(timestamptz,timestamptz,integer)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
    execute format('grant execute on function public.%s to authenticated, service_role', fn);
  end loop;
  foreach fn in array array[
    'customer_events_on_contact_view()',
    'customer_events_on_inquiry()',
    'customer_events_on_order()'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', fn);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Backfill (idempotent). History before this migration is approximate:
--    one listing_view per user/listing at the last recorded view.
-- ---------------------------------------------------------------------------
insert into public.customer_events (occurred_at, event_type, user_id, property_id, metadata, source)
select h.last_viewed_at, 'listing_view', h.user_id, h.property_id,
       jsonb_build_object('backfill', true, 'view_count', h.view_count, 'first_viewed_at', h.first_viewed_at), 'backfill'
from public.property_view_history h
where exists (select 1 from public.users u where u.id = h.user_id)
  and not exists (
    select 1 from public.customer_events ce
    where ce.source = 'backfill' and ce.event_type = 'listing_view' and ce.user_id = h.user_id and ce.property_id = h.property_id
  );

insert into public.customer_events (occurred_at, event_type, user_id, property_id, metadata, source)
select cv.viewed_at at time zone 'UTC', 'contact_unlock', cv.user_id, cv.property_id,
       jsonb_build_object('backfill', true, 'contact_view_id', cv.id, 'credits_spent', cv.credits_spent), 'backfill'
from public.contact_views cv
where exists (select 1 from public.users u where u.id = cv.user_id)
  and not exists (
    select 1 from public.customer_events ce
    where ce.event_type = 'contact_unlock' and ce.user_id = cv.user_id and ce.property_id = cv.property_id
  );

insert into public.customer_events (occurred_at, event_type, user_id, property_id, metadata, source)
select i.created_at, 'inquiry', u.id, i.property_id,
       jsonb_build_object('backfill', true, 'inquiry_id', i.id, 'name', i.name, 'email', i.email, 'phone', i.phone), 'backfill'
from public.property_inquiries i
join public.users u on u.email is not null and lower(u.email) = lower(i.email)
where not exists (
  select 1 from public.customer_events ce
  where ce.event_type = 'inquiry' and (ce.metadata ->> 'inquiry_id') = i.id::text
);

insert into public.customer_events (occurred_at, event_type, user_id, metadata, source)
select o.created_at, 'order', o.user_id,
       jsonb_build_object('backfill', true, 'order_id', o.id, 'category', o.category, 'district', o.district, 'area', o.area, 'status', o.status, 'cost', o.cost), 'backfill'
from public.orders o
where o.user_id is not null
  and exists (select 1 from public.users u where u.id = o.user_id)
  and not exists (
    select 1 from public.customer_events ce
    where ce.event_type = 'order' and (ce.metadata ->> 'order_id') = o.id::text
  );

-- ---------------------------------------------------------------------------
-- 7. Assertions
-- ---------------------------------------------------------------------------
do $$
declare
  v_missing text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_missing
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_missing is not null then
    raise exception 'Tables without RLS after migration: %', v_missing;
  end if;
  if not has_function_privilege('anon', 'public.track_customer_event(text,uuid,uuid,uuid,text,text,jsonb)', 'execute') then
    raise exception 'customer_events: anon cannot execute track_customer_event';
  end if;
  if has_function_privilege('anon', 'public.admin_customer_list(text,timestamptz,timestamptz,boolean,text,text,integer,integer)', 'execute') then
    raise exception 'customer_events: anon can execute admin_customer_list';
  end if;
  if has_function_privilege('authenticated', 'public.customer_events_on_order()', 'execute') then
    raise exception 'customer_events: trigger function is client-executable';
  end if;
end $$;

select 'CUSTOMER_EVENTS_DONE';

commit;

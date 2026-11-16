-- Facebook Page auto-post queue.
--
-- When a listing becomes approved (admin approval or auto_approve_properties), one row is
-- queued here. The facebook-page-post Edge Function (run by cron on the VPS) claims due
-- rows, posts them to the NewTolet Facebook Page and records the result.
-- See claudedocs/FACEBOOK_PAGE_AUTOPOST.md.

create table if not exists public.facebook_page_posts (
  id bigint generated always as identity primary key,
  property_id uuid not null unique references public.properties(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'posted', 'failed', 'skipped')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  fb_post_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  posted_at timestamptz
);

create index if not exists facebook_page_posts_due_idx
  on public.facebook_page_posts (next_attempt_at)
  where status = 'pending';

-- Service role only: no policies, so anon/authenticated see nothing.
alter table public.facebook_page_posts enable row level security;
revoke all on public.facebook_page_posts from anon, authenticated;
grant select, insert, update, delete on public.facebook_page_posts to service_role;

-- Queue a listing the first time it becomes approved. ON CONFLICT keeps re-approvals
-- (approved -> pending -> approved after an edit) from posting the same listing twice.
create or replace function public.queue_facebook_page_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved'
     and new.deleted_at is null
     and coalesce(new.is_active, true)
     and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    insert into public.facebook_page_posts (property_id)
    values (new.id)
    on conflict (property_id) do nothing;
  end if;
  return new;
end;
$$;

revoke all on function public.queue_facebook_page_post() from public, anon, authenticated;

drop trigger if exists trg_properties_queue_facebook_post on public.properties;
create trigger trg_properties_queue_facebook_post
after insert or update of status on public.properties
for each row
execute function public.queue_facebook_page_post();

-- Atomically claim up to p_limit due rows for one worker run. Rows stuck in
-- 'processing' for 10 minutes (worker crashed mid-post) become claimable again.
create or replace function public.claim_facebook_page_posts(p_limit integer default 5)
returns setof public.facebook_page_posts
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.facebook_page_posts f
  set status = 'processing',
      attempts = f.attempts + 1,
      updated_at = now()
  where f.id in (
    select q.id
    from public.facebook_page_posts q
    where (q.status = 'pending' and q.next_attempt_at <= now())
       or (q.status = 'processing' and q.updated_at < now() - interval '10 minutes')
    order by q.next_attempt_at
    limit greatest(1, least(coalesce(p_limit, 5), 20))
    for update skip locked
  )
  returning f.*;
end;
$$;

revoke all on function public.claim_facebook_page_posts(integer) from public, anon, authenticated;
grant execute on function public.claim_facebook_page_posts(integer) to service_role;

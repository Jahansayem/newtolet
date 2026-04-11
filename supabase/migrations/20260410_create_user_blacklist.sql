create table if not exists public.user_blacklist (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  reason text not null,
  blacklisted_at timestamptz default now(),
  blacklisted_by uuid references public.users(id) on delete set null,
  notes text,
  is_permanent boolean default true,
  expires_at timestamptz
);

create index if not exists idx_user_blacklist_user_id
  on public.user_blacklist(user_id);

alter table public.user_blacklist enable row level security;

drop policy if exists "Users can read own blacklist status" on public.user_blacklist;
create policy "Users can read own blacklist status"
on public.user_blacklist
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Admins can manage blacklist" on public.user_blacklist;
create policy "Admins can manage blacklist"
on public.user_blacklist
for all
to authenticated
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

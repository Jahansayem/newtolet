create table if not exists public.property_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  reason varchar not null,
  message text,
  status varchar default 'pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_property_reports_property_id on public.property_reports(property_id);
create index if not exists idx_property_reports_status on public.property_reports(status);
create index if not exists idx_property_reports_created_at on public.property_reports(created_at desc);

drop trigger if exists trg_property_reports_set_updated_at on public.property_reports;
create trigger trg_property_reports_set_updated_at
before update on public.property_reports
for each row
execute function public.set_updated_at();

alter table public.property_reports enable row level security;

drop policy if exists "Anyone can submit property reports" on public.property_reports;
create policy "Anyone can submit property reports"
on public.property_reports
for insert
with check (true);

drop policy if exists "Admins can view property reports" on public.property_reports;
create policy "Admins can view property reports"
on public.property_reports
for select
using (public.is_current_user_admin());

drop policy if exists "Admins can update property reports" on public.property_reports;
create policy "Admins can update property reports"
on public.property_reports
for update
using (public.is_current_user_admin())
with check (public.is_current_user_admin());

drop policy if exists "Admins can delete property reports" on public.property_reports;
create policy "Admins can delete property reports"
on public.property_reports
for delete
using (public.is_current_user_admin());

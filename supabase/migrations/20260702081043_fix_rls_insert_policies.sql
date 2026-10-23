-- Restore insert policies expected by the browser app.
-- This migration is intentionally scoped to INSERT policies so admin-only
-- read/update/delete rules are not loosened.

alter table if exists public.feedback enable row level security;

drop policy if exists "Anyone can insert feedback" on public.feedback;
drop policy if exists "Authenticated users can submit feedback" on public.feedback;
drop policy if exists "Authenticated insert feedback" on public.feedback;
drop policy if exists "Public can submit feedback" on public.feedback;

create policy "Public can submit feedback"
on public.feedback
for insert
to anon, authenticated
with check (
  user_id is null
  or (select auth.uid()) = user_id
);

alter table if exists public.property_inquiries enable row level security;

drop policy if exists "Anyone can create inquiries" on public.property_inquiries;
drop policy if exists "Public can create property inquiries" on public.property_inquiries;

create policy "Public can create property inquiries"
on public.property_inquiries
for insert
to anon, authenticated
with check (true);

alter table if exists public.customer_search_history enable row level security;

drop policy if exists "Anyone can insert customer search history" on public.customer_search_history;
drop policy if exists "Public can insert customer search history" on public.customer_search_history;

create policy "Public can insert customer search history"
on public.customer_search_history
for insert
to anon, authenticated
with check (
  user_id is null
  or (select auth.uid()) = user_id
);

alter table if exists public.property_reports enable row level security;

drop policy if exists "Anyone can submit property reports" on public.property_reports;
drop policy if exists "Public can submit property reports" on public.property_reports;

create policy "Public can submit property reports"
on public.property_reports
for insert
to anon, authenticated
with check (
  user_id is null
  or (select auth.uid()) = user_id
);

alter table if exists public.orders enable row level security;

drop policy if exists "Users can create own orders" on public.orders;

create policy "Users can create own orders"
on public.orders
for insert
to authenticated
with check ((select auth.uid()) = user_id);

alter table if exists public.property_images enable row level security;

drop policy if exists "Users can insert images for own properties" on public.property_images;

create policy "Users can insert images for own properties"
on public.property_images
for insert
to authenticated
with check (
  exists (
    select 1
    from public.properties p
    where p.id = property_images.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);

alter table if exists public.property_amenities enable row level security;

drop policy if exists "Users can insert amenities for own properties" on public.property_amenities;

create policy "Users can insert amenities for own properties"
on public.property_amenities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.properties p
    where p.id = property_amenities.property_id
      and (
        p.user_id = (select auth.uid())
        or public.is_current_user_admin()
      )
  )
);

alter table if exists public.user_verifications enable row level security;

drop policy if exists "Users can insert own verification documents" on public.user_verifications;

create policy "Users can insert own verification documents"
on public.user_verifications
for insert
to authenticated
with check ((select auth.uid()) = user_id);

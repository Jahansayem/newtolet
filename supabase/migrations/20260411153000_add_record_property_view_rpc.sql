create or replace function public.record_property_view(p_property_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_property_id is null then
    return;
  end if;

  insert into public.property_view_history (
    user_id,
    property_id,
    view_count,
    first_viewed_at,
    last_viewed_at,
    updated_at
  )
  values (
    v_user_id,
    p_property_id,
    1,
    now(),
    now(),
    now()
  )
  on conflict (user_id, property_id)
  do update set
    view_count = public.property_view_history.view_count + 1,
    last_viewed_at = now(),
    updated_at = now();
end;
$$;

grant execute on function public.record_property_view(uuid) to authenticated;

-- Customer Orders: accept "whatsapp" as an order source.
--
-- The admin "New customer order" form now offers Facebook (stored as
-- messenger), Phone call (phone) and WhatsApp (whatsapp). Two places decide
-- which sources are valid: the check on customer_orders.source and the
-- co_clean_fields validator. Both are widened here; nothing else changes.
-- "website" stays table-only: it is set by the website mirror trigger, never by
-- a caller.

alter table public.customer_orders drop constraint if exists customer_orders_source_check;
alter table public.customer_orders add constraint customer_orders_source_check
  check (source in ('messenger', 'lead_generation', 'manual', 'phone', 'whatsapp', 'website'));

-- Same body as in 20261116090000_customer_orders.sql, with whatsapp added to the source list.
create or replace function public.co_clean_fields(p jsonb, p_allowed text[])
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  k text;
  v jsonb;
  t text;
  v_out jsonb := '{}'::jsonb;
  v_max int;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: A JSON object is required.';
  end if;
  for k, v in select key, value from jsonb_each(p) loop
    if not (k = any (p_allowed)) then
      raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is not accepted.', k);
    end if;
    if jsonb_typeof(v) in ('object', 'array') then
      raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a plain value.', k);
    end if;
    t := nullif(btrim(v #>> '{}'), '');
    if t is null then
      v_out := v_out || jsonb_build_object(k, null);
      continue;
    end if;

    if k in ('rooms', 'bathrooms', 'balconies', 'budget_min', 'budget_max', 'rent') then
      if t !~ '^[0-9]{1,9}$' then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a whole number.', k);
      end if;
      if k in ('rooms', 'bathrooms', 'balconies') and t::int > 50 then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is out of range.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, t::int);
    elsif k in ('customer_phone', 'owner_contact_phone') then
      v_out := v_out || jsonb_build_object(k, public.co_normalize_phone(t));
    elsif k = 'move_in_date' then
      if t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: move_in_date must be a date in YYYY-MM-DD format.';
      end if;
      begin
        perform t::date;
      exception when others then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: move_in_date is not a real date.';
      end;
      v_out := v_out || jsonb_build_object(k, t);
    elsif k = 'follow_up_at' then
      begin
        perform t::timestamptz;
      exception when others then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: follow_up_at must be an ISO 8601 timestamp.';
      end;
      v_out := v_out || jsonb_build_object(k, t);
    elsif k = 'type' then
      if upper(t) <> 'HOUSE_SEARCH' then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: Only HOUSE_SEARCH orders are supported.';
      end if;
      v_out := v_out || jsonb_build_object(k, 'HOUSE_SEARCH');
    elsif k = 'tenant_type' then
      if lower(t) not in ('family', 'bachelor') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: tenant_type must be family or bachelor.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k = 'source' then
      if lower(t) not in ('messenger', 'lead_generation', 'manual', 'phone', 'whatsapp') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: source must be messenger, lead_generation, manual, phone or whatsapp.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k = 'verification_status' then
      if lower(t) not in ('verified', 'unverified') then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: verification_status must be verified or unverified.';
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k in ('assigned_to', 'property_id') then
      if t !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be a uuid.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t));
    elsif k in ('owner_permission', 'removed') then
      if lower(t) not in ('true', 'false') then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" must be true or false.', k);
      end if;
      v_out := v_out || jsonb_build_object(k, lower(t) = 'true');
    elsif k = 'facebook_thread_url' then
      if t !~* '^https?://' or char_length(t) > 1000 then
        raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: facebook_thread_url must be an http(s) URL.';
      end if;
      v_out := v_out || jsonb_build_object(k, t);
    else
      v_max := case when k in ('requirement_notes', 'facilities', 'exact_address') then 2000 else 255 end;
      if char_length(t) > v_max then
        raise exception using errcode = 'P0001', message = format('ADMIN_VALIDATION: Field "%s" is too long (max %s characters).', k, v_max);
      end if;
      v_out := v_out || jsonb_build_object(k, t);
    end if;
  end loop;

  if (v_out ->> 'budget_min') is not null and (v_out ->> 'budget_max') is not null
     and (v_out ->> 'budget_min')::int > (v_out ->> 'budget_max')::int then
    raise exception using errcode = 'P0001', message = 'ADMIN_VALIDATION: budget_min cannot be greater than budget_max.';
  end if;
  return v_out;
end;
$$;

insert into public.payment_transactions (
  user_id,
  transaction_id,
  amount,
  status,
  payment_method,
  description,
  credits_to_add,
  provider,
  invoice_id,
  gateway_payload,
  reference,
  credited_at,
  created_at,
  updated_at
)
select
  topup.user_id,
  coalesce(nullif(topup.transaction_id, ''), 'LEGACY-TOPUP-' || topup.id::text),
  coalesce(topup.amount_bdt, 0)::numeric(10, 2),
  case
    when lower(coalesce(topup.status, '')) = 'paid' then 'credited'
    when lower(coalesce(topup.status, '')) = 'created' then 'pending'
    when lower(coalesce(topup.status, '')) = 'cancelled' then 'cancelled'
    when lower(coalesce(topup.status, '')) in ('failed', 'error') then 'failed'
    else 'pending'
  end,
  topup.payment_method,
  concat(coalesce(topup.credits_to_add, 0), ' credits purchase (legacy topup)'),
  coalesce(topup.credits_to_add, 0),
  coalesce(topup.provider, 'uddoktapay'),
  topup.invoice_id,
  case
    when coalesce(topup.verified_payload, '{}'::jsonb) <> '{}'::jsonb then topup.verified_payload
    when coalesce(topup.provider_payload, '{}'::jsonb) <> '{}'::jsonb then topup.provider_payload
    else '{}'::jsonb
  end,
  coalesce(topup.invoice_id, 'legacy_topup:' || topup.id::text),
  topup.credited_at,
  topup.created_at,
  coalesce(topup.credited_at, topup.created_at, now())
from public.credit_topups as topup
where not exists (
  select 1
  from public.payment_transactions as payment
  where payment.transaction_id = coalesce(nullif(topup.transaction_id, ''), 'LEGACY-TOPUP-' || topup.id::text)
);

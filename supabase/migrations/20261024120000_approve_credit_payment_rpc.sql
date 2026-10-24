-- Credit-purchase approval RPC used by the paymently-* Edge Functions.
-- Previously defined only in the root DATABASE_SCHEMA.sql; this makes it a real
-- migration and records the actual gateway (EPS) in the ledger instead of a
-- hardcoded provider. Idempotent.

ALTER TABLE IF EXISTS public.credit_transactions
  ADD COLUMN IF NOT EXISTS credits_amount INTEGER,
  ADD COLUMN IF NOT EXISTS balance_after INTEGER,
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

CREATE OR REPLACE FUNCTION public.approve_credit_payment_transaction(
  p_payment_transaction_id UUID,
  p_admin_id UUID
)
RETURNS TABLE (
  payment_id UUID,
  transaction_id TEXT,
  user_id UUID,
  credits_added INTEGER,
  balance_after INTEGER,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  payment_record public.payment_transactions%ROWTYPE;
  next_balance INTEGER;
BEGIN
  SELECT *
  INTO payment_record
  FROM public.payment_transactions
  WHERE id = p_payment_transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment transaction not found';
  END IF;

  IF payment_record.status = 'credited' THEN
    RETURN QUERY
    SELECT
      payment_record.id,
      payment_record.transaction_id,
      payment_record.user_id,
      COALESCE(payment_record.credits_to_add, 0),
      COALESCE((SELECT credits FROM public.users WHERE id = payment_record.user_id), 0),
      payment_record.status;
    RETURN;
  END IF;

  IF payment_record.status <> 'awaiting_admin_approval' THEN
    RAISE EXCEPTION 'Only verified payments can be approved';
  END IF;

  UPDATE public.users
  SET
    credits = COALESCE(credits, 0) + COALESCE(payment_record.credits_to_add, 0),
    updated_at = NOW()
  WHERE id = payment_record.user_id
  RETURNING credits INTO next_balance;

  INSERT INTO public.credit_transactions (
    user_id,
    credits_deducted,
    transaction_type,
    credits_amount,
    balance_after,
    reference_type,
    reference_id,
    provider,
    metadata,
    payment_transaction_id
  )
  VALUES (
    payment_record.user_id,
    -COALESCE(payment_record.credits_to_add, 0),
    'credit_purchase',
    COALESCE(payment_record.credits_to_add, 0),
    next_balance,
    'payment_transaction',
    payment_record.id,
    COALESCE(payment_record.provider, 'eps'),
    jsonb_build_object(
      'invoice_id', COALESCE(payment_record.invoice_id, payment_record.reference),
      'approved_by', p_admin_id
    ),
    payment_record.transaction_id
  );

  UPDATE public.payment_transactions
  SET
    status = 'credited',
    approved_at = COALESCE(approved_at, NOW()),
    approved_by = COALESCE(approved_by, p_admin_id),
    credited_at = NOW(),
    credited_by = p_admin_id,
    updated_at = NOW()
  WHERE id = payment_record.id;

  RETURN QUERY
  SELECT
    payment_record.id,
    payment_record.transaction_id,
    payment_record.user_id,
    COALESCE(payment_record.credits_to_add, 0),
    next_balance,
    'credited'::TEXT;
END;
$$;

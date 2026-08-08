ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_status_chk" CHECK ("customer_payments"."status" in ('draft', 'posted', 'reversed'));--> statement-breakpoint

-- Migration 0007 staged the payment rows that existed at that point. Three
-- draft JSON payments were subsequently created. Preserve those exact draft
-- identities without guessing an unresolved deposit account. A NULL deposit
-- account is an intentionally incomplete, accounting-neutral draft.
WITH candidates AS (
  SELECT
    rr.*,
    customer."id" AS customer_id,
    deposit_account."id" AS deposit_account_id
  FROM "resource_records" rr
  JOIN LATERAL (
    SELECT c."id"
    FROM "customers" c
    WHERE c."company_id" = rr."company_id"
      AND c."is_deleted" = false
      AND (
        c."id"::text = COALESCE(rr."data"->>'customerId', '')
        OR c."display_name" = COALESCE(rr."data"->>'customerId', '')
      )
    LIMIT 1
  ) customer ON true
  JOIN "branches" branch
    ON branch."id" = rr."branch_id"
   AND branch."company_id" = rr."company_id"
   AND branch."active" = true
  LEFT JOIN LATERAL (
    SELECT a."id"
    FROM "accounts" a
    WHERE a."company_id" = rr."company_id"
      AND a."active" = true
      AND (
        a."id"::text = COALESCE(rr."data"->>'depositToAccountId', '')
        OR a."account_number" = COALESCE(rr."data"->>'depositToAccountId', '')
        OR a."name" = COALESCE(rr."data"->>'depositToAccountId', '')
      )
    LIMIT 1
  ) deposit_account ON true
  WHERE rr."module" = 'sales'
    AND rr."resource" = 'payments'
    AND rr."is_deleted" = false
    AND rr."created_at" > '2026-08-01T12:12:59.429Z'::timestamptz
    AND NOT EXISTS (
      SELECT 1 FROM "customer_payments" payment WHERE payment."id" = rr."id"
    )
    AND COALESCE(jsonb_array_length(
      CASE WHEN jsonb_typeof(rr."data"->'allocations') = 'array'
        THEN rr."data"->'allocations' ELSE '[]'::jsonb END
    ), 0) = 0
    AND COALESCE(rr."data"->>'paymentDate', '') ~ '^\d{4}-\d{2}-\d{2}$'
    AND COALESCE(rr."data"->>'amount', '') ~ '^\d+(\.\d{1,4})?$'
    AND (rr."data"->>'amount')::numeric > 0
)
INSERT INTO "customer_payments" (
  "id", "company_id", "branch_id", "customer_id", "payment_number",
  "payment_date", "currency", "exchange_rate", "amount", "unapplied_amount",
  "payment_method", "reference", "deposit_account_id", "status", "version",
  "created_by", "updated_by", "is_deleted", "deleted_at", "created_at", "updated_at"
)
SELECT
  candidates."id",
  candidates."company_id",
  candidates."branch_id",
  candidates.customer_id,
  COALESCE(NULLIF(candidates."data"->>'documentNumber', ''), 'PAY-MIG-' || left(candidates."id"::text, 8)),
  (candidates."data"->>'paymentDate')::timestamptz,
  COALESCE(NULLIF(candidates."data"->>'currency', ''), 'USD'),
  COALESCE(NULLIF(candidates."data"->>'exchangeRate', ''), '1')::numeric,
  (candidates."data"->>'amount')::numeric,
  (candidates."data"->>'amount')::numeric,
  NULLIF(candidates."data"->>'paymentMethod', ''),
  NULLIF(candidates."data"->>'reference', ''),
  candidates.deposit_account_id,
  'draft',
  candidates."version",
  candidates."created_by",
  candidates."updated_by",
  false,
  NULL,
  candidates."created_at",
  candidates."updated_at"
FROM candidates
ON CONFLICT DO NOTHING;--> statement-breakpoint

-- Cutover is unsafe if any active post-0007 payment still lacks a relational
-- identity. Abort the migration rather than silently dropping a legacy draft.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "resource_records" rr
    LEFT JOIN "customer_payments" payment
      ON payment."id" = rr."id" AND payment."company_id" = rr."company_id"
    WHERE rr."module" = 'sales'
      AND rr."resource" = 'payments'
      AND rr."is_deleted" = false
      AND rr."created_at" > '2026-08-01T12:12:59.429Z'::timestamptz
      AND payment."id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Payment cutover aborted: an active post-0007 JSON payment was not migrated';
  END IF;
END $$;

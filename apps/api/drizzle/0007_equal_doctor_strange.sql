CREATE TABLE "migration_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"migration_tag" text NOT NULL,
	"source_table" text NOT NULL,
	"source_id" text NOT NULL,
	"company_id" uuid,
	"module" text,
	"resource" text,
	"reason_code" text NOT NULL,
	"reason" text NOT NULL,
	"raw_data" jsonb,
	"details" jsonb,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid
);
--> statement-breakpoint
CREATE TABLE "posting_idempotency_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"source_module" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"posting_kind" text DEFAULT 'primary' NOT NULL,
	"transaction_id" uuid,
	"status" text DEFAULT 'processing' NOT NULL,
	"response" jsonb,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_idempotency_status_chk" CHECK ("posting_idempotency_keys"."status" in ('processing', 'completed', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "source_type" text DEFAULT 'journal' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "posting_kind" text DEFAULT 'primary' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "posting_fingerprint" text;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "reversed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "reversed_by" uuid;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "subtype" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "system_key" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "normal_balance" text DEFAULT 'debit' NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "is_control_account" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "allow_manual_posting" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "migration_exceptions" ADD CONSTRAINT "migration_exceptions_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "migration_exceptions" ADD CONSTRAINT "migration_exceptions_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_idempotency_keys" ADD CONSTRAINT "posting_idempotency_keys_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_idempotency_keys" ADD CONSTRAINT "posting_idempotency_keys_transaction_id_accounting_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."accounting_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "migration_exceptions_source_reason_uq" ON "migration_exceptions" USING btree ("migration_tag","source_table","source_id","reason_code");--> statement-breakpoint
CREATE INDEX "migration_exceptions_open_idx" ON "migration_exceptions" USING btree ("migration_tag","resolved_at");--> statement-breakpoint
CREATE INDEX "migration_exceptions_company_idx" ON "migration_exceptions" USING btree ("company_id","detected_at");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_idempotency_company_key_uq" ON "posting_idempotency_keys" USING btree ("company_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_idempotency_source_uq" ON "posting_idempotency_keys" USING btree ("company_id","source_module","source_type","source_id","posting_kind");--> statement-breakpoint
CREATE INDEX "posting_idempotency_expiry_idx" ON "posting_idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_reversal_of_id_accounting_transactions_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."accounting_transactions"("id") ON DELETE restrict ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "accounting_transactions_reversed_by_users_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "transactions_company_posting_fingerprint_uq" ON "accounting_transactions" USING btree ("company_id","posting_fingerprint") WHERE "accounting_transactions"."posting_fingerprint" is not null;--> statement-breakpoint
CREATE INDEX "transactions_company_source_idx" ON "accounting_transactions" USING btree ("company_id","source_module","source_type","source_id","posting_kind");--> statement-breakpoint
CREATE INDEX "transactions_reversal_idx" ON "accounting_transactions" USING btree ("reversal_of_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_company_system_key_uq" ON "accounts" USING btree ("company_id","system_key") WHERE "accounts"."system_key" is not null;--> statement-breakpoint
CREATE INDEX "accounts_company_type_active_idx" ON "accounts" USING btree ("company_id","type","active");--> statement-breakpoint
ALTER TABLE "accounting_lines" ADD CONSTRAINT "accounting_lines_non_negative_chk" CHECK ("accounting_lines"."debit" >= 0 and "accounting_lines"."credit" >= 0) NOT VALID;--> statement-breakpoint
ALTER TABLE "accounting_lines" ADD CONSTRAINT "accounting_lines_one_side_chk" CHECK (("accounting_lines"."debit" > 0 and "accounting_lines"."credit" = 0) or ("accounting_lines"."credit" > 0 and "accounting_lines"."debit" = 0)) NOT VALID;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD CONSTRAINT "transactions_status_chk" CHECK ("accounting_transactions"."status" in ('draft', 'posted', 'reversed', 'voided')) NOT VALID;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_normal_balance_chk" CHECK ("accounts"."normal_balance" in ('debit', 'credit')) NOT VALID;--> statement-breakpoint

-- Compatibility helpers are used instead of pg_input_is_valid so this
-- migration remains safe on supported PostgreSQL versions before 16.
CREATE OR REPLACE FUNCTION migration_0007_is_valid_numeric(input text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN RETURN false; END IF;
  PERFORM input::numeric;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION migration_0007_is_valid_timestamptz(input text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF input IS NULL OR btrim(input) = '' THEN RETURN false; END IF;
  PERFORM input::timestamptz;
  RETURN true;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;--> statement-breakpoint

-- Existing rows remain in place. Invalid legacy data is recorded for review,
-- while NOT VALID constraints protect every new or modified row.
INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "details"
)
SELECT
  '0007_equal_doctor_strange', 'accounting_lines', al."id"::text,
  at."company_id", 'accounting', 'journal-entries', 'INVALID_DEBIT_CREDIT',
  'Journal line must have exactly one positive debit or credit.',
  jsonb_build_object('transactionId', al."transaction_id", 'debit', al."debit", 'credit', al."credit")
FROM "accounting_lines" al
JOIN "accounting_transactions" at ON at."id" = al."transaction_id"
WHERE NOT (
  (al."debit" > 0 AND al."credit" = 0)
  OR (al."credit" > 0 AND al."debit" = 0)
)
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "details"
)
SELECT
  '0007_equal_doctor_strange', 'accounting_transactions', duplicate."transaction_id"::text,
  duplicate."company_id", 'accounting', 'journal-entries', 'DUPLICATE_LINE_NUMBER',
  'Legacy journal contained duplicate line numbers; line numbers were deterministically resequenced without deleting journal lines.',
  jsonb_build_object('duplicateLineNumber', duplicate."line_number", 'count', duplicate.line_count)
FROM (
  SELECT al."transaction_id", al."line_number", at."company_id", count(*) AS line_count
  FROM "accounting_lines" al
  JOIN "accounting_transactions" at ON at."id" = al."transaction_id"
  GROUP BY al."transaction_id", al."line_number", at."company_id"
  HAVING count(*) > 1
) duplicate
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

WITH duplicate_transactions AS (
  SELECT "transaction_id"
  FROM "accounting_lines"
  GROUP BY "transaction_id", "line_number"
  HAVING count(*) > 1
), resequenced AS (
  SELECT al."id", row_number() OVER (
    PARTITION BY al."transaction_id"
    ORDER BY al."line_number", al."id"
  )::integer AS new_line_number
  FROM "accounting_lines" al
  WHERE al."transaction_id" IN (SELECT "transaction_id" FROM duplicate_transactions)
)
UPDATE "accounting_lines" line
SET "line_number" = resequenced.new_line_number
FROM resequenced
WHERE line."id" = resequenced."id";--> statement-breakpoint

CREATE UNIQUE INDEX "accounting_lines_transaction_number_uq" ON "accounting_lines" USING btree ("transaction_id","line_number");--> statement-breakpoint

UPDATE "accounts"
SET
  "normal_balance" = CASE
    WHEN "type" IN ('liability', 'equity', 'income') THEN 'credit'
    ELSE 'debit'
  END,
  "updated_at" = now();--> statement-breakpoint

UPDATE "accounts"
SET "normal_balance" = 'credit', "updated_at" = now()
WHERE "account_number" IN ('1150', '1450');--> statement-breakpoint

UPDATE "accounts"
SET
  "system_key" = CASE "account_number"
    WHEN '1000' THEN 'cash'
    WHEN '1020' THEN 'bank'
    WHEN '1030' THEN 'mobile_money'
    WHEN '1100' THEN 'accounts_receivable'
    WHEN '1200' THEN 'inventory_asset'
    WHEN '2000' THEN 'accounts_payable'
    WHEN '2060' THEN 'tax_payable'
    WHEN '3000' THEN 'owner_capital'
    WHEN '3100' THEN 'owner_drawings'
    WHEN '3200' THEN 'retained_earnings'
    WHEN '4000' THEN 'sales_revenue'
    WHEN '4020' THEN 'service_revenue'
    WHEN '4090' THEN 'sales_discounts'
    WHEN '4200' THEN 'other_income'
    WHEN '5000' THEN 'cost_of_goods_sold'
    WHEN '6000' THEN 'salary_expense'
    WHEN '6010' THEN 'rent_expense'
    WHEN '6020' THEN 'utilities_expense'
    WHEN '6070' THEN 'bank_fees'
    WHEN '6900' THEN 'other_expense'
  END,
  "is_system" = true,
  "is_control_account" = "account_number" IN ('1100', '1200', '2000', '2060'),
  "allow_manual_posting" = NOT ("account_number" IN ('1100', '1200', '2000', '2060')),
  "updated_at" = now()
WHERE "account_number" IN (
  '1000', '1020', '1030', '1100', '1200', '2000', '2060', '3000',
  '3100', '3200', '4000', '4020', '4090', '4200', '5000', '6000', '6010',
  '6020', '6070', '6900'
);--> statement-breakpoint

-- Quarantine invoice rows whose line JSON cannot be migrated safely.
WITH legacy_lines AS (
  SELECT rr.*, line.value AS line, line.ordinality::integer AS line_number
  FROM "resource_records" rr
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(rr."data"->'lines') = 'array' THEN rr."data"->'lines' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS line(value, ordinality)
  WHERE rr."module" = 'sales' AND rr."resource" = 'invoices'
), resolved AS (
  SELECT ll.*, i."id" AS relational_invoice_id, item."id" AS item_id, account."id" AS account_id
  FROM legacy_lines ll
  LEFT JOIN "invoices" i ON i."id" = ll."id" AND i."company_id" = ll."company_id"
  LEFT JOIN LATERAL (
    SELECT candidate."id"
    FROM "items" candidate
    WHERE candidate."company_id" = ll."company_id"
      AND candidate."is_deleted" = false
      AND (
        candidate."id"::text = COALESCE(ll.line->>'itemId', '')
        OR candidate."sku" = COALESCE(ll.line->>'itemId', '')
        OR candidate."name" = COALESCE(ll.line->>'itemId', '')
      )
    LIMIT 1
  ) item ON true
  LEFT JOIN LATERAL (
    SELECT candidate."id"
    FROM "accounts" candidate
    WHERE candidate."company_id" = ll."company_id"
      AND candidate."active" = true
      AND (
        candidate."id"::text = COALESCE(ll.line->>'accountId', '')
        OR candidate."account_number" = COALESCE(ll.line->>'accountId', '')
        OR candidate."name" = COALESCE(ll.line->>'accountId', '')
      )
    LIMIT 1
  ) account ON true
)
INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "raw_data", "details"
)
SELECT
  '0007_equal_doctor_strange', 'resource_records',
  resolved."id"::text || ':line:' || resolved.line_number::text,
  resolved."company_id", 'sales', 'invoices',
  CASE
    WHEN resolved.relational_invoice_id IS NULL THEN 'MISSING_INVOICE_HEADER'
    WHEN resolved.item_id IS NULL AND resolved.account_id IS NULL THEN 'UNRESOLVED_LINE_REFERENCE'
    ELSE 'INVALID_LINE_AMOUNT'
  END,
  CASE
    WHEN resolved.relational_invoice_id IS NULL THEN 'Invoice header was not migrated.'
    WHEN resolved.item_id IS NULL AND resolved.account_id IS NULL THEN 'Line item/account could not be resolved in the same company.'
    ELSE 'Quantity, unit price, discount, tax, or line total is not a valid numeric value.'
  END,
  resolved.line,
  jsonb_build_object('invoiceId', resolved."id", 'lineNumber', resolved.line_number)
FROM resolved
WHERE resolved.relational_invoice_id IS NULL
   OR (resolved.item_id IS NULL AND resolved.account_id IS NULL)
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'quantity', ''), '1'))
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'unitPrice', ''), NULLIF(resolved.line->>'rate', ''), '0'))
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'discountAmount', ''), '0'))
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'taxAmount', ''), '0'))
   OR (
     COALESCE(NULLIF(resolved.line->>'lineTotal', ''), NULLIF(resolved.line->>'amount', '')) IS NOT NULL
     AND NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'lineTotal', ''), NULLIF(resolved.line->>'amount', '')))
   )
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

WITH legacy_lines AS (
  SELECT rr.*, line.value AS line, line.ordinality::integer AS line_number
  FROM "resource_records" rr
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(rr."data"->'lines') = 'array' THEN rr."data"->'lines' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS line(value, ordinality)
  WHERE rr."module" = 'sales' AND rr."resource" = 'invoices'
), resolved AS (
  SELECT ll.*, i."id" AS relational_invoice_id, item."id" AS item_id, account."id" AS account_id
  FROM legacy_lines ll
  JOIN "invoices" i ON i."id" = ll."id" AND i."company_id" = ll."company_id"
  LEFT JOIN LATERAL (
    SELECT candidate."id" FROM "items" candidate
    WHERE candidate."company_id" = ll."company_id" AND candidate."is_deleted" = false
      AND (candidate."id"::text = COALESCE(ll.line->>'itemId', '') OR candidate."sku" = COALESCE(ll.line->>'itemId', '') OR candidate."name" = COALESCE(ll.line->>'itemId', ''))
    LIMIT 1
  ) item ON true
  LEFT JOIN LATERAL (
    SELECT candidate."id" FROM "accounts" candidate
    WHERE candidate."company_id" = ll."company_id" AND candidate."active" = true
      AND (candidate."id"::text = COALESCE(ll.line->>'accountId', '') OR candidate."account_number" = COALESCE(ll.line->>'accountId', '') OR candidate."name" = COALESCE(ll.line->>'accountId', ''))
    LIMIT 1
  ) account ON true
)
INSERT INTO "invoice_lines" (
  "invoice_id", "item_id", "account_id", "description", "quantity",
  "unit_price", "discount_amount", "tax_amount", "line_total", "line_number"
)
SELECT
  resolved.relational_invoice_id, resolved.item_id, resolved.account_id,
  COALESCE(NULLIF(resolved.line->>'description', ''), NULLIF(resolved.line->>'item', ''), 'Invoice line'),
  COALESCE(NULLIF(resolved.line->>'quantity', ''), '1')::numeric,
  COALESCE(NULLIF(resolved.line->>'unitPrice', ''), NULLIF(resolved.line->>'rate', ''), '0')::numeric,
  COALESCE(NULLIF(resolved.line->>'discountAmount', ''), '0')::numeric,
  COALESCE(NULLIF(resolved.line->>'taxAmount', ''), '0')::numeric,
  COALESCE(
    NULLIF(resolved.line->>'lineTotal', ''),
    NULLIF(resolved.line->>'amount', ''),
    ((COALESCE(NULLIF(resolved.line->>'quantity', ''), '1')::numeric * COALESCE(NULLIF(resolved.line->>'unitPrice', ''), NULLIF(resolved.line->>'rate', ''), '0')::numeric)
      - COALESCE(NULLIF(resolved.line->>'discountAmount', ''), '0')::numeric
      + COALESCE(NULLIF(resolved.line->>'taxAmount', ''), '0')::numeric)::text
  )::numeric,
  resolved.line_number
FROM resolved
WHERE (resolved.item_id IS NOT NULL OR resolved.account_id IS NOT NULL)
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'quantity', ''), '1'))
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'unitPrice', ''), NULLIF(resolved.line->>'rate', ''), '0'))
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'discountAmount', ''), '0'))
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'taxAmount', ''), '0'))
  AND (
    COALESCE(NULLIF(resolved.line->>'lineTotal', ''), NULLIF(resolved.line->>'amount', '')) IS NULL
    OR migration_0007_is_valid_numeric(COALESCE(NULLIF(resolved.line->>'lineTotal', ''), NULLIF(resolved.line->>'amount', '')))
  )
ON CONFLICT ("invoice_id", "line_number") DO NOTHING;--> statement-breakpoint

-- Normalize legacy customer payments. Ambiguous or invalid records remain in
-- resource_records and are recorded in migration_exceptions.
WITH candidates AS (
  SELECT rr.*, customer."id" AS customer_id, deposit_account."id" AS deposit_account_id
  FROM "resource_records" rr
  LEFT JOIN LATERAL (
    SELECT c."id" FROM "customers" c
    WHERE c."company_id" = rr."company_id" AND c."is_deleted" = false
      AND (c."id"::text = COALESCE(rr."data"->>'customerId', '') OR c."display_name" = COALESCE(rr."data"->>'customerId', ''))
    LIMIT 1
  ) customer ON true
  LEFT JOIN LATERAL (
    SELECT a."id" FROM "accounts" a
    WHERE a."company_id" = rr."company_id" AND a."active" = true
      AND (a."id"::text = COALESCE(rr."data"->>'depositToAccountId', '') OR a."account_number" = COALESCE(rr."data"->>'depositToAccountId', '') OR a."name" = COALESCE(rr."data"->>'depositToAccountId', ''))
    LIMIT 1
  ) deposit_account ON true
  WHERE rr."module" = 'sales' AND rr."resource" = 'payments'
)
INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "raw_data"
)
SELECT
  '0007_equal_doctor_strange', 'resource_records', candidates."id"::text,
  candidates."company_id", 'sales', 'payments',
  CASE
    WHEN candidates.customer_id IS NULL THEN 'UNRESOLVED_CUSTOMER'
    WHEN candidates.deposit_account_id IS NULL THEN 'UNRESOLVED_DEPOSIT_ACCOUNT'
    WHEN NOT migration_0007_is_valid_timestamptz(COALESCE(candidates."data"->>'paymentDate', '')) THEN 'INVALID_PAYMENT_DATE'
    WHEN NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'unappliedAmount', ''), candidates."data"->>'amount')) THEN 'INVALID_UNAPPLIED_AMOUNT'
    ELSE 'INVALID_PAYMENT_AMOUNT'
  END,
  CASE
    WHEN candidates.customer_id IS NULL THEN 'Payment customer could not be resolved in the same company.'
    WHEN candidates.deposit_account_id IS NULL THEN 'Payment deposit account could not be resolved in the same company.'
    WHEN NOT migration_0007_is_valid_timestamptz(COALESCE(candidates."data"->>'paymentDate', '')) THEN 'Payment date is invalid.'
    WHEN NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'unappliedAmount', ''), candidates."data"->>'amount')) THEN 'Payment unapplied amount is invalid.'
    ELSE 'Payment amount or exchange rate is invalid.'
  END,
  candidates."data"
FROM candidates
WHERE candidates.customer_id IS NULL
   OR candidates.deposit_account_id IS NULL
   OR NOT migration_0007_is_valid_timestamptz(COALESCE(candidates."data"->>'paymentDate', ''))
   OR NOT migration_0007_is_valid_numeric(COALESCE(candidates."data"->>'amount', ''))
   OR CASE
     WHEN migration_0007_is_valid_numeric(COALESCE(candidates."data"->>'amount', ''))
       THEN (candidates."data"->>'amount')::numeric <= 0
     ELSE false
   END
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'exchangeRate', ''), '1'))
   OR NOT migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'unappliedAmount', ''), candidates."data"->>'amount'))
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

WITH candidates AS (
  SELECT rr.*, customer."id" AS customer_id, deposit_account."id" AS deposit_account_id
  FROM "resource_records" rr
  JOIN LATERAL (
    SELECT c."id" FROM "customers" c
    WHERE c."company_id" = rr."company_id" AND c."is_deleted" = false
      AND (c."id"::text = COALESCE(rr."data"->>'customerId', '') OR c."display_name" = COALESCE(rr."data"->>'customerId', ''))
    LIMIT 1
  ) customer ON true
  JOIN LATERAL (
    SELECT a."id" FROM "accounts" a
    WHERE a."company_id" = rr."company_id" AND a."active" = true
      AND (a."id"::text = COALESCE(rr."data"->>'depositToAccountId', '') OR a."account_number" = COALESCE(rr."data"->>'depositToAccountId', '') OR a."name" = COALESCE(rr."data"->>'depositToAccountId', ''))
    LIMIT 1
  ) deposit_account ON true
  WHERE rr."module" = 'sales' AND rr."resource" = 'payments'
)
INSERT INTO "customer_payments" (
  "id", "company_id", "branch_id", "customer_id", "payment_number",
  "payment_date", "currency", "exchange_rate", "amount", "unapplied_amount",
  "payment_method", "reference", "deposit_account_id", "status", "version",
  "created_by", "updated_by", "is_deleted", "deleted_at", "created_at", "updated_at"
)
SELECT
  candidates."id", candidates."company_id", candidates."branch_id", candidates.customer_id,
  COALESCE(NULLIF(candidates."data"->>'documentNumber', ''), 'PAY-MIG-' || left(candidates."id"::text, 8)),
  (candidates."data"->>'paymentDate')::timestamptz,
  COALESCE(NULLIF(candidates."data"->>'currency', ''), 'USD'),
  COALESCE(NULLIF(candidates."data"->>'exchangeRate', ''), '1')::numeric,
  (candidates."data"->>'amount')::numeric,
  COALESCE(NULLIF(candidates."data"->>'unappliedAmount', ''), candidates."data"->>'amount')::numeric,
  NULLIF(candidates."data"->>'paymentMethod', ''), NULLIF(candidates."data"->>'reference', ''),
  candidates.deposit_account_id,
  -- Legacy operational status is not proof of a balanced ledger posting.
  -- The posting engine must explicitly post this normalized draft later.
  'draft',
  candidates."version", candidates."created_by", candidates."updated_by",
  candidates."is_deleted", candidates."deleted_at", candidates."created_at", candidates."updated_at"
FROM candidates
WHERE migration_0007_is_valid_timestamptz(COALESCE(candidates."data"->>'paymentDate', ''))
  AND migration_0007_is_valid_numeric(COALESCE(candidates."data"->>'amount', ''))
  AND (candidates."data"->>'amount')::numeric > 0
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'exchangeRate', ''), '1'))
  AND migration_0007_is_valid_numeric(COALESCE(NULLIF(candidates."data"->>'unappliedAmount', ''), candidates."data"->>'amount'))
ON CONFLICT DO NOTHING;--> statement-breakpoint

INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "raw_data"
)
SELECT
  '0007_equal_doctor_strange', 'resource_records', rr."id"::text,
  rr."company_id", 'sales', 'payments', 'PAYMENT_UNIQUE_CONFLICT',
  'Payment passed field validation but could not be inserted, usually because its document number conflicts with an existing payment.',
  rr."data"
FROM "resource_records" rr
LEFT JOIN "customer_payments" payment ON payment."id" = rr."id"
WHERE rr."module" = 'sales' AND rr."resource" = 'payments'
  AND payment."id" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "migration_exceptions" existing
    WHERE existing."migration_tag" = '0007_equal_doctor_strange'
      AND existing."source_table" = 'resource_records'
      AND existing."source_id" = rr."id"::text
  )
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

CREATE TEMP TABLE migration_0007_allocation_candidates ON COMMIT DROP AS
WITH legacy_allocations AS (
  SELECT rr."id" AS payment_id, rr."company_id", allocation.value AS allocation,
    allocation.ordinality::integer AS allocation_number
  FROM "resource_records" rr
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE WHEN jsonb_typeof(rr."data"->'allocations') = 'array' THEN rr."data"->'allocations' ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS allocation(value, ordinality)
  WHERE rr."module" = 'sales' AND rr."resource" = 'payments'
), resolved AS (
  SELECT legacy_allocations.*, payment."customer_id", payment."amount" AS payment_amount,
    invoice."id" AS invoice_id, invoice."customer_id" AS invoice_customer_id,
    invoice."total" AS invoice_total, invoice."status" AS invoice_status,
    CASE WHEN migration_0007_is_valid_numeric(COALESCE(legacy_allocations.allocation->>'amount', ''))
      THEN (legacy_allocations.allocation->>'amount')::numeric END AS parsed_amount
  FROM legacy_allocations
  LEFT JOIN "customer_payments" payment ON payment."id" = legacy_allocations.payment_id
    AND payment."company_id" = legacy_allocations."company_id"
  LEFT JOIN LATERAL (
    SELECT i."id", i."customer_id", i."total", i."status" FROM "invoices" i
    WHERE i."company_id" = legacy_allocations."company_id"
      AND (i."id"::text = COALESCE(legacy_allocations.allocation->>'invoiceId', '') OR i."invoice_number" = COALESCE(legacy_allocations.allocation->>'invoiceId', ''))
    LIMIT 1
  ) invoice ON true
), batch_stats AS (
  SELECT resolved.*,
    count(*) OVER (
      PARTITION BY resolved.payment_id, COALESCE(resolved.invoice_id::text, resolved.allocation->>'invoiceId')
    ) AS duplicate_count,
    sum(COALESCE(resolved.parsed_amount, 0)) OVER (PARTITION BY resolved.payment_id) AS payment_batch_total,
    sum(COALESCE(resolved.parsed_amount, 0)) OVER (PARTITION BY resolved.company_id, resolved.invoice_id) AS invoice_batch_total,
    count(*) FILTER (WHERE resolved.customer_id IS NULL OR resolved.invoice_id IS NULL
      OR resolved.customer_id <> resolved.invoice_customer_id
      OR resolved.parsed_amount IS NULL OR resolved.parsed_amount <= 0
      OR resolved.invoice_status IN ('draft', 'incomplete', 'voided'))
      OVER (PARTITION BY resolved.payment_id) AS payment_error_count
  FROM resolved
)
SELECT batch_stats.*,
  COALESCE((SELECT sum(existing."amount") FROM "customer_payment_allocations" existing
    WHERE existing."payment_id" = batch_stats.payment_id), 0) AS existing_payment_allocated,
  COALESCE((SELECT sum(existing."amount") FROM "customer_payment_allocations" existing
    WHERE existing."invoice_id" = batch_stats.invoice_id), 0) AS existing_invoice_allocated
FROM batch_stats;--> statement-breakpoint

INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "raw_data", "details"
)
SELECT
  '0007_equal_doctor_strange', 'resource_records',
  candidate.payment_id::text || ':allocation:' || candidate.allocation_number::text,
  candidate."company_id", 'sales', 'payments',
  CASE
    WHEN candidate.customer_id IS NULL THEN 'MISSING_PAYMENT'
    WHEN candidate.invoice_id IS NULL THEN 'UNRESOLVED_INVOICE'
    WHEN candidate.customer_id <> candidate.invoice_customer_id THEN 'CUSTOMER_MISMATCH'
    WHEN candidate.parsed_amount IS NULL OR candidate.parsed_amount <= 0 THEN 'INVALID_ALLOCATION_AMOUNT'
    WHEN candidate.duplicate_count > 1 THEN 'DUPLICATE_ALLOCATION'
    WHEN candidate.invoice_status IN ('draft', 'incomplete', 'voided') THEN 'INVOICE_NOT_ALLOCATABLE'
    WHEN candidate.payment_error_count > 0 THEN 'PAYMENT_BATCH_INVALID'
    WHEN candidate.existing_payment_allocated + candidate.payment_batch_total > candidate.payment_amount THEN 'PAYMENT_OVERALLOCATED'
    ELSE 'INVOICE_OVERALLOCATED'
  END,
  CASE
    WHEN candidate.customer_id IS NULL THEN 'The parent payment was not migrated.'
    WHEN candidate.invoice_id IS NULL THEN 'Allocation invoice could not be resolved in the same company.'
    WHEN candidate.customer_id <> candidate.invoice_customer_id THEN 'Payment and invoice belong to different customers.'
    WHEN candidate.parsed_amount IS NULL OR candidate.parsed_amount <= 0 THEN 'Allocation amount must be a positive numeric value.'
    WHEN candidate.duplicate_count > 1 THEN 'Payment JSON contains the same invoice more than once; no duplicate allocation was silently discarded.'
    WHEN candidate.invoice_status IN ('draft', 'incomplete', 'voided') THEN 'Draft, incomplete, or voided invoices cannot receive migrated allocations.'
    WHEN candidate.payment_error_count > 0 THEN 'The payment allocation batch contains another invalid row; the whole batch was quarantined.'
    WHEN candidate.existing_payment_allocated + candidate.payment_batch_total > candidate.payment_amount THEN 'Total allocations exceed the payment amount.'
    ELSE 'Total allocations exceed the invoice total.'
  END,
  candidate.allocation,
  jsonb_build_object('paymentId', candidate.payment_id, 'invoiceId', candidate.invoice_id,
    'paymentBatchTotal', candidate.payment_batch_total, 'invoiceBatchTotal', candidate.invoice_batch_total)
FROM migration_0007_allocation_candidates candidate
WHERE candidate.customer_id IS NULL OR candidate.invoice_id IS NULL
   OR candidate.customer_id <> candidate.invoice_customer_id
   OR candidate.parsed_amount IS NULL OR candidate.parsed_amount <= 0
   OR candidate.duplicate_count > 1
   OR candidate.invoice_status IN ('draft', 'incomplete', 'voided')
   OR candidate.payment_error_count > 0
   OR candidate.existing_payment_allocated + candidate.payment_batch_total > candidate.payment_amount
   OR candidate.existing_invoice_allocated + candidate.invoice_batch_total > candidate.invoice_total
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

INSERT INTO "customer_payment_allocations" ("payment_id", "invoice_id", "amount")
SELECT candidate.payment_id, candidate.invoice_id, candidate.parsed_amount
FROM migration_0007_allocation_candidates candidate
WHERE candidate.customer_id = candidate.invoice_customer_id
  AND candidate.parsed_amount > 0
  AND candidate.duplicate_count = 1
  AND candidate.invoice_status NOT IN ('draft', 'incomplete', 'voided')
  AND candidate.payment_error_count = 0
  AND candidate.existing_payment_allocated + candidate.payment_batch_total <= candidate.payment_amount
  AND candidate.existing_invoice_allocated + candidate.invoice_batch_total <= candidate.invoice_total
ON CONFLICT ("payment_id", "invoice_id") DO NOTHING;--> statement-breakpoint

-- Migrated payments deliberately remain drafts because legacy operational
-- status is not evidence of a balanced journal. Allocations are staged for the
-- posting engine, but must not change invoice paid/balance/status or payment
-- unapplied amount until the atomic payment posting transaction succeeds.

-- These checks are intentionally last. A migration with no exceptions can
-- validate them immediately; otherwise remediation can occur without data loss.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "migration_exceptions"
    WHERE "migration_tag" = '0007_equal_doctor_strange'
      AND "source_table" = 'accounting_lines'
      AND "resolved_at" IS NULL
  ) THEN
    ALTER TABLE "accounting_lines" VALIDATE CONSTRAINT "accounting_lines_non_negative_chk";
    ALTER TABLE "accounting_lines" VALIDATE CONSTRAINT "accounting_lines_one_side_chk";
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION migration_0007_is_valid_numeric(text);--> statement-breakpoint
DROP FUNCTION migration_0007_is_valid_timestamptz(text);

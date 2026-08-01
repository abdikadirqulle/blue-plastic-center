CREATE TABLE "inventory_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"quantity" numeric(20, 4) DEFAULT '0' NOT NULL,
	"inventory_value" numeric(20, 4) DEFAULT '0' NOT NULL,
	"revision" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_balances_non_negative_chk" CHECK ("inventory_balances"."quantity" >= 0 and "inventory_balances"."inventory_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"source_module" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" uuid NOT NULL,
	"source_line_id" uuid,
	"idempotency_key" text NOT NULL,
	"quantity_delta" numeric(20, 4) NOT NULL,
	"value_delta" numeric(20, 4) NOT NULL,
	"unit_cost" numeric(20, 4) DEFAULT '0' NOT NULL,
	"quantity_after" numeric(20, 4) NOT NULL,
	"value_after" numeric(20, 4) NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "warehouse_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "unit" text;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD COLUMN "tax_rate" numeric(9, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "posted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "posted_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_balances_scope_uq" ON "inventory_balances" USING btree ("company_id","warehouse_id","item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_movements_source_uq" ON "inventory_movements" USING btree ("company_id","source_module","source_type","source_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "inventory_movements_item_idx" ON "inventory_movements" USING btree ("company_id","item_id","warehouse_id","occurred_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_source_idx" ON "inventory_movements" USING btree ("company_id","source_module","source_type","source_id");--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_warehouse_id_warehouses_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_posted_by_users_id_fk" FOREIGN KEY ("posted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_company_status_idx" ON "invoices" USING btree ("company_id","status","invoice_date");--> statement-breakpoint

-- Legacy invoice statuses came from a free-text JSONB workflow. Map the known
-- synonyms onto the canonical lifecycle before the constraint is introduced.
UPDATE "invoices"
SET "status" = CASE lower("status")
  WHEN 'posted' THEN 'open'
  WHEN 'sent' THEN 'open'
  WHEN 'approved' THEN 'open'
  WHEN 'partial' THEN 'partially_paid'
  WHEN 'partially paid' THEN 'partially_paid'
  WHEN 'partially-paid' THEN 'partially_paid'
  WHEN 'void' THEN 'voided'
  WHEN 'cancelled' THEN 'voided'
  WHEN 'canceled' THEN 'voided'
  WHEN 'incomplete' THEN 'draft'
  ELSE lower("status")
END
WHERE lower("status") <> "status"
   OR lower("status") IN (
     'posted', 'sent', 'approved', 'partial', 'partially paid',
     'partially-paid', 'void', 'cancelled', 'canceled', 'incomplete'
   );--> statement-breakpoint

-- Anything still outside the lifecycle is quarantined rather than rewritten,
-- so no financial state is silently invented by a migration.
INSERT INTO "migration_exceptions" (
  "migration_tag", "source_table", "source_id", "company_id", "module",
  "resource", "reason_code", "reason", "details"
)
SELECT
  '0009_parallel_lord_tyger', 'invoices', invoice."id"::text, invoice."company_id",
  'sales', 'invoices', 'UNKNOWN_INVOICE_STATUS',
  'Invoice status is outside the canonical lifecycle and must be corrected manually.',
  jsonb_build_object('status', invoice."status", 'invoiceNumber', invoice."invoice_number")
FROM "invoices" invoice
WHERE invoice."status" NOT IN ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'voided')
ON CONFLICT ("migration_tag", "source_table", "source_id", "reason_code") DO NOTHING;--> statement-breakpoint

-- Posted invoices predate the lifecycle columns; recover their posting audit
-- from the journal that already exists for them.
UPDATE "invoices" invoice
SET "posted_at" = posting."posted_at", "posted_by" = posting."posted_by"
FROM "accounting_transactions" posting
WHERE posting."company_id" = invoice."company_id"
  AND posting."source_module" = 'sales'
  AND posting."source_type" = 'invoice'
  AND posting."source_id" = invoice."id"
  AND posting."posting_kind" = 'primary'
  AND invoice."posted_at" IS NULL;--> statement-breakpoint

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_chk" CHECK ("invoices"."status" in ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'voided')) NOT VALID;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "migration_exceptions"
    WHERE "migration_tag" = '0009_parallel_lord_tyger'
      AND "reason_code" = 'UNKNOWN_INVOICE_STATUS'
      AND "resolved_at" IS NULL
  ) THEN
    ALTER TABLE "invoices" VALIDATE CONSTRAINT "invoices_status_chk";
  END IF;
END $$;
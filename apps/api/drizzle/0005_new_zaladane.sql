CREATE TABLE "customer_payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"payment_number" text NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"currency" text NOT NULL,
	"exchange_rate" numeric(20, 8) DEFAULT '1' NOT NULL,
	"amount" numeric(20, 4) NOT NULL,
	"unapplied_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"payment_method" text,
	"reference" text,
	"deposit_account_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"item_id" uuid,
	"account_id" uuid,
	"tax_code_id" uuid,
	"description" text NOT NULL,
	"quantity" numeric(20, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(20, 4) DEFAULT '0' NOT NULL,
	"discount_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"tax_amount" numeric(20, 4) DEFAULT '0' NOT NULL,
	"line_total" numeric(20, 4) DEFAULT '0' NOT NULL,
	"line_number" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"branch_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"currency" text NOT NULL,
	"exchange_rate" numeric(20, 8) DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"customer_purchase_order" text,
	"memo" text,
	"subtotal" numeric(20, 4) DEFAULT '0' NOT NULL,
	"discount_total" numeric(20, 4) DEFAULT '0' NOT NULL,
	"tax_total" numeric(20, 4) DEFAULT '0' NOT NULL,
	"total" numeric(20, 4) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(20, 4) DEFAULT '0' NOT NULL,
	"balance_due" numeric(20, 4) DEFAULT '0' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_by" uuid NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "branch_id" uuid;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "created_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_payment_id_customer_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payment_allocations" ADD CONSTRAINT "customer_payment_allocations_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_deposit_account_id_accounts_id_fk" FOREIGN KEY ("deposit_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_payments" ADD CONSTRAINT "customer_payments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_item_id_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_tax_code_id_tax_codes_id_fk" FOREIGN KEY ("tax_code_id") REFERENCES "public"."tax_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_allocations_payment_invoice_uq" ON "customer_payment_allocations" USING btree ("payment_id","invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_payments_company_number_uq" ON "customer_payments" USING btree ("company_id","payment_number");--> statement-breakpoint
CREATE INDEX "customer_payments_customer_idx" ON "customer_payments" USING btree ("company_id","customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_lines_invoice_number_uq" ON "invoice_lines" USING btree ("invoice_id","line_number");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoice_lines" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_company_number_uq" ON "invoices" USING btree ("company_id","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_company_customer_idx" ON "invoices" USING btree ("company_id","customer_id");--> statement-breakpoint
CREATE INDEX "invoices_company_due_idx" ON "invoices" USING btree ("company_id","due_date");--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
INSERT INTO "customers" (
  "id", "company_id", "branch_id", "display_name", "company_name", "email",
  "phone", "currency", "opening_balance", "active", "version", "created_by",
  "updated_by", "is_deleted", "deleted_at", "created_at", "updated_at"
)
SELECT
  rr."id", rr."company_id", rr."branch_id", rr."data"->>'displayName',
  NULLIF(rr."data"->>'companyName', ''), NULLIF(rr."data"->>'email', ''),
  NULLIF(rr."data"->>'phone', ''), COALESCE(NULLIF(rr."data"->>'currency', ''), 'USD'),
  COALESCE(NULLIF(rr."data"->>'openingBalance', '')::numeric, 0),
  rr."status" <> 'inactive', rr."version", rr."created_by", rr."updated_by",
  rr."is_deleted", rr."deleted_at", rr."created_at", rr."updated_at"
FROM "resource_records" rr
WHERE rr."module" = 'sales'
  AND rr."resource" = 'customers'
  AND NULLIF(rr."data"->>'displayName', '') IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "invoices" (
  "id", "company_id", "branch_id", "customer_id", "invoice_number",
  "invoice_date", "due_date", "currency", "exchange_rate", "status",
  "memo", "subtotal", "discount_total", "tax_total", "total", "amount_paid",
  "balance_due", "version", "created_by", "updated_by", "is_deleted",
  "deleted_at", "created_at", "updated_at"
)
SELECT
  rr."id", rr."company_id", rr."branch_id", c."id",
  COALESCE(NULLIF(rr."data"->>'documentNumber', ''), 'MIG-' || left(rr."id"::text, 8)),
  COALESCE(NULLIF(rr."data"->>'invoiceDate', '')::timestamptz, rr."created_at"),
  COALESCE(NULLIF(rr."data"->>'dueDate', '')::timestamptz, rr."created_at"),
  COALESCE(NULLIF(rr."data"->>'currency', ''), 'USD'),
  COALESCE(NULLIF(rr."data"->>'exchangeRate', '')::numeric, 1), rr."status",
  NULLIF(rr."data"->>'memo', ''),
  COALESCE(NULLIF(rr."data"->>'subtotal', '')::numeric, NULLIF(rr."data"->>'total', '')::numeric, 0),
  COALESCE(NULLIF(rr."data"->>'discountTotal', '')::numeric, 0),
  COALESCE(NULLIF(rr."data"->>'taxTotal', '')::numeric, 0),
  COALESCE(NULLIF(rr."data"->>'total', '')::numeric, 0),
  COALESCE(NULLIF(rr."data"->>'amountPaid', '')::numeric, 0),
  COALESCE(NULLIF(rr."data"->>'balanceDue', '')::numeric, NULLIF(rr."data"->>'total', '')::numeric, 0),
  rr."version", rr."created_by", rr."updated_by", rr."is_deleted",
  rr."deleted_at", rr."created_at", rr."updated_at"
FROM "resource_records" rr
JOIN "customers" c
  ON c."company_id" = rr."company_id"
 AND (
   c."id"::text = rr."data"->>'customerId'
   OR c."display_name" = rr."data"->>'customer'
 )
WHERE rr."module" = 'sales' AND rr."resource" = 'invoices'
ON CONFLICT ("id") DO NOTHING;

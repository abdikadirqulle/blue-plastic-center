CREATE TABLE "posting_profile_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"profile_id" uuid NOT NULL,
	"role" text NOT NULL,
	"side" text NOT NULL,
	"account_meaning" text,
	"override_source" text,
	"line_number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_profile_lines_number_chk" CHECK ("posting_profile_lines"."line_number" > 0),
	CONSTRAINT "posting_profile_lines_side_chk" CHECK ("posting_profile_lines"."side" in ('debit', 'credit')),
	CONSTRAINT "posting_profile_lines_role_chk" CHECK ("posting_profile_lines"."role" in ('receivable', 'payable', 'revenue', 'sales_discount', 'inventory_asset', 'cost_of_goods_sold', 'tax_payable', 'deposit', 'opening_equity', 'transfer_source', 'transfer_destination', 'bank_fee')),
	CONSTRAINT "posting_profile_lines_meaning_chk" CHECK ("posting_profile_lines"."account_meaning" is null or "posting_profile_lines"."account_meaning" in ('accounts_receivable', 'accounts_payable', 'sales_revenue', 'service_revenue', 'sales_discounts', 'inventory_asset', 'cost_of_goods_sold', 'tax_payable', 'cash', 'bank', 'mobile_money', 'owner_capital')),
	CONSTRAINT "posting_profile_lines_override_chk" CHECK ("posting_profile_lines"."override_source" is null or "posting_profile_lines"."override_source" in ('customer_receivable_account', 'vendor_payable_account', 'item_income_account', 'item_inventory_account', 'item_expense_account', 'tax_sales_account', 'tax_purchase_account', 'deposit_account', 'bank_ledger_account', 'bank_fee_expense_account')),
	CONSTRAINT "posting_profile_lines_account_source_chk" CHECK ("posting_profile_lines"."account_meaning" is not null or "posting_profile_lines"."override_source" is not null)
);
--> statement-breakpoint
CREATE TABLE "posting_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posting_profiles_version_chk" CHECK ("posting_profiles"."version" > 0),
	CONSTRAINT "posting_profiles_code_chk" CHECK ("posting_profiles"."code" in ('invoice', 'customer_payment', 'sales_receipt', 'vendor_bill', 'inventory_opening', 'bank_transfer'))
);
--> statement-breakpoint
ALTER TABLE "posting_profile_lines" ADD CONSTRAINT "posting_profile_lines_profile_id_posting_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."posting_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posting_profiles" ADD CONSTRAINT "posting_profiles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "posting_profile_lines_role_uq" ON "posting_profile_lines" USING btree ("profile_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_profile_lines_number_uq" ON "posting_profile_lines" USING btree ("profile_id","line_number");--> statement-breakpoint
CREATE UNIQUE INDEX "posting_profiles_company_code_uq" ON "posting_profiles" USING btree ("company_id","code");
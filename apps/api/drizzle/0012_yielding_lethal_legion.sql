ALTER TABLE "accounting_lines" ADD COLUMN "functional_debit" numeric(20, 4);--> statement-breakpoint
ALTER TABLE "accounting_lines" ADD COLUMN "functional_credit" numeric(20, 4);--> statement-breakpoint
ALTER TABLE "accounting_transactions" ADD COLUMN "functional_currency" text;--> statement-breakpoint
UPDATE "accounting_transactions" AS gl_transaction
SET "functional_currency" = company."functional_currency"
FROM "companies" AS company
WHERE gl_transaction."company_id" = company."id";--> statement-breakpoint
UPDATE "accounting_lines"
SET
	"functional_debit" = "debit",
	"functional_credit" = "credit";--> statement-breakpoint
ALTER TABLE "accounting_transactions" ALTER COLUMN "functional_currency" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_lines" ALTER COLUMN "functional_debit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_lines" ALTER COLUMN "functional_credit" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "accounting_lines" ADD CONSTRAINT "accounting_lines_functional_non_negative_chk" CHECK ("accounting_lines"."functional_debit" >= 0 and "accounting_lines"."functional_credit" >= 0);--> statement-breakpoint
ALTER TABLE "accounting_lines" ADD CONSTRAINT "accounting_lines_functional_one_side_chk" CHECK (("accounting_lines"."functional_debit" > 0 and "accounting_lines"."functional_credit" = 0) or ("accounting_lines"."functional_credit" > 0 and "accounting_lines"."functional_debit" = 0));

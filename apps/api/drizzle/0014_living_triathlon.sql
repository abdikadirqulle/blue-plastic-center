UPDATE "accounting_transactions" AS gl_transaction
SET "fiscal_period_id" = period."id"
FROM "fiscal_periods" AS period
WHERE gl_transaction."fiscal_period_id" IS NULL
	AND period."company_id" = gl_transaction."company_id"
	AND period."start_date" <= gl_transaction."transaction_date"
	AND period."end_date" >= gl_transaction."transaction_date"
	AND period."status" = 'open'
	AND (
		SELECT count(*)
		FROM "fiscal_periods" AS candidate
		WHERE candidate."company_id" = gl_transaction."company_id"
			AND candidate."start_date" <= gl_transaction."transaction_date"
			AND candidate."end_date" >= gl_transaction."transaction_date"
	) = 1;--> statement-breakpoint
ALTER TABLE "accounting_transactions" ALTER COLUMN "fiscal_period_id" SET NOT NULL;

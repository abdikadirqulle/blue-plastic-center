ALTER TABLE "invoices" ADD COLUMN "discount_type" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "discount_value" numeric(20, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint

-- The document discount lived only in the legacy JSONB copy. Recover it before
-- the constraint lands so re-editing a migrated draft keeps its discount.
UPDATE "invoices" invoice
SET
  "discount_type" = CASE lower(coalesce(legacy."data"->>'discountType', 'none'))
    WHEN 'percentage' THEN 'percentage'
    WHEN 'percent' THEN 'percentage'
    WHEN 'fixed' THEN 'fixed'
    WHEN 'fixed amount' THEN 'fixed'
    ELSE 'none'
  END,
  "discount_value" = CASE
    WHEN coalesce(legacy."data"->>'discountValue', '') ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (legacy."data"->>'discountValue')::numeric(20, 4)
    ELSE 0
  END
FROM "resource_records" legacy
WHERE legacy."id" = invoice."id"
  AND legacy."company_id" = invoice."company_id"
  AND legacy."module" = 'sales'
  AND legacy."resource" = 'invoices'
  AND coalesce(legacy."data"->>'discountType', 'none') <> 'none';--> statement-breakpoint

ALTER TABLE "invoices" ADD CONSTRAINT "invoices_discount_type_chk" CHECK ("invoices"."discount_type" in ('none', 'percentage', 'fixed'));

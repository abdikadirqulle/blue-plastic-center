ALTER TABLE "users" ADD COLUMN "username" text;--> statement-breakpoint
WITH normalized AS (
  SELECT
    "id",
    COALESCE(NULLIF(regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'user') AS base_username,
    row_number() OVER (
      PARTITION BY COALESCE(NULLIF(regexp_replace(lower(split_part("email", '@', 1)), '[^a-z0-9._-]', '', 'g'), ''), 'user')
      ORDER BY "created_at", "id"
    ) AS duplicate_number
  FROM "users"
)
UPDATE "users"
SET "username" = CASE
  WHEN normalized.duplicate_number = 1 THEN normalized.base_username
  ELSE normalized.base_username || normalized.duplicate_number::text
END
FROM normalized
WHERE "users"."id" = normalized."id";--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_username_unique" UNIQUE("username");

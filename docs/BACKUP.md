# PostgreSQL Backup and Restore

Use the managed PostgreSQL provider's automated daily backups and point-in-time
recovery in production. Also create an encrypted logical backup before every
schema migration and month-end close.

## Backup

```bash
pg_dump --format=custom --no-owner --no-acl "$DATABASE_URL" \
  --file blue-plastic-center.dump
```

Store backups outside the application server with restricted access, encryption
at rest, and a retention policy of 7 daily, 4 weekly, and 12 monthly copies.

## Restore rehearsal

Restore only into an empty non-production database:

```bash
pg_restore --clean --if-exists --no-owner --no-acl \
  --dbname "$RESTORE_DATABASE_URL" blue-plastic-center.dump
```

After restoration:

1. Run the API health check.
2. Verify company, user, account, customer, vendor, item, and audit counts.
3. Confirm trial-balance control totals when ledger posting is enabled.
4. Record restore duration, backup timestamp, and verification results.

Perform a restore rehearsal quarterly. Never test restoration against the live
production database.

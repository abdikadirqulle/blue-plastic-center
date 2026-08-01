# Migration 0007 Reconciliation

`0007_equal_doctor_strange.sql` is an expand-only migration. It does not delete
or update the JSON payload in `resource_records`. Invalid or ambiguous legacy
records remain available and are copied to `migration_exceptions` for repair.
Apply its generated `0008_bouncy_blockbuster.sql` companion in the same
deployment; it adds posting-idempotency actor fields before the API is started.

## Before applying

1. Take a verified PostgreSQL backup.
2. Record counts for sales invoices, invoice lines and payments.
3. Apply the migration in a staging copy of the production database first.
4. Do not switch payment reads until every open migration exception has been
   reviewed.

## Reconciliation queries

```sql
-- Open migration exceptions grouped by cause.
select reason_code, count(*)
from migration_exceptions
where migration_tag = '0007_equal_doctor_strange'
  and resolved_at is null
group by reason_code
order by reason_code;

-- Invoice line count: JSON source versus normalized destination.
select
  sum(case when jsonb_typeof(data->'lines') = 'array'
    then jsonb_array_length(data->'lines') else 0 end) as source_lines,
  (select count(*) from invoice_lines) as normalized_lines
from resource_records
where module = 'sales' and resource = 'invoices';

-- Invoices that still have source lines but no normalized lines.
select rr.id, rr.data->>'documentNumber' as invoice_number
from resource_records rr
join invoices i on i.id = rr.id and i.company_id = rr.company_id
where rr.module = 'sales' and rr.resource = 'invoices'
  and jsonb_array_length(case when jsonb_typeof(rr.data->'lines') = 'array'
    then rr.data->'lines' else '[]'::jsonb end) > 0
  and not exists (select 1 from invoice_lines il where il.invoice_id = i.id);

-- Recalculate each normalized invoice line total without floating point math.
select i.id, i.invoice_number, i.subtotal,
  coalesce(sum(il.line_total), 0) as normalized_line_total,
  i.subtotal - coalesce(sum(il.line_total), 0) as difference
from invoices i
left join invoice_lines il on il.invoice_id = i.id
group by i.id, i.invoice_number, i.subtotal
having i.subtotal <> coalesce(sum(il.line_total), 0);

-- Payment and allocation counts.
select
  (select count(*) from resource_records
    where module = 'sales' and resource = 'payments') as source_payments,
  (select count(*) from customer_payments) as normalized_payments,
  (select count(*) from customer_payment_allocations) as normalized_allocations;

-- Staged allocation integrity. Payments remain draft and unapplied until the
-- accounting engine posts them; this query must never show over-allocation.
select p.id, p.payment_number, p.amount, p.unapplied_amount,
  coalesce(sum(a.amount), 0) as allocated,
  p.amount - coalesce(sum(a.amount), 0) as remaining_after_planned_allocation
from customer_payments p
left join customer_payment_allocations a on a.payment_id = p.id
group by p.id, p.payment_number, p.amount, p.unapplied_amount
having coalesce(sum(a.amount), 0) > p.amount;

-- Cross-customer allocation defense check; expected result is zero rows.
select a.id, a.payment_id, a.invoice_id
from customer_payment_allocations a
join customer_payments p on p.id = a.payment_id
join invoices i on i.id = a.invoice_id
where p.company_id <> i.company_id or p.customer_id <> i.customer_id;
```

## Constraint validation

Journal-line checks are created `NOT VALID`, so new and modified rows are
protected without destroying legacy data. The migration validates them
automatically only when no unresolved legacy journal-line exception exists.
After remediation, validate manually:

```sql
alter table accounting_lines
  validate constraint accounting_lines_non_negative_chk;
alter table accounting_lines
  validate constraint accounting_lines_one_side_chk;
```

The normalized API cutover is a separate deployment gate. Successful migration
execution alone does not authorize disabling generic reads or deleting legacy
rows.

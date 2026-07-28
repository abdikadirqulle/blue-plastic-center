# Deployment

## Vercel frontend

Create the Vercel project with `apps/web` as its Root Directory.

Set this production environment variable:

```text
VITE_API_URL=https://YOUR-RENDER-SERVICE.onrender.com
```

The checked-in `apps/web/vercel.json` installs the complete npm workspace,
builds the Vite application, and rewrites React Router URLs to `index.html`.

## Render API

The root `render.yaml` builds the shared contracts before the API and starts
the compiled Fastify server. Configure these secret environment variables:

```text
DATABASE_URL=postgresql://...
WEB_ORIGIN=https://YOUR-VERCEL-PROJECT.vercel.app
WEB_ORIGINS=https://YOUR-CUSTOM-DOMAIN.example
```

`WEB_ORIGINS` is optional and may contain a comma-separated list. Do not add a
trailing slash to origins. Production authentication uses an HTTP-only,
`Secure`, `SameSite=None` cookie so credentials work between Vercel and Render.

The Render health check is:

```text
GET /health
```

## Presentation database

Apply migrations, then run the idempotent seed from a trusted machine:

```bash
npm run db:migrate --workspace @blue-plastic/api
npm run db:seed --workspace @blue-plastic/api
```

The seed creates company users, the chart of accounts, customers, inventory
items, invoices, sales receipts, customer payments, vendors, bills, bank
accounts, bank transactions, receivables, and payables. It updates the same
stable records when run again instead of duplicating them.

Demo administrator:

```text
admin@blueplastic.local
Admin123!
```

Change all seeded passwords before using the database for real operations.

# Deployment

## Vercel

The web workspace has a dedicated Vercel build:

- Runtime: Node.js 22
- Framework: Next.js
- Build command: `npm run build:vercel`
- Output: standard `.next` application

`apps/web/vercel.json` selects the Vercel build automatically. Linux native
bindings for Rolldown and Next SWC are explicit optional dependencies so npm
installs them on Vercel even when the lockfile was generated on macOS.

Recommended Vercel project settings:

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Install Command: `npm install --prefix=../..`
- Build Command: leave empty so `vercel.json` is authoritative

## Local and Sites build

Run the root build for the vinext/Cloudflare target:

```text
npm run build
```

The vinext route classification message ending in `Build complete` is
informational. It is not a failed build.

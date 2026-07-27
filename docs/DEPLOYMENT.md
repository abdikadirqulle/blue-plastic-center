# Deployment

## Vercel

The web workspace has a dedicated Vercel build:

- Runtime: Node.js 22
- Framework: Vite and React
- Build command: `npm run build:vercel`
- Output: static `dist` application

`apps/web/vercel.json` selects the Vite build automatically. Linux native
bindings used by Rolldown, Tailwind, and Lightning CSS are explicit optional
dependencies so npm installs them when the lockfile was generated on macOS.

Recommended Vercel project settings:

- Root Directory: `apps/web`
- Framework Preset: Vite
- Install Command: `npm install --prefix=../..`
- Build Command: leave empty so `vercel.json` is authoritative

## Local and Sites build

Run the root build for the Vite target:

```text
npm run build
```

The Vite output ending in `built in` is
informational. It is not a failed build.

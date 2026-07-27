# BLUE PLASTIC CENTER — Codex Working Agreement

## Product

BLUE PLASTIC CENTER is a web-based accounting and operations platform inspired by
the functional breadth of QuickBooks Enterprise. It must remain suitable for
multi-company, multi-branch, multi-warehouse, multi-currency businesses.

## Current delivery phase

The current phase is frontend-first. Use realistic mock data and typed service
boundaries so the future backend can replace mock implementations without
rewriting screens.

## Engineering rules

- Use TypeScript with strict typing. Avoid `any`.
- Keep route-level files small; place reusable UI in `components/`.
- Put product modules in `features/` and shared utilities in `lib/`.
- Keep domain types in `types/`.
- Use accessible semantic HTML, keyboard states, and responsive layouts.
- All financial amounts must be represented as decimal strings or integer minor
  units at API boundaries. Never rely on floating-point arithmetic for posting.
- Posted accounting transactions will eventually be immutable; corrections use
  reversal or adjustment workflows.
- Every financial workflow must account for company, branch, currency, fiscal
  period, permissions, and audit events.
- Do not introduce backend behavior into UI components.
- Do not add dependencies when a small existing utility is sufficient.

## Visual direction

- Professional enterprise interface with high information density.
- Calm navy/ink foundation with BLUE PLASTIC CENTER blue `#007DCC` as the primary action color.
- Clear financial hierarchy, restrained decoration, and strong table usability.
- Desktop-first, but fully usable on tablets and phones.
- English is the initial UI language; architecture must allow Somali localization.

## Verification

Before handing off a change:

1. Run `npm run build`.
2. Run `npm run typecheck` for every change before submission.
3. Run `npm run lint` when source files changed.
4. Run relevant tests.
5. Check empty, loading, error, and responsive states for new workflows.
6. Push completed, verified work to `origin/main` when the user has authorized it.

## Documentation

Keep these documents aligned with material product decisions:

- `docs/PRD.md`
- `docs/ROADMAP.md`
- `docs/FRONTEND.md`
- `docs/ACCOUNTING-RULES.md`
- `docs/ARCHITECTURE.md`

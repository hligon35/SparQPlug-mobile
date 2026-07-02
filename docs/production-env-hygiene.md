# Production Environment Hygiene

SparQPlug currently carries public production configuration in these tracked files:

- `apps/web/.env.production`
- `apps/mobile/eas.json`

The Firebase web config values are public identifiers, but they should still be managed centrally so production and preview builds do not drift.

Recommended production setup:

- Move the web production API base URL into Cloudflare Pages environment variables.
- Keep mobile build-time values in EAS secrets or EAS environment configuration instead of hardcoding them in `eas.json`.
- Keep private backend secrets only in Cloudflare Worker secrets and never in source control.
- Treat `EXPO_PUBLIC_API_BASE_URL` as required for release builds even if the app has a fallback for local resilience.

This keeps deploy-time configuration auditable without changing application behavior in this scaffold.

## Follow-up Rollout Pattern

The responsive and save-safety scaffolding added in this pass should be applied next to:

- `apps/web/src/pages/crm/companies.tsx`
- `apps/web/src/pages/crm/opportunities.tsx`
- `apps/web/src/pages/billing/customers.tsx`
- `apps/web/src/pages/billing/invoices.tsx`
- `apps/web/src/pages/billing/subscriptions.tsx`
- `apps/web/src/pages/documents/index.tsx`
- `apps/web/src/pages/crm/password-lockers.tsx`

Recommended pattern:

- Use `PageShell` for consistent responsive headings, actions, and spacing.
- Use `ResponsiveDataView` when desktop tables need a card-based mobile presentation.
- Replace browser `confirm()` flows with `ConfirmDialog` for destructive actions.
- Normalize optional form fields before submit and disable submit actions while mutations are pending.
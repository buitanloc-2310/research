# PRODUCTION RUNBOOK — V5

1. Export/backup the existing remote D1 database.
2. Run `wrangler d1 migrations list tt --remote` and reconcile history before any migration command. V5 adds no migration and must not rerun `0006`.
3. Confirm bindings remain `DB → tt` and `STORAGE → ttrungtam`.
4. Run `npm ci`, `npm test`, `npm run build`, `npm run test:pages` and the browser matrix in an environment with Chromium.
5. Deploy the existing Pages project with `public` as output. Do not create a new database or bucket.
6. Smoke-test `/api/v1/health`, `/api/v1/public/site`, `/api/v1/public/pulse`, `/`, `/about`, `/explore`, `/contact`, login and Workspace.
7. Check the browser console and inspect Home at normal zoom and 25% zoom. The expected result is visible content even if motion is disabled.
8. If a regression appears, redeploy the previous known-good package. Do not reset or delete D1/R2 data.

Required server-side secrets remain outside the package: `SETUP_SECRET`, `RESEND_API_KEY`, `MAINTENANCE_SECRET` and any alert recipient variable. Never place them in `public/`, `.env`, `.dev.vars` or the ZIP.

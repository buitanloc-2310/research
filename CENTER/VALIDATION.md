# V5 VALIDATION LOG

**Date:** 07/10/2026

| Check | Result |
|---|---|
| `npm ci` | PASS — dependencies installed locally for verification. |
| `npm test` | PASS — 79/79, 0 failures. |
| `node scripts/build.mjs` | PASS. |
| `npm run build` | PASS — source validation and Wrangler Pages Functions compilation. |
| Public pulse regression | PASS. |
| Progressive enhancement source audit | PASS — default public visibility plus motion opt-in. |
| Browser E2E | NOT VERIFIED — no usable Chromium executable. |
| `npm run test:pages` | NOT VERIFIED — Wrangler local runtime stopped before readiness: `uv_interface_addresses returned Unknown system error 1`. |
| Remote D1/R2 | NOT VERIFIED — production credentials/control plane unavailable. |
| Resend delivery | NOT VERIFIED — provider secret/inbox unavailable. |

## V5 regression focus

- The public DOM is not hidden by default.
- `IntersectionObserver` failure cannot hide public content.
- Reduced motion uses a static renderer.
- A blank/invalid CMS Published Snapshot falls back to visible public content or an explicit content state.
- Research Pulse uses only public D1 records and reports unavailable data separately from zero.
- Research, People, Knowledge, Innovation, Activities, Fields and Groups use distinct route grammars with real public records only.
- Public mega-menu uses semantic disclosure elements and Escape handling; `/` opens/focuses Research Finder.
- Existing CMS, Auth, RBAC, workflow, file, email and security suites remain passing.

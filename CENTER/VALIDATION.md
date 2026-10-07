# Research Cloud V3 validation — 05/10/2026

Kết quả dưới đây là trạng thái thực tế của môi trường sửa source. Không quy đổi kiểm tra chưa chạy thành PASS.

| Kiểm tra | Trạng thái | Kết quả |
|---|---|---|
| `npm test` | PASS | **77 PASS / 0 FAIL / 0 SKIPPED** |
| `node scripts/build.mjs` | PASS | syntax + deployment config/source validation PASS |
| `npm run build` | NOT VERIFIED (environment) | bước internal build PASS; full command dừng vì `wrangler` không có (`exit 127`) |
| `npm ci` | NOT VERIFIED (environment) | đã thử nhưng package download treo/timeout trong sandbox; không dùng dependency partial làm bằng chứng |
| Local HTTP route smoke | PASS | **10/10**: `/`, `/about`, `/explore`, `/contact`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/api/v1/health`, `/api/v1/public/settings`, `/api/v1/public/site` trả 200 |
| CMS core | PASS | D1 persistence, Draft/Published snapshot isolation, Page Builder add/edit/reorder/publish, nav/footer RBAC |
| CMS V3 revisions | PASS | save/list/read/restore, restore only changes Draft, republish updates public |
| CMS V3 duplicate | PASS | duplicate page is Draft/noindex and copies blocks |
| CMS V3 navigation | PASS | 2-level nesting, third level rejected, safe parent delete behavior |
| Media Cloud | PASS (local adapter) | R2-compatible adapter upload, server-side search/filter/pagination, dimensions, private/public policy and safe-delete |
| First-time Setup | PASS (local) | PBKDF2 100k, one-time Root Admin, lock, rate-limit semantics + `Retry-After` |
| Full `npm run test:pages` | NOT VERIFIED | requires Wrangler/workerd and Playwright dependencies |
| Browser responsive/visual/console | NOT VERIFIED | direct system Chromium attempt timed out due DBus/EGL/zygote runtime; no false PASS |
| Cloudflare D1/R2 remote | NOT VERIFIED | production account credentials/control plane unavailable |
| Resend production delivery | NOT VERIFIED | production provider secret/access unavailable |
| Cloudflare Analytics after deploy | NOT VERIFIED | CSP is allowlisted in source; production console requires deployed environment |

## Regression coverage added in V3

- Revisions: snapshot, list/read, restore-to-Draft, Published isolation and republish.
- Page duplication: copied blocks, Draft/noindex and no public leakage.
- Two-level navigation: parent relation public payload + third-level rejection.
- Media pagination/filter/dimensions and safe delete.
- Setup rate-limit UX: missing server secret does not burn attempts; brute force returns 429 + `Retry-After`.
- Existing auth/RBAC/IDOR/workflow/email/security suite remains passing.

## Static/self-audit

- Production D1 ID remains `0a75531f-b227-4a8b-bc26-dda1cc9a0004`.
- Retired D1 ID literal absent from source/config.
- `STORAGE` still targets `ttrungtam`.
- `APP_ORIGIN` remains `https://research.skyfirst.io.vn`.
- No committed `.env`, `.dev.vars`, production credential or hard-coded login/setup secret is included in the final package.
- Empty `catch {}` patterns in runtime source were removed; optional localStorage failures are explicitly handled.
- No new Internet/AI-generated image asset is included in runtime public assets.

## Conclusion

Automated/local integration coverage passes, but the package is **not self-labeled PRODUCTION READY** until full Wrangler Pages build, browser E2E and remote Cloudflare/Resend verification are run on an environment with the required dependencies and credentials.

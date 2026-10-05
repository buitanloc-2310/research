# Production Final validation — 05/10/2026

Đây là kết quả thực tế của môi trường sửa source hiện tại. Không quy đổi phần chưa chạy thành PASS.

| Kiểm tra | Trạng thái | Kết quả |
|---|---|---|
| `npm test` | PASS | **70 PASS / 0 FAIL / 0 SKIPPED** |
| `node scripts/build.mjs` | PASS | source syntax + deployment config parse PASS |
| `npm run build` | NOT VERIFIED (environment) | bước syntax/config PASS; dừng với exit 127 vì local `wrangler` binary không có sau khi dependency download bị timeout |
| Local HTTP route smoke | PASS | **10/10** route trả 200: `/`, `/about`, `/explore`, `/contact`, `/privacy`, `/robots.txt`, `/sitemap.xml`, `/api/v1/health`, `/api/v1/public/settings`, `/api/v1/public/site` |
| CMS API integration | PASS | D1 persistence, real memory-R2 adapter, private→public media, reference-safe delete, draft/preview/publish snapshot, add/reorder block, nav/footer CRUD, RBAC |
| Full `npm run test:pages` | NOT VERIFIED | cần Wrangler/workerd dependency đầy đủ trong environment |
| Full `npm run test:browser` | NOT VERIFIED | Playwright/Chromium runtime không ổn định/không cài đầy đủ trong environment |
| Cloudflare D1/R2 remote | NOT VERIFIED | không có quyền production account trong phiên này |
| Resend email production | NOT VERIFIED | không có production `RESEND_API_KEY`/provider access |
| Production Analytics console | NOT VERIFIED | CSP đã sửa theo allowlist, cần xác nhận sau deploy |

## Regression coverage mới

- Website CMS Site Settings, pages, blocks, publish snapshot và RBAC.
- Media upload theo signature + MIME, private mặc định, public khi được tham chiếu và chặn xóa media đang dùng.
- Block được tạo mới, reorder, preview và thứ tự published snapshot được giữ.
- Production bindings đúng D1 ID hiện tại/R2 bucket và config production không chứa D1 ID cũ.
- CSP allowlist Cloudflare Analytics chính xác, không dùng wildcard `script-src *`.
- `/api/v1/public/settings` hoạt động với schema local đã migration và không trả secret.

## Kết luận validation

Source đạt PASS cho automated Node suite và local route smoke. **Chưa gắn nhãn PRODUCTION READY** vì full Wrangler Pages Functions build, browser E2E và các dependency production D1/R2/Resend chưa thể xác minh trong environment này. Trước production deploy phải chạy lại `npm ci`, `npm test`, `npm run build`, migration remote có kiểm soát và smoke/E2E theo `README.md`.

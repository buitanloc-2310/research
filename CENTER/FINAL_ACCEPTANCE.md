# BÁO CÁO NGHIỆM THU — PRODUCTION FINAL

Ngày audit/sửa: 05/10/2026  
Hệ thống: **TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST**  
English: **SKY FIRST RESEARCH & INNOVATION CENTER**  
Production: `https://research.skyfirst.io.vn`

## A. Root cause — `/api/v1/public/settings` HTTP 500

Source trước bản sửa gọi D1 `settings` trực tiếp. Bảng này đến từ migration `0001_initial.sql`, trong khi Cloudflare Pages deploy code **không tự áp D1 migration**. Vì vậy một DB production đúng binding nhưng thiếu/chưa đồng bộ migration/schema sẽ làm D1 query ném exception; worker sau đó trả generic HTTP 500/request ID. Source config hiện tại đã trỏ đúng D1 production ID, nên vấn đề không phải là hard-code ID cũ trong config hiện hành.

Không có production Functions logs/D1 console trong phiên này nên trạng thái bảng/column remote tại thời điểm lỗi là **NOT VERIFIED**. Không tuyên bố một SQL exception cụ thể đã được quan sát ở production.

Fix đã thực hiện: migration `0004_website_cms.sql` additive tạo `settings` nếu thiếu + toàn bộ CMS schema; `/api/health` kiểm tra binding/schema an toàn; `/api/public/settings` chỉ merge public allowlisted legacy settings với public Site Settings; error client tiếp tục không lộ SQL/stack và có request ID.

## B. Files/modules quan trọng đã thay đổi

- `migrations/0004_website_cms.sql`
- `src/cms.js`
- `src/api.js`
- `src/seo.js`
- `src/security.js`
- `src/notifications.js`
- `public/app.js`
- `public/style.css`
- `public/index.html`
- `public/manifest.webmanifest`
- `public/_headers`
- `public/catalog.js`
- `public/sky-first-logo.png`
- `tests/cms.test.mjs`
- `tests/production.test.mjs`
- `package.json`, `package-lock.json`
- `README.md`, `VALIDATION.md`, `API.md`, `SECURITY.md`

## C. Database

Migration mới: `0004_website_cms.sql`. Migration chỉ thêm/seed bằng `CREATE TABLE IF NOT EXISTS`, index và `INSERT OR IGNORE`; không drop/reset bảng production.

Schema mới: `site_settings`, `cms_pages`, `cms_blocks`, `cms_navigation`, `cms_footer_links`, `cms_media`. Migration cũng bảo đảm `settings` tồn tại để xử lý schema drift liên quan endpoint public settings.

Bindings được giữ nguyên: `DB` → database `tt` → ID `0a75531f-b227-4a8b-bc26-dda1cc9a0004`. Không tạo DB mới. D1 ID cũ không còn ở production config.

## D. CMS

Admin có Website CMS để chỉnh Site Settings, logo/favicon/contact/social, navigation, footer, pages và SEO. Page Builder hỗ trợ Hero, Heading, Rich Text, Image, CTA, Statistics, Cards, Feature Grid, Partners/Links, FAQ; có add/edit/delete, enable/disable, reorder, preview và publish.

Draft lưu thật vào D1. Publish tạo snapshot riêng; sửa draft sau publish không đổi public content cho tới lần publish tiếp theo. Public page render snapshot đã publish.

## E. Media

Media Library upload file thật vào R2 binding `STORAGE`/bucket `ttrungtam`; D1 chỉ lưu metadata/object key. PNG/JPG/WEBP/GIF/PDF được giới hạn 10MB và kiểm tra signature. SVG bị loại để tránh stored-XSS risk.

Media private mặc định. Public endpoint chỉ phục vụ media có `visibility='public'`; media được đánh public khi được dùng trong published page/site identity. Xóa bị chặn nếu còn tham chiếu ở Site Settings, page snapshot hoặc block draft.

## F. Security

Giữ auth/session/RBAC/CSRF-origin checks, IDOR/business ACL, password reset và audit. CMS Admin yêu cầu `settings`; publish yêu cầu `publish`. API public không expose secrets. R2 private access vẫn qua API. Error nội bộ không trả SQL/stack cho client.

CSP giữ chính sách chặt và chỉ thêm `https://static.cloudflareinsights.com` vào `script-src` + `https://cloudflareinsights.com` vào `connect-src`; không dùng wildcard.

## G. Tests

- Automated Node suite: **70 PASS / 0 FAIL / 0 SKIPPED**.
- Local route smoke: **10 PASS / 0 FAIL**.
- Internal syntax/config build: **PASS**.
- Full `npm run build`: **NOT VERIFIED trong environment** — syntax/config PASS, nhưng bước Wrangler dừng exit 127 vì binary `wrangler` chưa cài được do dependency download timeout.
- Full Pages/workerd E2E: **NOT VERIFIED**.
- Browser/Playwright responsive flow: **NOT VERIFIED**.
- Production D1/R2/Resend: **NOT VERIFIED**.

Không sử dụng mock production secret để tuyên bố PASS. CMS integration tests dùng local D1-compatible runtime và memory-R2 adapter để kiểm tra logic/persistence; R2 Cloudflare thật vẫn cần smoke production.

## H. Production requirements

- `DB` / `tt` / `0a75531f-b227-4a8b-bc26-dda1cc9a0004`
- `STORAGE` / `ttrungtam`
- `APP_ORIGIN=https://research.skyfirst.io.vn`
- `EMAIL_FROM=Sky First Research & Innovation Center <research@skyfirst.io.vn>`
- `EMAIL_REPLY_TO=research@skyfirst.io.vn`
- Secret: `SETUP_SECRET` (nếu bootstrap), `RESEND_API_KEY`, `MAINTENANCE_SECRET` nếu dùng scheduler.
- Optional: `ADMIN_ALERT_EMAIL`.

## I. Deployment — đúng thứ tự

1. Export/backup D1 remote.
2. Chạy `wrangler d1 migrations list tt --remote`; đối chiếu migration history với schema thật.
3. Nếu 0001–0003 đã đúng, áp migration còn thiếu (0004). Nếu history bất thường do import SQL thủ công, reconcile trước; **không chạy lại migration cũ mù quáng**.
4. Kiểm tra lại binding D1/R2 và variables/secrets.
5. Ở CI/máy có network: `npm ci`, `npm test`, `npm run build`, rồi Pages/browser tests.
6. Deploy Pages project hiện có.
7. Smoke health/public settings/public site + public routes + login.
8. Admin test Website CMS theo luồng sửa Settings → media → page → add/reorder block → menu/footer → Save Draft → Preview → Publish → refresh public.
9. Test R2 thật và Resend thật bằng production credentials.

## J. Known limitations

- Không có Cloudflare production logs để chứng minh trạng thái remote gây 500 tại thời điểm sự cố; root cause được xác định từ source/migration contract và cần production verification.
- Không có quyền thay đổi D1/R2/Pages/Resend production trong phiên sửa source.
- Full Wrangler bundle, browser E2E, responsive visual QA và analytics console sau deploy chưa thể chạy trong environment hiện tại.
- Vì các mục trên, bản này **chưa được gọi là PRODUCTION READY** theo điều kiện nghiệm thu đã đặt. Source đã được chuẩn bị để chạy các bước verification còn lại mà không cần xây lại kiến trúc.

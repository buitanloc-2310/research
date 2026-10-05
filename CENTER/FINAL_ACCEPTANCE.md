# BÁO CÁO NGHIỆM THU — PRODUCTION FINAL UX/CMS

Ngày audit/sửa: **05/10/2026**  
Hệ thống: **TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST**  
English: **SKY FIRST RESEARCH & INNOVATION CENTER**  
Production: `https://research.skyfirst.io.vn`

## A. Source / production state

Bản này tiếp tục trực tiếp trên source Cloudflare Pages/Functions + D1 + R2 hiện có; không đổi stack, không dựng website demo và không bỏ các module nghiệp vụ.

Các binding production được giữ nguyên:

- D1: binding `DB`, database `tt`, ID `0a75531f-b227-4a8b-bc26-dda1cc9a0004`
- R2: binding `STORAGE`, bucket `ttrungtam`
- Origin: `https://research.skyfirst.io.vn`

Repository đã được quét lại: D1 ID đã nghỉ hưu không còn xuất hiện dưới dạng literal và không có production config nào tham chiếu ID cũ.

Endpoint `/api/v1/public/settings` vẫn giữ fix từ vòng trước: schema drift/missing migration có thể làm D1 query ném lỗi và trả HTTP 500; source hiện có migration/schema guard, generic request ID và không lộ SQL/stack. Trong local runtime hiện tại endpoint trả **200**. Nguyên nhân chính xác từ production logs tại thời điểm sự cố vẫn là **NOT VERIFIED** vì phiên này không có Cloudflare production logs/D1 console.

## B. Files/modules quan trọng của vòng nâng cấp này

- `public/app.js` — public renderer, Home/About/Explore/Contact, header/footer, login, states.
- `public/style.css` — design system/UX responsive/light-dark và presentation toàn site.
- `src/cms.js` — public site payload hợp nhất + bounded shared cache cho public CMS data.
- `src/api.js` — bounded cache cho public settings compatibility endpoint.
- `migrations/0005_public_experience.sql` — nâng starter CMS content an toàn, không auto-publish.
- `tests/cms.test.mjs` — regression cho starter Draft, cache, CMS/R2 flow.
- `tests/production.test.mjs` — production binding/CSP regression và không giữ literal D1 ID cũ.
- `README.md`, `FINAL_ACCEPTANCE.md` — cập nhật vận hành/nghiệm thu.

Không tải/chèn ảnh Internet. Public runtime chỉ dùng logo/tài nguyên local hoặc media thật qua CMS/R2; visual trang chủ được dựng bằng HTML/CSS, không dùng ảnh AI.

## C. Database / migration

Migration mới của vòng này: **`0005_public_experience.sql`**.

Migration chỉ nâng nội dung starter nếu page vẫn là bản mặc định chưa được quản trị viên sửa/publish (`status='draft'`, `published_snapshot IS NULL`, `updated_by IS NULL`). Trang đã chỉnh hoặc đã publish không bị ghi đè.

Migration:

- cập nhật copy/SEO/canonical cho Home/About/Contact/Privacy starter;
- bổ sung các block CMS cho quy trình, lĩnh vực, cách tiếp cận và CTA;
- dùng `INSERT OR IGNORE` khi thêm block;
- không `DROP`, không reset DB, không xóa dữ liệu;
- **không auto-publish**: starter pages vẫn Draft để giữ đúng Draft → Preview → Publish.

CMS schema hiện hữu `site_settings`, `cms_pages`, `cms_blocks`, `cms_navigation`, `cms_footer_links`, `cms_media` được giữ nguyên.

## D. Public UX

### Home

- Hero được polish theo visual direction nhưng không dùng ảnh AI.
- Lĩnh vực trọng tâm: Giáo dục & học tập; Công nghệ & sáng tạo; Cộng đồng & phát triển; Dữ liệu & tri thức mở.
- Quy trình: Tiếp nhận ý tưởng → Nghiên cứu & phát triển → Công bố & chia sẻ → Tạo tác động.
- Nội dung mới lấy từ **record public thật**; không tạo social-proof giả và không dựng số `0+ / 100+`.
- Có lối vào Publications/Datasets/Events và CTA kết nối.

### About

- Sứ mệnh, tầm nhìn, giá trị cốt lõi, lĩnh vực, cách tiếp cận, nhóm có thể kết nối và CTA được tổ chức bằng grid/cards/process; nội dung ngắn và tránh paragraph dài.

### Explore / Publications / Datasets / Events

- Search, select filter, category chips, pagination.
- Layout riêng cho Events, Publications, Datasets thay vì dùng một card cho mọi loại.
- Loading/error theo hệ thống hiện hữu; empty state mới có hành động xóa/đổi bộ lọc.
- Dữ liệu vẫn đến từ public API/backend thật.

### Contact

- 4 nhu cầu kết nối: hợp tác nghiên cứu, đề xuất ý tưởng, truyền thông/đối tác, hỗ trợ hệ thống.
- Chỉ dùng thông tin chính thức được cung cấp: `research@skyfirst.io.vn`, `support@skyfirst.io.vn`, `0924 910 210`, `research.skyfirst.io.vn`.
- Không tạo form giả khi source không có public submit workflow phù hợp.

### Header / Footer / Login

- Header sticky gọn, active state, login CTA, theme switch và mobile navigation.
- Footer theo cấu trúc **Brand / Trung tâm / Khám phá / Hệ sinh thái Sky First / Kết nối**; chỉ dùng các ecosystem/social URL được cho phép, không thêm YouTube/TikTok/địa chỉ.
- Copyright fallback chính xác: `© 2026 Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First.`
- Login giữ nguyên authentication logic, thêm hierarchy/branding/password visibility/accessibility; không hard-code account/password.

## E. CMS / persistence

Website CMS không bị thay thế bởi hard-code. Public renderer ưu tiên page snapshot đã publish từ D1. Starter fallback chỉ là lớp an toàn trước khi starter CMS page được publish; migration `0005` đã chuẩn bị cùng nội dung ở D1 để quản trị viên có thể Preview/Publish và tiếp tục chỉnh mà không mở source.

Site Settings, menu, footer, page blocks, SEO và media vẫn quản trị từ Admin. Draft không tự xuất hiện public; Publish tạo snapshot ổn định. R2 Media Library và business modules/RBAC/workflow không bị bỏ.

## F. Performance / security

- `/api/v1/public/site` hợp nhất các public legacy setting cần thiết để frontend không phải gọi thêm public settings trong luồng bình thường.
- Public site/page/settings response dùng cache có giới hạn: `max-age=30`, `s-maxage=120`, `stale-while-revalidate=300`.
- Search backend vẫn sử dụng pagination/limit của source; không thêm query toàn bảng/N+1 ở frontend.
- Auth/session/RBAC/CSRF/IDOR/password reset/audit/private R2 được giữ nguyên.
- CSP Cloudflare Analytics vẫn allowlist hẹp; không dùng `script-src *`.
- Không đưa Resend/API/setup/maintenance secret ra frontend.

## G. Test results

### PASS

- `node --check public/app.js`
- `node --check src/cms.js`
- `node --check src/api.js`
- Automated Node suite: **72 PASS / 0 FAIL / 0 SKIPPED**.
- Internal production syntax/config build: **PASS** (`node scripts/build.mjs`).
- Local migration/runtime: migrations `0001` → `0005` áp thành công trên fresh SQLite D1-compatible runtime.
- Local HTTP smoke: **10 PASS / 0 FAIL**:
  - `/`
  - `/about`
  - `/explore`
  - `/contact`
  - `/privacy`
  - `/robots.txt`
  - `/sitemap.xml`
  - `/api/v1/health`
  - `/api/v1/public/site`
  - `/api/v1/public/settings`
- `/api/v1/public/site` và `/api/v1/public/settings` local đều trả cache header mới đúng thiết kế.

### NOT VERIFIED

- Full `npm run build` qua Wrangler Pages Functions: **NOT VERIFIED**. Bước nội bộ PASS, nhưng môi trường này không cài hoàn tất dependency; `wrangler` binary không khả dụng nên bước `wrangler pages functions build` dừng exit 127.
- Browser E2E/responsive visual/console-network: **NOT VERIFIED**. Chromium system trong sandbox treo và timeout do runtime DBus/zygote; không gán PASS giả.
- Cloudflare D1/R2 remote: **NOT VERIFIED** vì không có production credentials/control plane.
- Resend production delivery: **NOT VERIFIED** vì không có production secret.

## H. Production requirements

- `DB` / `tt` / `0a75531f-b227-4a8b-bc26-dda1cc9a0004`
- `STORAGE` / `ttrungtam`
- `APP_ORIGIN=https://research.skyfirst.io.vn`
- `EMAIL_FROM=Sky First Research & Innovation Center <research@skyfirst.io.vn>`
- `EMAIL_REPLY_TO=research@skyfirst.io.vn`
- Server-side secrets nếu dùng: `RESEND_API_KEY`, `SETUP_SECRET`, `MAINTENANCE_SECRET`.

## I. Deployment — thứ tự an toàn

1. Backup/export D1 remote.
2. Chạy `wrangler d1 migrations list tt --remote` và đối chiếu history thực tế.
3. Chỉ áp migration còn thiếu; với source này migration mới là `0005_public_experience.sql`. Không chạy lại migration cũ mù quáng.
4. Xác nhận `DB`, `STORAGE`, `APP_ORIGIN` và secrets production.
5. Trên CI/máy có network: `npm ci` → `npm test` → `npm run build` → `npm run test:pages`/browser tests nếu môi trường hỗ trợ.
6. Deploy Pages project hiện có.
7. Smoke `/api/v1/health`, `/api/v1/public/site`, `/api/v1/public/settings`, public routes và login.
8. Admin kiểm tra Website CMS: Settings → media → page → add/reorder block → menu/footer → Save Draft → Preview → Publish → refresh public.
9. Smoke R2 thật và Resend thật bằng production credentials.

## J. Known limitations / kết luận

Source đã hoàn thiện vòng UX/CMS này và các test có thể chạy trong sandbox đều PASS. Tuy nhiên theo tiêu chí nghiệm thu đã đặt, **không gắn nhãn PRODUCTION READY** cho tới khi full Wrangler Pages build, browser E2E và Cloudflare D1/R2/Resend production được verify trên môi trường có dependency/credentials phù hợp.

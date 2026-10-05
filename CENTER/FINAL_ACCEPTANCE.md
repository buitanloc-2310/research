# FINAL ACCEPTANCE — RESEARCH CLOUD V3 ULTIMATE

**Ngày audit/sửa:** 05/10/2026  
**Hệ thống:** TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST  
**English:** SKY FIRST RESEARCH & INNOVATION CENTER  
**Production:** `https://research.skyfirst.io.vn`

> Báo cáo này chỉ đánh dấu PASS cho kiểm tra thực sự đã chạy trong môi trường bàn giao. Phần phụ thuộc Cloudflare production, provider secret hoặc browser runtime không khả dụng được ghi **NOT VERIFIED**.

## A. Source audit / kiến trúc thực tế

Source tiếp tục trên kiến trúc hiện hữu, không rebuild project và không đổi stack:

- Frontend: vanilla ES modules + CSS, public website và authenticated workspace dùng cùng `public/app.js`/design system.
- Cloudflare Pages static output: `public/`.
- Cloudflare Pages Functions adapter: `functions/`.
- Server/API: modules trong `src/`, entry qua worker adapter.
- D1: auth/session/RBAC/audit/settings, business records/workflows và Website CMS.
- R2: private object storage cho file nghiệp vụ và CMS media.
- Email: Resend qua outbox D1/retry/idempotency hiện hữu.
- CMS: `site_settings`, `cms_pages`, `cms_blocks`, `cms_navigation`, `cms_footer_links`, `cms_media`; V3 bổ sung `cms_revisions`.
- Business modules được giữ: Research/Projects, Publications, Datasets, Researchers, Research Groups, Events, Tasks, Reviews, Ethics, Finance, Forms, Notifications và workflow liên quan.
- First-time Setup hiện hữu được giữ và có regression test.

Production bindings được giữ nguyên:

- D1 binding `DB` → database `tt` → ID `0a75531f-b227-4a8b-bc26-dda1cc9a0004`.
- R2 binding `STORAGE` → bucket `ttrungtam`.
- `APP_ORIGIN=https://research.skyfirst.io.vn`.

D1 ID production đã được đối chiếu; repository không còn tham chiếu literal tới D1 ID đã ngừng sử dụng.

## B. Changes / file-module quan trọng

Các thay đổi chính của vòng V3:

- `public/app.js`
  - Research Cloud workspace shell mới.
  - Command Palette `Ctrl/Cmd + K` và `/` focus global search.
  - CMS-managed two-level public navigation.
  - Cloud CMS Studio dashboard.
  - Full Page Builder với device preview, drag/reorder, duplicate, Draft/Preview/Publish.
  - Revision browser/restore-to-Draft.
  - R2 Media Cloud search/filter/pagination/metadata/reference check.
  - Site Identity + Global SEO controls.
  - Dialog lifecycle/focus cleanup và keyboard behavior.
- `public/style.css`
  - Research Cloud V3 design system White/Navy/Sky/Cyan.
  - Workspace/sidebar/topbar, CMS Studio, Media Cloud, Page Builder, Command Palette.
  - Responsive 1280/1100/850/620/430 breakpoints.
  - Designed dark mode, focus states và reduced motion.
  - Public two-level navigation dropdown/mobile treatment.
- `src/cms.js`
  - CMS overview.
  - Bounded/paginated media search.
  - Bounded/paginated page listing.
  - Revision snapshots + retention.
  - Restore revision to Draft without changing Published snapshot.
  - Duplicate page/block.
  - Two-level navigation.
  - Media dimensions/description/reference inspection.
  - Safe-delete reference protection extended to global social image.
- `src/api.js`
  - Setup rate limit remains enforced but misconfiguration/already-initialized states no longer consume attempts.
  - `429` includes safe retry guidance and `Retry-After`.
- `src/security.js`, `src/worker.js`
  - Safe error headers can be propagated without exposing internal exception data.
- `src/seo.js`
  - Global CMS-managed SEO defaults/social image.
- `migrations/0006_research_cloud_v3.sql`
  - additive CMS revisions/navigation/media/SEO schema and indexes.
- `tests/cms.test.mjs`, `tests/extended.test.mjs`
  - V3 regression coverage.

Không tải hoặc chèn ảnh Internet. Runtime public chỉ dùng logo/asset có sẵn và media thật từ CMS/R2; visual không có media được dựng bằng CSS/HTML, không phụ thuộc ảnh AI.

## C. UI/UX

### Public website

Design system tiếp tục theo hướng institutional/editorial: White + Navy + Sky Blue/Cyan, border/shadow nhẹ, typography rõ, animation dùng transform/opacity và tôn trọng `prefers-reduced-motion`.

Home/About/Explore/Contact, content cards, loading/error/empty states, header/footer/login từ source hiện hữu được giữ và polish để đồng nhất với V3. Public navigation hiện hỗ trợ tối đa hai cấp từ CMS và có dropdown desktop + stack mobile. Không thêm số liệu/đối tác/thành tích giả.

### Auth / Login / First-time Setup

Login/Setup giữ cùng nhận diện và backend auth hiện hữu. Setup chỉ xuất hiện khi backend trả `required=true`; sau initialized, `#setup` quay về Login. Password visibility/accessibility và error/request ID được giữ.

### Research Management Workspace

- Sidebar Navy, hierarchy rõ, responsive drawer.
- Sticky topbar, global search, account/theme controls.
- Command Palette để điều hướng nhanh tới module thật.
- Existing business data/workflow/RBAC không bị thay bằng fake analytics.

### Cloud CMS Studio

Dashboard CMS có KPI từ D1 thật, Pages, recent audit activity, Site Identity/SEO, Header/Navigation, Footer Builder và Media Cloud. Không dùng localStorage làm CMS persistence.

## D. Cloud CMS / Page Builder

Các chức năng có backend persistence thật:

- Site identity: tên Việt/Anh, tagline, description, logo/favicon, contact/social, copyright.
- Global SEO: title, description, default social image, theme color.
- Navigation: CRUD, visibility, external/new-tab, ordering, parent/child tối đa 2 cấp.
- Footer: CRUD, cột/heading/label/URL/order/visibility.
- Pages: create/update/delete custom page; system pages được bảo vệ.
- Block types giữ nguyên: Hero, Heading, Rich Text, Image, CTA, Statistics, Cards, Feature Grid, Partners/Links, FAQ.
- Block create/edit/delete/enable/disable/reorder/duplicate.
- Drag/drop reorder + ↑/↓ fallback.
- Draft preview với Desktop/Tablet/Mobile canvas.
- Publish tạo Published snapshot; Draft tiếp theo không rò ra public.
- Duplicate page luôn tạo Draft + noindex.
- Revision History: tự lưu trước thay đổi quan trọng, tối đa 50 revision/page.
- Restore revision chỉ khôi phục Draft; Published snapshot cũ giữ nguyên tới lần Publish mới.

## E. Database / migration

Migration mới: **`migrations/0006_research_cloud_v3.sql`**.

Additive changes:

- `cms_revisions` + unique/page-created indexes.
- index `cms_pages(status, updated_at)`.
- `cms_navigation.parent_id` + parent/position index.
- `cms_media.width`, `height`, `description`, `updated_at` + indexes.
- Site Settings: `global_seo_title`, `global_seo_description`, `default_social_media_id`, `theme_color`.
- CMS starter Home bổ sung knowledge portal block **chỉ khi Home vẫn là untouched Draft**; không auto-publish, không ghi đè page đã chỉnh/publish.

Không có `DROP`, reset DB hoặc tạo database mới. `ALTER TABLE ADD COLUMN` dựa trên D1 migration history chuẩn; vì vậy trước production phải đối chiếu `d1_migrations`/schema, không chạy lại migration đã áp thủ công một cách mù quáng.

## F. Media / R2

Media Cloud tiếp tục dùng binding `STORAGE` và bucket `ttrungtam`:

- Upload binary thật vào R2; D1 chỉ lưu metadata/reference.
- Server-side search/filter/page/limit; `limit` bị chặn trên server.
- PNG/GIF/JPEG/VP8X WebP có thể ghi width/height khi header hỗ trợ.
- ALT text + description metadata.
- Reference inspection.
- Public media chỉ đọc được khi đang được Site Settings hoặc Published snapshot tham chiếu theo policy hiện hữu.
- Delete bị chặn khi media đang được tham chiếu.
- Không chấp nhận SVG trong CMS upload path hiện hữu; file size/signature/MIME validation được giữ.

Remote R2 production: **NOT VERIFIED — không có Cloudflare production credentials trong môi trường này**.

## G. Security

Đã bảo toàn/kiểm tra bằng automated suite:

- session/authentication;
- RBAC backend enforcement;
- CSRF/origin/`X-Requested-With` write protection;
- IDOR/business ACL;
- PBKDF2 password handling;
- password reset/session revocation;
- immutable/audited system-admin protections;
- CMS `settings` permission; Publish cần `publish`;
- private R2 access;
- SQL parameterization;
- public settings allowlist;
- CSP không dùng wildcard script source;
- error response chỉ trả safe message + request ID.

### First-time Setup rate limiting

- `SETUP_SECRET` vẫn chỉ đọc server-side.
- Setup giới hạn 10 attempts / 15 phút / IP theo runtime hiện tại.
- Missing server `SETUP_SECRET` và trạng thái already initialized không tiêu hao attempts.
- Brute-force vượt ngưỡng trả HTTP `429` + `Retry-After` và message có thời gian chờ.
- First-time Setup vẫn khóa sau khi Root Admin/initialization tồn tại.

## H. Performance

- Public Site/Settings cache policy hiện hữu được giữ: bounded shared caching.
- Media Cloud dùng SQL filtering + `LIMIT/OFFSET` thay vì tải toàn library.
- CMS Pages list hiện bounded tối đa 100/request và hỗ trợ query/status/page/limit ở API.
- Revision list bounded 50/page và retention tự dọn revision cũ.
- CMS overview/recent activity có `LIMIT`.
- Không thêm N+1 media query trên public renderer.
- Frontend motion chủ yếu transform/opacity; `prefers-reduced-motion` có override.

Không đánh đổi correctness/RBAC để lấy điểm benchmark.

## I. Tests — kết quả thực tế

### PASS

- `npm test`: **77 PASS / 0 FAIL / 0 SKIPPED**.
- `node scripts/build.mjs`: **PASS** — syntax/config/source validation.
- `node --check public/app.js`: **PASS**.
- `node --check src/cms.js`: **PASS**.
- `node --check src/api.js`: **PASS**.
- Local D1-compatible migrations `0001` → `0006`: **PASS** thông qua test runtime fresh DB.
- Local HTTP smoke: **10 PASS / 0 FAIL**:
  - `/`
  - `/about`
  - `/explore`
  - `/contact`
  - `/privacy`
  - `/robots.txt`
  - `/sitemap.xml`
  - `/api/v1/health`
  - `/api/v1/public/settings`
  - `/api/v1/public/site`
- CMS V3 regression PASS:
  - revision snapshot/list/read/restore;
  - restore không thay Published trước Publish;
  - duplicate page → Draft/noindex;
  - nested nav 2 cấp, chặn cấp 3;
  - Media Cloud pagination/filter/dimensions;
  - safe media delete;
  - Draft/Published isolation;
  - CMS RBAC.
- First-time Setup regression PASS:
  - exactly PBKDF2 100,000 iterations;
  - Root Admin creation/one-time lock;
  - missing `SETUP_SECRET` không consume rate attempts;
  - brute-force limit + `Retry-After`.

### NOT VERIFIED

- `npm run build` full Wrangler Pages Functions: **NOT VERIFIED — environment dependency unavailable**. `node scripts/build.mjs` PASS, sau đó `wrangler` không có. Một lần `npm ci` đã được thử nhưng bị treo/timeout do package download trong sandbox; không báo PASS giả.
- `npm run test:pages`: **NOT VERIFIED — cần local Wrangler/workerd + Playwright dependency**.
- Browser responsive/visual/console E2E: **NOT VERIFIED**. System Chromium CLI được thử nhưng treo/timeout với DBus/EGL/zygote trong sandbox; không có screenshot mới hợp lệ để dùng làm bằng chứng.
- Cloudflare D1/R2 remote: **NOT VERIFIED — không có account credentials/control plane**.
- Resend production delivery: **NOT VERIFIED — không có production `RESEND_API_KEY`/provider access**.
- Production Cloudflare Analytics console after deploy: **NOT VERIFIED**.

## J. Production configuration

Giữ chính xác:

- `DB` / `tt` / `0a75531f-b227-4a8b-bc26-dda1cc9a0004`
- `STORAGE` / `ttrungtam`
- `APP_ORIGIN=https://research.skyfirst.io.vn`
- `EMAIL_FROM=Sky First Research & Innovation Center <research@skyfirst.io.vn>`
- `EMAIL_REPLY_TO=research@skyfirst.io.vn`

Server-side secrets/vars tùy chức năng:

- `RESEND_API_KEY`
- `SETUP_SECRET` — chỉ cần cho bootstrap; hệ thống đã initialized có thể không giữ secret này nếu quy trình vận hành đã hoàn tất.
- `MAINTENANCE_SECRET`
- `ADMIN_ALERT_EMAIL` nếu dùng.

Không đưa các secret trên vào frontend/ZIP/Git.

## K. Deployment order

1. Backup/export D1 remote.
2. Chạy `wrangler d1 migrations list tt --remote` và đối chiếu schema/history thật.
3. Nếu 0001–0005 đã được áp đúng, chạy **chỉ migration còn thiếu `0006_research_cloud_v3.sql`** thông qua migration command chuẩn.
4. Xác nhận D1/R2 binding và production variables/secrets.
5. Trên CI/máy có network: `npm ci`.
6. Chạy `npm test`.
7. Chạy `npm run build` và yêu cầu full Wrangler step PASS trước deploy.
8. Chạy `npm run test:pages`/browser suite nếu runtime có Playwright/Chromium ổn định.
9. Deploy Pages project hiện có, output `public`, không đổi database/bucket.
10. Smoke `/api/v1/health`, public settings/site/routes/login.
11. Admin smoke Cloud CMS: Site Settings → Media → Page → add/edit/reorder → Save Draft → Preview → Publish → refresh public → sửa Draft → xác nhận public vẫn giữ Published → restore revision → xác nhận chỉ Draft → Publish lại.
12. Smoke R2 và Resend thật trong production.

## L. Known limitations / kết luận

Source V3 đã đạt PASS cho automated Node tests, D1-compatible CMS persistence tests, setup/rate-limit regressions, source/config build validation và local HTTP smoke. Full Wrangler build, browser E2E và remote Cloudflare/Resend vẫn chưa xác minh được trong sandbox này.

**Kết luận:** không tự gắn nhãn `PRODUCTION READY` trong báo cáo này cho đến khi các mục NOT VERIFIED bắt buộc phía production được chạy và PASS trên CI/Cloudflare thực tế.

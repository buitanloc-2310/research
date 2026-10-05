# TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST

**SKY FIRST RESEARCH & INNOVATION CENTER**  
Production: `https://research.skyfirst.io.vn`

Source production cho một Cloudflare Pages project gồm public website, login/workspace, Admin, Website CMS, Pages Functions/API, D1 và private R2. Bản này tiếp tục trực tiếp trên kiến trúc có sẵn; không chuyển framework, không tạo database/bucket mới và không chứa secret production.

## 1. Production bindings cố định

| Thành phần | Giá trị |
|---|---|
| Pages project hiện có | `research-xcl` — đối chiếu tên project trước CLI deploy |
| Domain / APP_ORIGIN | `https://research.skyfirst.io.vn` |
| D1 binding | `DB` |
| D1 database | `tt` |
| D1 database ID | `0a75531f-b227-4a8b-bc26-dda1cc9a0004` |
| R2 binding | `STORAGE` |
| R2 bucket | `ttrungtam` |
| Build command | `npm run build` |
| Static output | `public` |
| Node | `>=22.13.0` |

Không thay D1/R2 ở trên. ID D1 cũ `ddcc0aa9-cbd3-4a7c-ad9d-dc226456eef1` không được dùng trong production config.

## 2. Cấu trúc

- `public/`: website, workspace/admin UI, design system, logo chính thức, manifest, headers/routes.
- `functions/`: Cloudflare Pages Functions adapter.
- `src/`: API, auth/session/RBAC, security, business workflows, email, SEO và Website CMS.
- `migrations/`: migration D1 tuần tự `0001` → `0004`.
- `tests/`: automated tests và browser/Pages harness.
- `scripts/`: local runtime, seed, build/config helpers.
- `FINAL_ACCEPTANCE.md`: báo cáo nghiệm thu của vòng Production Final này.

ZIP bàn giao phải có đúng một top-level folder `CENTER/`. Không deploy `node_modules`, `.git`, `.local`, `.build` hoặc secret file.

## 3. Website CMS

Admin có mục **Website CMS**. Dữ liệu được lưu ở D1, media thực ở R2 `STORAGE`; không dùng localStorage/base64 làm nguồn dữ liệu.

CMS quản lý được:

- Site Settings: tên Việt/Anh, tagline, mô tả, logo, favicon, website, hotline, email, social, copyright.
- Header/Navigation: tạo/sửa/xóa, thứ tự, bật/tắt, internal/external, tab mới.
- Footer: cột/heading/link, thứ tự, bật/tắt và các liên kết hệ sinh thái.
- Pages: tạo/sửa trang, SEO title, meta description, social image, canonical, noindex.
- Page Builder: Hero, Heading, Rich Text, Image, CTA, Statistics, Cards, Feature Grid, Partners/Links, FAQ; tạo/sửa/xóa/bật/tắt/reorder.
- Draft → Preview → Publish bằng published snapshot. Draft tiếp theo không tự rò ra public.
- Media Library: upload/browse/search/preview/reuse/alt text/delete có kiểm tra tham chiếu. Media được private mặc định và chỉ public qua API khi được dùng cho nội dung public.

Các module nghiệp vụ Research/Publications/Datasets/Researchers/Research Groups/Events và RBAC hiện hữu vẫn độc lập với content layer của CMS.

## 4. Local

```sh
npm ci
cp .env.example .dev.vars
# Đặt DEMO_PASSWORD ngẫu nhiên >=12 ký tự và SETUP_SECRET chỉ cho local.
npm run seed
npm run dev
```

Mặc định local dùng SQLite/D1 adapter và storage local. Không seed demo vào production.

Để chạy đúng Cloudflare Pages/workerd khi dependencies có sẵn:

```sh
npm run migrate:local
npm run dev:pages -- --port 8788
```

## 5. Build & tests

```sh
npm ci
npm test
npm run build
npm run test:browser
npm run test:pages
```

`npm run build` gồm kiểm tra syntax/config (`scripts/build.mjs`) và `wrangler pages functions build`. Trong môi trường bàn giao hiện tại, syntax/config và Node automated tests đã chạy; full Wrangler/browser suite phụ thuộc package/browser runtime và được ghi đúng trạng thái trong `VALIDATION.md`/`FINAL_ACCEPTANCE.md`.

## 6. Migration production — bảo toàn dữ liệu

**Backup trước. Không reset DB. Không copy/paste chạy lại migration cũ mù quáng.**

```sh
npx wrangler d1 export tt --remote --output backup-tt.sql
npx wrangler d1 migrations list tt --remote
```

Migration:

1. `0001_initial.sql`: schema nghiệp vụ/auth/RBAC/session/audit/settings.
2. `0002_email_delivery.sql`: email delivery/outbox fields.
3. `0003_email_reliability.sql`: retry/idempotency/lease.
4. `0004_website_cms.sql`: additive Website CMS, resilient `settings`, site settings, pages/blocks/nav/footer/media và default content. Dùng `CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`, không drop/reset business data.

Nếu migration history remote khớp 0001–0003, áp migration còn thiếu:

```sh
npm run migrate:production
```

Nếu remote từng import SQL thủ công hoặc `d1_migrations` không khớp schema, **dừng lại và reconcile trước**. Không đánh dấu hoặc chạy lại 0001–0003 chỉ để làm migration list đẹp.

## 7. Production variables & secrets

Non-secret đã cấu hình trong `wrangler.jsonc`:

- `MODE=single`
- `APP_ORIGIN=https://research.skyfirst.io.vn`
- `EMAIL_FROM=Sky First Research & Innovation Center <research@skyfirst.io.vn>`
- `EMAIL_REPLY_TO=research@skyfirst.io.vn`

Secrets/variables cần đặt server-side trong Cloudflare Production tùy chức năng:

- `SETUP_SECRET` — chỉ bootstrap lần đầu; xóa sau khi đã có admin.
- `RESEND_API_KEY` — gửi email thật; tuyệt đối không đưa frontend/Git/ZIP.
- `MAINTENANCE_SECRET` — nếu dùng external scheduler cho maintenance/outbox.
- `ADMIN_ALERT_EMAIL` — tùy chọn hộp thư nhận cảnh báo.

Email production thật cần domain/sender được Resend xác minh. Không có key trong local test không được coi là email production PASS.

## 8. Deploy đúng thứ tự

1. Backup D1 remote.
2. Kiểm tra `wrangler d1 migrations list tt --remote` và schema thực.
3. Áp **chỉ migration còn thiếu**, trong đó `0004_website_cms.sql` là migration mới của bản này.
4. Xác nhận bindings `DB→tt` đúng ID và `STORAGE→ttrungtam`.
5. Cấu hình variables/secrets Production.
6. Trong CI/máy có network: `npm ci && npm test && npm run build`.
7. Deploy Pages project hiện có; output `public`, `functions` cùng cấp `package.json`.
8. Smoke test `/api/v1/health`, `/api/v1/public/settings`, `/api/v1/public/site`, `/`, `/about`, `/explore`, `/contact`, login.
9. Đăng nhập Admin → Website CMS → sửa draft → preview → publish → refresh public.
10. Test upload R2 và gửi email thật bằng tài khoản/provider production do bạn kiểm soát.

Nếu repo chứa thư mục `CENTER` ở root, đặt Pages Root directory = `CENTER`; nếu nội dung của `CENTER` được đưa trực tiếp lên repo root thì để Root directory trống.

## 9. P0 `/api/v1/public/settings`

Endpoint này phụ thuộc D1 schema. Bản trước gọi bảng `settings` trực tiếp trong khi deployment Pages không tự áp migration; DB remote thiếu/không đồng bộ migration sẽ ném D1 error và bị handler chuyển thành generic HTTP 500. Bản này thêm migration 0004 để bảo đảm schema cần thiết theo hướng additive, thêm health check trả trạng thái DB/schema an toàn, đồng thời giữ client error có request ID mà không lộ SQL/stack.

Không có Cloudflare production logs/database access trong phiên sửa source nên trạng thái schema remote cụ thể vẫn phải xác minh khi deploy.

## 10. Security / CSP

- Session/RBAC/CSRF-origin checks của hệ thống hiện hữu được giữ.
- CMS Admin yêu cầu quyền `settings`; publish yêu cầu thêm quyền `publish`.
- Public settings chỉ trả allowlisted public values; không có Resend/setup/maintenance/API secrets.
- R2 objects không expose trực tiếp; private/public đi qua API kiểm tra metadata/visibility.
- CSP chỉ allow Cloudflare Analytics cần thiết: `static.cloudflareinsights.com` cho script và `cloudflareinsights.com` cho connect; không dùng `script-src *`.
- Error nội bộ log server-side; client chỉ nhận thông báo an toàn + request ID.

Xem thêm `SECURITY.md`, `API.md`, `VALIDATION.md`, `FINAL_ACCEPTANCE.md`.

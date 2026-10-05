# SKY FIRST Research & Innovation Center

Ứng dụng quản lý nghiên cứu bằng tiếng Việt, gồm website công khai có HTML phục vụ SEO, Research Workspace và Admin Control Center. Chạy bằng Cloudflare Workers + D1 + R2; hỗ trợ Application Worker hoặc Pages ở tài khoản khác Data Worker.

## 1. Phạm vi sử dụng

Có 23 nhóm hồ sơ: ý tưởng, đề tài/dự án, nhóm, task, milestone, nhật ký, tài liệu, dataset, hồ sơ researcher, ethics, hội đồng, nghiệm thu, công bố, kinh phí, sự kiện, contribution, impact, biểu mẫu, đối tác, hợp tác, tin/báo cáo, nội dung website và challenge. Mỗi hồ sơ có mã, chủ sở hữu, trạng thái, access level, phiên bản, tệp, thảo luận, lịch sử và quy trình xét duyệt. Các màn hình nhập liệu được sinh từ một catalog dùng chung với backend để giữ hợp đồng nhất quán.

Research Journey có 15 bước, tiến độ, checklist, người phụ trách, hạn, ghi chú, tệp gắn theo bước và lịch sử. Danh sách hỗ trợ tìm kiếm, lọc trạng thái, phân trang, List/Board/Timeline. Form Builder tạo trường text, textarea, email, number, date, select, file qua giao diện; phản hồi và tệp phản hồi riêng tư.

Đây là bộ mã ứng dụng có thể cấu hình triển khai. Kiểm thử cục bộ được mô tả trong `VALIDATION.md`; chưa đồng nghĩa đã nghiệm thu trên tài khoản Cloudflare của bạn. Email transactional có ranh giới adapter; thông báo trong ứng dụng hoạt động. Không tự gửi email khi chưa tích hợp nhà cung cấp. Đặt lại mật khẩu qua liên kết một lần do quản trị cấp sau xác minh, có giao diện dùng ngay.

## 2. Kiến trúc

- **Account A — DATA:** `src/worker.js` ở chế độ `data`; bindings `DB` và `STORAGE`; chỉ nhận API có chữ ký.
- **Account B — APPLICATION:** `src/proxy.js` phục vụ tài nguyên public và proxy `/api/*`. Ký HMAC SHA-256 theo method, path/query, timestamp, nonce, body hash và các header danh tính liên quan. Data Worker kiểm tra tuổi chữ ký và nonce chống phát lại.
- Trình duyệt chỉ gọi cùng origin của Application. Shared secret không bao giờ gửi vào JavaScript trình duyệt. Cookie session HttpOnly/Secure/SameSite Lax chỉ thuộc host Application.
- Một tài khoản: `wrangler.jsonc` chạy Worker ứng dụng cùng D1/R2, không cần proxy.
- Pages: `functions/[[path]].js` dùng cùng proxy, nối tới Data Worker. Xem mục triển khai.

## 3. Cấu trúc

`src/` backend, policy, domain, security, proxy, SEO; `public/` giao diện và catalog; `migrations/` schema; `scripts/` local runtime, seed, build, configure; `tests/` kiểm thử; `functions/` adapter Pages. Không có dependency runtime phía trình duyệt, không CDN font/JS.

D1 dùng bảng `records` có loại, cột quan hệ và JSON theo schema catalog thay vì nhiều bảng lặp lại. Các bảng thành viên, phản biện, history, journey, files, form responses, registrations, roles/permissions và audit được chuẩn hóa với foreign keys/index. Một bản ghi kinh phí là một dự toán/thu/đề nghị/thực chi; các khoản duyệt được tổng hợp theo đề tài. Đây là quản lý kinh phí nội bộ.

## 4. Yêu cầu

Node.js **22.13+** (khuyến nghị 24), npm, tài khoản Cloudflare khi triển khai. Local dùng `node:sqlite` và storage trên đĩa; không cần D1/R2 thật và không cần Python. Wrangler đã được khóa phiên bản trong package-lock. Cài dependency để deploy bằng `npm ci`.

## 5. Chạy local

```bash
npm ci
cp .env.example .dev.vars
```

Mở `.dev.vars`, đặt `SETUP_SECRET` bằng chuỗi ngẫu nhiên tối thiểu 32 ký tự nếu muốn thiết lập từ trắng; đặt `DEMO_PASSWORD` dài tối thiểu 12 ký tự nếu muốn dùng seed. Không dùng mật khẩu ví dụ trên môi trường thật.

```bash
npm run seed
npm run dev
```

Mở `http://localhost:8787`. Các tài khoản demo: `demo-admin@example.test`, `demo-researcher@example.test`, `demo-reviewer@example.test`, `demo-manager@example.test`, `demo-finance@example.test`, `demo-ethics@example.test`. Mật khẩu là giá trị **bạn tự đặt** trong `DEMO_PASSWORD`. Seed không ghi đè tài khoản đã có. Tất cả nội dung mẫu gắn `[DEMO]`, không phải hoạt động thật.

Nếu không seed: chạy `npm run dev`, mở `http://localhost:8787/#setup` để tạo quản trị viên đầu tiên. Migrations được tự áp dụng khi local server mở DB. Dữ liệu nằm ở `.local/data.sqlite`, tệp ở `.local/storage`. Xóa thư mục này chỉ khi muốn xóa toàn bộ dữ liệu local; tuyệt đối không nhầm với bản sao lưu.

## 6. Build và test

```bash
npm run build
npm test
```

Build kiểm tra cú pháp các module và JSON cấu hình; dự án dùng ES modules native nên không cần transpile frontend. `npm test` chạy API thật qua adapter D1 bằng SQLite và R2 trong bộ nhớ, không chỉ kiểm tra marker chuỗi. Kiểm thử trình duyệt tùy chọn: cài Playwright và Chromium ở môi trường QA, xem `tests/browser.mjs`. Không đóng dependency/browser vào ZIP.

## 7. Tạo D1 và R2 trên Account A

Không dùng tài nguyên của hệ thống TK cũ. Chọn tài khoản DATA của Trung tâm mới:

```bash
npx wrangler login
export CLOUDFLARE_ACCOUNT_ID="ACCOUNT_A_ID"
npx wrangler d1 create tt
npx wrangler r2 bucket create TEN_BUCKET_RIENG
```

Ghi lại database ID được trả về. R2 phải giữ private: không bật public `r2.dev`, không cấu hình public bucket domain. API Worker kiểm tra quyền trước mỗi download.

Trong `.dev.vars`, điền `D1_DATABASE_ID`, `D1_DATABASE_NAME`, `R2_BUCKET_NAME`, `APP_ORIGIN` (HTTPS, không dấu `/` cuối), `DATA_API_URL`. Account ID không cần ghi trong mã; dùng `CLOUDFLARE_ACCOUNT_ID` đúng tài khoản ở từng shell triển khai.

```bash
npm run configure
```

Lệnh chỉ đưa tên tài nguyên/ID/origin vào Wrangler; không chép secrets. Có thể chỉnh các placeholder ngay trong ba file Wrangler nếu muốn. Giữ bindings đúng **DB** và **STORAGE**.

## 8. Migrations và Data Worker

```bash
export CLOUDFLARE_ACCOUNT_ID="ACCOUNT_A_ID"
npx wrangler d1 migrations apply tt --remote --config wrangler.data.jsonc
npx wrangler secret put SETUP_SECRET --config wrangler.data.jsonc
npx wrangler secret put API_SHARED_SECRET --config wrangler.data.jsonc
npm run deploy:data
```

Nhập secrets ở prompt, không ghi vào source. `SETUP_SECRET` chỉ dùng tạo admin đầu tiên. `API_SHARED_SECRET` dùng chuỗi ngẫu nhiên ít nhất 32 byte, phải giống nhau trên Data và App. Ghi lại HTTPS URL Data Worker; cập nhật `DATA_API_URL` của App. Data endpoint trực tiếp không ký sẽ trả 401: đó là hoạt động đúng.

Cron mặc định mỗi ngày 01:00 UTC xóa session/token/nonce/rate limit hết hạn và nhắc task/milestone đến hạn ngày hôm sau. Không đặt cron trên App proxy.

## 9. Application Worker trên Account B

```bash
export CLOUDFLARE_ACCOUNT_ID="ACCOUNT_B_ID"
npx wrangler secret put API_SHARED_SECRET --config wrangler.app.jsonc
npm run deploy:app
```

Application không có D1/R2 binding. `DATA_API_URL` trỏ đúng gốc Data Worker, không thêm `/api`. Truy cập App bằng đúng `APP_ORIGIN` đã cấu hình ở Data Worker; origin khác sẽ bị chặn thao tác ghi.

Trong Cloudflare dashboard của App Worker → Settings → Domains & Routes, thêm domain thuộc tài khoản B. Cập nhật `APP_ORIGIN` ở Data Worker thành domain chính xác rồi deploy Data lại. Với staging, dùng bộ config, secrets và DB riêng; không bật wildcard origin.

## 10. Application bằng Pages (tùy chọn thay Worker B)

Tạo Pages project có thư mục output `public`; thư mục `functions` nằm ở root dự án và phải được build/deploy cùng. Build command `npm run build`. Không chỉ upload các tệp public bằng cách bỏ qua Pages Functions.

```bash
export CLOUDFLARE_ACCOUNT_ID="ACCOUNT_B_ID"
npx wrangler pages project create sfrc-app
npx wrangler pages secret put API_SHARED_SECRET --project-name sfrc-app
npx wrangler pages deploy public --project-name sfrc-app
```

Đặt `DATA_API_URL` trong Pages Environment Variables; deploy lại sau thay đổi. Production và Preview có cấu hình riêng. Data `APP_ORIGIN` phải khớp production domain. Preview dùng Data staging hoặc không được phép ghi. Pages Functions dùng `context.next()` để lấy assets.

## 11. Chạy một tài khoản

Dùng `wrangler.jsonc`; áp dụng migrations, đặt `SETUP_SECRET`, cấu hình domain/APP_ORIGIN và `npm run deploy:single`. Không cần API_SHARED_SECRET trong chế độ single. D1 và R2 phải ở cùng tài khoản Worker này.

## 12. Quản trị đầu tiên

Mở `https://APP_DOMAIN/#setup`, điền tên, email, mật khẩu dài tối thiểu 12 ký tự và SETUP_SECRET. Bootstrap được khóa bằng hàng `initialized` duy nhất trong transaction. Sau thành công, đăng nhập và xóa SETUP_SECRET khỏi Worker nếu không còn cần. Không seed demo lên production.

Trong Admin:

1. Cài đặt: tên mã prefix, giới thiệu, sứ mệnh, tầm nhìn, giá trị, liên hệ, bình chọn ý tưởng.
2. Tài khoản: tạo nhân sự, chọn vai trò, bàn giao mật khẩu tạm qua kênh riêng. Người dùng phải đổi mật khẩu lần đầu.
3. Vai trò & quyền: bật/tắt quyền vận hành; System Admin được bảo vệ.
4. Hồ sơ: tạo nhóm/đề tài, thêm thành viên và đồng chủ nhiệm, giao task, milestone.
5. Nội dung: tạo tin, tài liệu/công bố; chọn Public, gửi/duyệt, sau đó công bố. Public không tự xuất hiện ngay khi lưu draft.

## 13. Quy trình hoạt động

Đề tài: Draft → Submitted → Screening/Review → Approved → Active → Acceptance → Completed → Published → Archived. Revision đưa hồ sơ về trạng thái được sửa. Phiếu phản biện đã nộp không sửa đè; tạo vòng mới để đánh giá tiếp. Người tham gia không tự phê duyệt dự án, kinh phí, ethics hoặc nghiệm thu của mình, kể cả System Admin; cần người độc lập.

Đề tài có người tham gia chỉ được bắt đầu sau khi hồ sơ Ethics cùng đề tài đã được duyệt và còn hiệu lực. Nghiệm thu cần mã hồ sơ hội đồng cùng đề tài có kết luận. Ghi nhận/ethics chỉ là nghiệp vụ nội bộ, không phải chứng nhận nhà nước.

Mức truy cập: Public (chờ duyệt công bố), Internal (mọi tài khoản đăng nhập), Restricted (chủ hồ sơ/nhóm/nhân sự có quyền), Confidential (chủ hồ sơ, người phản biện được giao, quản lý chuyên trách). Kinh phí/ethics/hội đồng/đối tác/hợp tác không cho đặt Public/Internal.

Tệp hồ sơ được tải khi hồ sơ còn mở sửa; khi đã công bố cần mở lại quy trình để thay đổi. Tệp phản hồi Form dùng bảng và đường dẫn riêng, chỉ người gửi/chủ form/điều phối xem được. Giới hạn 10 MB/tệp, tải xuống dạng attachment; có metadata và phiên bản hồ sơ tại thời điểm upload. Preview Office/biên tập tài liệu đồng thời không có trong bản này.

## 14. Backup/recovery

Admin → Xuất dữ liệu tải từng bảng nghiệp vụ thành JSON theo trang, không xuất password/session. Đây là bản xuất dữ liệu, **không thay thế backup toàn DB**.

Sao lưu D1 đầy đủ:

```bash
export CLOUDFLARE_ACCOUNT_ID="ACCOUNT_A_ID"
npx wrangler d1 export tt --remote --output=backup.sql --config wrangler.data.jsonc
```

Bảo quản SQL trong nơi riêng có kiểm soát truy cập. Sao lưu objects R2 bằng công cụ S3-compatible với credential tối thiểu, cùng metadata DB và đúng object key. Tệp soft-delete vẫn tồn tại để phục hồi; không tự xóa vật lý. Thực hiện backup theo lịch vận hành phù hợp và thử phục hồi vào DB/bucket staging trước khi áp dụng production. Khôi phục đầy đủ cần SQL + objects + cấu hình; secrets được khôi phục từ kho secret riêng. Không ghi secret vào file backup công khai.

## 15. Troubleshooting

- `503 Chưa cấu hình`: kiểm tra binding và DATA_API_URL/secret đúng môi trường, deploy lại.
- `401 API authentication`: secret hai phía không khớp, Data đang nhận yêu cầu trực tiếp không ký.
- `403 Yêu cầu không đúng nguồn`: APP_ORIGIN khác domain truy cập hoặc thiếu header SFRC; không sửa thành wildcard.
- `409 Phiên bản`: mở lại hồ sơ trước khi lưu, tránh ghi đè dữ liệu người khác.
- `409` khi duyệt: đọc thông báo điều kiện (phiếu phản biện, ethics, hội đồng); không sửa DB để vượt quy trình.
- Login local: truy cập `localhost`, không dùng IP khác origin. Cookie Secure được trình duyệt hiện đại hỗ trợ cho localhost.
- `500`: lấy `request_id`, xem Worker logs; chưa migration, binding sai hoặc lỗi dữ liệu. Không gửi secret vào ticket.
- R2 object không có: kiểm tra bộ DB và bucket tương ứng cùng môi trường, không trộn DB staging với bucket production.
- Cài dependency: cần kết nối npm registry. Lệnh local/test thuần Node có thể chạy không có Wrangler; deploy/dry-run cần npm ci.

Xem thêm `API.md`, `SECURITY.md`, `VALIDATION.md`.

## 16. Các hình thức sử dụng hiện có

Hội đồng được quản lý bằng hồ sơ thành viên/vai trò, lịch, kết luận và tệp biên bản; phản biện là các phiếu có tài khoản được phân công độc lập. Không có phòng họp trực tuyến hoặc bỏ phiếu kín. Timeline sắp xếp hồ sơ theo hạn, Board phân cột trạng thái; thay đổi trạng thái thực hiện trong hồ sơ để giữ kiểm tra quyền và audit. Biểu mẫu yêu cầu đăng nhập, phù hợp tiếp nhận thành viên đã được cấp tài khoản. Đây là các quy tắc vận hành của bản bàn giao, không phải nút giả hoặc dữ liệu frontend không lưu.

Ảnh chụp giao diện mẫu có thể xem trong `previews/`. Toàn bộ thông tin DEMO chỉ để kiểm tra UI.

Tài liệu Cloudflare tham chiếu khi xây dựng:
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/workers/static-assets/binding/

## Cloudflare Pages single-project deployment (account-limited mode)

This package includes a Pages adapter so the existing `research-xcl` Pages project can run the frontend and API together. It does not require a separate Data Worker or `DATA_API_URL`.

Cloudflare Pages settings when the repository project is inside `CENTER`:

- Root directory: `CENTER`
- Build command: `npm run build`
- Build output directory: `public`
- Production variable: `APP_ORIGIN=https://research.skyfirst.io.vn`
- D1 binding: `DB` -> database `tt` (`ddcc0aa9-cbd3-4a7c-ad9d-dc226456eef1`)
- R2 binding: `STORAGE` -> bucket `ttrungtam`

`API_SHARED_SECRET` is not required for this single Pages deployment because the Pages Function calls the API handler directly rather than crossing accounts over HTTPS. It may be removed from this Pages project after migration to this mode. `RESEND_API_KEY` is harmless but email delivery is not enabled until a real email provider adapter is implemented.

Before production use, apply `migrations/0001_initial.sql` to D1 `tt`. Then redeploy the Pages project and attach the custom domain `research.skyfirst.io.vn`.

Note: Pages does not run the Worker cron trigger from `wrangler.jsonc`. The web/API application works without it, but scheduled expiry/cleanup/deadline jobs need a separate scheduled mechanism later if those automations are required.

## Transactional email (Resend)
Production email is integrated through the existing D1 outbox. The default sender is `Sky First Research & Innovation Center <research@skyfirst.io.vn>` and reply-to is `research@skyfirst.io.vn`.

Required Cloudflare Pages settings:
- Secret `RESEND_API_KEY`: Resend API key. Never commit it.
- Variable `EMAIL_FROM`: `Sky First Research & Innovation Center <research@skyfirst.io.vn>`
- Variable `EMAIL_REPLY_TO`: `research@skyfirst.io.vn`
- Variable/Secret `ADMIN_ALERT_EMAIL`: private inbox that should receive important administrative alerts.

Before production sending, verify `skyfirst.io.vn` (or the exact sending domain) in Resend and publish the DNS records Resend provides. Without domain verification, Resend can reject the sender even when the API key is valid.

Email coverage includes in-app notifications (assignment, review and record notifications), account creation, password reset/change security notices, event registration, form submissions and important admin alerts. Messages are written to `outbox`, delivered through Resend, retried up to five attempts, and failures remain auditable in D1. Passwords and secrets are never emailed.

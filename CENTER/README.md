# SKY FIRST — Trung tâm Nghiên cứu & Đổi mới Sáng tạo

Bản hoàn thiện trực tiếp từ source `PAGES-EMAIL-LOGO-FIXED`, dành cho **một Cloudflare Pages project**: public website, workspace, admin, Pages Functions/API, D1 và private R2. Không cần tạo database/bucket mới. Logo chính thức giữ nguyên byte.

## 1. Cấu hình production đã chốt

| Thành phần | Giá trị |
|---|---|
| Pages project | `research-xcl` (đối chiếu tên project hiện có trước CLI deploy) |
| Domain / APP_ORIGIN | `https://research.skyfirst.io.vn` |
| D1 binding | `DB` |
| D1 database | `tt` |
| D1 database ID | `ddcc0aa9-cbd3-4a7c-ad9d-dc226456eef1` |
| R2 binding / bucket | `STORAGE` / `ttrungtam` |
| Build command | `npm run build` |
| Build output | `public` |
| Node | 22.13+; khuyến nghị Node 24 |

`wrangler.jsonc` là cấu hình Pages mặc định được Git integration tự phát hiện. `wrangler.pages.jsonc` là bản tương đương để tham khảo; nếu chỉnh cấu hình, giữ hai bản đồng nhất. Không chọn cấu hình Workers cũ để deploy Pages. `npm run configure` chỉ kiểm tra binding, không sửa database ID/bucket.

## 2. Cấu trúc GitHub / ZIP

ZIP chỉ có một thư mục `CENTER/`. Bên trong:

- `public/`: HTML, JS, CSS, logo gốc, manifest, `_routes.json`, `_headers`.
- `functions/[[path]].js`: adapter Pages, gọi backend cùng project.
- `src/`: API, RBAC, DB, workflow, bảo mật, email, SEO.
- `migrations/`: ba migration tuần tự.
- `scripts/`: local runtime, seed, build, cấu hình.
- `tests/`: API/security/email, browser, Pages/workerd với D1/R2 local.
- `previews/`: ảnh kiểm tra giao diện.

Nếu GitHub chứa `CENTER` ở root repo, đặt **Root directory = CENTER**, output `public` (không phải `CENTER/public`). Nếu đưa nội dung CENTER lên root repo, Root directory để trống, output vẫn `public`. `functions` phải ở cùng cấp `package.json`, không nằm trong `public`.

## 3. Chạy local

```sh
npm ci
cp .env.example .dev.vars
# Điền DEMO_PASSWORD ngẫu nhiên >=12 ký tự và SETUP_SECRET riêng cho local.
npm run seed
npm run dev
```

Mở `http://localhost:8787`. Seed tạo tài khoản `demo-admin@example.test`, `demo-researcher@example.test`, `demo-reviewer@example.test`, `demo-manager@example.test`, `demo-finance@example.test`, `demo-ethics@example.test`, cùng mật khẩu lấy từ DEMO_PASSWORD. Không có mật khẩu mặc định trong source. Dữ liệu đánh dấu DEMO; seed chỉ dùng local, không seed production.

Local Node dùng SQLite/D1 adapter và R2 trên disk. Chạy đúng Pages/workerd:

```sh
npm run migrate:local
# Khi test Pages trên localhost, đặt APP_ORIGIN=http://localhost:8788 trong .dev.vars.
npm run dev:pages -- --port 8788
```

Giữ `RESEND_API_KEY` trống ở local/test để không gửi email thật. Preview deployment cần DB/R2 và APP_ORIGIN riêng nếu muốn ghi dữ liệu; không dùng preview để thử phá dữ liệu production.

## 4. Build và tests

```sh
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:pages
```

Build kiểm tra syntax/config và **biên dịch Pages Functions thật** vào `.build/pages`; thư mục này không phải output tĩnh. `test:pages` tự tạo D1/R2 local trong thư mục tạm, áp migration, khởi động Wrangler Pages, kiểm tra HTTP, đăng nhập, upload/download và Chromium, sau đó dọn tài nguyên local. Không gọi database production. Browser tests dùng tài khoản demo local. Có thể đặt `CHROMIUM_PATH` / `PLAYWRIGHT_MODULE` khi môi trường cung cấp trình duyệt sẵn. Kết quả đã chạy: xem `VALIDATION.md`.

## 5. Migration production — không tạo D1/R2 mới

Sao lưu database hiện tại trước:

```sh
npx wrangler d1 export tt --remote --output backup-tt.sql
npx wrangler d1 migrations list tt --remote
npm run migrate:production
```

Các migration cần có:

1. `0001_initial.sql`: schema nghiệp vụ, users, RBAC, sessions, audit, outbox gốc.
2. `0002_email_delivery.sql`: attempts/error/recipient/sent_at, trigger notification → email.
3. **`0003_email_reliability.sql`**: lịch retry, request đã cố định, provider ID, khóa xử lý nền.

Nếu 0001/0002 đã áp bằng Wrangler migration, chỉ 0003 sẽ chạy. Không chạy lại toàn bộ SQL bằng copy/paste. Nếu trước đây import SQL thủ công, hãy đối chiếu `PRAGMA table_info(outbox)` và bảng `d1_migrations` trước: schema hiện có phải khớp migration đã áp. Không tự đánh dấu migration là đã chạy khi chưa kiểm tra cấu trúc. Migration không xóa dữ liệu nghiệp vụ. Áp migration **trước** khi deploy code mới.

## 6. Variables và secrets

Các biến không nhạy cảm đã có trong `wrangler.jsonc`:

| Biến | Giá trị |
|---|---|
| MODE | `single` |
| APP_ORIGIN | `https://research.skyfirst.io.vn` — không dấu `/` cuối |
| EMAIL_FROM | `Sky First Research & Innovation Center <research@skyfirst.io.vn>` |
| EMAIL_REPLY_TO | `research@skyfirst.io.vn` |
| ADMIN_ALERT_EMAIL | tùy chọn: hộp thư quản trị thực nhận cảnh báo |

Secrets đặt trong Pages → Settings → Variables and Secrets, môi trường Production:

- `SETUP_SECRET`: chuỗi ngẫu nhiên mạnh cho bootstrap lần đầu; xóa sau thiết lập.
- `RESEND_API_KEY`: API key Resend có quyền gửi từ domain đã xác minh.
- `MAINTENANCE_SECRET`: chuỗi ngẫu nhiên ít nhất 32 ký tự nếu gọi endpoint bảo trì bằng scheduler ngoài.

Có thể dùng CLI:

```sh
npx wrangler pages secret put SETUP_SECRET --project-name research-xcl
npx wrangler pages secret put RESEND_API_KEY --project-name research-xcl
npx wrangler pages secret put MAINTENANCE_SECRET --project-name research-xcl
```

Không đưa key vào JS frontend, GitHub, ZIP hoặc log. `CLOUDFLARE_API_TOKEN` và `CLOUDFLARE_ACCOUNT_ID` chỉ cần cho CLI/CI, không phải binding frontend. `API_SHARED_SECRET` và `DATA_API_URL` không cần trong kiến trúc Pages hiện tại. Các file proxy/Workers cũ được giữ để tránh refactor phần không liên quan, không deploy chúng trong quy trình này.

## 7. Deploy Pages / GitHub

1. Backup D1; áp migration còn thiếu.
2. Push source vào GitHub; kết nối **Pages project hiện có**, không tạo project Workers.
3. Đặt root/build/output đúng mục 2; Node 24.
4. Kiểm tra binding DB→tt, STORAGE→ttrungtam, variables và secrets Production.
5. Deploy branch production (CLI thay thế: `npm run deploy:pages -- --project-name research-xcl`).
6. Pages Custom domains gắn `research.skyfirst.io.vn`, chờ DNS/TLS active. Không dùng route Worker cũ che domain này.
7. Sau thay đổi secrets/bindings, deploy lại để Functions nhận cấu hình mới.

Không upload chỉ thư mục public qua thao tác kéo/thả Dashboard: cách đó không thay thế quy trình build/deploy Pages Functions từ Git/CLI.

## 8. Kiểm tra chống trang trắng

Pages tự chuẩn hóa `/index.html` về `/`. Backend lấy entry qua **native `env.ASSETS.fetch('/')`**, không gọi `context.next()` thay thế cho một URL asset khác, không biến redirect có body rỗng thành HTML 200. `_routes.json` cho CSS/JS/logo đi thẳng static; robots/sitemap vẫn chạy handler. Nếu HTML thiếu entry scripts/styles, trả HTTP 503 kèm thông báo thay vì trang trắng.

Sau deploy kiểm tra:

```sh
curl -fsS https://research.skyfirst.io.vn/ > homepage.html
curl -I https://research.skyfirst.io.vn/app.js
curl -I https://research.skyfirst.io.vn/style.css
curl -I https://research.skyfirst.io.vn/sky-first-logo.png
curl -fsS https://research.skyfirst.io.vn/api/v1/health
```

`homepage.html` phải chứa `/app.js` và `/style.css`, không rỗng. Trình duyệt Network phải có JS/CSS/logo và API. Kiểm tra `/about`, `/explore`, `/robots.txt`, `/sitemap.xml`, `/#login`. Nếu 503: kiểm tra build output/root, artifact `public/index.html`, bindings và log Functions. Nếu API 500: xem mã request, migration và binding; không tắt auth để chữa lỗi.

## 9. Quản trị đầu tiên / vận hành

Mở `https://research.skyfirst.io.vn/#setup`, điền SETUP_SECRET và tài khoản admin thật; bootstrap chỉ dùng một lần. Nếu đã có admin, đăng nhập tài khoản hiện có, không reset database. Xóa SETUP_SECRET sau thiết lập.

Admin quản lý Users/Roles/Settings, các danh mục nghiên cứu, file, sự kiện, biểu mẫu và thông báo qua UI. Email outbox ở `/#w/email` (quyền settings), hiển thị trạng thái/lỗi/lần thử, nút xử lý hàng đợi và thử lại job lỗi còn trong cửa sổ an toàn. Liên kết reset mật khẩu do admin phát hành sau xác minh, chỉ dùng một lần trong 30 phút. Tệp R2 luôn đi qua API kiểm tra quyền; public download chỉ cho hồ sơ đã Published + Public thuộc danh mục cho phép.

## 10. Resend và retry

Xác minh domain `skyfirst.io.vn` trong Resend, cấu hình DNS SPF/DKIM theo Resend; kiểm tra DMARC và inbox `research@skyfirst.io.vn` nhận reply. Không hard-code API key. Email HTML dùng logo gốc từ URL production HTTPS; không gửi mật khẩu.

Email bao gồm bootstrap/account creation, password reset/change, event registration, form receipt/admin alerts và các notification phân công/phản biện/cập nhật hồ sơ. Notification có liên kết workspace đúng `/#w/detail/ID`.

Outbox ghi D1; khóa DB chống nhiều isolate gửi đồng thời; mỗi job có Idempotency-Key cố định và nội dung request cố định. Timeout mỗi request 5 giây, batch tối đa 4; lỗi tạm (network/408/409/429/5xx) backoff 60/120/240/480 giây, tôn trọng Retry-After đến 1 giờ; tối đa 5 lần tự động. Lỗi provider 4xx không retry vô hạn. Job mơ hồ quá 23 giờ dừng để không gửi lại ngoài cửa sổ idempotency 24 giờ của Resend. `sent` nghĩa Resend đã chấp nhận, **không phải xác nhận email đã vào inbox**; đối chiếu provider ID trong Resend.

Token reset không xuất trong admin export/outbox UI, được xóa khỏi payload sau gửi; job reset hết hạn không được gửi. D1 backup vẫn là dữ liệu nhạy cảm cần bảo vệ.

**Pages không chạy scheduled handler của Workers.** Có hai cách xử lý hàng đợi: request API kích hoạt xử lý nền bằng waitUntil và admin bấm xử lý. Để retry/deadline hoạt động cả lúc không có người truy cập, cấu hình scheduler HTTPS ngoài gọi mỗi phút:

```sh
curl --fail-with-body -X POST https://research.skyfirst.io.vn/api/v1/maintenance \
  -H "Authorization: Bearer $MAINTENANCE_SECRET"
```

Lưu token trong secret store của scheduler, không query string hoặc Git. Endpoint yêu cầu POST và secret >=32 ký tự, không cookie/CSRF browser. Không cần thêm Cloudflare project. Maintenance dọn session/reset/rate nonce và kiểm tra deadline/ethics tối đa mỗi giờ, email theo lịch retry. Khi provider lỗi, sửa cấu hình trong Cloudflare, rồi chọn Thử lại trong outbox; reset link hết hạn phải phát hành link mới. Batch 4 phù hợp quy mô nhỏ/vừa; hàng nghìn email cần worker/queue chuyên dụng riêng sau này.

## 11. Production checklist

- [ ] Backup và migration 0001→0002→0003 đã thành công.
- [ ] Root/build/output, DB/STORAGE/domain đúng bảng cấu hình.
- [ ] Secrets nằm trong Production, không nằm trong source.
- [ ] GET homepage có HTML, JS/CSS/logo trả đúng MIME, không trắng ở desktop/mobile.
- [ ] Đăng nhập/đăng xuất, bootstrap khóa, user không có quyền bị chặn.
- [ ] Tạo/sửa hồ sơ, upload/download tệp riêng, public không đọc tệp đó.
- [ ] Resend domain verified; thử reset/notification đến hộp thư do bạn kiểm soát, kiểm tra provider ID.
- [ ] Scheduler bảo trì đã cấu hình nếu cần giao thư khi không có traffic.
- [ ] Không seed demo vào production; xóa SETUP_SECRET sau bootstrap.
- [ ] WAF/rate rules, giám sát 5xx, hạn mức D1/R2/Resend và backup định kỳ.

## 12. Backup / khôi phục / giới hạn

Xuất D1 bằng `wrangler d1 export tt --remote`; giữ bản SQL mã hóa ngoài project. Đồng bộ objects R2 qua S3-compatible client với credential riêng có quyền tối thiểu; không bật public bucket. Backup phải gồm DB metadata và objects cùng mốc. Thử restore vào môi trường riêng trước khi tác động production, đối chiếu file count/hash. Admin export chỉ là dữ liệu nghiệp vụ, không thay thế backup đầy đủ.

Bản này không tích hợp SSO hệ thống TK cũ, antivirus, chữ ký pháp lý hoặc chứng nhận nhà nước. Tài liệu chi tiết bảo mật ở SECURITY.md, API ở API.md. Chưa deploy thay bạn vào Cloudflare, chưa gửi Resend thật khi chưa có credentials. Không có thay đổi remote database trong quá trình sửa/kiểm thử này.

Tài liệu nền tảng: https://developers.cloudflare.com/pages/functions/api-reference/ ; https://developers.cloudflare.com/pages/functions/routing/ ; https://resend.com/docs/dashboard/emails/idempotency-keys .

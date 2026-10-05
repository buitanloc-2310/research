# Production validation — 05/10/2026

Kiểm tra trực tiếp bản source ZIP người dùng cung cấp; không xây lại hệ thống.

| Kiểm tra đã chạy | Kết quả |
|---|---|
| `npm ci` | PASS, lockfile đầy đủ |
| `npm run build` | PASS syntax/config + biên dịch Pages Functions bằng Wrangler 4.34.0 |
| `npm test` | **63 PASS / 0 FAIL / 0 skipped** |
| `npm run test:pages` | **19 PASS / 0 FAIL** trên Pages/workerd với D1/R2 local |
| `npm run test:browser` | PASS public/login, **36 màn hình workspace/admin**, Journey update, idea create, Form Builder, mobile, dark mode |
| D1 local migrations | 0001, 0002, 0003 áp thành công bằng Wrangler |
| Logo chính thức | SHA-256/byte đối chiếu khớp file PNG trong ZIP gốc |
| ZIP cuối | **48 file**, tất cả nằm dưới đúng `CENTER/`, ZIP integrity PASS |

Tổng kiểm thử có bộ đếm riêng: **82 PASS / 0 FAIL** (63 API/security/email + 19 Pages smoke). Browser suite là một kịch bản end-to-end với 36 màn hình và các thao tác nêu trên, không cộng 36 màn hình thành 36 unit test.

## Lỗi thực tế đã sửa

1. Domain production trước sửa trả HTTP 200 với body rỗng. Source SEO lấy `/index.html`; Pages chuẩn hóa URL này về `/` bằng redirect. Đọc body redirect rồi trả HTML 200 tạo trang trắng không tải assets. Dùng native ASSETS fetch URL `/`, kiểm tra entry trước trả HTML; không dùng context.next làm fetch một asset URL khác. Đã tái hiện lỗi trên Pages local trước sửa (503 khi bật guard), sau sửa 19 smoke PASS.
2. Cấu hình mặc định trước đây là Workers dù deploy Pages. `wrangler.jsonc` giờ là Pages, root/output rõ ràng; config Workers cũ giữ riêng.
3. `_routes.json` tách assets; robots/sitemap vẫn qua handler. Sửa MIME favicon PNG, thêm app manifest, metadata và ảnh email dùng logo gốc. Không chỉnh ảnh logo.
4. Resend outbox thêm lease, idempotency, request cố định, timeout, backoff, hạn retry, receipt và bảo vệ reset token. Thêm admin outbox + retry có quyền/audit; endpoint bảo trì bảo vệ secret. Không còn claim email delivered chỉ dựa trên việc key tồn tại.
5. Đổi mật khẩu thu hồi reset token còn hiệu lực; phát hành reset mới hủy email reset cũ còn chờ. Outbox không xuất qua admin export thông thường.
6. Browser test lặp lại phát hiện delayed detail refresh sau lưu Journey ghi đè trang mới. Thêm guard theo route và regression có chủ động delay mạng; chạy lại PASS.

## Phạm vi kiểm thử

Auth/session/CSRF, user-role permissions, IDOR, private dataset/files, project CRUD/concurrency, Journey/task, review/ethics/acceptance/publication workflows, finance self-approval, event capacity, form access/upload, SQL injection, audit, API errors; HMAC legacy tests được giữ.

Email dùng fake provider có kiểm tra nội dung HTTP: sender/reply-to/logo/escaping, missing key, concurrent sends, backoff/429, stable idempotency/body, provider 422, exhaustion, expired window/reset, trigger notification, role checks, token revocation và manual retry. Không gửi email thật hoặc dùng Resend production key.

Pages suite chạy Functions bundle thật trên workerd, native ASSETS, migrations thật trên D1 local, R2 local upload/download, browser load CSS/JS/logo, PBKDF2/login, admin email và mobile không tràn ngang. Môi trường kiểm thử không cho Node liệt kê network interfaces; đã dùng fallback loopback **chỉ cho CLI test runtime**, không chỉnh code ứng dụng hoặc đưa shim này vào bản bàn giao. Chromium thực thi headless; ảnh trong previews được cập nhật từ lần chạy cuối.

## Chưa thực hiện trên production

Không thay đổi hoặc deploy Cloudflare account, không sửa D1/R2 remote, không gửi Resend thật. Chủ hệ thống cần áp migration còn thiếu, secrets/bindings và deploy theo README, rồi smoke test domain/inbox thật. Không có load test diện rộng hoặc kiểm toán độc lập; PASS cục bộ không phải cam kết không còn lỗi ở mọi điều kiện vận hành.

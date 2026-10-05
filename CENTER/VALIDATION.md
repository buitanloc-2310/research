# Báo cáo kiểm tra — 05/10/2026

## Đã thực hiện

- Node 24.19: build kiểm tra syntax frontend/backend/scripts/Pages adapter và các cấu hình.
- 46 kiểm thử thực thi bằng Node test runner, API Worker thật, D1 adapter chạy SQLite có foreign keys và transactions, R2 memory adapter.
- Migration từ DB trống + seed demo chạy thành công.
- Wrangler D1 local emulator: migration `0001_initial.sql` áp dụng thành công.
- Pages Functions: biên dịch Worker thành công.
- Wrangler dry-run Data Worker và Application Worker: bundle thành công, không dùng credential production.
- Chromium headless: public desktop, đăng nhập, 35 routes workspace/admin, Research Journey 15 bước, sửa bước, tạo ý tưởng, Form Builder, viewport 390px không tràn ngang, dark mode. Không ghi nhận JavaScript page error trong luồng kiểm thử.
- Xem ảnh chụp giao diện desktop/mobile để kiểm tra bố cục và khả năng đọc.

## Các nhóm test

Authentication/cookie; reset một lần và thu hồi session; bootstrap khóa sau lần đầu; CSRF; RBAC admin; IDOR/search ACL; project/task CRUD; optimistic locking; Journey; R2 upload/private download; executable extension rejection; reviewer conflict/assignment/immutable verdict; approval/start/acceptance; ethics validity; dataset sensitive publish rejection; public SSR escaping/sitemap; event capacity; form required fields và private response upload; SQL injection input; append-only audit; HMAC/replay/cookie tampering; cron idempotence; foreign assignee validation.

## Lỗi phát hiện và sửa

- Placeholder bucket ban đầu không đáp ứng định dạng R2: đã đổi thành placeholder chữ thường hợp lệ và giữ bước configure bắt buộc.
- Giao diện hỏi bỏ thay đổi sau khi đã lưu: đã xóa dirty flag trước khi chuyển trang.
- Tệp phản hồi biểu mẫu cần ACL riêng: đã tách bảng/endpoint và kiểm tra owner/form khi nộp.
- Phạm vi đọc reviewer cần nhất quán giữa danh sách và chi tiết: đã kiểm tra assignment ở chi tiết.
- Thao tác async đổi route có thể kết thúc khác thứ tự: đã serialize luồng render route.

## Chưa xác minh trên production

Chưa tạo D1/R2 thật, chưa deploy tài khoản A/B, chưa gắn domain, chưa gửi email thật, chưa thực hiện load test quy mô lớn hoặc kiểm toán bảo mật độc lập. Không gọi bản kiểm thử cục bộ là chứng nhận tuyệt đối không còn lỗi. Cần smoke test staging sau khi cấu hình tài nguyên thật; đã có hướng dẫn và source tests để chạy lại.

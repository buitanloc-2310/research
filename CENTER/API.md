# API & mô hình dữ liệu

API version hiện tại: `/api/v1`. Alias `/api` được giữ cho các script nội bộ. JSON UTF-8; lỗi có `{error, request_id}` và HTTP status tương ứng. Authentication bằng cookie `__Host-sfrc`. Requests ghi phải có `Origin` đúng `APP_ORIGIN` và header `X-Requested-With: SFRC`. Không gửi shared secret từ trình duyệt.

| Endpoint                               | Method             | Nội dung                                                     |
| -------------------------------------- | ------------------ | ------------------------------------------------------------ |
| `/health`                              | GET                | Phiên bản API                                                |
| `/setup`                               | GET, POST          | Trạng thái bootstrap / tạo admin đầu tiên bằng secret        |
| `/login`, `/logout`                    | POST               | Tạo / kết thúc phiên                                         |
| `/me`                                  | GET                | Người dùng và quyền hiện hành                                |
| `/password`, `/reset`                  | POST               | Đổi mật khẩu / sử dụng reset token                           |
| `/sessions`                            | GET, DELETE        | Liệt kê / thu hồi tất cả phiên của chính mình                |
| `/public/settings`                     | GET                | Nội dung cấu hình công khai                                  |
| `/public/search`                       | GET                | Tìm nội dung đã công bố, q/kind/page, 24 hàng/trang          |
| `/public/records/:id`                  | GET                | Chi tiết công khai, danh sách tệp và số lượt truy cập        |
| `/public/related?id=:id`               | GET                | Công trình công khai liên quan profile/nhóm                  |
| `/public/files/:id`                    | GET                | Tệp thuộc hồ sơ đã công bố Public                            |
| `/users/directory`                     | GET                | ID/tên thành viên đang hoạt động để phân công                |
| `/dashboard`                           | GET                | Thống kê/hoạt động/hạn/phiếu phản biện theo quyền            |
| `/records`                             | GET, POST          | Tìm/tạo hồ sơ theo catalog                                   |
| `/records/:id`                         | GET, PATCH, DELETE | Chi tiết / sửa phiên bản / soft-delete bản nháp              |
| `/records/:id/transition`              | POST               | Action, version, note; kiểm tra workflow và quyền            |
| `/records/:id/members`                 | POST, DELETE       | Thêm/cập nhật/gỡ thành viên nhóm hoặc đề tài                 |
| `/records/:id/journey`                 | PATCH              | Step, progress, assignee, deadline, checklist, note, version |
| `/records/:id/comments`                | POST               | Trao đổi trong phạm vi hồ sơ                                 |
| `/records/:id/reviews`                 | POST               | Giao reviewer, vòng, deadline                                |
| `/reviews`                             | GET                | Phiếu được giao hoặc toàn bộ với quản lý                     |
| `/reviews/:id`                         | PATCH              | Gửi điểm/khuyến nghị/nhận xét hoặc phản hồi tác giả          |
| `/records/:id/vote`                    | POST               | Một phiếu/tài khoản, chỉ khi Admin bật                       |
| `/records/:id/convert`                 | POST               | Tạo dự án từ ý tưởng được duyệt                              |
| `/records/:id/files?name=...&step=...` | POST               | Body nhị phân, max 10 MB, step tùy chọn 0–14                 |
| `/files/:id`                           | GET, DELETE        | Download có kiểm tra quyền / ẩn tệp                          |
| `/records/:id/responses`               | POST, GET          | Nộp / xem phản hồi biểu mẫu                                  |
| `/records/:id/response-files?name=...` | POST               | Upload tệp phản hồi riêng tư                                 |
| `/response-files/:id`                  | GET                | Tệp của người gửi/chủ form/điều phối                         |
| `/records/:id/registrations`           | POST, GET, PATCH   | Đăng ký / danh sách / điểm danh                              |
| `/finance/summary`                     | GET                | Tổng hợp khoản đã duyệt theo đề tài và loại                  |
| `/notifications`                       | GET, POST          | Thông báo của mình / đánh dấu đã đọc                         |
| `/admin/users`                         | GET, POST, PATCH   | Tài khoản, trạng thái, vai trò                               |
| `/admin/reset`                         | POST               | Cấp liên kết reset 30 phút, một lần                          |
| `/admin/roles`                         | GET, PATCH         | Vai trò, grants và chỉnh quyền                               |
| `/admin/settings`                      | GET, PATCH         | Cấu hình vận hành, không trả secrets                         |
| `/admin/notices`                       | POST               | Thông báo tới một hoặc mọi tài khoản                         |
| `/admin/audit`                         | GET                | Audit phân trang 100 hàng                                    |
| `/admin/storage`                       | GET                | Metadata storage, max 300 mục gần đây                        |
| `/admin/export`                        | GET                | Danh mục bảng hoặc trang JSON 500 hàng                       |

## Hồ sơ

POST records: `{kind, title, summary, access, project_id?, data:{...}}`. `kind` và schema field ở `public/catalog.js`; backend dùng cùng catalog để xác thực. PATCH thêm `version` lấy từ lần đọc hiện tại. Khi phiên bản thay đổi, API trả 409; không tự ghi đè.

GET records: `kind`, `q`, `status`, `project`, `page`, `sort=title|created_at|updated_at`. 30 hàng/trang. Điều kiện ACL nằm trước LIMIT/OFFSET và COUNT. Trường resource/project không được chuyển bằng PATCH sau khi tạo, tránh đổi phạm vi trái phép.

Access Public vẫn chỉ xuất hiện ngoài website sau trạng thái Published. Hồ sơ Published/Approved/Submitted/Reviewing/Completed/Archived bị khóa sửa; quản lý mở lại draft qua action `reopen` khi cần sửa. Thay đổi tạo history snapshot và audit. Tệp không ghi đè object cũ.

## RBAC

13 vai trò có thể cấu hình grants trong giao diện: System Admin, Center Admin, Research Manager, Principal Investigator, Researcher, Research Assistant, Reviewer, Ethics Reviewer, Data Manager, Editor, Finance Manager, Member, Guest. Nhóm có vai trò lead/member/advisor theo resource. Các quyền chuyên trách không tự cho phép đọc hồ sơ bất kỳ ngoài phạm vi trong policy.

`users.role` giữ giá trị coarse phục vụ schema, quyền thực tế lấy từ `user_roles` + `role_permissions`, không dựa vào giá trị frontend. Không cache quyền trong token; mỗi request đọc lại quyền/account status.

## Lưu ý vận hành và phạm vi

- Form yêu cầu đăng nhập để nộp phản hồi/upload. Điều này hỗ trợ theo dõi người gửi và kiểm soát tệp; không có anonymous file upload.
- Review dùng rubric bốn tiêu chí, tổng điểm và recommendation. Hệ thống lưu vòng + author response. Attachment phản biện có thể nộp dưới hồ sơ tài liệu của đề tài; không có phòng họp video hoặc đồng soạn thảo Office.
- Hội đồng có chủ trì, danh sách thành viên/vai trò, điểm/nhận xét, lịch, biên bản và kết luận dưới hồ sơ được phân quyền; chưa tích hợp chữ ký số pháp lý hoặc bỏ phiếu kín.
- Profile/nhóm công khai chỉ hiển thị công trình đã published/public. Trường group dùng mã nhóm để liên kết công trình. Avatar chọn tệp ảnh đính kèm hồ sơ profile đã công bố.
- Bộ đếm views/downloads là lượt request, không phải số người duy nhất.
- DOI chỉ là trường nhập DOI đã được cấp; không sinh DOI. Trích dẫn là gợi ý văn bản, không có xác minh metadata từ nhà xuất bản.
- Session 12 giờ. Mật khẩu PBKDF2-SHA256 salt riêng, hash session/reset token trong D1. Không hard-code account/password.


## Pages production: email và bảo trì

- `GET /api/v1/admin/email`: quyền settings; 100 job gần nhất, chỉ metadata, không trả token/payload.
- `POST /api/v1/admin/email/flush`: quyền settings + CSRF; xử lý batch tối đa 4 job đã đến lịch.
- `POST /api/v1/admin/email/retry`: quyền settings + CSRF; body `{ "id": "job-id" }`; chỉ job failed còn trong cửa sổ idempotency, không gửi reset hết hạn; có audit.
- `POST /api/v1/maintenance`: server-to-server, `Authorization: Bearer MAINTENANCE_SECRET` >=32 ký tự; dọn/nhắc hạn và flush email. Không cần session; không cho CORS.
- `POST /api/v1/admin/reset`: trả `url`, `expires_in`, `email_queued`, `email_configured`. Không dùng boolean emailed để khẳng định đã gửi.
- `outbox` không còn trong admin export vì có liên kết reset tạm thời; sao lưu D1 đầy đủ chỉ dành cho người vận hành có quyền Cloudflare.
- Email sent = provider accepted; provider_id dùng đối chiếu dashboard Resend. Không có webhook xác nhận inbox/delivery.

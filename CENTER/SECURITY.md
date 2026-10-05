# Bảo mật & vận hành production

## Biện pháp đã triển khai

- Backend session check + resource/project ACL; role grants đọc lại mỗi request; khóa account/đổi quyền thu hồi phiên.
- Cookie `__Host-sfrc`, Secure, HttpOnly, Path=/, SameSite=Lax, 12 giờ. Token ngẫu nhiên 256 bit; D1 chỉ lưu SHA-256 token.
- Mật khẩu PBKDF2-SHA256 100.000 vòng, salt ngẫu nhiên. Mật khẩu 12–200 ký tự; tài khoản được cấp buộc đổi lần đầu.
- Reset token 30 phút, lưu hash, tiêu thụ một lần; reset/đổi mật khẩu thu hồi phiên.
- CSRF kiểm tra exact Origin + custom header trên mọi thao tác ghi; không bật CORS wildcard.
- Prepared SQL; sort/table export whitelist; các fields không thuộc catalog không được lưu tùy ý.
- Render văn bản có escape, không nhận raw HTML; CSP, frame deny, nosniff, referrer policy, permissions policy.
- Rate limit D1 theo email/IP đăng nhập; thiết lập giới hạn riêng; thao tác ghi theo user. IP trên split-mode chỉ tin khi request đã ký từ App proxy.
- Shared secret HMAC chỉ ở Worker; ký cả body/cookie/origin/custom header, timestamp và nonce. Replay bị chặn. App ghi đè IP proxy trước khi ký; không forward header chữ ký do client cung cấp.
- R2 private, UUID object keys, whitelist loại file, giới hạn body có kiểm soát cả khi không có Content-Length. Download theo hồ sơ và `attachment`; preview chỉ ảnh. Tệp phản hồi form có ACL riêng.
- Dataset chứa dữ liệu cá nhân không được publish. Form không upload ẩn danh.
- Optimistic locking cho hồ sơ/Journey; D1 batch ghi thay đổi và history cùng transaction; phiếu phản biện đã gửi khóa.
- Không cho người tham gia tự duyệt các hồ sơ cần độc lập. Bắt buộc Ethics có hiệu lực trước khi bắt đầu nghiên cứu có người tham gia.
- Audit append-only ở cấp trigger; ghi login, quyền, workflow, review, tệp, export, reset. Người có quyền truy cập trực tiếp DB vẫn có thể thay schema: kiểm soát Cloudflare IAM riêng.

## Checklist trước production

1. Dùng DB/bucket production riêng, chưa seed demo, migration thành công.
2. APP_ORIGIN khớp domain chính; HTTPS hoạt động.
3. Shared secret đủ ngẫu nhiên, giống ở A/B, không có trong source/JS public.
4. Bootstrap admin thành công, xóa SETUP_SECRET nếu không dùng nữa.
5. Thử quyền researcher/reviewer/finance và một tài khoản bị khóa trên staging.
6. Thử upload/download, file private từ tài khoản không được cấp quyền phải thất bại.
7. Thử end-to-end review → approve → ethics → start → acceptance → publish trên staging.
8. Đặt sao lưu D1/R2, người chịu trách nhiệm kiểm tra và diễn tập khôi phục.
9. Cập nhật nội dung liên hệ, quyền riêng tư, quy tắc lưu dữ liệu thực tế qua quản trị.
10. Theo dõi Worker logs và hạn mức D1/R2; tránh bật logs body/cookie/secret. Bảo vệ tài khoản Cloudflare bằng MFA và API token tối thiểu.

## Giới hạn được công bố

Không có antivirus nội dung tệp hoặc chống DDoS cấp ứng dụng chuyên dụng; dùng Cloudflare WAF/rate rules bổ sung khi cần. Thư mục upload không phải môi trường chạy file. Không có client-side encryption cho dataset; confidentiality dựa trên access control và private R2. Audit không thay thế log bên ngoài chống sửa bởi chủ tài khoản Cloudflare. Email adapter chưa có provider; notification in-app là kênh đang hoạt động. Không tích hợp SSO của hệ thống Member/TK cũ trong bản này. Phần mềm vẫn cần cập nhật bảo mật, theo dõi hạn mức và sao lưu khi vận hành lâu dài.

## Xoay khóa và khôi phục

Để xoay shared secret, triển khai cùng giá trị mới ở Data và App trong cửa sổ bảo trì ngắn; yêu cầu có chữ ký cũ có thể tạm bị từ chối. Không bật cơ chế bỏ qua signature. Nếu mất admin, dùng quyền quản trị Cloudflare có thẩm quyền để tạo quy trình khôi phục được audit; không có mật khẩu cửa hậu.

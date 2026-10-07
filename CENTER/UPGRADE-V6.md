# SKY FIRST RESEARCH & INNOVATION — V6 DIGITAL RESEARCH CAMPUS

V6 là rebuild-in-place trên source hiện hữu. Không reset D1/R2, không chạy lại migration 0006 và không thay framework.

## Thay đổi trực tiếp

- Homepage được chuyển thành Digital Research Campus journey, không còn phụ thuộc vào hero + card template cũ. CMS Home vẫn là editorial layer và vẫn dùng published snapshot hiện hữu.
- Thêm trải nghiệm public riêng biệt: `/universe`, `/atlas`, `/observatory`, `/people`, `/knowledge`, `/innovation`.
- Research Universe chỉ dựng node từ public records; zero-data không tạo node giả và có accessible fallback.
- Research Atlas có entity grid + timeline từ public records.
- People Constellation lấy `profiles` công khai và có list fallback.
- Knowledge Explorer dùng Research Finder và hồ sơ nguồn; không tạo knowledge graph giả khi chưa có relationship data.
- Innovation Sandbox thể hiện Idea → Hypothesis → Experiment → Observation → Iteration → Outcome và chỉ liệt kê record thật.
- Research Observatory đếm trực tiếp dữ liệu public hiện tại; zero được giữ nguyên.
- Research Finder mở rộng taxonomy public gồm profiles/teams/impacts/ideas ngoài project/publication/dataset/event/contribution.
- Project workspace được nhận diện là Research Room / Project Digital Twin và tiếp tục dùng cùng record/project/journey/files/members/reviews/history hiện hữu.
- Workspace dashboard được đổi thành Research Command Center: NOW / NEXT / ATTENTION / KNOWLEDGE, pipeline, activity và system status.
- Public navigation fallback bổ sung Universe / Atlas / Observatory.
- HTML ban đầu có nội dung cốt lõi thay vì màn hình loading trống; JavaScript là lớp nâng trải nghiệm. Graph có mobile/list fallback.
- Responsive mới cho 1024 và mobile; không dùng content opacity=0 làm điều kiện hiển thị.

## Không thay đổi dữ liệu production

V6 không yêu cầu migration mới. D1/R2/Auth/Session/RBAC/Audit/CMS/revisions/email/outbox hiện hữu được giữ nguyên.

## Giới hạn trung thực

Không tuyên bố relationship graph sâu khi schema public hiện tại chưa expose relationship graph tổng quát. Universe/Constellation hiện biểu diễn entity thật và fallback thật; quan hệ sâu chỉ nên bổ sung khi backend có nguồn quan hệ canonical. Browser production Cloudflare và D1/R2 production phải được verify sau deploy.

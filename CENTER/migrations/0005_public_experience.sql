-- Production-final public experience defaults.
-- This migration only upgrades the untouched starter CMS pages created by 0004.
-- Any page already edited/published by an administrator is left unchanged.

UPDATE cms_pages
SET title='Trang chủ',
    description='Không gian nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng.',
    seo_title='Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First',
    meta_description='Từ câu hỏi hôm nay đến giải pháp ngày mai — khám phá nghiên cứu, công bố, dữ liệu và hoạt động của Trung tâm.',
    canonical_url='https://research.skyfirst.io.vn/'
WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL;

UPDATE cms_blocks
SET data='{"eyebrow":"SKY FIRST RESEARCH & INNOVATION CENTER","title":"Từ câu hỏi hôm nay. Đến giải pháp ngày mai.","text":"Kết nối câu hỏi, dữ liệu và con người để phát triển những giải pháp có ích trong thực tế.","primaryLabel":"Khám phá nghiên cứu","primaryUrl":"/explore","secondaryLabel":"Về Trung tâm","secondaryUrl":"/about"}'
WHERE id='block-home-hero'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_blocks
SET data='{"heading":"Đi sâu vào những vấn đề có ý nghĩa.","items":[{"title":"Giáo dục & học tập","text":"Hiểu cách con người học, tiếp cận tri thức và phát triển năng lực."},{"title":"Công nghệ & sáng tạo","text":"Thử nghiệm công cụ, phương pháp và mô hình giải quyết vấn đề."},{"title":"Cộng đồng & phát triển","text":"Bắt đầu từ nhu cầu thật và theo dõi tác động sau triển khai."},{"title":"Dữ liệu & tri thức mở","text":"Tổ chức dữ liệu rõ ràng để tri thức có thể được hiểu và tái sử dụng."}]}'
WHERE id='block-home-features'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-home-process','page-home','cards',20,1,'{"heading":"Từ ý tưởng đến tác động thực tế.","items":[{"title":"Tiếp nhận ý tưởng","text":"Làm rõ vấn đề và câu hỏi cần khám phá."},{"title":"Nghiên cứu & phát triển","text":"Thử nghiệm, thu thập dữ liệu và hoàn thiện phương án."},{"title":"Công bố & chia sẻ","text":"Đưa kết quả phù hợp đến cộng đồng một cách có trách nhiệm."},{"title":"Tạo tác động","text":"Theo dõi ứng dụng, phản hồi và cơ hội cải tiến tiếp theo."}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_blocks SET position=30
WHERE id='block-home-cta'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);
UPDATE cms_blocks
SET data='{"title":"Một câu hỏi tốt có thể bắt đầu từ một cuộc trao đổi.","text":"Trao đổi về nghiên cứu, đề xuất ý tưởng hoặc một cơ hội hợp tác phù hợp.","label":"Kết nối cùng Trung tâm","url":"/contact"}'
WHERE id='block-home-cta'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_pages
SET title='Giới thiệu Trung tâm',
    description='Sứ mệnh, cách tiếp cận và các lĩnh vực hoạt động của Trung tâm.',
    seo_title='Giới thiệu Trung tâm · Sky First Research & Innovation Center',
    meta_description='Tìm hiểu sứ mệnh, cách tiếp cận nghiên cứu và các lĩnh vực hoạt động của Trung tâm.',
    canonical_url='https://research.skyfirst.io.vn/about'
WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL;

UPDATE cms_blocks
SET data='{"eyebrow":"VỀ TRUNG TÂM","title":"Nơi những câu hỏi mở ra khả năng mới.","text":"Một không gian nghiên cứu và đổi mới sáng tạo hướng đến những vấn đề có ý nghĩa trong thực tế."}'
WHERE id='block-about-hero'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-about-principles','page-about','feature_grid',10,1,'{"heading":"Nghiên cứu có trách nhiệm, hướng đến thực tiễn.","items":[{"title":"Sứ mệnh","text":"Kết nối con người, tri thức và phương pháp để phát triển các giải pháp hữu ích."},{"title":"Tầm nhìn","text":"Xây dựng môi trường nghiên cứu cởi mở, có trách nhiệm và hướng đến tác động cộng đồng."},{"title":"Giá trị cốt lõi","text":"Trung thực · Hợp tác · Tôn trọng dữ liệu · Học hỏi liên tục."}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-about-fields','page-about','cards',20,1,'{"heading":"Những điểm giao giữa tri thức và thực tiễn.","items":[{"title":"Giáo dục & học tập","text":"Trải nghiệm học tập, tiếp cận tri thức và phát triển năng lực."},{"title":"Công nghệ & sáng tạo","text":"Công cụ và phương pháp mới cho những vấn đề cụ thể."},{"title":"Cộng đồng & phát triển","text":"Nhu cầu cộng đồng, mức độ phù hợp và tác động sau triển khai."},{"title":"Dữ liệu & tri thức mở","text":"Cách tổ chức, mô tả và chia sẻ tri thức có trách nhiệm."}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-about-approach','page-about','cards',30,1,'{"heading":"Rõ câu hỏi. Rõ dữ liệu. Rõ tác động.","items":[{"title":"Lắng nghe","text":"Bắt đầu từ bối cảnh và nhu cầu thực tế."},{"title":"Kiểm chứng","text":"Dùng dữ liệu, phương pháp và phản biện để làm rõ giả định."},{"title":"Chia sẻ","text":"Công bố phù hợp với mức độ sẵn sàng và quyền truy cập."},{"title":"Học lại","text":"Quan sát tác động để tiếp tục cải tiến."}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-about-cta','page-about','cta',40,1,'{"title":"Có một câu hỏi, đề xuất hay cơ hội hợp tác?","text":"Bắt đầu bằng một cuộc trao đổi rõ ràng.","label":"Kết nối cùng Trung tâm","url":"/contact"}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-about' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_pages
SET title='Kết nối cùng Trung tâm',
    description='Các kênh liên hệ chính thức dành cho nghiên cứu, hợp tác và hỗ trợ.',
    seo_title='Kết nối cùng Trung tâm · Sky First Research & Innovation Center',
    meta_description='Liên hệ Trung tâm về hợp tác nghiên cứu, đề xuất ý tưởng, truyền thông và hỗ trợ hệ thống.',
    canonical_url='https://research.skyfirst.io.vn/contact'
WHERE id='page-contact' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL;

UPDATE cms_blocks
SET data='{"eyebrow":"KẾT NỐI","title":"Bắt đầu bằng một trao đổi rõ ràng.","text":"Chọn đúng đầu mối để câu hỏi của bạn được tiếp nhận nhanh hơn."}'
WHERE id='block-contact-hero'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-contact' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-contact-intents','page-contact','feature_grid',10,1,'{"heading":"Bạn muốn trao đổi về điều gì?","items":[{"title":"Hợp tác nghiên cứu","text":"Đề tài, nghiên cứu chung hoặc nguồn lực chuyên môn."},{"title":"Đề xuất ý tưởng","text":"Một vấn đề, nhu cầu hoặc hướng thử nghiệm đáng khám phá."},{"title":"Truyền thông / đối tác","text":"Nội dung công khai, hoạt động hoặc cơ hội phối hợp phù hợp."},{"title":"Hỗ trợ hệ thống","text":"Tài khoản, quyền truy cập hoặc vấn đề kỹ thuật."}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-contact' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_blocks SET position=20,
  data='{"heading":"Kênh liên hệ chính thức","items":[{"title":"Email Trung tâm","text":"research@skyfirst.io.vn","url":"mailto:research@skyfirst.io.vn"},{"title":"Email hỗ trợ","text":"support@skyfirst.io.vn","url":"mailto:support@skyfirst.io.vn"},{"title":"Hotline/Zalo","text":"0924 910 210","url":"tel:0924910210"},{"title":"Website","text":"research.skyfirst.io.vn","url":"https://research.skyfirst.io.vn"}]}'
WHERE id='block-contact-links'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-contact' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_pages
SET seo_title='Quyền riêng tư & sử dụng dữ liệu · Sky First Research & Innovation Center',
    meta_description='Nguyên tắc sử dụng dữ liệu và quyền truy cập trong hệ thống nghiên cứu Sky First.',
    canonical_url='https://research.skyfirst.io.vn/privacy'
WHERE id='page-privacy' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL;

-- Starter pages remain Draft by design.
-- This preserves the CMS Draft → Preview → Publish workflow; public fallback layout remains available until an administrator publishes.

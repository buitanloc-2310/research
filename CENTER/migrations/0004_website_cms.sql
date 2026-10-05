-- Additive Website CMS + resilient public site schema.
-- Safe for existing production data: creates new tables only and inserts defaults with OR IGNORE.
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS site_settings(
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_pages(
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  seo_title TEXT NOT NULL DEFAULT '',
  meta_description TEXT NOT NULL DEFAULT '',
  social_media_id TEXT,
  canonical_url TEXT NOT NULL DEFAULT '',
  noindex INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN('draft','published')),
  published_snapshot TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  updated_by TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cms_blocks(
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN('hero','heading','rich_text','image','cta','statistics','cards','feature_grid','partners','faq')),
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_blocks_page_position ON cms_blocks(page_id,position);

CREATE TABLE IF NOT EXISTS cms_navigation(
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  external INTEGER NOT NULL DEFAULT 0,
  new_tab INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_navigation_position ON cms_navigation(position);

CREATE TABLE IF NOT EXISTS cms_footer_links(
  id TEXT PRIMARY KEY,
  column_key TEXT NOT NULL,
  heading TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_footer_position ON cms_footer_links(column_key,position);

CREATE TABLE IF NOT EXISTS cms_media(
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN('private','public')),
  uploaded_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_media_created ON cms_media(created_at);

INSERT OR IGNORE INTO site_settings(key,value) VALUES
 ('center_name','TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST'),
 ('english_name','SKY FIRST RESEARCH & INNOVATION CENTER'),
 ('tagline','Nghiên cứu sâu hơn. Đổi mới có trách nhiệm. Tạo tác động bền vững.'),
 ('description','Không gian kết nối nghiên cứu, đổi mới sáng tạo, tri thức và những giải pháp tạo tác động tích cực cho cộng đồng.'),
 ('website','https://research.skyfirst.io.vn'),
 ('hotline','0924 910 210'),
 ('email','research@skyfirst.io.vn'),
 ('support_email','support@skyfirst.io.vn'),
 ('facebook','https://fb.com/skyfirstnetwork'),
 ('facebook_group','https://fb.com/groups/sfn.network'),
 ('logo_media_id',''),
 ('favicon_media_id',''),
 ('copyright','© 2026 Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First.');

INSERT OR IGNORE INTO cms_navigation(id,label,url,position,enabled,external,new_tab) VALUES
 ('nav-home','Trang chủ','/',0,1,0,0),
 ('nav-about','Trung tâm','/about',10,1,0,0),
 ('nav-explore','Khám phá','/explore',20,1,0,0),
 ('nav-publications','Công bố','/explore?kind=publications',30,1,0,0),
 ('nav-events','Sự kiện','/explore?kind=events',40,1,0,0),
 ('nav-contact','Kết nối','/contact',50,1,0,0);

INSERT OR IGNORE INTO cms_footer_links(id,column_key,heading,label,url,position,enabled) VALUES
 ('foot-center-about','center','Trung tâm','Giới thiệu','/about',0,1),
 ('foot-center-contact','center','Trung tâm','Liên hệ','/contact',10,1),
 ('foot-center-privacy','center','Trung tâm','Quyền riêng tư','/privacy',20,1),
 ('foot-discover-explore','discover','Khám phá','Kho nghiên cứu','/explore',0,1),
 ('foot-discover-publications','discover','Khám phá','Công bố','/explore?kind=publications',10,1),
 ('foot-discover-datasets','discover','Khám phá','Dataset','/explore?kind=datasets',20,1),
 ('foot-eco-main','ecosystem','Hệ sinh thái Sky First','Trang Thông tin Sky First Network','https://skyfirst.io.vn',0,1),
 ('foot-eco-ctt','ecosystem','Hệ sinh thái Sky First','Cổng Thông tin Sky First','https://ctt.skyfirst.io.vn',10,1),
 ('foot-eco-tnv','ecosystem','Hệ sinh thái Sky First','Trung tâm Tình nguyện viên Sky First','https://tnv.skyfirst.io.vn',20,1),
 ('foot-eco-member','ecosystem','Hệ sinh thái Sky First','Trung tâm Thành viên số Sky First','https://member.skyfirst.io.vn',30,1),
 ('foot-eco-slc','ecosystem','Hệ sinh thái Sky First','Sky First Learning Center','https://slc.skyfirst.io.vn',40,1),
 ('foot-connect-facebook','connect','Kết nối','Facebook','https://fb.com/skyfirstnetwork',0,1),
 ('foot-connect-group','connect','Kết nối','Cộng đồng Facebook','https://fb.com/groups/sfn.network',10,1),
 ('foot-connect-phone','connect','Kết nối','Hotline/Zalo: 0924 910 210','tel:0924910210',20,1),
 ('foot-connect-email','connect','Kết nối','Email Trung tâm','mailto:research@skyfirst.io.vn',30,1),
 ('foot-connect-support','connect','Kết nối','Email hỗ trợ','mailto:support@skyfirst.io.vn',40,1);

INSERT OR IGNORE INTO cms_pages(id,slug,title,description,status) VALUES
 ('page-home','home','Trang chủ','Trang chủ Trung tâm','draft'),
 ('page-about','about','Giới thiệu Trung tâm','Thông tin về Trung tâm','draft'),
 ('page-contact','contact','Kết nối cùng Trung tâm','Thông tin liên hệ và hợp tác','draft'),
 ('page-privacy','privacy','Quyền riêng tư & sử dụng dữ liệu','Chính sách quyền riêng tư','draft');

INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data) VALUES
 ('block-home-hero','page-home','hero',0,1,'{"eyebrow":"SKY FIRST RESEARCH & INNOVATION CENTER","title":"Từ câu hỏi hôm nay đến giải pháp ngày mai.","text":"Một không gian để kết nối ý tưởng, phát triển nghiên cứu và cùng tạo nên những thay đổi có ý nghĩa.","primaryLabel":"Khám phá nghiên cứu","primaryUrl":"/explore","secondaryLabel":"Đề xuất ý tưởng","secondaryUrl":"/#w/ideas"}'),
 ('block-home-features','page-home','feature_grid',10,1,'{"heading":"Tri thức gặp thực tiễn.","items":[{"title":"Giáo dục & học tập","text":"Nghiên cứu trải nghiệm học tập và cơ hội tiếp cận tri thức."},{"title":"Công nghệ & sáng tạo","text":"Thử nghiệm những cách giải quyết vấn đề mới."},{"title":"Cộng đồng & phát triển","text":"Lắng nghe nhu cầu và đo lường tác động thực tế."}]}'),
 ('block-home-cta','page-home','cta',20,1,'{"title":"Một ý tưởng tốt bắt đầu bằng một cuộc trao đổi.","label":"Kết nối nghiên cứu","url":"/contact"}'),
 ('block-about-hero','page-about','hero',0,1,'{"eyebrow":"VỀ TRUNG TÂM","title":"Nơi những câu hỏi mở ra khả năng mới.","text":"Trung tâm kết nối nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng."}'),
 ('block-contact-hero','page-contact','hero',0,1,'{"eyebrow":"KẾT NỐI","title":"Kết nối cùng SKY FIRST","text":"Trao đổi về nghiên cứu, đổi mới sáng tạo và cơ hội hợp tác."}'),
 ('block-contact-links','page-contact','cards',10,1,'{"items":[{"title":"Email Trung tâm","text":"research@skyfirst.io.vn","url":"mailto:research@skyfirst.io.vn"},{"title":"Hotline/Zalo","text":"0924 910 210","url":"tel:0924910210"},{"title":"Website","text":"research.skyfirst.io.vn","url":"https://research.skyfirst.io.vn"}]}'),
 ('block-privacy-text','page-privacy','rich_text',0,1,'{"heading":"Quyền riêng tư & sử dụng dữ liệu","text":"Hệ thống lưu thông tin tài khoản và hồ sơ bạn gửi để phục vụ quản lý nghiên cứu. Hồ sơ nội bộ và tệp đính kèm được truy cập theo quyền; nội dung chỉ xuất hiện công khai sau khi được duyệt công bố."}');

-- Research Cloud V3 — additive CMS/editor/media enhancements.
-- No destructive operations. Existing pages, published snapshots, media objects and identities are preserved.

CREATE TABLE IF NOT EXISTS cms_revisions(
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  revision_no INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'edit',
  snapshot TEXT NOT NULL,
  actor_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cms_revisions_page_created ON cms_revisions(page_id,created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS cms_revisions_page_no ON cms_revisions(page_id,revision_no);
CREATE INDEX IF NOT EXISTS cms_pages_status_updated ON cms_pages(status,updated_at DESC);

ALTER TABLE cms_navigation ADD COLUMN parent_id TEXT;
CREATE INDEX IF NOT EXISTS cms_navigation_parent_position ON cms_navigation(parent_id,position,id);

ALTER TABLE cms_media ADD COLUMN width INTEGER;
ALTER TABLE cms_media ADD COLUMN height INTEGER;
ALTER TABLE cms_media ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE cms_media ADD COLUMN updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS cms_media_name ON cms_media(name);
CREATE INDEX IF NOT EXISTS cms_media_mime_created ON cms_media(mime,created_at DESC);
CREATE INDEX IF NOT EXISTS cms_media_visibility_created ON cms_media(visibility,created_at DESC);

INSERT OR IGNORE INTO site_settings(key,value) VALUES
 ('global_seo_title','Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First'),
 ('global_seo_description','Nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng.'),
 ('default_social_media_id',''),
 ('theme_color','#0759A6');

-- Complete the untouched starter Home with a CMS-managed knowledge portal section.
INSERT OR IGNORE INTO cms_blocks(id,page_id,type,position,enabled,data)
SELECT 'block-home-portals','page-home','cards',30,1,'{"heading":"Không gian tri thức & dữ liệu","items":[{"title":"Công bố khoa học","text":"Kết quả, báo cáo và bài viết đã được công khai.","url":"/explore?kind=publications"},{"title":"Dataset","text":"Nguồn dữ liệu đi kèm mô tả và điều kiện sử dụng.","url":"/explore?kind=datasets"},{"title":"Sự kiện & hội thảo","text":"Không gian trao đổi, học thuật và hoạt động kết nối.","url":"/explore?kind=events"}]}'
WHERE EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

UPDATE cms_blocks SET position=40
WHERE id='block-home-cta'
  AND EXISTS(SELECT 1 FROM cms_pages WHERE id='page-home' AND status='draft' AND published_snapshot IS NULL AND updated_by IS NULL);

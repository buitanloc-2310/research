import { uuid, fail, boundedBody } from "./security.js";
import { all, one, run, stmt, audit } from "./db.js";
import { requirePerm } from "./policy.js";

const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { "cache-control": "no-store", ...headers } });
const PUBLIC_CACHE = { "cache-control": "public,max-age=30,s-maxage=120,stale-while-revalidate=300" };
const text = (v, max = 10000) => String(v ?? "").trim().slice(0, max);
const BLOCK_TYPES = new Set(["hero","heading","rich_text","image","cta","statistics","cards","feature_grid","partners","faq"]);
const SITE_KEYS = new Set(["center_name","english_name","tagline","description","website","hotline","email","support_email","facebook","facebook_group","logo_media_id","favicon_media_id","copyright"]);
const safeUrl = (v, allowRelative = true) => {
  v = text(v, 2000);
  if (!v) return "";
  if (allowRelative && (/^\/(?!\/)/.test(v) || /^#/.test(v))) return v;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  fail(400, "URL không hợp lệ.");
};
const cleanBlockData = (type, raw = {}) => {
  const d = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = {};
  const copy = (k, max = 4000) => { if (d[k] !== undefined) out[k] = text(d[k], max); };
  if (["hero","heading"].includes(type)) {
    copy("eyebrow",160); copy("title",500); copy("text",5000);
    if (type === "hero") {
      copy("primaryLabel",120); copy("secondaryLabel",120);
      out.primaryUrl = safeUrl(d.primaryUrl || ""); out.secondaryUrl = safeUrl(d.secondaryUrl || "");
    }
  } else if (type === "rich_text") {
    copy("heading",500); copy("text",20000);
  } else if (type === "image") {
    copy("media_id",100); copy("alt",500); copy("caption",2000);
  } else if (type === "cta") {
    copy("title",500); copy("text",5000); copy("label",120); out.url = safeUrl(d.url || "");
  } else if (["statistics","cards","feature_grid","partners","faq"].includes(type)) {
    copy("heading",500);
    out.items = (Array.isArray(d.items) ? d.items : []).slice(0,50).map((item) => {
      const x = item && typeof item === "object" ? item : {};
      if (type === "statistics") return { value:text(x.value,100), label:text(x.label,300) };
      const y = { title:text(x.title ?? x.question,500), text:text(x.text ?? x.answer,5000) };
      if (x.url) y.url = safeUrl(x.url);
      if (x.media_id) y.media_id = text(x.media_id,100);
      return y;
    });
  }
  return out;
};
async function requestBody(req) {
  let d;
  try { d = JSON.parse(new TextDecoder().decode(await boundedBody(req, 300000))); }
  catch (e) { if (e.status) throw e; fail(400, "JSON không hợp lệ."); }
  if (!d || typeof d !== "object" || Array.isArray(d)) fail(400, "Nội dung yêu cầu không hợp lệ.");
  return d;
}
const parseJson = (v, fallback = {}) => { try { return JSON.parse(v || ""); } catch { return fallback; } };
const pagePayload = async (env, page, published = false) => {
  if (published) return parseJson(page.published_snapshot, null);
  const blocks = await all(env, "SELECT id,type,position,enabled,data FROM cms_blocks WHERE page_id=? ORDER BY position,id", page.id);
  return {
    id: page.id, slug: page.slug, title: page.title, description: page.description,
    seo_title: page.seo_title, meta_description: page.meta_description,
    social_media_id: page.social_media_id, canonical_url: page.canonical_url,
    noindex: !!page.noindex, status: page.status, version: page.version,
    blocks: blocks.map(b => ({...b, enabled: !!b.enabled, data: parseJson(b.data,{})})),
    published_at: page.published_at,
  };
};
const validateSlug = (v) => {
  v = text(v, 100).toLowerCase().replace(/^\/+|\/+$/g, "");
  if (v === "") return "home";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v)) fail(400, "Slug chỉ gồm chữ thường, số và dấu gạch nối.");
  return v;
};
async function setMediaPublic(env, ids) {
  ids = [...new Set(ids.filter(Boolean))];
  if (!ids.length) return;
  for (const id of ids) await run(env, "UPDATE cms_media SET visibility='public' WHERE id=?", id);
}
function mediaIdsFromSnapshot(snapshot) {
  const ids = new Set();
  if (snapshot?.social_media_id) ids.add(snapshot.social_media_id);
  for (const b of snapshot?.blocks || []) {
    for (const key of ["media_id","image_media_id","background_media_id"]) if (b.data?.[key]) ids.add(b.data[key]);
    for (const item of b.data?.items || []) for (const key of ["media_id","image_media_id"]) if (item?.[key]) ids.add(item[key]);
  }
  return [...ids];
}
async function mediaIsPubliclyReferenced(env, id) {
  if (await one(env, "SELECT 1 FROM site_settings WHERE value=? AND key IN ('logo_media_id','favicon_media_id')", id)) return true;
  return !!(await one(env, "SELECT 1 FROM cms_pages WHERE status='published' AND published_snapshot IS NOT NULL AND (social_media_id=? OR published_snapshot LIKE ?) LIMIT 1", id, `%${id}%`));
}

export async function publicCms(req, env, p) {
  if (p === "/api/public/pages") {
    return json({ items: await all(env, "SELECT slug,title,published_at FROM cms_pages WHERE status='published' AND published_snapshot IS NOT NULL ORDER BY slug") }, 200, PUBLIC_CACHE);
  }
  if (p === "/api/public/site") {
    const settingsRows = await all(env,"SELECT key,value FROM site_settings");
    const legacyRows = await all(env,"SELECT key,value FROM settings WHERE key IN ('intro','mission','vision','values','contact')");
    const settings = {
      ...Object.fromEntries(settingsRows.map(x=>[x.key,x.value])),
      ...Object.fromEntries(legacyRows.map(x=>[x.key,x.value])),
    };
    const navigation = await all(env,"SELECT id,label,url,position,external,new_tab FROM cms_navigation WHERE enabled=1 ORDER BY position,id");
    const footer = await all(env,"SELECT id,column_key,heading,label,url,position FROM cms_footer_links WHERE enabled=1 ORDER BY column_key,position,id");
    return json({settings,navigation:navigation.map(x=>({...x,external:!!x.external,new_tab:!!x.new_tab})),footer},200,PUBLIC_CACHE);
  }
  const pageMatch = p.match(/^\/api\/public\/pages\/([^/]+)$/);
  if (pageMatch) {
    const slug = validateSlug(decodeURIComponent(pageMatch[1]));
    const page = await one(env,"SELECT * FROM cms_pages WHERE slug=? AND status='published' AND published_snapshot IS NOT NULL",slug);
    if (!page) fail(404,"Trang chưa được công bố.");
    return json({page:await pagePayload(env,page,true)},200,PUBLIC_CACHE);
  }
  const mediaMatch = p.match(/^\/api\/public\/media\/([^/]+)$/);
  if (mediaMatch) {
    const media = await one(env,"SELECT * FROM cms_media WHERE id=? AND visibility='public'",mediaMatch[1]);
    if (!media || !(await mediaIsPubliclyReferenced(env, media.id))) fail(404,"Không tìm thấy media.");
    const object = await env.STORAGE?.get(media.object_key);
    if (!object) fail(404,"Media chưa có trên storage.");
    return new Response(object.body,{headers:{"content-type":media.mime,"content-length":String(media.size),"cache-control":"public,max-age=3600","content-disposition":`inline; filename*=UTF-8''${encodeURIComponent(media.name)}`}});
  }
  return null;
}

export async function adminCms(req, env, u, p, method) {
  if (!p.startsWith("/api/admin/cms/")) return null;
  requirePerm(u,"settings");

  if (p === "/api/admin/cms/site") {
    if (method === "GET") return json({settings:Object.fromEntries((await all(env,"SELECT key,value FROM site_settings")).map(x=>[x.key,x.value]))});
    if (method !== "PATCH") fail(405,"Phương thức không hỗ trợ.");
    const b=await requestBody(req), q=[];
    for (const [k,v0] of Object.entries(b)) {
      if (!SITE_KEYS.has(k)) continue;
      let v=text(v0, k.includes("description")?10000:2000);
      if (["website","facebook","facebook_group"].includes(k) && v) v=safeUrl(v,false);
      if (["email","support_email"].includes(k) && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) fail(400,"Email không hợp lệ.");
      if (["logo_media_id","favicon_media_id"].includes(k) && v && !(await one(env,"SELECT 1 FROM cms_media WHERE id=? AND mime LIKE 'image/%'",v))) fail(400,"Logo/favicon phải là media hình ảnh hợp lệ.");
      q.push(stmt(env,"INSERT INTO site_settings(key,value,updated_by,updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_by=excluded.updated_by,updated_at=CURRENT_TIMESTAMP",k,v,u.id));
    }
    await env.DB.batch([...q,audit(env,u,"cms_site_settings",null,{keys:Object.keys(b).filter(k=>SITE_KEYS.has(k))})]);
    await setMediaPublic(env,[b.logo_media_id,b.favicon_media_id]);
    return json({ok:true});
  }

  if (p === "/api/admin/cms/navigation") {
    if (method === "GET") return json({items:await all(env,"SELECT * FROM cms_navigation ORDER BY position,id")});
    const b=await requestBody(req);
    if (method === "POST") {
      const id=uuid();
      await env.DB.batch([stmt(env,"INSERT INTO cms_navigation(id,label,url,position,enabled,external,new_tab) VALUES(?,?,?,?,?,?,?)",id,text(b.label,120),safeUrl(b.url),Number.isFinite(+b.position)?+b.position:0,b.enabled===false?0:1,b.external?1:0,b.new_tab?1:0),audit(env,u,"cms_nav_create",id)]);
      return json({id},201);
    }
    if (method === "PATCH") {
      if (!b.id || !(await one(env,"SELECT 1 FROM cms_navigation WHERE id=?",b.id))) fail(404,"Mục menu không tồn tại.");
      await env.DB.batch([stmt(env,"UPDATE cms_navigation SET label=?,url=?,position=?,enabled=?,external=?,new_tab=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",text(b.label,120),safeUrl(b.url),Number.isFinite(+b.position)?+b.position:0,b.enabled?1:0,b.external?1:0,b.new_tab?1:0,b.id),audit(env,u,"cms_nav_update",b.id)]);
      return json({ok:true});
    }
    if (method === "DELETE") { if(!b.id) fail(400,"Thiếu id."); await env.DB.batch([stmt(env,"DELETE FROM cms_navigation WHERE id=?",b.id),audit(env,u,"cms_nav_delete",b.id)]); return json({ok:true}); }
    fail(405,"Phương thức không hỗ trợ.");
  }

  if (p === "/api/admin/cms/footer") {
    if (method === "GET") return json({items:await all(env,"SELECT * FROM cms_footer_links ORDER BY column_key,position,id")});
    const b=await requestBody(req);
    if (method === "POST") { const id=uuid(); await env.DB.batch([stmt(env,"INSERT INTO cms_footer_links(id,column_key,heading,label,url,position,enabled) VALUES(?,?,?,?,?,?,?)",id,text(b.column_key,60),text(b.heading,120),text(b.label,160),safeUrl(b.url),Number.isFinite(+b.position)?+b.position:0,b.enabled===false?0:1),audit(env,u,"cms_footer_create",id)]); return json({id},201); }
    if (method === "PATCH") { if(!b.id||!(await one(env,"SELECT 1 FROM cms_footer_links WHERE id=?",b.id))) fail(404,"Liên kết footer không tồn tại."); await env.DB.batch([stmt(env,"UPDATE cms_footer_links SET column_key=?,heading=?,label=?,url=?,position=?,enabled=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",text(b.column_key,60),text(b.heading,120),text(b.label,160),safeUrl(b.url),Number.isFinite(+b.position)?+b.position:0,b.enabled?1:0,b.id),audit(env,u,"cms_footer_update",b.id)]); return json({ok:true}); }
    if (method === "DELETE") { if(!b.id) fail(400,"Thiếu id."); await env.DB.batch([stmt(env,"DELETE FROM cms_footer_links WHERE id=?",b.id),audit(env,u,"cms_footer_delete",b.id)]); return json({ok:true}); }
    fail(405,"Phương thức không hỗ trợ.");
  }

  if (p === "/api/admin/cms/pages") {
    if (method === "GET") return json({items:await all(env,"SELECT id,slug,title,description,status,version,published_at,updated_at FROM cms_pages ORDER BY CASE slug WHEN 'home' THEN 0 ELSE 1 END,slug")});
    if (method === "POST") { const b=await requestBody(req),id=uuid(),slug=validateSlug(b.slug); await env.DB.batch([stmt(env,"INSERT INTO cms_pages(id,slug,title,description,created_by,updated_by) VALUES(?,?,?,?,?,?)",id,slug,text(b.title,240)||slug,text(b.description,1000),u.id,u.id),audit(env,u,"cms_page_create",id,{slug})]); return json({id},201); }
    fail(405,"Phương thức không hỗ trợ.");
  }

  const pageMatch=p.match(/^\/api\/admin\/cms\/pages\/([^/]+)(?:\/(preview|publish|reorder))?$/);
  if (pageMatch) {
    const id=pageMatch[1], op=pageMatch[2], page=await one(env,"SELECT * FROM cms_pages WHERE id=?",id);
    if(!page) fail(404,"Trang không tồn tại.");
    if (!op && method === "GET") return json({page:await pagePayload(env,page,false),published:await pagePayload(env,page,true)});
    if (!op && method === "PATCH") {
      const b=await requestBody(req);
      if (+b.version !== page.version) fail(409,"Trang đã thay đổi. Tải lại trước khi lưu.");
      const slug=b.slug===undefined?page.slug:validateSlug(b.slug);
      const canonical=b.canonical_url===undefined?page.canonical_url:safeUrl(b.canonical_url,false);
      if (b.social_media_id && !(await one(env,"SELECT 1 FROM cms_media WHERE id=? AND mime LIKE 'image/%'",b.social_media_id))) fail(400,"Social image phải là hình ảnh hợp lệ.");
      await env.DB.batch([stmt(env,"UPDATE cms_pages SET slug=?,title=?,description=?,seo_title=?,meta_description=?,social_media_id=?,canonical_url=?,noindex=?,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?",slug,text(b.title??page.title,240),text(b.description??page.description,2000),text(b.seo_title??page.seo_title,240),text(b.meta_description??page.meta_description,500),text(b.social_media_id??page.social_media_id,100),canonical,b.noindex?1:0,u.id,id,page.version),audit(env,u,"cms_page_update",id,{slug})]);
      return json({ok:true,version:page.version+1});
    }
    if (!op && method === "DELETE") {
      if (["home","about","contact","privacy"].includes(page.slug)) fail(409,"Trang hệ thống không được xóa; hãy tắt nội dung bằng block hoặc noindex nếu cần.");
      await env.DB.batch([stmt(env,"DELETE FROM cms_pages WHERE id=?",id),audit(env,u,"cms_page_delete",id)]); return json({ok:true});
    }
    if (op === "preview" && method === "GET") return json({page:await pagePayload(env,page,false)});
    if (op === "reorder" && method === "POST") {
      const b=await requestBody(req); if(!Array.isArray(b.ids)) fail(400,"Danh sách block không hợp lệ.");
      const existing=await all(env,"SELECT id FROM cms_blocks WHERE page_id=?",id), allowed=new Set(existing.map(x=>x.id));
      if(b.ids.length!==existing.length||b.ids.some(x=>!allowed.has(x))) fail(400,"Danh sách block không khớp trang.");
      await env.DB.batch([...b.ids.map((bid,i)=>stmt(env,"UPDATE cms_blocks SET position=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND page_id=?",i*10,bid,id)),stmt(env,"UPDATE cms_pages SET version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",u.id,id),audit(env,u,"cms_blocks_reorder",id)]); return json({ok:true});
    }
    if (op === "publish" && method === "POST") {
      requirePerm(u,"publish");
      const snapshot=await pagePayload(env,page,false);
      if(!snapshot.title || !snapshot.blocks.some(b=>b.enabled)) fail(400,"Trang cần tiêu đề và ít nhất một block đang bật.");
      if(snapshot.canonical_url && !/^https:\/\/research\.skyfirst\.io\.vn(?:\/|$)/i.test(snapshot.canonical_url)) fail(400,"Canonical production phải thuộc research.skyfirst.io.vn.");
      const mediaIds=mediaIdsFromSnapshot(snapshot);
      for (const mediaId of mediaIds) if (!(await one(env,"SELECT 1 FROM cms_media WHERE id=? AND mime LIKE 'image/%'",mediaId))) fail(400,"Trang tham chiếu media hình ảnh không tồn tại hoặc không hợp lệ.");
      const serialized=JSON.stringify({...snapshot,status:"published",published_at:new Date().toISOString()});
      await env.DB.batch([stmt(env,"UPDATE cms_pages SET status='published',published_snapshot=?,published_at=CURRENT_TIMESTAMP,version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",serialized,u.id,id),audit(env,u,"cms_page_publish",id,{slug:page.slug})]);
      await setMediaPublic(env,mediaIds);
      return json({ok:true});
    }
    fail(405,"Phương thức không hỗ trợ.");
  }

  const blockMatch=p.match(/^\/api\/admin\/cms\/blocks\/([^/]+)$/);
  if (p === "/api/admin/cms/blocks" && method === "POST") {
    const b=await requestBody(req); if(!b.page_id||!(await one(env,"SELECT 1 FROM cms_pages WHERE id=?",b.page_id))) fail(404,"Trang không tồn tại.");
    if(!BLOCK_TYPES.has(b.type)) fail(400,"Loại block không hợp lệ.");
    const id=uuid(), max=await one(env,"SELECT COALESCE(MAX(position),-10) p FROM cms_blocks WHERE page_id=?",b.page_id);
    await env.DB.batch([stmt(env,"INSERT INTO cms_blocks(id,page_id,type,position,enabled,data) VALUES(?,?,?,?,?,?)",id,b.page_id,b.type,(max?.p??-10)+10,b.enabled===false?0:1,JSON.stringify(cleanBlockData(b.type,b.data))),stmt(env,"UPDATE cms_pages SET version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",u.id,b.page_id),audit(env,u,"cms_block_create",id,{page:b.page_id,type:b.type})]); return json({id},201);
  }
  if (blockMatch) {
    const block=await one(env,"SELECT * FROM cms_blocks WHERE id=?",blockMatch[1]); if(!block) fail(404,"Block không tồn tại.");
    if(method === "PATCH") { const b=await requestBody(req); const type=b.type??block.type; if(!BLOCK_TYPES.has(type)) fail(400,"Loại block không hợp lệ."); await env.DB.batch([stmt(env,"UPDATE cms_blocks SET type=?,enabled=?,data=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",type,b.enabled===undefined?block.enabled:(b.enabled?1:0),JSON.stringify(cleanBlockData(type,b.data??parseJson(block.data,{}))),block.id),stmt(env,"UPDATE cms_pages SET version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",u.id,block.page_id),audit(env,u,"cms_block_update",block.id,{page:block.page_id})]); return json({ok:true}); }
    if(method === "DELETE") { await env.DB.batch([stmt(env,"DELETE FROM cms_blocks WHERE id=?",block.id),stmt(env,"UPDATE cms_pages SET version=version+1,updated_by=?,updated_at=CURRENT_TIMESTAMP WHERE id=?",u.id,block.page_id),audit(env,u,"cms_block_delete",block.id,{page:block.page_id})]); return json({ok:true}); }
    fail(405,"Phương thức không hỗ trợ.");
  }

  if (p === "/api/admin/cms/media") {
    if(method === "GET") { const q=text(new URL(req.url).searchParams.get("q"),120); return json({items:await all(env,"SELECT id,name,mime,size,alt_text,visibility,created_at FROM cms_media WHERE name LIKE ? OR alt_text LIKE ? ORDER BY created_at DESC LIMIT 300",`%${q}%`,`%${q}%`)}); }
    if(method === "POST") {
      if(!env.STORAGE) fail(503,"R2 STORAGE chưa được cấu hình.");
      const url=new URL(req.url), name=text(url.searchParams.get("name"),180).replace(/[\\/\r\n\x00-\x1f]/g,"_");
      const ext=(name.split(".").pop()||"").toLowerCase(), types={png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",gif:"image/gif",pdf:"application/pdf"};
      if(!types[ext]) fail(400,"Media chỉ hỗ trợ PNG, JPG, WEBP, GIF hoặc PDF.");
      const bytes=await boundedBody(req,10*1024*1024); if(!bytes.length) fail(400,"Tệp rỗng.");
      const head=new TextDecoder("latin1").decode(bytes.slice(0,12));
      const valid = ext==="png" ? bytes.length>=8 && [137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)
        : ["jpg","jpeg"].includes(ext) ? bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff
        : ext==="gif" ? /^GIF8[79]a/.test(head)
        : ext==="webp" ? head.slice(0,4)==="RIFF" && head.slice(8,12)==="WEBP"
        : ext==="pdf" ? head.startsWith("%PDF-") : false;
      if(!valid) fail(400,"Nội dung tệp không khớp định dạng.");
      const id=uuid(), key=`cms/${new Date().toISOString().slice(0,10)}/${id}/${name}`;
      await env.STORAGE.put(key,bytes,{httpMetadata:{contentType:types[ext]}});
      try { await env.DB.batch([stmt(env,"INSERT INTO cms_media(id,object_key,name,mime,size,alt_text,visibility,uploaded_by) VALUES(?,?,?,?,?,?,?,?)",id,key,name,types[ext],bytes.length,text(url.searchParams.get("alt"),300),"private",u.id),audit(env,u,"cms_media_upload",id,{name,size:bytes.length})]); }
      catch(e){ await env.STORAGE.delete(key); throw e; }
      return json({id,name},201);
    }
    fail(405,"Phương thức không hỗ trợ.");
  }
  const mediaMatch=p.match(/^\/api\/admin\/cms\/media\/([^/]+)$/);
  if(mediaMatch) {
    const media=await one(env,"SELECT * FROM cms_media WHERE id=?",mediaMatch[1]); if(!media) fail(404,"Media không tồn tại.");
    if(method === "GET") { const object=await env.STORAGE?.get(media.object_key); if(!object) fail(404,"Media chưa có trên R2."); return new Response(object.body,{headers:{"content-type":media.mime,"content-length":String(media.size),"cache-control":"private,no-store","content-disposition":`inline; filename*=UTF-8''${encodeURIComponent(media.name)}`}}); }
    if(method === "PATCH") { const b=await requestBody(req); await env.DB.batch([stmt(env,"UPDATE cms_media SET alt_text=? WHERE id=?",text(b.alt_text,300),media.id),audit(env,u,"cms_media_update",media.id)]); return json({ok:true}); }
    if(method === "DELETE") {
      const refs=[];
      const sites=await all(env,"SELECT key FROM site_settings WHERE value=? AND key IN ('logo_media_id','favicon_media_id')",media.id); refs.push(...sites.map(x=>`site:${x.key}`));
      const pages=await all(env,"SELECT id,slug FROM cms_pages WHERE social_media_id=? OR published_snapshot LIKE ?",media.id,`%${media.id}%`); refs.push(...pages.map(x=>`page:${x.slug}`));
      const blocks=await all(env,"SELECT id,page_id FROM cms_blocks WHERE data LIKE ?",`%${media.id}%`); refs.push(...blocks.map(x=>`block:${x.id}`));
      if(refs.length) fail(409,"Media đang được sử dụng: "+refs.slice(0,8).join(", "));
      await env.STORAGE?.delete(media.object_key); await env.DB.batch([stmt(env,"DELETE FROM cms_media WHERE id=?",media.id),audit(env,u,"cms_media_delete",media.id)]); return json({ok:true});
    }
    fail(405,"Phương thức không hỗ trợ.");
  }
  fail(404,"CMS API không tồn tại.");
}

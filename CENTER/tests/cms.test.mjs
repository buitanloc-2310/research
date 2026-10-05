import test from "node:test";
import assert from "node:assert/strict";
import { database, memoryStorage } from "../scripts/runtime.mjs";
import { seed } from "../scripts/seed.mjs";
import { fetchHandler } from "../src/worker.js";

const { DB } = database();
const password = crypto.randomUUID() + "Aa1!";
await seed(DB, password);
const env = { DB, STORAGE: memoryStorage(), MODE: "single", APP_ORIGIN: "https://app.test" };
let cookie = "";

async function call(path, method = "GET", payload, raw = false) {
  const headers = { origin: env.APP_ORIGIN, "x-requested-with": "SFRC" };
  if (cookie) headers.cookie = cookie;
  if (payload !== undefined && !raw) headers["content-type"] = "application/json";
  const r = await fetchHandler(new Request(env.APP_ORIGIN + "/api/v1" + path, {
    method,
    headers,
    body: payload === undefined ? undefined : raw ? payload : JSON.stringify(payload),
  }), env);
  let d = {};
  try { d = await r.clone().json(); } catch {}
  return { r, d, status: r.status };
}

const login = await call("/login", "POST", { email: "demo-admin@example.test", password });
assert.equal(login.status, 200);
cookie = login.r.headers.get("set-cookie").split(";")[0];

test("CMS: public site defaults are persisted in D1", async () => {
  const x = await call("/public/site");
  assert.equal(x.status, 200);
  assert.equal(x.d.settings.center_name, "TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST");
  assert(x.d.navigation.some(x => x.url === "/about"));
  assert(x.d.footer.some(x => x.label === "Sky First Learning Center"));
});

test("CMS: production-final starter content stays draft until an administrator publishes", async () => {
  const page = await call("/admin/cms/pages/page-home");
  assert.equal(page.status, 200);
  assert.equal(page.d.page.status, "draft");
  assert.equal(page.d.page.blocks.find(x => x.id === "block-home-hero").data.title, "Từ câu hỏi hôm nay. Đến giải pháp ngày mai.");
  assert(page.d.page.blocks.some(x => x.id === "block-home-process"));
  assert.equal((await call("/public/pages/home")).status, 404, "starter migration must never auto-publish");
});

test("CMS: public configuration endpoints use bounded shared caching", async () => {
  for (const path of ["/public/site", "/public/settings"]) {
    const x = await call(path);
    assert.equal(x.status, 200);
    assert.match(x.r.headers.get("cache-control") || "", /s-maxage=120/);
    assert.match(x.r.headers.get("cache-control") || "", /stale-while-revalidate=300/);
  }
});

test("CMS: media upload uses R2 and becomes public only when referenced", async () => {
  const bytes = new Uint8Array([137,80,78,71,13,10,26,10,1,2,3,4]);
  const up = await call("/admin/cms/media?name=logo.png&alt=Logo", "POST", bytes, true);
  assert.equal(up.status, 201, JSON.stringify(up.d));
  assert.equal((await call("/admin/cms/media/" + up.d.id, "PATCH", { alt_text: "Logo test metadata" })).status, 200);
  const mediaSearch = await call("/admin/cms/media?q=logo");
  assert(mediaSearch.d.items.some(x => x.id === up.d.id && x.alt_text === "Logo test metadata"));
  const privateMedia = await call("/public/media/" + up.d.id);
  assert.equal(privateMedia.status, 404);
  const site = await call("/admin/cms/site", "PATCH", { logo_media_id: up.d.id, email: "research@skyfirst.io.vn" });
  assert.equal(site.status, 200);
  const publicMedia = await call("/public/media/" + up.d.id);
  assert.equal(publicMedia.status, 200);
  assert.equal(publicMedia.r.headers.get("content-type"), "image/png");
  const del = await call("/admin/cms/media/" + up.d.id, "DELETE");
  assert.equal(del.status, 409, "referenced media must not be deleted");
  assert.equal((await call("/admin/cms/site", "PATCH", { logo_media_id: "" })).status, 200);
  assert.equal((await call("/public/media/" + up.d.id)).status, 404, "unreferenced stale media must not remain publicly readable");
  assert.equal((await call("/admin/cms/media/" + up.d.id, "DELETE")).status, 200);
});

test("CMS: page builder draft preview publish and persistence", async () => {
  const list = await call("/admin/cms/pages");
  const about = list.d.items.find(x => x.slug === "about");
  assert(about);
  let page = await call("/admin/cms/pages/" + about.id);
  const hero = page.d.page.blocks.find(x => x.type === "hero");
  assert(hero);
  const editBlock = await call("/admin/cms/blocks/" + hero.id, "PATCH", { type: "hero", enabled: true, data: { eyebrow: "TEST", title: "Draft title", text: "Draft only" } });
  assert.equal(editBlock.status, 200);
  const added = await call("/admin/cms/blocks", "POST", { page_id: about.id, type: "heading", enabled: true, data: { eyebrow: "NEW", title: "Added block", text: "Created through CMS" } });
  assert.equal(added.status, 201, JSON.stringify(added.d));
  page = await call("/admin/cms/pages/" + about.id);
  const ids = page.d.page.blocks.map(x => x.id);
  const reordered = [added.d.id, ...ids.filter(x => x !== added.d.id)];
  assert.equal((await call(`/admin/cms/pages/${about.id}/reorder`, "POST", { ids: reordered })).status, 200);
  const preview = await call(`/admin/cms/pages/${about.id}/preview`);
  assert.equal(preview.d.page.blocks[0].id, added.d.id, "reorder must persist");
  assert.equal(preview.d.page.blocks.find(x => x.id === hero.id).data.title, "Draft title");
  assert.equal((await call("/public/pages/about")).status, 404, "draft must not be public");
  const pub = await call(`/admin/cms/pages/${about.id}/publish`, "POST", {});
  assert.equal(pub.status, 200, JSON.stringify(pub.d));
  const publicPage = await call("/public/pages/about");
  assert.equal(publicPage.status, 200);
  assert.equal(publicPage.d.page.blocks[0].id, added.d.id, "published snapshot keeps block order");
  assert.equal(publicPage.d.page.blocks.find(x => x.id === hero.id).data.title, "Draft title");
  await call("/admin/cms/blocks/" + hero.id, "PATCH", { type: "hero", enabled: true, data: { title: "Unpublished change", text: "still draft" } });
  const publicAfterDraft = await call("/public/pages/about");
  assert.equal(publicAfterDraft.d.page.blocks.find(x => x.id === hero.id).data.title, "Draft title", "published snapshot must remain stable");
});


test("CMS: custom page can be created and deleted while system pages are protected", async () => {
  const created = await call("/admin/cms/pages", "POST", { slug: "temporary-page", title: "Temporary Page", description: "delete test" });
  assert.equal(created.status, 201, JSON.stringify(created.d));
  assert.equal((await call("/admin/cms/pages/" + created.d.id, "DELETE")).status, 200);
  assert.equal((await call("/admin/cms/pages/" + created.d.id)).status, 404);
  assert.equal((await call("/admin/cms/pages/page-about", "DELETE")).status, 409);
});

test("CMS: navigation and footer support create update delete", async () => {
  const nav = await call("/admin/cms/navigation", "POST", { label: "Lab", url: "/lab", position: 99, enabled: true });
  assert.equal(nav.status, 201);
  assert.equal((await call("/admin/cms/navigation", "PATCH", { id: nav.d.id, label: "Labs", url: "/labs", position: 98, enabled: true, external: false, new_tab: false })).status, 200);
  assert((await call("/public/site")).d.navigation.some(x => x.label === "Labs"));
  assert.equal((await call("/admin/cms/navigation", "DELETE", { id: nav.d.id })).status, 200);

  const foot = await call("/admin/cms/footer", "POST", { column_key: "discover", heading: "Khám phá", label: "Highlights", url: "/highlights", position: 99, enabled: true });
  assert.equal(foot.status, 201);
  assert.equal((await call("/admin/cms/footer", "DELETE", { id: foot.d.id })).status, 200);
});

test("CMS: researcher is blocked from Website CMS", async () => {
  const other = await call("/login", "POST", { email: "demo-researcher@example.test", password });
  const old = cookie;
  cookie = other.r.headers.get("set-cookie").split(";")[0];
  const x = await call("/admin/cms/site");
  cookie = old;
  assert.equal(x.status, 403);
});

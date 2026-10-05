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

test("CMS V3: revisions restore to Draft without changing Published until republish", async () => {
  const created = await call("/admin/cms/pages", "POST", { slug: "revision-lab", title: "Revision Lab", description: "Revision regression" });
  assert.equal(created.status, 201, JSON.stringify(created.d));
  const pageId = created.d.id;
  const block = await call("/admin/cms/blocks", "POST", { page_id: pageId, type: "heading", enabled: true, data: { title: "Version one", text: "one" } });
  assert.equal(block.status, 201, JSON.stringify(block.d));
  assert.equal((await call(`/admin/cms/blocks/${block.d.id}`, "PATCH", { type: "heading", enabled: true, data: { title: "Version two", text: "two" } })).status, 200);
  assert.equal((await call(`/admin/cms/pages/${pageId}/publish`, "POST", {})).status, 200);
  let pub = await call("/public/pages/revision-lab");
  assert.equal(pub.d.page.blocks[0].data.title, "Version two");

  assert.equal((await call(`/admin/cms/blocks/${block.d.id}`, "PATCH", { type: "heading", enabled: true, data: { title: "Version three", text: "three" } })).status, 200);
  assert.equal((await call(`/admin/cms/blocks/${block.d.id}`, "PATCH", { type: "heading", enabled: true, data: { title: "Version four", text: "four" } })).status, 200);
  pub = await call("/public/pages/revision-lab");
  assert.equal(pub.d.page.blocks[0].data.title, "Version two", "Draft edits must not leak to Published snapshot");

  const revisions = await call(`/admin/cms/pages/${pageId}/revisions`);
  assert.equal(revisions.status, 200);
  assert(revisions.d.items.length >= 4);
  const newest = revisions.d.items[0];
  const revision = await call(`/admin/cms/pages/${pageId}/revisions/${newest.id}`);
  assert.equal(revision.status, 200);
  assert.equal(revision.d.revision.snapshot.blocks[0].data.title, "Version three");

  assert.equal((await call(`/admin/cms/pages/${pageId}/restore`, "POST", { revision_id: newest.id })).status, 200);
  const draft = await call(`/admin/cms/pages/${pageId}/preview`);
  assert.equal(draft.d.page.blocks[0].data.title, "Version three");
  pub = await call("/public/pages/revision-lab");
  assert.equal(pub.d.page.blocks[0].data.title, "Version two", "Restore must remain Draft until republished");
  assert.equal((await call(`/admin/cms/pages/${pageId}/publish`, "POST", {})).status, 200);
  pub = await call("/public/pages/revision-lab");
  assert.equal(pub.d.page.blocks[0].data.title, "Version three");
  assert.equal((await call(`/admin/cms/pages/${pageId}`, "DELETE")).status, 200);
});

test("CMS V3: page duplicate copies blocks as an unpublished Draft", async () => {
  const source = await call("/admin/cms/pages", "POST", { slug: "duplicate-source", title: "Duplicate Source" });
  assert.equal(source.status, 201);
  assert.equal((await call("/admin/cms/blocks", "POST", { page_id: source.d.id, type: "rich_text", enabled: true, data: { heading: "Source block", text: "Body" } })).status, 201);
  const copy = await call(`/admin/cms/pages/${source.d.id}/duplicate`, "POST", {});
  assert.equal(copy.status, 201, JSON.stringify(copy.d));
  const copied = await call(`/admin/cms/pages/${copy.d.id}`);
  assert.equal(copied.status, 200);
  assert.equal(copied.d.page.status, "draft");
  assert.equal(copied.d.page.noindex, true);
  assert.equal(copied.d.page.blocks.length, 1);
  assert.equal(copied.d.page.blocks[0].data.heading, "Source block");
  assert.equal((await call(`/public/pages/${copy.d.slug}`)).status, 404);
  assert.equal((await call(`/admin/cms/pages/${copy.d.id}`, "DELETE")).status, 200);
  assert.equal((await call(`/admin/cms/pages/${source.d.id}`, "DELETE")).status, 200);
});

test("CMS V3: nested navigation is limited to two levels and exposed publicly", async () => {
  const parent = await call("/admin/cms/navigation", "POST", { label: "Knowledge", url: "/explore", position: 70, enabled: true });
  assert.equal(parent.status, 201);
  const child = await call("/admin/cms/navigation", "POST", { label: "Publications", url: "/explore?type=publication", parent_id: parent.d.id, position: 1, enabled: true });
  assert.equal(child.status, 201, JSON.stringify(child.d));
  const site = await call("/public/site");
  assert.equal(site.d.navigation.find(x => x.id === child.d.id).parent_id, parent.d.id);
  const grandchild = await call("/admin/cms/navigation", "POST", { label: "Rejected", url: "/about", parent_id: child.d.id, enabled: true });
  assert.equal(grandchild.status, 400);
  assert.equal((await call("/admin/cms/navigation", "DELETE", { id: parent.d.id })).status, 200);
  const after = await call("/admin/cms/navigation");
  assert.equal(after.d.items.find(x => x.id === child.d.id).parent_id, null, "Deleting a parent promotes its child safely");
  assert.equal((await call("/admin/cms/navigation", "DELETE", { id: child.d.id })).status, 200);
});

test("CMS V3: Media Cloud uses bounded server-side pagination and image dimensions", async () => {
  const png1x1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
  const ids = [];
  for (const name of ["v3-a.png", "v3-b.png", "v3-c.png"]) {
    const up = await call(`/admin/cms/media?name=${encodeURIComponent(name)}&alt=V3`, "POST", png1x1, true);
    assert.equal(up.status, 201, JSON.stringify(up.d));
    ids.push(up.d.id);
  }
  const page1 = await call("/admin/cms/media?q=v3-&type=image&page=1&limit=2");
  assert.equal(page1.status, 200);
  assert.equal(page1.d.limit, 2);
  assert.equal(page1.d.items.length, 2);
  assert(page1.d.total >= 3);
  assert(page1.d.items.every(x => x.width === 1 && x.height === 1));
  const page2 = await call("/admin/cms/media?q=v3-&type=image&page=2&limit=2");
  assert(page2.d.items.length >= 1);
  for (const id of ids) assert.equal((await call(`/admin/cms/media/${id}`, "DELETE")).status, 200);
});

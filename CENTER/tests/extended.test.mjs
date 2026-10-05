import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { database, memoryStorage } from "../scripts/runtime.mjs";
import { seed } from "../scripts/seed.mjs";
import worker, { fetchHandler } from "../src/worker.js";
import { hmac, hash, canonical, uuid, PASSWORD_PBKDF2_ITERATIONS } from "../src/security.js";
const { DB, sqlite } = database(),
  password = crypto.randomUUID();
await seed(DB, password);
const env = {
  DB,
  STORAGE: memoryStorage(),
  MODE: "single",
  APP_ORIGIN: "https://app.test",
  ASSETS: {
    fetch: async () =>
      new Response(readFileSync("public/index.html"), {
        headers: { "content-type": "text/html" },
      }),
  },
};
const cookies = {};
async function call(path, method = "GET", b, role = "admin", raw = false) {
  const req = new Request(env.APP_ORIGIN + path, {
    method,
    headers: {
      origin: env.APP_ORIGIN,
      "x-requested-with": "SFRC",
      cookie: cookies[role] || "",
    },
    body: b === undefined ? undefined : raw ? b : JSON.stringify(b),
  });
  const r = await fetchHandler(req, env);
  let d = {};
  try {
    d = await r.clone().json();
  } catch {}
  return { r, d, status: r.status };
}
for (const role of ["admin", "researcher", "manager", "ethics", "finance"]) {
  const x = await call(
    "/api/v1/login",
    "POST",
    { email: `demo-${role}@example.test`, password },
    "none",
  );
  cookies[role] = x.r.headers.get("set-cookie").split(";")[0];
}
async function action(id, action, role = "manager") {
  const r = await call("/api/v1/records/" + id, "GET", undefined, role);
  return call(
    "/api/v1/records/" + id + "/transition",
    "POST",
    { version: r.d.item.version, action, note: "Integration test" },
    role,
  );
}
test("first-time setup: detects fresh install, creates one Root Admin, then locks", async () => {
  assert.equal(PASSWORD_PBKDF2_ITERATIONS, 100000);
  const empty = database();
  const ev = { ...env, DB: empty.DB, SETUP_SECRET: uuid() };
  const status = async () =>
    fetchHandler(new Request(env.APP_ORIGIN + "/api/v1/setup"), ev);
  const invoke = async (b) =>
    fetchHandler(
      new Request(env.APP_ORIGIN + "/api/v1/setup", {
        method: "POST",
        headers: { origin: env.APP_ORIGIN, "x-requested-with": "SFRC" },
        body: JSON.stringify(b),
      }),
      ev,
    );
  assert.deepEqual(await (await status()).json(), { required: true });
  assert.equal((await invoke({ secret: "bad" })).status, 403);
  const password = uuid();
  const b = {
    secret: ev.SETUP_SECRET,
    email: "root@example.test",
    name: "Root Admin",
    password,
    confirm_password: password,
  };
  assert.equal((await invoke({ ...b, confirm_password: password + "x" })).status, 400);
  assert.equal((await invoke(b)).status, 201);
  assert.deepEqual(await (await status()).json(), { required: false });
  assert.equal(empty.sqlite.prepare("SELECT count(*) n FROM users").get().n, 1);
  assert.equal(empty.sqlite.prepare("SELECT role FROM users LIMIT 1").get().role, "admin");
  assert.equal(empty.sqlite.prepare("SELECT role FROM user_roles LIMIT 1").get().role, "system_admin");
  assert.equal(empty.sqlite.prepare("SELECT count(*) n FROM audit WHERE action='first_time_setup'").get().n, 1);
  assert.notEqual(empty.sqlite.prepare("SELECT password FROM users LIMIT 1").get().password, password);
  assert.equal((await invoke(b)).status, 409);
  empty.sqlite.exec("DELETE FROM settings WHERE key='initialized'");
  assert.deepEqual(await (await status()).json(), { required: false });
  assert.equal((await invoke({ ...b, email: "second@example.test" })).status, 409);
});
test("public SEO: content rendered and metadata escaped", async () => {
  await DB.prepare("UPDATE records SET title=? WHERE id='demo-publications'")
    .bind("<script>evil</script>")
    .run();
  const x = await call("/record/demo-publications");
  const html = await x.r.text();
  assert.equal(x.status, 200);
  assert(html.includes("&lt;script&gt;evil&lt;/script&gt;"));
  assert(!html.includes("<script>evil</script>"));
  assert(html.includes('rel="canonical"'));
});
test("public sitemap: excludes confidential draft", async () => {
  const x = await call("/sitemap.xml");
  const body = await x.r.text();
  assert(body.includes("/record/demo-publications"));
  assert(!body.includes("/record/demo-ethics"));
});
test("roles: researcher cannot modify grants", async () =>
  assert.equal(
    (
      await call(
        "/api/v1/admin/roles",
        "PATCH",
        { role: "researcher", permissions: ["settings"] },
        "researcher",
      )
    ).status,
    403,
  ));
test("roles: system admin cannot be demoted through ordinary user endpoint", async () =>
  assert.equal(
    (
      await call(
        "/api/v1/admin/users",
        "PATCH",
        { id: "demo-admin", role: "member", active: false },
        "manager",
      )
    ).status,
    403,
  ));
test("form uploads: private response cannot be downloaded by other submitter", async () => {
  await DB.prepare(
    "UPDATE records SET status='active',access='internal' WHERE id='demo-forms'",
  ).run();
  const x = await call(
    "/api/v1/records/demo-forms/response-files?name=notes.txt",
    "POST",
    "private notes",
    "researcher",
    true,
  );
  assert.equal(x.status, 201);
  assert.equal(
    (
      await call(
        "/api/v1/response-files/" + x.d.id,
        "GET",
        undefined,
        "finance",
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/api/v1/response-files/" + x.d.id,
        "GET",
        undefined,
        "researcher",
      )
    ).status,
    200,
  );
  assert.equal(
    (await call("/api/v1/response-files/" + x.d.id, "GET", undefined, "admin"))
      .status,
    200,
  );
});
test("form required fields reject missing response", async () =>
  assert.equal(
    (
      await call(
        "/api/v1/records/demo-forms/responses",
        "POST",
        { answers: {} },
        "researcher",
      )
    ).status,
    400,
  ));
test("finance: own approval rejected even for administrator", async () => {
  await DB.prepare(
    "UPDATE records SET owner_id='demo-finance',status='submitted' WHERE id='demo-budgets'",
  ).run();
  assert.equal(
    (await action("demo-budgets", "approve", "finance")).status,
    403,
  );
});
test("ethics: human subjects project requires valid approval before start", async () => {
  await DB.prepare(
    "UPDATE records SET status='approved',data=json_set(data,'$.human_subjects','Có') WHERE id='demo-projects'",
  ).run();
  assert.equal(
    (await action("demo-projects", "start", "researcher")).status,
    409,
  );
  await DB.prepare(
    "UPDATE records SET status='approved',data=json_set(data,'$.expires','2027-12-31') WHERE id='demo-ethics'",
  ).run();
  assert.equal(
    (await action("demo-projects", "start", "researcher")).status,
    200,
  );
});
test("acceptance: independent approval with council then project completion", async () => {
  await DB.prepare(
    "UPDATE records SET status='submitted' WHERE id='demo-acceptances'",
  ).run();
  assert.equal(
    (await action("demo-acceptances", "approve", "manager")).status,
    200,
  );
  assert.equal(
    (await action("demo-projects", "acceptance", "researcher")).status,
    200,
  );
  assert.equal(
    (await action("demo-projects", "complete", "manager")).status,
    200,
  );
});
test("publish: complete record explicitly Public then publication", async () => {
  await DB.prepare(
    "UPDATE records SET access='public' WHERE id='demo-projects'",
  ).run();
  assert.equal((await action("demo-projects", "publish", "admin")).status, 200);
  assert.equal(
    (
      await call(
        "/api/v1/public/records/demo-projects",
        "GET",
        undefined,
        "none",
      )
    ).status,
    200,
  );
});
test("dataset: sensitive personal data cannot be published", async () => {
  await DB.prepare(
    "UPDATE records SET status='approved',data=json_set(data,'$.personal','Có dữ liệu cá nhân') WHERE id='demo-datasets'",
  ).run();
  assert.equal((await action("demo-datasets", "publish", "admin")).status, 400);
});
test("cross-account: valid signature cannot be reused with changed cookie", async () => {
  const secret = uuid(),
    time = String(Math.floor(Date.now() / 1000)),
    nonce = uuid();
  const r = new Request("https://data.test/api/v1/me", {
    headers: { cookie: cookies.researcher },
  });
  r.headers.set("x-api-time", time);
  r.headers.set("x-api-nonce", nonce);
  r.headers.set(
    "x-api-signature",
    await hmac(secret, canonical(r, time, nonce, await hash(new Uint8Array()))),
  );
  r.headers.set("cookie", cookies.admin);
  assert.equal(
    (await fetchHandler(r, { ...env, MODE: "data", API_SHARED_SECRET: secret }))
      .status,
    401,
  );
});
test("cron: expiration and deadline notifications are idempotent per day", async () => {
  await DB.prepare(
    "UPDATE records SET status='approved',data=json_set(data,'$.expires','2000-01-01') WHERE id='demo-ethics'",
  ).run();
  await DB.prepare(
    "UPDATE records SET data=json_set(data,'$.due',date('now','+1 day')) WHERE id='demo-tasks'",
  ).run();
  await worker.scheduled({}, env);
  await worker.scheduled({}, env);
  assert.equal(
    sqlite.prepare("SELECT status FROM records WHERE id='demo-ethics'").get()
      .status,
    "expired",
  );
  assert.equal(
    sqlite
      .prepare(
        "SELECT count(*) n FROM notifications WHERE record_id='demo-tasks'",
      )
      .get().n,
    1,
  );
});
test("validation: task assignee must belong to project", async () => {
  const x = await call(
    "/api/v1/records",
    "POST",
    {
      kind: "tasks",
      title: "Invalid member",
      project_id: "demo-projects",
      data: { assignee: "demo-finance" },
    },
    "researcher",
  );
  assert.equal(x.status, 400);
});

test("first-time setup: server misconfiguration does not consume attempts and brute force returns Retry-After", async () => {
  const fresh = database();
  const baseEnv = { ...env, DB: fresh.DB };
  const invoke = async (ev, secret) => fetchHandler(
    new Request(env.APP_ORIGIN + "/api/v1/setup", {
      method: "POST",
      headers: { origin: env.APP_ORIGIN, "x-requested-with": "SFRC" },
      body: JSON.stringify({ secret, email: "rate@example.test", name: "Rate Test", password: "ValidPassword123!", confirm_password: "ValidPassword123!" }),
    }),
    ev,
  );

  for (let i = 0; i < 12; i++) assert.equal((await invoke(baseEnv, "anything")).status, 503);
  assert.equal(fresh.sqlite.prepare("SELECT COUNT(*) n FROM rate_limits WHERE key LIKE 'setup:%'").get().n, 0, "missing SETUP_SECRET must not consume setup attempts");

  const protectedEnv = { ...baseEnv, SETUP_SECRET: uuid() };
  for (let i = 0; i < 10; i++) assert.equal((await invoke(protectedEnv, "wrong")).status, 403);
  const limited = await invoke(protectedEnv, "wrong");
  assert.equal(limited.status, 429);
  assert.match(limited.headers.get("retry-after") || "", /^\d+$/);
  const body = await limited.json();
  assert.match(body.error || "", /thử lại sau/i);
});

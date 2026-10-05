import test from "node:test";
import assert from "node:assert/strict";
import { database, memoryStorage } from "../scripts/runtime.mjs";
import { seed } from "../scripts/seed.mjs";
import { fetchHandler } from "../src/worker.js";
import { hmac, canonical, hash, uuid } from "../src/security.js";
const pass = crypto.randomUUID() + "Ab!";
const { DB, sqlite } = database();
await seed(DB, pass);
const env = {
  DB,
  STORAGE: memoryStorage(),
  APP_ORIGIN: "https://app.test",
  MODE: "single",
};
const cookies = {};
async function call(path, method = "GET", data, role = "admin", extra = {}) {
  const headers = {
    origin: env.APP_ORIGIN,
    "x-requested-with": "SFRC",
    ...extra,
  };
  if (cookies[role]) headers.cookie = cookies[role];
  if (data !== undefined) headers["content-type"] = "application/json";
  const r = await fetchHandler(
    new Request(env.APP_ORIGIN + "/api/v1" + path, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    }),
    env,
  );
  let d;
  try {
    d = await r.clone().json();
  } catch {
    d = {};
  }
  return { r, d, status: r.status };
}
for (const role of [
  "admin",
  "researcher",
  "reviewer",
  "manager",
  "finance",
  "ethics",
]) {
  const { r, status } = await call(
    "/login",
    "POST",
    { email: `demo-${role}@example.test`, password: pass },
    "none",
  );
  assert.equal(status, 200);
  cookies[role] = r.headers.get("set-cookie").split(";")[0];
}
let project, task, review;
test("auth: session resolves without exposing password", async () => {
  const x = await call("/me");
  assert.equal(x.status, 200);
  assert.equal(x.d.user.password, undefined);
  assert(x.d.user.permissions.includes("users"));
});
test("auth: wrong password rejected", async () =>
  assert.equal(
    (
      await call(
        "/login",
        "POST",
        {
          email: "demo-admin@example.test",
          password: "not-the-right-password",
        },
        "none",
      )
    ).status,
    401,
  ));
test("auth: malformed cookie rejected", async () =>
  assert.equal(
    (await call("/me", "GET", undefined, "none", { cookie: "__Host-sfrc=%XX" }))
      .status,
    401,
  ));
test("CSRF: cross-origin write rejected", async () =>
  assert.equal(
    (
      await call("/records", "POST", {}, "admin", {
        origin: "https://evil.test",
      })
    ).status,
    403,
  ));
test("admin: researcher cannot access user management", async () =>
  assert.equal(
    (await call("/admin/users", "GET", undefined, "researcher")).status,
    403,
  ));
test("project: create complete draft", async () => {
  const x = await call(
    "/records",
    "POST",
    {
      kind: "projects",
      title: "Test research",
      summary: "Test",
      data: {
        type: "Nghiên cứu",
        field: "Giáo dục",
        objectives: "Objective",
        method: "Method",
        outputs: "Report",
        due: "2027-12-01",
        human_subjects: "Không",
      },
      access: "restricted",
    },
    "researcher",
  );
  assert.equal(x.status, 201, JSON.stringify(x.d));
  project = x.d.item;
  assert(project.code.startsWith("SFRC-"));
  assert.equal(
    (await call("/records/" + project.id, "GET", undefined, "researcher")).d
      .journey.length,
    15,
  );
});
test("IDOR: independent reviewer cannot read project", async () =>
  assert.equal(
    (await call("/records/" + project.id, "GET", undefined, "reviewer")).status,
    403,
  ));
test("search ACL: private title absent for outsider", async () => {
  const x = await call(
    "/records?q=Test%20research",
    "GET",
    undefined,
    "reviewer",
  );
  assert.equal(x.d.total, 0);
});
test("project: optimistic concurrency prevents stale overwrite", async () => {
  const x = await call(
    "/records/" + project.id,
    "PATCH",
    { ...project, title: "Updated research" },
    "researcher",
  );
  assert.equal(x.status, 200);
  assert.equal(
    (await call("/records/" + project.id, "PATCH", project, "researcher"))
      .status,
    409,
  );
  project = x.d.item;
});
test("journey: update with checklist and concurrency", async () => {
  const b = {
    step: 0,
    progress: 50,
    assignee: "demo-researcher",
    deadline: "2027-01-01",
    note: "Progress",
    checklist: [{ text: "Read", done: true }],
    version: 1,
  };
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/journey",
        "PATCH",
        b,
        "researcher",
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/journey",
        "PATCH",
        b,
        "researcher",
      )
    ).status,
    409,
  );
});
test("task: create scoped task and reject invalid progress", async () => {
  let x = await call(
    "/records",
    "POST",
    {
      kind: "tasks",
      title: "Task",
      project_id: project.id,
      data: {
        assignee: "demo-researcher",
        due: "2027-01-01",
        priority: "Cao",
        progress: 20,
      },
    },
    "researcher",
  );
  assert.equal(x.status, 201);
  task = x.d.item;
  x = await call(
    "/records/" + task.id,
    "PATCH",
    { ...task, data: { ...task.data, progress: 200 } },
    "researcher",
  );
  assert.equal(x.status, 400);
});
test("upload: PDF stored in private R2 adapter", async () => {
  const r = await fetchHandler(
    new Request(
      env.APP_ORIGIN + "/api/v1/records/" + task.id + "/files?name=test.pdf",
      {
        method: "POST",
        headers: {
          origin: env.APP_ORIGIN,
          "x-requested-with": "SFRC",
          cookie: cookies.researcher,
        },
        body: "%PDF-1.4\ntest",
      },
    ),
    env,
  );
  assert.equal(r.status, 201);
  const f = await r.json();
  assert.equal(
    (await call("/files/" + f.id, "GET", undefined, "reviewer")).status,
    403,
  );
  assert.equal(
    (await call("/files/" + f.id, "GET", undefined, "researcher")).status,
    200,
  );
  assert.equal(
    (await call("/public/files/" + f.id, "GET", undefined, "none")).status,
    404,
  );
});
test("upload: executable rejected", async () => {
  const r = await fetchHandler(
    new Request(
      env.APP_ORIGIN + "/api/v1/records/" + task.id + "/files?name=test.html",
      {
        method: "POST",
        headers: {
          origin: env.APP_ORIGIN,
          "x-requested-with": "SFRC",
          cookie: cookies.researcher,
        },
        body: "<script>alert(1)</script>",
      },
    ),
    env,
  );
  assert.equal(r.status, 400);
});
test("review workflow: submit project", async () => {
  const x = await call(
    "/records/" + project.id + "/transition",
    "POST",
    { action: "submit", version: project.version, note: "Submit" },
    "researcher",
  );
  assert.equal(x.status, 200);
  project = x.d.item;
});
test("submitted record: editing blocked", async () =>
  assert.equal(
    (await call("/records/" + project.id, "PATCH", project, "researcher"))
      .status,
    403,
  ));
test("review: cannot assign contributor to review own work", async () => {
  await DB.prepare(
    "INSERT INTO user_roles(user_id,role) VALUES('demo-researcher','reviewer')",
  ).run();
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/reviews",
        "POST",
        { reviewer_id: "demo-researcher" },
        "manager",
      )
    ).status,
    409,
  );
});
test("review: assign independent reviewer then submit verdict", async () => {
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/reviews",
        "POST",
        { reviewer_id: "demo-reviewer", round: 1, deadline: "2027-01-01" },
        "manager",
      )
    ).status,
    200,
  );
  let x = await call(
    "/records/" + project.id + "/transition",
    "POST",
    { action: "review", version: project.version, note: "Review" },
    "manager",
  );
  assert.equal(x.status, 200);
  project = x.d.item;
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/transition",
        "POST",
        { action: "approve", version: project.version, note: "Approve" },
        "manager",
      )
    ).status,
    409,
  );
  x = await call("/records/" + project.id, "GET", undefined, "reviewer");
  review = x.d.reviews[0];
  assert.equal(
    (
      await call(
        "/reviews/" + review.id,
        "PATCH",
        { score: 82, comment: "Reasoned evaluation", verdict: "accepted" },
        "reviewer",
      )
    ).status,
    200,
  );
});
test("review: submitted verdict immutable", async () =>
  assert.equal(
    (
      await call(
        "/reviews/" + review.id,
        "PATCH",
        { score: 99, comment: "Changed", verdict: "accepted" },
        "reviewer",
      )
    ).status,
    409,
  ));
test("workflow: manager approves and owner starts", async () => {
  let x = await call(
    "/records/" + project.id + "/transition",
    "POST",
    { action: "approve", version: project.version, note: "Approved" },
    "manager",
  );
  assert.equal(x.status, 200);
  project = x.d.item;
  x = await call(
    "/records/" + project.id + "/transition",
    "POST",
    { action: "start", version: project.version, note: "Started" },
    "researcher",
  );
  assert.equal(x.status, 200);
  project = x.d.item;
});
test("workflow: cannot skip acceptance evidence", async () => {
  assert.equal(
    (
      await call(
        "/records/" + project.id + "/transition",
        "POST",
        { action: "complete", version: project.version, note: "Done" },
        "manager",
      )
    ).status,
    409,
  );
});
test("publication: private drafts not public", async () =>
  assert.equal(
    (await call("/public/records/" + project.id, "GET", undefined, "none"))
      .status,
    404,
  ));
test("publication: published content visible publicly", async () => {
  const x = await call(
    "/public/records/demo-publications",
    "GET",
    undefined,
    "none",
  );
  assert.equal(x.status, 200);
  assert.equal(x.d.item.owner_id, undefined);
});
test("finance: unrelated researcher cannot see budget", async () => {
  await DB.prepare(
    "UPDATE records SET owner_id='demo-finance' WHERE id='demo-budgets'",
  ).run();
  assert.equal(
    (await call("/records/demo-budgets", "GET", undefined, "researcher"))
      .status,
    403,
  );
  assert.equal(
    (await call("/records/demo-budgets", "GET", undefined, "finance")).status,
    200,
  );
});
test("events: capacity enforced atomically", async () => {
  await DB.prepare(
    "UPDATE records SET data=json_set(data,'$.capacity',1) WHERE id='demo-events'",
  ).run();
  assert.equal(
    (await call("/records/demo-events/registrations", "POST", {}, "researcher"))
      .status,
    200,
  );
  assert.equal(
    (await call("/records/demo-events/registrations", "POST", {}, "reviewer"))
      .status,
    409,
  );
});
test("forms: submit and enforce response privacy", async () => {
  await DB.prepare(
    "UPDATE records SET status='active',access='internal' WHERE id='demo-forms'",
  ).run();
  assert.equal(
    (
      await call(
        "/records/demo-forms/responses",
        "POST",
        { answers: { name: "Tester", proposal: "Research" } },
        "reviewer",
      )
    ).status,
    201,
  );
  assert.equal(
    (await call("/records/demo-forms/responses", "GET", undefined, "reviewer"))
      .status,
    403,
  );
});
test("API: malformed JSON returns 400", async () => {
  const r = await fetchHandler(
    new Request(env.APP_ORIGIN + "/api/v1/records", {
      method: "POST",
      headers: {
        origin: env.APP_ORIGIN,
        "x-requested-with": "SFRC",
        cookie: cookies.admin,
      },
      body: "{",
    }),
    env,
  );
  assert.equal(r.status, 400);
});
test("SQL injection search does not bypass scope", async () => {
  const x = await call(
    "/records?q=" + encodeURIComponent("' OR 1=1 --"),
    "GET",
    undefined,
    "reviewer",
  );
  assert.equal(x.status, 200);
  assert.equal(x.d.total, 0);
});
test("audit: modification blocked at database", () =>
  assert.throws(() => sqlite.exec("DELETE FROM audit"), /immutable/));
test("cross-account: invalid signature blocked", async () => {
  const r = await fetchHandler(new Request("https://data.test/api/v1/me"), {
    ...env,
    MODE: "data",
    API_SHARED_SECRET: crypto.randomUUID(),
  });
  assert.equal(r.status, 401);
});
test("cross-account: signed request accepted and replay rejected", async () => {
  const secret = crypto.randomUUID(),
    bytes = new Uint8Array(),
    time = String(Math.floor(Date.now() / 1000)),
    nonce = uuid();
  const req = new Request("https://data.test/api/v1/me", {
    headers: {
      cookie: cookies.admin,
      origin: env.APP_ORIGIN,
      "x-requested-with": "SFRC",
    },
  });
  req.headers.set("x-api-time", time);
  req.headers.set("x-api-nonce", nonce);
  req.headers.set(
    "x-api-signature",
    await hmac(secret, canonical(req, time, nonce, await hash(bytes))),
  );
  const dataEnv = { ...env, MODE: "data", API_SHARED_SECRET: secret };
  assert.equal((await fetchHandler(req.clone(), dataEnv)).status, 200);
  assert.equal((await fetchHandler(req.clone(), dataEnv)).status, 409);
});
test("reset link: one time password reset revokes session", async () => {
  let x = await call("/admin/reset", "POST", { user_id: "demo-reviewer" });
  assert.equal(x.status, 200);
  const token = x.d.url.split("/").pop();
  assert.equal(
    (
      await call(
        "/reset",
        "POST",
        { token, password: crypto.randomUUID() },
        "none",
      )
    ).status,
    200,
  );
  assert.equal((await call("/me", "GET", undefined, "reviewer")).status, 401);
  assert.equal(
    (
      await call(
        "/reset",
        "POST",
        { token, password: crypto.randomUUID() },
        "none",
      )
    ).status,
    400,
  );
});

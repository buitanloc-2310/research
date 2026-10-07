import { CATALOG, PUBLIC_KINDS, JOURNEY } from "../public/catalog.js";
import {
  uuid,
  random,
  hash,
  passwordHash,
  verifyPassword,
  equal,
  fail,
  boundedBody,
} from "./security.js";
import {
  stmt,
  one,
  all,
  run,
  audit,
  record,
  parse,
  commit,
  notify,
} from "./db.js";
import {
  permissions,
  has,
  requirePerm,
  view,
  edit,
  lead,
  participant,
  scope,
  ROLE_NAMES,
  PERMISSIONS,
  DEFAULT_GRANTS,
} from "./policy.js";
import { text, validate, transition } from "./domain.js";
import { queueEmail, adminAlert, flushOutbox } from "./notifications.js";
import { publicCms, adminCms } from "./cms.js";
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: { "cache-control": "no-store", ...headers },
  });
const now = () => Math.floor(Date.now() / 1000);
const sessionCookie = (t, age = 43200) =>
  `__Host-sfrc=${t}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
async function body(req) {
  let b;
  try {
    b = JSON.parse(new TextDecoder().decode(await boundedBody(req, 250000)));
  } catch (e) {
    if (e.status) throw e;
    fail(400, "JSON không hợp lệ.");
  }
  if (!b || typeof b !== "object" || Array.isArray(b))
    fail(400, "Nội dung yêu cầu không hợp lệ.");
  return b;
}
async function rate(env, key, max = 15, seconds = 900) {
  const n = now();
  await run(
    env,
    `INSERT INTO rate_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<? THEN ? ELSE expires END`,
    key,
    n + seconds,
    n,
    n,
    n + seconds,
  );
  const r = await one(env, "SELECT count,expires FROM rate_limits WHERE key=?", key);
  if (r.count > max) {
    const retry = Math.max(1, Number(r.expires || n + seconds) - n);
    fail(429, `Quá nhiều yêu cầu. Vui lòng thử lại sau ${Math.ceil(retry / 60)} phút.`, {
      "retry-after": String(retry),
    });
  }
}
export async function session(req, env) {
  const raw = (req.headers.get("cookie") || "")
    .split(";")
    .map((x) => x.trim())
    .find((x) => x.startsWith("__Host-sfrc="));
  if (!raw) return null;
  let t;
  try {
    t = decodeURIComponent(raw.slice(12));
  } catch {
    return null;
  }
  const u = await one(
    env,
    "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.hash=? AND s.expires>? AND u.active=1",
    await hash(t),
    now(),
  );
  if (!u) return null;
  delete u.password;
  return permissions(env, u);
}
async function initRoles(env) {
  const q = [];
  for (const [code, name] of Object.entries(ROLE_NAMES))
    q.push(
      stmt(
        env,
        "INSERT OR IGNORE INTO roles(code,name) VALUES(?,?)",
        code,
        name,
      ),
    );
  for (const [code, label] of Object.entries(PERMISSIONS))
    q.push(
      stmt(
        env,
        "INSERT OR IGNORE INTO permissions(code,label) VALUES(?,?)",
        code,
        label,
      ),
    );
  await env.DB.batch(q);
  const grants = [];
  for (const [role, perms] of Object.entries(DEFAULT_GRANTS))
    for (const p of perms)
      grants.push(
        stmt(
          env,
          "INSERT OR IGNORE INTO role_permissions(role,permission) VALUES(?,?)",
          role,
          p,
        ),
      );
  await env.DB.batch(grants);
}
async function firstTimeSetupState(env) {
  const state = await one(
    env,
    `SELECT
       EXISTS(SELECT 1 FROM settings WHERE key='initialized') AS initialized,
       EXISTS(SELECT 1 FROM user_roles WHERE role='system_admin') AS root_admin`,
  );
  const initialized = Boolean(state?.initialized),
    rootAdmin = Boolean(state?.root_admin);
  return { initialized, rootAdmin, required: !initialized && !rootAdmin };
}
async function canRead(env, u, r) {
  if (!(await view(env, u, r))) fail(403, "Bạn không có quyền xem hồ sơ.");
}
async function validateLinks(env, kind, data, project) {
  for (const [key, , type] of CATALOG[kind].fields)
    if (type === "user" && data[key]) {
      if (
        !(await one(
          env,
          "SELECT 1 FROM users WHERE id=? AND active=1",
          data[key],
        ))
      )
        fail(400, "Người được chọn không tồn tại.");
      if (
        kind === "tasks" &&
        key === "assignee" &&
        !(await one(
          env,
          "SELECT 1 FROM members WHERE project_id=? AND user_id=?",
          project,
          data[key],
        ))
      )
        fail(400, "Người phụ trách công việc phải thuộc nhóm đề tài.");
    }
}
async function createRecord(env, u, kind, b) {
  requirePerm(u, "create");
  if (["pages", "news"].includes(kind)) requirePerm(u, "publish");
  if (["councils", "partners"].includes(kind)) requirePerm(u, "manage");
  const fields = validate(kind, b);
  let pid = b.project_id || null;
  if (CATALOG[kind]?.project && !pid) fail(400, "Vui lòng chọn đề tài.");
  if (pid) {
    const p = await record(env, pid);
    if (p.kind !== "projects") fail(400, "Đề tài không hợp lệ.");
    if (!has(u, "manage") && !(await participant(env, u, p)))
      fail(403, "Bạn không thuộc nhóm đề tài.");
  }
  await validateLinks(env, kind, fields.data, pid);
  const id = uuid();
  const prefix =
    (await one(env, "SELECT value FROM settings WHERE key='prefix'"))?.value ||
    "SFRC";
  const year = new Date().getUTCFullYear();
  await run(
    env,
    "INSERT INTO counters(key,value) VALUES('record',1) ON CONFLICT(key) DO UPDATE SET value=value+1",
  );
  const seq = await one(env, "SELECT value FROM counters WHERE key='record'");
  const code = `${prefix}-${year}-${String(seq.value).padStart(5, "0")}-${id.slice(0, 4)}`;
  await env.DB.batch([
    stmt(
      env,
      "INSERT INTO records(id,kind,title,summary,owner_id,project_id,data,access,code) VALUES(?,?,?,?,?,?,?,?,?)",
      id,
      kind,
      fields.title,
      fields.summary,
      u.id,
      pid,
      JSON.stringify(fields.data),
      fields.access,
      code,
    ),
    audit(env, u, "create", id, { kind, code }),
  ]);
  if (["projects", "teams"].includes(kind)) {
    await run(
      env,
      "INSERT INTO members(project_id,user_id,role) VALUES(?,?,'lead')",
      id,
      u.id,
    );
    if (kind === "projects")
      await env.DB.batch(
        JOURNEY.map((_, i) =>
          stmt(env, "INSERT INTO journey(project_id,step) VALUES(?,?)", id, i),
        ),
      );
  }
  if (["projects", "ethics", "collaborations", "ideas"].includes(kind))
    await adminAlert(env, `Hồ sơ mới: ${fields.title}`, `${u.name || u.email || "Một thành viên"} vừa tạo hồ sơ ${kind} (${code}).`, `${env.APP_ORIGIN}/#w/detail/${id}`);
  return record(env, id);
}
export async function api(req, env) {
  const url = new URL(req.url),
    p = url.pathname.replace(/^\/api\/v1/, "/api"),
    method = req.method;
  const ip =
    (env.MODE === "data"
      ? req.headers.get("x-client-ip")
      : req.headers.get("cf-connecting-ip")) || "local";
  if (!["GET", "HEAD"].includes(method)) {
    const origin = req.headers.get("origin");
    if (
      !env.APP_ORIGIN ||
      origin !== env.APP_ORIGIN ||
      req.headers.get("x-requested-with") !== "SFRC"
    )
      fail(403, "Yêu cầu không đúng nguồn.");
  }
  if (p === "/api/health") {
    if (!env.DB || typeof env.DB.prepare !== "function") return json({ ok: false, version: "1.1.0", database: "missing_binding" }, 503);
    let database = "ok";
    try {
      await one(env, "SELECT 1 FROM settings LIMIT 1");
    } catch {
      database = "schema_unavailable";
    }
    return json({ ok: database === "ok", version: "1.1.0", database }, database === "ok" ? 200 : 503);
  }
  if (!env.DB || typeof env.DB.prepare !== "function") fail(503, "Cơ sở dữ liệu chưa được cấu hình.");
  const cmsPublic = await publicCms(req, env, p);
  if (cmsPublic) return cmsPublic;
  if (p === "/api/setup" && method === "GET") {
    const state = await firstTimeSetupState(env);
    return json({ required: state.required });
  }
  if (p === "/api/setup" && method === "POST") {
    const state = await firstTimeSetupState(env);
    if (!state.required) fail(409, "Hệ thống đã được khởi tạo.");
    if (!env.SETUP_SECRET)
      fail(503, "First-time Setup chưa được cấu hình trên máy chủ.");
    // Setup is intentionally rate-limited, but server misconfiguration and already-initialized
    // states do not consume attempts. This prevents an operator from locking themselves out
    // while still protecting the secret from brute-force attempts.
    await rate(env, "setup:" + ip, 10);
    const b = await body(req);
    if (!equal(b.secret, env.SETUP_SECRET)) fail(403, "SETUP_SECRET không đúng.");
    if (b.password !== b.confirm_password)
      fail(400, "Mật khẩu xác nhận không khớp.");
    const email = text(b.email, 200).toLowerCase(),
      name = text(b.name, 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name)
      fail(400, "Họ tên hoặc email không hợp lệ.");
    if (await one(env, "SELECT 1 FROM users WHERE email=? LIMIT 1", email))
      fail(409, "Email này đã được sử dụng.");
    await initRoles(env);
    const id = uuid(),
      pw = await passwordHash(b.password);
    try {
      await env.DB.batch([
        stmt(env, "INSERT INTO settings(key,value) VALUES('initialized','1')"),
        stmt(
          env,
          "INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,'admin')",
          id,
          email,
          name,
          pw,
        ),
        stmt(
          env,
          "INSERT INTO user_roles(user_id,role) VALUES(?,'system_admin')",
          id,
        ),
        audit(env, { id }, "first_time_setup", id, { role: "system_admin" }),
      ]);
    } catch (error) {
      const current = await firstTimeSetupState(env).catch(() => null);
      if (current && !current.required) fail(409, "Hệ thống đã được khởi tạo.");
      throw error;
    }
    await queueEmail(env, { userId: id, subject: "Chào mừng đến Sky First Research & Innovation Center", message: "Root Admin đầu tiên đã được thiết lập thành công. Bạn có thể đăng nhập và bắt đầu cấu hình Trung tâm.", actionUrl: env.APP_ORIGIN + "/#login", actionLabel: "Đăng nhập" });
    return json({ ok: true }, 201);
  }
  if (p === "/api/login" && method === "POST") {
    const b = await body(req),
      email = text(b.email, 200).toLowerCase();
    await rate(env, "login-ip:" + ip, 40);
    await rate(env, "login-email:" + (await hash(email)), 15);
    const user = await one(env, "SELECT * FROM users WHERE email=?", email);
    if (
      !user ||
      !user.active ||
      !(await verifyPassword(b.password, user.password))
    ) {
      await audit(env, null, "login_failed", null, { ip }).run();
      fail(401, "Email hoặc mật khẩu không đúng.");
    }
    const t = random();
    await env.DB.batch([
      stmt(
        env,
        "INSERT INTO sessions(hash,user_id,expires) VALUES(?,?,?)",
        await hash(t),
        user.id,
        now() + 43200,
      ),
      audit(env, user, "login", user.id, { ip }),
    ]);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(t) });
  }
  if (p === "/api/reset" && method === "POST") {
    await rate(env, "reset:" + ip, 10);
    const b = await body(req),
      h = await hash(text(b.token, 200));
    const r = await one(
      env,
      "SELECT * FROM reset_tokens WHERE hash=? AND expires>?",
      h,
      now(),
    );
    if (!r) fail(400, "Liên kết hết hạn hoặc đã sử dụng.");
    const pw = await passwordHash(b.password);
    const result = await env.DB.batch([
      stmt(
        env,
        "DELETE FROM reset_tokens WHERE hash=? AND expires>? RETURNING user_id",
        h,
        now(),
      ),
      stmt(
        env,
        "UPDATE users SET password=?,force_change=0 WHERE id=? AND changes()=1",
        pw,
        r.user_id,
      ),
      stmt(env, "DELETE FROM sessions WHERE user_id=?", r.user_id),
      audit(env, { id: r.user_id }, "reset_password", r.user_id),
    ]);
    if (!result[0].meta.changes) fail(409, "Liên kết đã sử dụng.");
    await queueEmail(env, { userId: r.user_id, subject: "Mật khẩu đã được thay đổi", message: "Mật khẩu tài khoản của bạn vừa được đặt lại thành công. Nếu bạn không thực hiện thao tác này, hãy liên hệ quản trị viên ngay.", actionUrl: env.APP_ORIGIN + "/#login", actionLabel: "Đăng nhập" });
    return json({ ok: true });
  }
  if (p === "/api/public/settings") {
    const rows = await all(
      env,
      "SELECT key,value FROM settings WHERE key IN ('intro','mission','vision','values','contact','prefix','vote_enabled')",
    );
    const site = await all(env, "SELECT key,value FROM site_settings");
    return json({
      settings: {
        ...Object.fromEntries(site.map((r) => [r.key, r.value])),
        ...Object.fromEntries(rows.map((r) => [r.key, r.value])),
      },
    }, 200, { "cache-control": "public,max-age=30,s-maxage=120,stale-while-revalidate=300" });
  }
  if (p === "/api/public/search") {
    const q = text(url.searchParams.get("q"), 100);
    const kind = url.searchParams.get("kind");
    if (kind && !PUBLIC_KINDS.includes(kind))
      fail(400, "Danh mục không công khai.");
    const page = Math.max(
      1,
      Math.min(10000, Number(url.searchParams.get("page")) || 1),
    );
    const where = `deleted=0 AND status='published' AND access='public' AND kind IN (${PUBLIC_KINDS.map(() => "?").join(",")}) AND (title LIKE ? OR summary LIKE ? OR data LIKE ?)${kind ? " AND kind=?" : ""}`;
    const args = [
      ...PUBLIC_KINDS,
      `%${q}%`,
      `%${q}%`,
      `%${q}%`,
      ...(kind ? [kind] : []),
    ];
    const items = await all(
      env,
      `SELECT id,code,kind,title,summary,created_at,data FROM records WHERE ${where} ORDER BY created_at DESC LIMIT 24 OFFSET ?`,
      ...args,
      (page - 1) * 24,
    );
    return json({
      items: items.map(parse),
      total: (
        await one(env, `SELECT COUNT(*) n FROM records WHERE ${where}`, ...args)
      ).n,
      page,
    });
  }
  if (p === "/api/public/pulse") {
    // This endpoint intentionally counts only records that are already public.
    // It is a read-only observatory feed, not a CMS statistic or a seeded demo.
    const rows = await all(
      env,
      `SELECT kind,COUNT(*) n
       FROM records
       WHERE deleted=0 AND status='published' AND access='public'
         AND kind IN (${PUBLIC_KINDS.map(() => "?").join(",")})
       GROUP BY kind`,
      ...PUBLIC_KINDS,
    );
    const counts = Object.fromEntries(PUBLIC_KINDS.map((kind) => [kind, 0]));
    for (const row of rows) counts[row.kind] = Number(row.n) || 0;
    return json(
      {
        counts,
        total: Object.values(counts).reduce((sum, value) => sum + value, 0),
        source: "public-d1-records",
      },
      200,
      { "cache-control": "public,max-age=30,s-maxage=120,stale-while-revalidate=300" },
    );
  }
  if (p === "/api/public/related") {
    const target = await record(env, url.searchParams.get("id"));
    if (
      target.status !== "published" ||
      target.access !== "public" ||
      !["profiles", "teams"].includes(target.kind)
    )
      fail(404, "Không có hồ sơ.");
    const items = await all(
      env,
      `SELECT id,kind,title,summary,code,created_at FROM records WHERE deleted=0 AND status='published' AND access='public' AND kind IN ('projects','publications','datasets','contributions') AND ${target.kind === "profiles" ? "owner_id=?" : "json_extract(data,'$.group')=?"} ORDER BY created_at DESC LIMIT 100`,
      target.kind === "profiles" ? target.owner_id : target.code,
    );
    return json({ items });
  }
  const pub = p.match(/^\/api\/public\/records\/([^/]+)$/);
  if (pub) {
    const r = await record(env, pub[1]);
    if (
      r.status !== "published" ||
      r.access !== "public" ||
      !PUBLIC_KINDS.includes(r.kind)
    )
      fail(404, "Không tìm thấy nội dung.");
    await run(
      env,
      "INSERT INTO metrics(record_id,views) VALUES(?,1) ON CONFLICT(record_id) DO UPDATE SET views=views+1",
      r.id,
    );
    return json({
      item: {
        id: r.id,
        code: r.code,
        kind: r.kind,
        title: r.title,
        summary: r.summary,
        data: r.data,
        created_at: r.created_at,
      },
      metrics: await one(
        env,
        "SELECT views,downloads FROM metrics WHERE record_id=?",
        r.id,
      ),
      files: await all(
        env,
        "SELECT id,name,size,mime,version FROM files WHERE record_id=? AND deleted=0",
        r.id,
      ),
    });
  }
  const u = await session(req, env);
  if (!u) fail(401, "Vui lòng đăng nhập.");
  if (p === "/api/me") return json({ user: u });
  if (p === "/api/logout" && method === "POST") {
    const t = (req.headers.get("cookie") || "")
      .split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith("__Host-sfrc="))
      ?.slice(12);
    if (t) await run(env, "DELETE FROM sessions WHERE hash=?", await hash(t));
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  if (p === "/api/password" && method === "POST") {
    const b = await body(req),
      stored = await one(env, "SELECT password FROM users WHERE id=?", u.id);
    if (!(await verifyPassword(b.current, stored.password)))
      fail(400, "Mật khẩu hiện tại không đúng.");
    await env.DB.batch([
      stmt(
        env,
        "UPDATE users SET password=?,force_change=0 WHERE id=?",
        await passwordHash(b.password),
        u.id,
      ),
      stmt(env, "DELETE FROM sessions WHERE user_id=?", u.id),
      stmt(env, "DELETE FROM reset_tokens WHERE user_id=?", u.id),
      stmt(env, "UPDATE outbox SET status='cancelled',payload='{}',request_body=NULL WHERE user_id=? AND status='pending' AND json_extract(payload,'$.type')='password_reset'", u.id),
      audit(env, u, "password_change", u.id),
    ]);
    await queueEmail(env, { userId: u.id, subject: "Mật khẩu đã được thay đổi", message: "Mật khẩu tài khoản của bạn vừa được thay đổi. Nếu đây không phải thao tác của bạn, hãy liên hệ quản trị viên ngay.", actionUrl: env.APP_ORIGIN + "/#login" });
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  if (u.force_change) fail(403, "Bạn cần đổi mật khẩu trước khi sử dụng.");
  if (!["GET", "HEAD"].includes(method))
    await rate(env, "write:" + u.id, 240, 60);
  const cmsAdmin = await adminCms(req, env, u, p, method);
  if (cmsAdmin) return cmsAdmin;

  const rf = p.match(/^\/api\/response-files\/([^/]+)$/);
  if (rf) {
    const f = await one(env, "SELECT * FROM response_files WHERE id=?", rf[1]);
    if (!f) fail(404, "Không tìm thấy tệp.");
    const form = await record(env, f.form_id);
    if (f.user_id !== u.id && !has(u, "manage") && !(await lead(env, u, form)))
      fail(403, "Tệp phản hồi riêng tư.");
    const object = await env.STORAGE.get(f.object_key);
    if (!object) fail(404, "Tệp không có trên storage.");
    await audit(env, u, "response_file_download", f.id).run();
    return new Response(object.body, {
      headers: {
        "content-type": f.mime,
        "content-disposition": `${new URL(req.url).searchParams.get("preview") === "1" && ["image/png", "image/jpeg", "image/webp"].includes(f.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "cache-control": "no-store",
      },
    });
  }
  if (p === "/api/finance/summary") {
    requirePerm(u, "finance");
    return json({
      items: await all(
        env,
        `SELECT project_id,json_extract(data,'$.type') type,SUM(CAST(json_extract(data,'$.amount') AS REAL)) amount,COUNT(*) count FROM records WHERE deleted=0 AND kind='budgets' AND status IN ('approved','completed') GROUP BY project_id,type`,
      ),
    });
  }
  if (p === "/api/admin/storage") {
    requirePerm(u, "data");
    return json({
      items: await all(
        env,
        "SELECT f.id,f.record_id,f.name,f.size,f.version,f.deleted,f.created_at,r.title FROM files f JOIN records r ON r.id=f.record_id ORDER BY f.created_at DESC LIMIT 300",
      ),
    });
  }
  if (p === "/api/users/directory")
    return json({
      items: await all(
        env,
        "SELECT id,name FROM users WHERE active=1 ORDER BY name LIMIT 1000",
      ),
    });
  if (p === "/api/notifications") {
    if (method === "POST") {
      await run(env, "UPDATE notifications SET seen=1 WHERE user_id=?", u.id);
      return json({ ok: true });
    }
    return json({
      items: await all(
        env,
        "SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100",
        u.id,
      ),
    });
  }
  if (p === "/api/sessions") {
    if (method === "DELETE") {
      await run(env, "DELETE FROM sessions WHERE user_id=?", u.id);
      return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
    }
    return json({
      items: await all(
        env,
        "SELECT created_at,expires FROM sessions WHERE user_id=? AND expires>?",
        u.id,
        now(),
      ),
    });
  }
  if (p === "/api/dashboard") {
    const sc = scope(u);
    return json({
      stats: await all(
        env,
        `SELECT kind,status,COUNT(*) n FROM records r WHERE deleted=0 AND ${sc.q} GROUP BY kind,status`,
        ...sc.args,
      ),
      recent: (
        await all(
          env,
          `SELECT r.* FROM records r WHERE deleted=0 AND ${sc.q} ORDER BY updated_at DESC LIMIT 12`,
          ...sc.args,
        )
      ).map(parse),
      deadlines: (
        await all(
          env,
          `SELECT r.* FROM records r WHERE deleted=0 AND kind IN ('tasks','milestones','projects') AND status NOT IN ('completed','archived') AND ${sc.q} ORDER BY json_extract(data,'$.due') LIMIT 12`,
          ...sc.args,
        )
      ).map(parse),
      reviews: await all(
        env,
        "SELECT v.*,r.title FROM reviews v JOIN records r ON r.id=v.record_id WHERE reviewer_id=? AND submitted_at IS NULL",
        u.id,
      ),
    });
  }
  if (p === "/api/records" && method === "GET") {
    const sc = scope(u),
      kind = url.searchParams.get("kind"),
      query = text(url.searchParams.get("q"), 100),
      status = text(url.searchParams.get("status"), 40),
      project = url.searchParams.get("project");
    if (kind && !CATALOG[kind]) fail(400, "Danh mục không hợp lệ.");
    const page = Math.max(
        1,
        Math.min(10000, Number(url.searchParams.get("page")) || 1),
      ),
      size = 30;
    let where = `r.deleted=0 AND ${sc.q}`,
      args = [...sc.args];
    for (const [col, value] of [
      ["kind", kind],
      ["status", status],
      ["project_id", project],
    ])
      if (value) {
        where += ` AND r.${col}=?`;
        args.push(value);
      }
    if (query) {
      where += " AND (r.title LIKE ? OR r.summary LIKE ? OR r.code LIKE ?)";
      args.push(...Array(3).fill(`%${query}%`));
    }
    const sort = ["title", "created_at", "updated_at"].includes(
      url.searchParams.get("sort"),
    )
      ? url.searchParams.get("sort")
      : "updated_at";
    return json({
      items: (
        await all(
          env,
          `SELECT r.* FROM records r WHERE ${where} ORDER BY r.${sort} DESC,r.id LIMIT ? OFFSET ?`,
          ...args,
          size,
          (page - 1) * size,
        )
      ).map(parse),
      total: (
        await one(
          env,
          `SELECT COUNT(*) n FROM records r WHERE ${where}`,
          ...args,
        )
      ).n,
      page,
      size,
    });
  }
  if (p === "/api/records" && method === "POST") {
    const b = await body(req);
    return json({ item: await createRecord(env, u, b.kind, b) }, 201);
  }
  const rm = p.match(/^\/api\/records\/([^/]+)(?:\/([^/]+))?$/);
  if (rm) {
    const r = await record(env, rm[1]);
    await canRead(env, u, r);
    const op = rm[2];
    if (!op && method === "GET") {
      const reviewers = await all(
        env,
        "SELECT v.*,u.name FROM reviews v JOIN users u ON u.id=v.reviewer_id WHERE record_id=? ORDER BY round DESC",
        r.id,
      );
      return json({
        item: r,
        can_edit: await edit(env, u, r),
        is_lead: await lead(env, u, r),
        files: await all(
          env,
          "SELECT id,name,mime,size,version,created_at,journey_step FROM files WHERE record_id=? AND deleted=0",
          r.id,
        ),
        history: await all(
          env,
          "SELECT id,actor_id,action,note,created_at FROM history WHERE record_id=? ORDER BY created_at DESC LIMIT 100",
          r.id,
        ),
        members: await all(
          env,
          "SELECT m.*,u.name FROM members m JOIN users u ON u.id=m.user_id WHERE project_id=?",
          r.id,
        ),
        reviews: reviewers,
        journey: await all(
          env,
          "SELECT * FROM journey WHERE project_id=? ORDER BY step",
          r.id,
        ),
        comments: await all(
          env,
          "SELECT c.*,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE record_id=? ORDER BY created_at LIMIT 300",
          r.id,
        ),
      });
    }
    if (!op && method === "PATCH") {
      if (!(await edit(env, u, r)))
        fail(403, "Hồ sơ bị khóa hoặc bạn không có quyền sửa.");
      const b = await body(req);
      if (b.version !== r.version) fail(409, "Phiên bản đã thay đổi.");
      const fields = validate(r.kind, b);
      await validateLinks(env, r.kind, fields.data, r.project_id);
      if (!has(u, "manage")) {
        fields.data.ethics = r.data.ethics;
        fields.data.decision = r.data.decision;
      }
      return json({
        item: await commit(env, u, r, { ...r, ...fields }, "edit"),
      });
    }
    if (!op && method === "DELETE") {
      if (!(await edit(env, u, r)) || r.status !== "draft")
        fail(403, "Chỉ xóa bản nháp có quyền sửa.");
      if (
        await one(
          env,
          "SELECT 1 FROM records WHERE project_id=? AND deleted=0",
          r.id,
        )
      )
        fail(409, "Hãy xử lý các hồ sơ con trước.");
      await env.DB.batch([
        stmt(
          env,
          "UPDATE records SET deleted=1,version=version+1 WHERE id=? AND version=?",
          r.id,
          r.version,
        ),
        audit(env, u, "delete", r.id),
      ]);
      return json({ ok: true });
    }
    if (op === "transition" && method === "POST") {
      const b = await body(req);
      if (b.version !== r.version) fail(409, "Phiên bản đã thay đổi.");
      const status = await transition(env, u, r, b.action);
      if (!text(b.note, 2000)) fail(400, "Vui lòng ghi lý do / kết luận.");
      return json({
        item: await commit(
          env,
          u,
          r,
          { ...r, status },
          b.action,
          text(b.note, 2000),
        ),
      });
    }
    if (op === "members") {
      if (!["projects", "teams"].includes(r.kind))
        fail(400, "Loại hồ sơ không có nhóm.");
      if (!has(u, "manage") && !(await lead(env, u, r)))
        fail(403, "Chỉ chủ nhiệm hoặc điều phối được quản lý nhóm.");
      const b = await body(req);
      if (
        !(await one(
          env,
          "SELECT 1 FROM users WHERE id=? AND active=1",
          b.user_id,
        ))
      )
        fail(400, "Thành viên không tồn tại.");
      if (b.user_id === r.owner_id && method === "DELETE")
        fail(409, "Không xóa chủ hồ sơ khỏi nhóm.");
      if (method === "DELETE")
        await run(
          env,
          "DELETE FROM members WHERE project_id=? AND user_id=?",
          r.id,
          b.user_id,
        );
      else {
        if (!["lead", "member", "advisor"].includes(b.role))
          fail(400, "Vai trò không hợp lệ.");
        await run(
          env,
          "INSERT INTO members(project_id,user_id,role) VALUES(?,?,?) ON CONFLICT(project_id,user_id) DO UPDATE SET role=excluded.role",
          r.id,
          b.user_id,
          b.role,
        );
        await notify(
          env,
          b.user_id,
          `Bạn được phân công vào: ${r.title}`,
          r.id,
        ).run();
      }
      await audit(env, u, "membership", r.id, {
        user: b.user_id,
        method,
      }).run();
      return json({ ok: true });
    }
    if (op === "comments" && method === "POST") {
      const b = await body(req),
        content = text(b.content, 5000);
      if (!content) fail(400, "Nhập nội dung thảo luận.");
      await env.DB.batch([
        stmt(
          env,
          "INSERT INTO comments(id,record_id,user_id,content) VALUES(?,?,?,?)",
          uuid(),
          r.id,
          u.id,
          content,
        ),
        audit(env, u, "comment", r.id),
      ]);
      return json({ ok: true });
    }
    if (op === "journey" && method === "PATCH") {
      if (
        r.kind !== "projects" ||
        (!has(u, "manage") && !(await participant(env, u, r)))
      )
        fail(403, "Không có quyền cập nhật hành trình.");
      const b = await body(req);
      if (
        !Number.isInteger(b.step) ||
        b.step < 0 ||
        b.step >= JOURNEY.length ||
        !Number.isInteger(b.progress) ||
        b.progress < 0 ||
        b.progress > 100
      )
        fail(400, "Bước hoặc tiến độ không hợp lệ.");
      if (
        b.assignee &&
        !(await one(
          env,
          "SELECT 1 FROM members WHERE project_id=? AND user_id=?",
          r.id,
          b.assignee,
        ))
      )
        fail(400, "Người phụ trách phải thuộc nhóm.");
      const checklist = Array.isArray(b.checklist)
        ? b.checklist
            .slice(0, 50)
            .map((x) => ({ text: text(x.text, 300), done: !!x.done }))
        : [];
      const res = await env.DB.batch([
        stmt(
          env,
          "UPDATE journey SET progress=?,assignee=?,deadline=?,note=?,checklist=?,version=version+1 WHERE project_id=? AND step=? AND version=?",
          b.progress,
          b.assignee || null,
          text(b.deadline, 20),
          text(b.note),
          JSON.stringify(checklist),
          r.id,
          b.step,
          b.version,
        ),
        stmt(
          env,
          "INSERT INTO history(id,record_id,actor_id,action,note,snapshot) SELECT ?,?,?,?,?,? WHERE changes()=1",
          uuid(),
          r.id,
          u.id,
          "journey",
          JOURNEY[b.step],
          JSON.stringify(b),
        ),
      ]);
      if (!res[0].meta.changes)
        fail(409, "Bước đã được cập nhật bởi người khác.");
      return json({ ok: true });
    }
    if (op === "reviews" && method === "POST") {
      const permitted =
        r.kind === "ethics" ? has(u, "ethics") : has(u, "manage");
      if (!permitted) fail(403, "Không có quyền phân công phản biện.");
      const b = await body(req);
      const reviewer = await one(
        env,
        "SELECT * FROM users WHERE id=? AND active=1",
        b.reviewer_id,
      );
      if (!reviewer) fail(400, "Người phản biện không tồn tại.");
      await permissions(env, reviewer);
      if (!has(reviewer, "review") && !has(reviewer, "ethics"))
        fail(400, "Tài khoản chưa có quyền phản biện.");
      if (await participant(env, reviewer, r))
        fail(409, "Người tham gia không thể phản biện hồ sơ của mình.");
      const round = Math.max(1, Math.min(100, Number(b.round) || 1));
      await env.DB.batch([
        stmt(
          env,
          "INSERT INTO reviews(id,record_id,reviewer_id,round,deadline) VALUES(?,?,?,?,?)",
          uuid(),
          r.id,
          reviewer.id,
          round,
          text(b.deadline, 20),
        ),
        notify(env, reviewer.id, `Yêu cầu phản biện: ${r.title}`, r.id),
        audit(env, u, "assign_review", r.id, { reviewer: reviewer.id, round }),
      ]);
      return json({ ok: true });
    }
    if (op === "vote" && method === "POST") {
      if (
        r.kind !== "ideas" ||
        (await one(env, "SELECT value FROM settings WHERE key='vote_enabled'"))
          ?.value !== "true"
      )
        fail(403, "Bình chọn chưa bật.");
      await run(
        env,
        "INSERT OR IGNORE INTO votes(record_id,user_id) VALUES(?,?)",
        r.id,
        u.id,
      );
      return json({
        count: (
          await one(env, "SELECT COUNT(*) n FROM votes WHERE record_id=?", r.id)
        ).n,
      });
    }
    if (op === "convert" && method === "POST") {
      requirePerm(u, "manage");
      if (r.kind !== "ideas" || !["approved", "completed"].includes(r.status))
        fail(409, "Ý tưởng cần được phê duyệt.");
      const item = await createRecord(env, u, "projects", {
        title: r.title,
        summary: r.summary,
        data: {
          type: "Đổi mới sáng tạo",
          field: r.data.field,
          objectives: r.data.impact,
          method: r.data.solution,
        },
        access: "restricted",
      });
      await audit(env, u, "idea_to_project", r.id, { project: item.id }).run();
      return json({ item }, 201);
    }
    if (op === "registrations") {
      if (r.kind !== "events") fail(400, "Không phải sự kiện.");
      if (method === "POST") {
        if (
          r.status !== "published" ||
          Date.parse(r.data.end + '+07:00') < Date.now()
        )
          fail(409, "Sự kiện không nhận đăng ký.");
        const cap = Math.floor(Number(r.data.capacity));
        const result = await run(
          env,
          "INSERT OR IGNORE INTO registrations(event_id,user_id) SELECT ?,? WHERE (SELECT COUNT(*) FROM registrations WHERE event_id=?)<?",
          r.id,
          u.id,
          r.id,
          cap,
        );
        if (
          !result.meta.changes &&
          !(await one(
            env,
            "SELECT 1 FROM registrations WHERE event_id=? AND user_id=?",
            r.id,
            u.id,
          ))
        )
          fail(409, "Đã đủ số chỗ.");
        if (result.meta.changes) {
          await queueEmail(env, { userId: u.id, subject: `Đăng ký sự kiện thành công: ${r.title}`, message: `Bạn đã đăng ký sự kiện “${r.title}”. Thông tin cập nhật sẽ được gửi qua hệ thống.`, actionUrl: `${env.APP_ORIGIN}/#w/detail/${r.id}` });
          await adminAlert(env, `Có đăng ký sự kiện: ${r.title}`, `${u.name || u.email} vừa đăng ký tham gia sự kiện.`, `${env.APP_ORIGIN}/#w/detail/${r.id}`);
        }
        return json({ ok: true });
      }
      if (!has(u, "manage") && !(await lead(env, u, r)))
        fail(403, "Không được xem danh sách đăng ký.");
      if (method === "PATCH") {
        const b = await body(req);
        await run(
          env,
          "UPDATE registrations SET attended=? WHERE event_id=? AND user_id=?",
          b.attended ? 1 : 0,
          r.id,
          b.user_id,
        );
        await audit(env, u, "attendance", r.id, {
          user: b.user_id,
          attended: !!b.attended,
        }).run();
        return json({ ok: true });
      }
      return json({
        items: await all(
          env,
          "SELECT g.*,u.name,u.email FROM registrations g JOIN users u ON u.id=g.user_id WHERE event_id=?",
          r.id,
        ),
      });
    }

    if (op === "response-files" && method === "POST") {
      if (
        r.kind !== "forms" ||
        !["active", "approved", "published"].includes(r.status)
      )
        fail(409, "Biểu mẫu chưa mở.");
      const bytes = await boundedBody(req, 10 * 1024 * 1024),
        name = text(url.searchParams.get("name"), 180).replace(
          /[\\/\r\n]/g,
          "_",
        );
      if (
        !/\.(pdf|txt|csv|png|jpg|jpeg|docx|xlsx)$/i.test(name) ||
        !bytes.length
      )
        fail(400, "Tệp không hỗ trợ.");
      const id = uuid(),
        key = `responses/${r.id}/${u.id}/${id}`;
      await env.STORAGE.put(key, bytes);
      try {
        await run(
          env,
          "INSERT INTO response_files(id,form_id,user_id,object_key,name,mime,size) VALUES(?,?,?,?,?,?,?)",
          id,
          r.id,
          u.id,
          key,
          name,
          "application/octet-stream",
          bytes.length,
        );
      } catch (e) {
        await env.STORAGE.delete(key);
        throw e;
      }
      await audit(env, u, "response_upload", id).run();
      return json({ id }, 201);
    }
    if (op === "responses") {
      if (r.kind !== "forms") fail(400, "Không phải biểu mẫu.");
      if (method === "GET") {
        if (!has(u, "manage") && !(await lead(env, u, r)))
          fail(403, "Không được xem phản hồi.");
        return json({
          items: await all(
            env,
            "SELECT * FROM form_responses WHERE form_id=? ORDER BY created_at DESC LIMIT 500",
            r.id,
          ),
        });
      }
      if (method === "POST") {
        if (!["active", "published", "approved"].includes(r.status))
          fail(409, "Biểu mẫu chưa mở.");
        const b = await body(req),
          answers = {};
        for (const f of r.data.fields || []) {
          const v = b.answers?.[f.key];
          if (f.required && !String(v || "").trim())
            fail(400, `Thiếu: ${f.label}`);
          answers[f.key] = text(String(v ?? ""), 10000);
          if (
            f.type === "file" &&
            v &&
            !(await one(
              env,
              "SELECT 1 FROM response_files WHERE id=? AND form_id=? AND user_id=?",
              v,
              r.id,
              u.id,
            ))
          )
            fail(400, "Tệp phản hồi không thuộc tài khoản này.");
          if (f.type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
            fail(400, "Email phản hồi không hợp lệ.");
          if (f.type === "number" && v && !Number.isFinite(Number(v)))
            fail(400, "Số phản hồi không hợp lệ.");
          if (f.type === "select" && v && !f.options.includes(v))
            fail(400, "Lựa chọn không hợp lệ.");
        }
        await run(
          env,
          "INSERT INTO form_responses(id,form_id,user_id,answers) VALUES(?,?,?,?)",
          uuid(),
          r.id,
          u.id,
          JSON.stringify(answers),
        );
        await queueEmail(env, { userId: u.id, subject: `Đã ghi nhận phản hồi: ${r.title}`, message: `Trung tâm đã ghi nhận phản hồi của bạn cho biểu mẫu “${r.title}”.`, actionUrl: env.APP_ORIGIN });
        await adminAlert(env, `Có phản hồi biểu mẫu: ${r.title}`, `${u.name || u.email} vừa gửi một phản hồi mới.`, `${env.APP_ORIGIN}/#w/detail/${r.id}`);
        return json({ ok: true }, 201);
      }
    }
    if (op === "files" && method === "POST") {
      if (!(await edit(env, u, r)))
        fail(403, "Không được thêm tệp vào hồ sơ đã khóa.");
      if (!env.STORAGE) fail(503, "Storage chưa được cấu hình.");
      const bytes = await boundedBody(req, 10 * 1024 * 1024);
      const name = text(url.searchParams.get("name"), 180).replace(
        /[\\/\r\n\x00-\x1f]/g,
        "_",
      );
      const ext = name.split(".").pop().toLowerCase();
      const allowed = {
        pdf: "application/pdf",
        txt: "text/plain",
        csv: "text/csv",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      };
      if (!allowed[ext] || !bytes.length)
        fail(400, "Định dạng không hỗ trợ hoặc tệp rỗng.");
      if (
        ext === "pdf" &&
        new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-"
      )
        fail(400, "PDF không hợp lệ.");
      const id = uuid(),
        key = `records/${r.id}/${id}/${name}`,
        digest = await hash(bytes);
      await env.STORAGE.put(key, bytes, {
        httpMetadata: { contentType: allowed[ext] },
      });
      try {
        await env.DB.batch([
          stmt(
            env,
            "INSERT INTO files(id,record_id,object_key,name,mime,size,sha256,uploaded_by,version,journey_step) VALUES(?,?,?,?,?,?,?,?,?,?)",
            id,
            r.id,
            key,
            name,
            allowed[ext],
            bytes.length,
            digest,
            u.id,
            r.version,
            r.kind === "projects" &&
              /^([0-9]|1[0-4])$/.test(url.searchParams.get("step") || "")
              ? Number(url.searchParams.get("step"))
              : null,
          ),
          audit(env, u, "upload", id, {
            record: r.id,
            size: bytes.length,
            hash: digest,
          }),
        ]);
      } catch (e) {
        await env.STORAGE.delete(key);
        throw e;
      }
      return json({ id, name }, 201);
    }
    fail(405, "Thao tác không được hỗ trợ.");
  }
  const rev = p.match(/^\/api\/reviews\/([^/]+)$/);
  if (rev && method === "PATCH") {
    const v = await one(env, "SELECT * FROM reviews WHERE id=?", rev[1]);
    if (!v) fail(404, "Không tìm thấy phiếu.");
    const r = await record(env, v.record_id);
    await canRead(env, u, r);
    const b = await body(req);
    if (b.response !== undefined) {
      if (!(await lead(env, u, r))) fail(403, "Chỉ tác giả được gửi phản hồi.");
      await run(
        env,
        "UPDATE reviews SET response=? WHERE id=?",
        text(b.response),
        v.id,
      );
      await audit(env, u, "author_response", r.id).run();
      return json({ ok: true });
    }
    if (v.reviewer_id !== u.id) fail(403, "Phiếu thuộc người phản biện khác.");
    if (v.submitted_at) fail(409, "Phiếu đã gửi; hãy tạo vòng phản biện mới.");
    if (
      !["accepted", "revision", "rejected"].includes(b.verdict) ||
      !Number.isInteger(b.score) ||
      b.score < 0 ||
      b.score > 100 ||
      !text(b.comment)
    )
      fail(400, "Điểm, kết luận hoặc nhận xét chưa hợp lệ.");
    if (await participant(env, u, r)) fail(403, "Xung đột lợi ích với hồ sơ.");
    await env.DB.batch([
      stmt(
        env,
        "UPDATE reviews SET score=?,verdict=?,comment=?,rubric=?,submitted_at=CURRENT_TIMESTAMP WHERE id=? AND submitted_at IS NULL",
        b.score,
        b.verdict,
        text(b.comment),
        JSON.stringify(b.rubric || {}),
        v.id,
      ),
      audit(env, u, "review_submitted", r.id, { round: v.round }),
      notify(env, r.owner_id, `Có kết quả phản biện: ${r.title}`, r.id),
    ]);
    return json({ ok: true });
  }
  if (p === "/api/reviews")
    return json({
      items: await all(
        env,
        `SELECT v.*,r.title,r.kind FROM reviews v JOIN records r ON r.id=v.record_id WHERE ${has(u, "manage") ? "1=1" : "v.reviewer_id=?"} ORDER BY v.submitted_at,v.deadline LIMIT 200`,
        ...(has(u, "manage") ? [] : [u.id]),
      ),
    });
  const file = p.match(/^\/api\/files\/([^/]+)$/);
  if (file) {
    const f = await one(
      env,
      "SELECT * FROM files WHERE id=? AND deleted=0",
      file[1],
    );
    if (!f) fail(404, "Không tìm thấy tệp.");
    const r = await record(env, f.record_id);
    await canRead(env, u, r);
    if (method === "DELETE") {
      if (!(await edit(env, u, r))) fail(403, "Không được xóa tệp.");
      await env.DB.batch([
        stmt(env, "UPDATE files SET deleted=1 WHERE id=?", f.id),
        audit(env, u, "file_soft_delete", f.id),
      ]);
      return json({ ok: true });
    }
    await audit(env, u, "file_download", f.id).run();
    const object = await env.STORAGE.get(f.object_key);
    if (!object) fail(404, "Tệp chưa có trên storage.");
    return new Response(object.body, {
      headers: {
        "content-type": f.mime,
        "content-length": String(f.size),
        "content-disposition": `${new URL(req.url).searchParams.get("preview") === "1" && ["image/png", "image/jpeg", "image/webp"].includes(f.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
        "cache-control": "private,no-store",
      },
    });
  }
  if (p === "/api/admin/users") {
    requirePerm(u, "users");
    if (method === "GET")
      return json({
        items: await all(
          env,
          "SELECT u.id,u.email,u.name,u.active,u.force_change,u.created_at,GROUP_CONCAT(ur.role) roles FROM users u LEFT JOIN user_roles ur ON ur.user_id=u.id GROUP BY u.id ORDER BY u.created_at DESC LIMIT 1000",
        ),
        roles: ROLE_NAMES,
      });
    const b = await body(req);
    if (method === "POST") {
      if (
        !ROLE_NAMES[b.role] ||
        (!has(u, "settings") &&
          ["system_admin", "center_admin"].includes(b.role))
      )
        fail(403, "Không được cấp vai trò này.");
      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email || "") ||
        !text(b.name, 160)
      )
        fail(400, "Tên/email không hợp lệ.");
      const id = uuid();
      await env.DB.batch([
        stmt(
          env,
          "INSERT INTO users(id,email,name,password,role,force_change) VALUES(?,?,?,?,'researcher',1)",
          id,
          text(b.email, 200).toLowerCase(),
          text(b.name, 160),
          await passwordHash(b.password),
        ),
        stmt(
          env,
          "INSERT INTO user_roles(user_id,role) VALUES(?,?)",
          id,
          b.role,
        ),
        audit(env, u, "user_create", id, { role: b.role }),
      ]);
      await queueEmail(env, { userId: id, subject: "Tài khoản Sky First Research & Innovation Center đã được tạo", message: `Xin chào ${text(b.name,160)}, tài khoản của bạn đã được Trung tâm tạo với vai trò ${ROLE_NAMES[b.role] || b.role}. Vì lý do bảo mật, mật khẩu không được gửi qua email.`, actionUrl: env.APP_ORIGIN + "/#login", actionLabel: "Đăng nhập" });
      return json({ id }, 201);
    }
    if (method === "PATCH") {
      const target = await one(env, "SELECT * FROM users WHERE id=?", b.id);
      if (!target) fail(404, "Không tìm thấy tài khoản.");
      const targetRoles = await all(
        env,
        "SELECT role FROM user_roles WHERE user_id=?",
        b.id,
      );
      if (b.id === u.id)
        fail(409, "Không tự thay đổi quyền/trạng thái tại đây.");
      if (
        targetRoles.some(
          (x) =>
            x.role === "system_admin" ||
            (x.role === "center_admin" && !has(u, "settings")),
        ) ||
        b.role === "system_admin"
      )
        fail(403, "Vai trò System Admin được bảo vệ.");
      if (
        !ROLE_NAMES[b.role] ||
        (!has(u, "settings") && b.role === "center_admin")
      )
        fail(403, "Không được cấp vai trò này.");
      await env.DB.batch([
        stmt(
          env,
          "UPDATE users SET active=? WHERE id=?",
          b.active ? 1 : 0,
          b.id,
        ),
        stmt(env, "DELETE FROM user_roles WHERE user_id=?", b.id),
        stmt(
          env,
          "INSERT INTO user_roles(user_id,role) VALUES(?,?)",
          b.id,
          b.role,
        ),
        stmt(env, "DELETE FROM sessions WHERE user_id=?", b.id),
        audit(env, u, "user_permissions", b.id, {
          role: b.role,
          active: !!b.active,
        }),
      ]);
      return json({ ok: true });
    }
  }
  if (p === "/api/admin/reset" && method === "POST") {
    requirePerm(u, "users");
    const b = await body(req);
    if (
      (await one(
        env,
        "SELECT 1 FROM user_roles WHERE user_id=? AND role='system_admin'",
        b.user_id,
      )) &&
      !has(u, "settings")
    )
      fail(403, "Không được đặt lại tài khoản này.");
    if (!(await one(env, "SELECT 1 FROM users WHERE id=?", b.user_id)))
      fail(404, "Không tìm thấy tài khoản.");
    const t = random();
    await env.DB.batch([
      stmt(env, "DELETE FROM reset_tokens WHERE user_id=?", b.user_id),
      stmt(env, "UPDATE outbox SET status='cancelled',payload='{}',request_body=NULL WHERE user_id=? AND status='pending' AND json_extract(payload,'$.type')='password_reset'", b.user_id),
      stmt(
        env,
        "INSERT INTO reset_tokens(hash,user_id,expires) VALUES(?,?,?)",
        await hash(t),
        b.user_id,
        now() + 1800,
      ),
      audit(env, u, "reset_link_issued", b.user_id),
    ]);
    const resetUrl = env.APP_ORIGIN + "/#reset/" + t;
    await queueEmail(env, { userId: b.user_id, subject: "Liên kết đặt lại mật khẩu", message: "Quản trị viên đã tạo liên kết đặt lại mật khẩu cho tài khoản của bạn. Liên kết có hiệu lực 30 phút và chỉ dùng một lần.", actionUrl: resetUrl, actionLabel: "Đặt lại mật khẩu", type: "password_reset", expiresAt: now()+1800 });
    return json({ url: resetUrl, expires_in: 1800, email_queued: true, email_configured: !!env.RESEND_API_KEY });
  }
  if (p === "/api/admin/roles") {
    requirePerm(u, "settings");
    if (method === "GET")
      return json({
        roles: ROLE_NAMES,
        permissions: PERMISSIONS,
        grants: await all(env, "SELECT * FROM role_permissions"),
      });
    const b = await body(req);
    if (
      !ROLE_NAMES[b.role] ||
      b.role === "system_admin" ||
      !Array.isArray(b.permissions) ||
      b.permissions.some((x) => !PERMISSIONS[x])
    )
      fail(400, "Vai trò hoặc quyền không hợp lệ.");
    await env.DB.batch([
      stmt(env, "DELETE FROM role_permissions WHERE role=?", b.role),
      ...b.permissions.map((p) =>
        stmt(
          env,
          "INSERT INTO role_permissions(role,permission) VALUES(?,?)",
          b.role,
          p,
        ),
      ),
      audit(env, u, "role_change", b.role, { permissions: b.permissions }),
    ]);
    return json({ ok: true });
  }
  if (p === "/api/admin/settings") {
    requirePerm(u, "settings");
    if (method === "GET")
      return json({
        settings: Object.fromEntries(
          (
            await all(
              env,
              "SELECT key,value FROM settings WHERE key<>'initialized'",
            )
          ).map((x) => [x.key, x.value]),
        ),
      });
    const b = await body(req),
      allowed = [
        "intro",
        "mission",
        "vision",
        "values",
        "contact",
        "prefix",
        "vote_enabled",
      ];
    const q = [];
    for (const k of allowed)
      if (b[k] !== undefined) {
        let v = text(String(b[k]), 10000);
        if (k === "prefix" && !/^[A-Z0-9-]{2,16}$/.test(v))
          fail(400, "Prefix chỉ gồm chữ in hoa, số, gạch nối (2–16 ký tự).");
        q.push(
          stmt(
            env,
            "INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            k,
            v,
          ),
        );
      }
    await env.DB.batch([
      ...q,
      audit(env, u, "settings_change", null, { keys: Object.keys(b) }),
    ]);
    return json({ ok: true });
  }
  if (p === "/api/admin/notices" && method === "POST") {
    requirePerm(u, "manage");
    const b = await body(req),
      title = text(b.title, 500);
    if (!title) fail(400, "Nhập nội dung thông báo.");
    if (b.user_id) await notify(env, b.user_id, title, null).run();
    else
      await run(
        env,
        "INSERT INTO notifications(id,user_id,title) SELECT lower(hex(randomblob(16))),id,? FROM users WHERE active=1",
        title,
      );
    await audit(env, u, "notice", null).run();
    return json({ ok: true });
  }
  if (p === "/api/admin/email" && method === "GET") {
    requirePerm(u,"settings");
    return json({configured:!!env.RESEND_API_KEY,items:await all(env,"SELECT id,subject,status,attempts,last_error,sent_at,created_at,next_attempt_at,provider_id FROM outbox ORDER BY created_at DESC LIMIT 100")});
  }
  if (p === "/api/admin/email/retry" && method === "POST") {
    requirePerm(u,"settings");
    const b=await body(req), job=await one(env,"SELECT * FROM outbox WHERE id=?",text(b.id,100));
    if (!job || job.status!=="failed") fail(409,"Email không ở trạng thái lỗi.");
    const payload=JSON.parse(job.payload || '{}');
    if ((job.first_attempt_at && now()-job.first_attempt_at>=23*3600) || (payload.type==='password_reset' && payload.expires_at<=now()) || job.last_error==='reset_link_expired') fail(409,"Job đã hết hạn an toàn. Hãy phát hành thông báo/liên kết mới.");
    await env.DB.batch([
      stmt(env,"UPDATE outbox SET status='pending',attempts=0,next_attempt_at=0,last_error=NULL WHERE id=? AND status='failed'",job.id),
      audit(env,u,"email_retry",job.id),
    ]);
    return json({ok:true});
  }
  if (p === "/api/admin/email/flush" && method === "POST") {
    requirePerm(u,"settings");
    await audit(env,u,"email_flush",null).run();
    return json(await flushOutbox(env));
  }
  if (p === "/api/admin/audit") {
    requirePerm(u, "audit");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    return json({
      items: await all(
        env,
        "SELECT a.*,u.name FROM audit a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.created_at DESC LIMIT 100 OFFSET ?",
        (page - 1) * 100,
      ),
      page,
    });
  }
  if (p === "/api/admin/export") {
    requirePerm(u, "settings");
    const tables = [
      "records",
      "members",
      "reviews",
      "files",
      "history",
      "journey",
      "comments",
      "form_responses",
      "registrations",
      "response_files",
      "metrics",
      "settings",
      "roles",
      "role_permissions",
      "user_roles",
      "notifications",
      "audit",
    ];
    const table = url.searchParams.get("table");
    if (!tables.includes(table)) return json({ tables });
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    const items = await all(
      env,
      `SELECT * FROM ${table} LIMIT 500 OFFSET ?`,
      offset,
    );
    await audit(env, u, "export", table, { offset }).run();
    return json({
      table,
      items,
      next_offset: items.length === 500 ? offset + 500 : null,
    });
  }
  fail(404, "API không tồn tại.");
}
export async function publicFile(req, env, id) {
  const f = await one(
    env,
    "SELECT f.* FROM files f JOIN records r ON r.id=f.record_id WHERE f.id=? AND f.deleted=0 AND r.deleted=0 AND r.status='published' AND r.access='public'",
    id,
  );
  if (!f) fail(404, "Không tìm thấy tệp.");
  const r = await record(env, f.record_id);
  if (!PUBLIC_KINDS.includes(r.kind)) fail(404, "Không tìm thấy tệp.");
  const object = await env.STORAGE.get(f.object_key);
  if (!object) fail(404, "Tệp không có trên storage.");
  await audit(env, null, "public_download", f.id).run();
  await run(
    env,
    "INSERT INTO metrics(record_id,downloads) VALUES(?,1) ON CONFLICT(record_id) DO UPDATE SET downloads=downloads+1",
    r.id,
  );
  return new Response(object.body, {
    headers: {
      "content-type": f.mime,
      "content-disposition": `${new URL(req.url).searchParams.get("preview") === "1" && ["image/png", "image/jpeg", "image/webp"].includes(f.mime) ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "cache-control": "no-store",
    },
  });
}

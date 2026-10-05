import { uuid, fail } from "./security.js";
export const stmt = (env, q, ...args) => env.DB.prepare(q).bind(...args);
export const one = (env, q, ...args) => stmt(env, q, ...args).first();
export const all = async (env, q, ...args) =>
  (await stmt(env, q, ...args).all()).results || [];
export const run = (env, q, ...args) => stmt(env, q, ...args).run();
export const audit = (env, u, action, id, detail = {}) =>
  stmt(
    env,
    "INSERT INTO audit(id,actor_id,action,target_id,detail) VALUES(?,?,?,?,?)",
    uuid(),
    u?.id || null,
    action,
    id || null,
    JSON.stringify(detail),
  );
export const parse = (r) =>
  r ? { ...r, data: JSON.parse(r.data || "{}") } : null;
export const record = async (env, id) => {
  const r = parse(
    await one(env, "SELECT * FROM records WHERE id=? AND deleted=0", id),
  );
  if (!r) fail(404, "Không tìm thấy hồ sơ.");
  return r;
};
export const notify = (env, user, title, id) =>
  stmt(
    env,
    "INSERT INTO notifications(id,user_id,title,record_id) VALUES(?,?,?,?)",
    uuid(),
    user,
    title,
    id,
  );
export async function commit(env, u, r, next, action, note = "") {
  const result = await env.DB.batch([
    stmt(
      env,
      `UPDATE records SET title=?,summary=?,data=?,status=?,access=?,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND version=?`,
      next.title,
      next.summary,
      JSON.stringify(next.data),
      next.status,
      next.access,
      r.id,
      r.version,
    ),
    // Gate follow-up writes with changes(): conflict produces no audit or history.
    stmt(
      env,
      `INSERT INTO history(id,record_id,actor_id,action,note,snapshot) SELECT ?,?,?,?,?,? WHERE changes()=1`,
      uuid(),
      r.id,
      u.id,
      action,
      note,
      JSON.stringify({ ...next, version: r.version + 1 }),
    ),
    stmt(
      env,
      `INSERT INTO audit(id,actor_id,action,target_id,detail) SELECT ?,?,?,?,? WHERE changes()=1`,
      uuid(),
      u.id,
      action,
      r.id,
      JSON.stringify({
        before_version: r.version,
        after_version: r.version + 1,
        note,
      }),
    ),
  ]);
  if (!result[0].meta?.changes)
    fail(409, "Hồ sơ đã thay đổi. Tải lại trước khi lưu.");
  if (r.owner_id !== u.id)
    await notify(env, r.owner_id, `${action}: ${r.title}`, r.id).run();
  return { ...next, version: r.version + 1 };
}

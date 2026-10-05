import { all, one } from "./db.js";
import { fail } from "./security.js";
export const ROLE_NAMES = {
  system_admin: "System Admin",
  center_admin: "Center Admin",
  research_manager: "Research Manager",
  principal_investigator: "Principal Investigator",
  researcher: "Researcher",
  research_assistant: "Research Assistant",
  reviewer: "Reviewer",
  ethics_reviewer: "Ethics Reviewer",
  data_manager: "Data Manager",
  editor: "Editor",
  finance_manager: "Finance Manager",
  member: "Member",
  guest: "Guest",
};
export const PERMISSIONS = {
  manage: "Điều phối nghiên cứu",
  users: "Quản lý tài khoản và quyền",
  finance: "Quản lý kinh phí",
  ethics: "Duyệt đạo đức nghiên cứu",
  publish: "Biên tập và công bố",
  data: "Quản lý kho dữ liệu",
  review: "Nhận phân công phản biện",
  create: "Tạo hồ sơ nghiên cứu",
  settings: "Cấu hình hệ thống",
  audit: "Xem nhật ký quản trị",
};
export const DEFAULT_GRANTS = {
  system_admin: Object.keys(PERMISSIONS),
  center_admin: [
    "manage",
    "users",
    "finance",
    "ethics",
    "publish",
    "data",
    "review",
    "create",
    "audit",
  ],
  research_manager: ["manage", "create", "review"],
  principal_investigator: ["create"],
  researcher: ["create"],
  research_assistant: ["create"],
  reviewer: ["review"],
  ethics_reviewer: ["ethics", "review"],
  data_manager: ["data", "create"],
  editor: ["publish", "create"],
  finance_manager: ["finance", "create"],
  member: ["create"],
  guest: [],
};
export async function permissions(env, u) {
  u.roles = (
    await all(env, "SELECT role FROM user_roles WHERE user_id=?", u.id)
  ).map((x) => x.role);
  u.permissions = (
    await all(
      env,
      "SELECT DISTINCT rp.permission FROM role_permissions rp JOIN user_roles ur ON ur.role=rp.role WHERE ur.user_id=?",
      u.id,
    )
  ).map((x) => x.permission);
  return u;
}
export const has = (u, p) =>
  u?.roles?.includes("system_admin") || u?.permissions?.includes(p);
export const requirePerm = (u, p) => {
  if (!has(u, p)) fail(403, "Bạn không có quyền thực hiện thao tác này.");
};
export async function participant(env, u, r) {
  if (r.owner_id === u.id) return true;
  return !!(await one(
    env,
    "SELECT 1 FROM members WHERE project_id=? AND user_id=?",
    r.project_id || r.id,
    u.id,
  ));
}
export async function lead(env, u, r) {
  if (r.owner_id === u.id) return true;
  return !!(await one(
    env,
    "SELECT 1 FROM members WHERE project_id=? AND user_id=? AND role='lead'",
    r.project_id || r.id,
    u.id,
  ));
}
export async function view(env, u, r) {
  if (has(u, "manage") || has(u, "settings")) return true;
  if (
    await one(
      env,
      "SELECT 1 FROM reviews WHERE record_id=? AND reviewer_id=?",
      r.id,
      u.id,
    )
  )
    return true;
  if (r.kind === "budgets") return has(u, "finance") || r.owner_id === u.id;
  if (r.kind === "ethics" && has(u, "ethics")) return true;
  if (r.kind === "partners") return false;
  if (["datasets", "documents"].includes(r.kind) && has(u, "data")) return true;
  if (["pages", "news", "publications"].includes(r.kind) && has(u, "publish"))
    return true;
  if (r.owner_id === u.id) return true;
  if (
    await one(
      env,
      "SELECT 1 FROM reviews WHERE record_id=? AND reviewer_id=?",
      r.id,
      u.id,
    )
  )
    return true;
  if (r.access === "confidential") return false;
  if (r.access === "internal" || r.access === "public") return true;
  return participant(env, u, r);
}
export async function edit(env, u, r) {
  if (
    [
      "published",
      "completed",
      "approved",
      "reviewing",
      "submitted",
      "screening",
      "archived",
      "rejected",
      "expired",
    ].includes(r.status)
  )
    return false;
  if (r.kind === "budgets") return has(u, "finance") || r.owner_id === u.id;
  if (r.kind === "ethics" && has(u, "ethics")) return true;
  if (["datasets", "documents"].includes(r.kind) && has(u, "data")) return true;
  if (["pages", "news"].includes(r.kind)) return has(u, "publish");
  if (has(u, "manage")) return true;
  return lead(env, u, r) || (r.kind === "tasks" && r.data.assignee === u.id);
}
// SQL ACL is used BEFORE pagination/search so inaccessible rows never affect totals.
export function scope(u) {
  if (has(u, "manage") || has(u, "settings")) return { q: "1=1", args: [] };
  let clauses = ["r.owner_id=?"],
    args = [u.id];
  clauses.push(
    "EXISTS(SELECT 1 FROM reviews rv WHERE rv.record_id=r.id AND rv.reviewer_id=?)",
  );
  args.push(u.id);
  clauses.push(
    "(r.kind NOT IN ('budgets','partners') AND (r.access IN ('public','internal') OR (r.access<>'confidential' AND EXISTS(SELECT 1 FROM members m WHERE m.project_id=COALESCE(r.project_id,r.id) AND m.user_id=?))))",
  );
  args.push(u.id);
  for (const [p, kinds] of [
    ["finance", ["budgets"]],
    ["ethics", ["ethics"]],
    ["data", ["datasets", "documents"]],
    ["publish", ["pages", "news", "publications"]],
  ])
    if (has(u, p))
      clauses.push(`r.kind IN (${kinds.map((x) => `'${x}'`).join(",")})`);
  return { q: "(" + clauses.join(" OR ") + ")", args };
}

import { CATALOG, PUBLIC_KINDS } from "../public/catalog.js";
import { fail } from "./security.js";
import { has, lead, participant } from "./policy.js";
import { one, all } from "./db.js";
export const text = (v, max = 10000) => {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
};
export function validate(kind, b, required = false) {
  const spec = CATALOG[kind];
  if (!spec) fail(400, "Loại hồ sơ không hợp lệ.");
  const title = text(b.title, 240);
  if (!title) fail(400, "Vui lòng nhập tên hồ sơ.");
  const data = {};
  for (const [key, label, type, mandatory, options] of spec.fields) {
    const value = b.data?.[key];
    if (
      required &&
      mandatory &&
      (value === undefined || value === null || String(value).trim() === "")
    )
      fail(400, `Thiếu: ${label}`);
    if (value === undefined || value === "") {
      data[key] = "";
      continue;
    }
    if (type === "number") {
      const n = Number(value);
      if (
        !Number.isFinite(n) ||
        n < 0 ||
        n > 1e12 ||
        (key === "progress" && n > 100)
      )
        fail(400, `${label} không hợp lệ.`);
      data[key] = n;
    } else {
      data[key] = text(value);
      if (type === "select" && !options.includes(data[key]))
        fail(400, `${label} không hợp lệ.`);
      if (
        ["date", "datetime-local"].includes(type) &&
        !/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(data[key])
      )
        fail(400, `${label} không hợp lệ.`);
      if (type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data[key]))
        fail(400, "Email không hợp lệ.");
    }
  }
  if (data.start && data.end && data.end < data.start)
    fail(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  if (data.start && data.due && data.due < data.start)
    fail(400, "Hạn hoàn thành phải sau ngày bắt đầu.");
  if (kind === "forms") {
    const fields = b.data?.fields || [];
    if (!Array.isArray(fields) || fields.length > 40)
      fail(400, "Biểu mẫu tối đa 40 trường.");
    const seen = new Set();
    data.fields = fields.map((f) => {
      if (
        !/^[a-z][a-z0-9_]{0,39}$/.test(f.key) ||
        seen.has(f.key) ||
        ![
          "text",
          "textarea",
          "email",
          "number",
          "date",
          "select",
          "file",
        ].includes(f.type) ||
        !text(f.label, 200)
      )
        fail(400, "Trường biểu mẫu không hợp lệ.");
      seen.add(f.key);
      return {
        key: f.key,
        label: text(f.label, 200),
        type: f.type,
        required: !!f.required,
        options: Array.isArray(f.options)
          ? f.options.slice(0, 50).map((x) => text(x, 200))
          : [],
      };
    });
  }
  let access = b.access || "restricted";
  if (!["public", "internal", "restricted", "confidential"].includes(access))
    fail(400, "Phạm vi truy cập không hợp lệ.");
  if (
    ["budgets", "partners", "ethics", "councils", "collaborations"].includes(
      kind,
    ) &&
    ["public", "internal"].includes(access)
  )
    fail(400, "Hồ sơ này phải hạn chế truy cập.");
  return { title, summary: text(b.summary, 3000), data, access };
}
export async function transition(env, u, r, action) {
  const owner =
    (await lead(env, u, r)) || (r.kind === "tasks" && r.data.assignee === u.id);
  const manager = has(u, "manage");
  const approver =
    r.kind === "budgets"
      ? has(u, "finance")
      : r.kind === "ethics"
        ? has(u, "ethics")
        : manager;
  const map = {
    submit: [["draft", "revision"], "submitted", owner || manager],
    screen: [["submitted"], "screening", approver],
    review: [["submitted", "screening"], "reviewing", approver],
    revise: [
      ["submitted", "screening", "reviewing", "acceptance"],
      "revision",
      approver,
    ],
    approve: [["submitted", "screening", "reviewing"], "approved", approver],
    reject: [
      ["submitted", "screening", "reviewing", "acceptance"],
      "rejected",
      approver,
    ],
    start: [["approved"], "active", owner || manager],
    acceptance: [["active"], "acceptance", owner || manager],
    complete: [
      ["acceptance", "approved", "active"],
      "completed",
      approver ||
        (["tasks", "milestones", "journals"].includes(r.kind) && owner),
    ],
    publish: [["completed", "approved"], "published", has(u, "publish")],
    archive: [
      ["published", "completed", "active", "rejected"],
      "archived",
      manager,
    ],
    reopen: [
      ["rejected", "archived", "approved", "completed", "expired"],
      "draft",
      manager,
    ],
  };
  const rule = map[action];
  if (!rule || !rule[2]) fail(403, "Bạn không có quyền chuyển trạng thái này.");
  if (!rule[0].includes(r.status))
    fail(409, "Trạng thái hiện tại không cho phép thao tác.");
  if (["submit", "approve", "publish"].includes(action))
    validate(r.kind, r, true);
  if (
    ["approve", "complete"].includes(action) &&
    ["projects", "ethics", "budgets", "acceptances"].includes(r.kind) &&
    (await participant(env, u, r))
  )
    fail(
      403,
      "Người tham gia hồ sơ không được tự phê duyệt/nghiệm thu. Hãy phân công người độc lập.",
    );
  if (action === "approve" && r.status === "reviewing") {
    const rv = await all(
      env,
      "SELECT * FROM reviews WHERE record_id=? AND round=(SELECT MAX(round) FROM reviews WHERE record_id=?)",
      r.id,
      r.id,
    );
    if (!rv.length || rv.some((x) => !x.submitted_at))
      fail(409, "Cần hoàn thành các phiếu phản biện của vòng hiện tại.");
  }
  if (
    action === "start" &&
    r.kind === "projects" &&
    r.data.human_subjects === "Có"
  ) {
    const e = await one(
      env,
      "SELECT id FROM records WHERE project_id=? AND kind='ethics' AND status='approved' AND deleted=0 AND json_extract(data,'$.expires')>=date('now')",
      r.id,
    );
    if (!e) fail(409, "Cần hồ sơ đạo đức nội bộ được duyệt và còn hiệu lực.");
  }
  if (action === "complete" && r.kind === "projects") {
    const ac = await one(
      env,
      "SELECT id FROM records WHERE project_id=? AND kind='acceptances' AND status IN ('approved','completed') AND deleted=0",
      r.id,
    );
    if (!ac) fail(409, "Cần hồ sơ nghiệm thu được phê duyệt.");
  }
  if (action === "approve" && r.kind === "acceptances") {
    const council = await one(
      env,
      "SELECT id FROM records WHERE id=? AND kind='councils' AND project_id=? AND deleted=0 AND json_extract(data,'$.conclusion')<>''",
      r.data.council,
      r.project_id,
    );
    if (!council) fail(409, "Cần hội đồng cùng đề tài và có kết luận.");
  }
  if (action === "publish") {
    if (!PUBLIC_KINDS.includes(r.kind) || r.access !== "public")
      fail(400, "Chỉ công bố hồ sơ được chọn phạm vi Public.");
    if (r.kind === "datasets" && r.data.personal === "Có dữ liệu cá nhân")
      fail(400, "Không công bố dataset chứa dữ liệu cá nhân.");
  }
  return rule[1];
}

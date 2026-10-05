import { CATALOG, JOURNEY } from "../public/catalog.js";
import { ROLE_NAMES, DEFAULT_GRANTS, PERMISSIONS } from "../src/policy.js";
import { passwordHash } from "../src/security.js";
import { mkdirSync } from "node:fs";
import { database } from "./runtime.mjs";
export async function seed(DB, password) {
  if (!password || password.length < 12)
    throw new Error("Set DEMO_PASSWORD (12+ characters). No default password.");
  const pw = await passwordHash(password);
  const run = (q, ...a) =>
    DB.prepare(q)
      .bind(...a)
      .run();
  for (const [c, n] of Object.entries(ROLE_NAMES))
    await run("INSERT OR IGNORE INTO roles VALUES(?,?)", c, n);
  for (const [c, n] of Object.entries(PERMISSIONS))
    await run("INSERT OR IGNORE INTO permissions VALUES(?,?)", c, n);
  for (const [r, ps] of Object.entries(DEFAULT_GRANTS))
    for (const p of ps)
      await run("INSERT OR IGNORE INTO role_permissions VALUES(?,?)", r, p);
  for (const [id, role, name] of [
    ["demo-admin", "system_admin", "Quản trị DEMO"],
    ["demo-researcher", "researcher", "Nhà nghiên cứu DEMO"],
    ["demo-reviewer", "reviewer", "Phản biện DEMO"],
    ["demo-manager", "research_manager", "Điều phối DEMO"],
    ["demo-finance", "finance_manager", "Kinh phí DEMO"],
    ["demo-ethics", "ethics_reviewer", "Đạo đức DEMO"],
  ]) {
    await run(
      "INSERT OR IGNORE INTO users(id,email,name,password,role) VALUES(?,?,?,?,'researcher')",
      id,
      id + "@example.test",
      name,
      pw,
    );
    await run("INSERT OR IGNORE INTO user_roles VALUES(?,?)", id, role);
  }
  await run("INSERT OR IGNORE INTO settings VALUES('initialized','1')");
  await run("INSERT OR IGNORE INTO settings VALUES('demo','true')");
  await run(
    "INSERT OR IGNORE INTO settings VALUES('intro','Không gian kết nối nghiên cứu, thử nghiệm và những giải pháp tạo tác động tích cực cho cộng đồng.')",
  );
  const titles = {
    projects: "[DEMO] Học tập chủ động trong cộng đồng số",
    ideas: "[DEMO] Thư viện tài nguyên học tập mở",
    teams: "[DEMO] Nhóm nghiên cứu giáo dục",
    publications: "[DEMO] Thiết kế trải nghiệm học tập cộng đồng",
    datasets: "[DEMO] Bộ dữ liệu khảo sát tổng hợp",
    events: "[DEMO] Seminar: từ ý tưởng đến đề cương",
    tasks: "[DEMO] Hoàn thành tổng quan tài liệu",
    forms: "[DEMO] Đề xuất hợp tác nghiên cứu",
    news: "[DEMO] Một không gian cho những câu hỏi mới",
    profiles: "[DEMO] Nhà nghiên cứu mẫu",
  };
  for (const [kind, spec] of Object.entries(CATALOG).sort(([a], [b]) =>
    a === "projects" ? -1 : b === "projects" ? 1 : 0,
  )) {
    const id = "demo-" + kind,
      data = {};
    for (const [k, label, type, , options] of spec.fields)
      data[k] =
        type === "number"
          ? k === "capacity"
            ? 30
            : k === "amount"
              ? 2000000
              : 50
          : type === "select"
            ? options[0]
            : type === "user"
              ? "demo-researcher"
              : type === "date"
                ? "2027-01-15"
                : type === "datetime-local"
                  ? k === "end"
                    ? "2027-01-15T16:00"
                    : "2027-01-15T14:00"
                  : type === "email"
                    ? "demo@example.test"
                    : `Dữ liệu minh họa: ${label}. Không phải hoạt động thật của Trung tâm.`;
    if (kind === "forms")
      data.fields = [
        { key: "name", label: "Họ và tên", type: "text", required: true },
        {
          key: "proposal",
          label: "Đề xuất hợp tác",
          type: "textarea",
          required: true,
        },
      ];
    if (kind === "acceptances") data.council = "demo-councils";
    if (kind === "pages") data.slug = "about";
    const pub = [
      "publications",
      "events",
      "datasets",
      "news",
      "profiles",
      "teams",
      "pages",
      "challenges",
      "documents",
    ].includes(kind);
    const project = spec.project ? "demo-projects" : null;
    await run(
      "INSERT OR IGNORE INTO records(id,kind,title,summary,status,owner_id,project_id,data,code,access) VALUES(?,?,?,?,?,?,?,?,?,?)",
      id,
      kind,
      titles[kind] || "[DEMO] " + spec.label,
      "Nội dung mẫu phục vụ kiểm tra chức năng và giao diện. Không mô tả kết quả nghiên cứu thực tế.",
      pub ? "published" : kind === "projects" ? "active" : "draft",
      "demo-researcher",
      project,
      JSON.stringify(data),
      "DEMO-" + kind.toUpperCase(),
      pub ? "public" : "restricted",
    );
  }
  for (const id of ["demo-projects", "demo-teams"])
    await run(
      "INSERT OR IGNORE INTO members VALUES(?,?,'lead')",
      id,
      "demo-researcher",
    );
  for (let i = 0; i < JOURNEY.length; i++)
    await run(
      "INSERT OR IGNORE INTO journey(project_id,step,progress,assignee,deadline,note) VALUES(?,?,?,?,?,?)",
      "demo-projects",
      i,
      i < 4 ? 100 : i === 4 ? 50 : 0,
      "demo-researcher",
      "2027-01-15",
      "[DEMO] Tiến độ minh họa.",
    );
  await run(
    "INSERT OR IGNORE INTO notifications(id,user_id,title,record_id) VALUES('demo-notification','demo-admin','Chào mừng đến bản dữ liệu DEMO.','demo-projects')",
  );
}
if (process.argv[1] === new URL(import.meta.url).pathname) {
  mkdirSync(".local", { recursive: true });
  await seed(database(".local/data.sqlite").DB, process.env.DEMO_PASSWORD);
  console.log(
    "Demo seeded. Log in as demo-admin@example.test using DEMO_PASSWORD. Existing accounts unchanged.",
  );
}

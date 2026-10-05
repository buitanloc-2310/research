import {
  CATALOG,
  BRAND,
  STATUS,
  STAGES,
  JOURNEY,
  ACTIONS,
  PUBLIC_KINDS,
} from "./catalog.js";
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const app = $("#app"),
  dialog = $("#dialog");
let me = null,
  directory = [],
  current = null,
  routeSequence = 0,
  dirty = false,
  page = 1,
  mode = "list",
  lastFocus = null;
const badge = (s) =>
  `<span class="badge ${esc(s)}">${esc(STATUS[s] || s)}</span>`;
const date = (v) =>
  v
    ? new Date(
        v.includes("T") ? v : v.includes(" ") ? v.replace(" ", "T") + "Z" : v,
      ).toLocaleDateString("vi-VN")
    : "Chưa đặt";
const has = (p) =>
  me?.roles?.includes("system_admin") || me?.permissions?.includes(p);
const name = (id) =>
  directory.find((u) => u.id === id)?.name || id || "Chưa phân công";
async function api(path, opt = {}) {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 35000);
  try {
    const r = await fetch("/api/v1" + path, {
      credentials: "same-origin",
      ...opt,
      headers: {
        "x-requested-with": "SFRC",
        ...(opt.body && typeof opt.body === "string"
          ? { "content-type": "application/json" }
          : {}),
        ...opt.headers,
      },
      signal: controller.signal,
    });
    let d;
    try {
      d = await r.json();
    } catch {
      throw Error("Phản hồi máy chủ không hợp lệ.");
    }
    if (!r.ok)
      throw Object.assign(Error(d.error || "Không thực hiện được yêu cầu."), {
        status: r.status,
      });
    return d;
  } finally {
    clearTimeout(timer);
  }
}
const send = (path, b, method = "POST") =>
  api(path, { method, body: JSON.stringify(b) });
function toast(s, error = false) {
  const n = document.createElement("div");
  n.className = "toast" + (error ? " error" : "");
  n.textContent = s;
  $("#toasts").append(n);
  setTimeout(() => n.remove(), 5500);
}
function close() {
  dialog.close();
  dialog.innerHTML = "";
  lastFocus?.focus();
}
function modal(title, html) {
  lastFocus = document.activeElement;
  dialog.innerHTML = `<div class="dialog-head"><h2>${esc(title)}</h2><button class="icon" data-close aria-label="Đóng">×</button></div>${html}`;
  dialog.querySelector("[data-close]").onclick = close;
  dialog.showModal();
}
function formSubmit(selector, handler) {
  const f = $(selector);
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = f.querySelector("[type=submit]");
    if (button.disabled) return;
    button.disabled = true;
    try {
      await handler(Object.fromEntries(new FormData(f)), f);
      dirty = false;
    } catch (e) {
      toast(e.message, true);
    } finally {
      if (button.isConnected) button.disabled = false;
    }
  });
}
function nav(url) {
  if (dirty && !confirm("Bạn có thay đổi chưa lưu. Rời trang?")) return;
  dirty = false;
  location.hash = url;
}
function chrome(content, active = "dashboard") {
  const links = [
    ["dashboard", "Tổng quan", "◫"],
    ["journey", "Research Journey", "↗"],
    ...Object.entries(CATALOG)
      .filter(([k, s]) => !s.restricted || has("manage") || has("publish"))
      .map(([k, s]) => [k, s.label, s.icon]),
    ["reviews", "Phản biện", "◇"],
    ["notifications", "Thông báo", "◉"],
    ...(has("finance") ? [["finance", "Tổng hợp kinh phí", "₫"]] : []),
    ...(has("data") ? [["storage", "Quản lý storage", "▧"]] : []),
    ["security", "Tài khoản & bảo mật", "◌"],
  ];
  const admin = [
    ...(has("users") ? [["users", "Tài khoản"]] : []),
    ...(has("settings")
      ? [
          ["roles", "Vai trò & quyền"],
          ["settings", "Cài đặt"],
          ["export", "Xuất dữ liệu"],
        ]
      : []),
    ...(has("audit") ? [["audit", "Audit log"]] : []),
    ...(has("manage") ? [["notices", "Gửi thông báo"]] : []),
  ];
  return `<div class="workspace"><aside id="sidebar"><a class="brand" href="/"><img src="/mark.svg" alt=""><span>SKY FIRST<small>RESEARCH & INNOVATION</small></span></a><div class="nav-label">KHÔNG GIAN NGHIÊN CỨU</div><nav>${links.map(([id, label, icon]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>${icon}</span>${esc(label)}</a>`).join("")}</nav>${admin.length ? `<div class="nav-label">ADMIN CONTROL CENTER</div><nav>${admin.map(([id, label]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>⌘</span>${label}</a>`).join("")}</nav>` : ""}<div class="sidebar-foot">Hỏi sâu hơn.<br>Tạo thay đổi tốt hơn.</div></aside><div class="work-main"><header class="work-top"><button class="icon" id="menu" aria-label="Mở menu" aria-expanded="false">☰</button><form id="globalSearch"><input name="q" placeholder="Tìm đề tài, tài liệu, nghiên cứu…" aria-label="Tìm toàn hệ thống"></form><button class="icon theme" aria-label="Đổi giao diện sáng tối">◐</button><a href="#w/notifications" class="icon" aria-label="Thông báo">♧</a><button id="logout" class="quiet">Đăng xuất</button><span class="avatar" title="${esc(me?.name)}">${esc(me?.name?.slice(0, 1) || "S")}</span></header><main id="main" tabindex="-1">${content}</main><footer>SKY FIRST · Research & Innovation Workspace</footer></div></div>`;
}
function bindChrome() {
  const menu = $("#menu");
  if (menu)
    menu.onclick = () => {
      const open = $("#sidebar").classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
    };
  if ($("#logout"))
    $("#logout").onclick = async () => {
      try {
        await send("/logout", {});
        me = null;
        nav("login");
      } catch (e) {
        toast(e.message, true);
      }
    };
  if ($("#globalSearch"))
    $("#globalSearch").onsubmit = (e) => {
      e.preventDefault();
      nav("w/search/" + encodeURIComponent(new FormData(e.target).get("q")));
    };
  $$(".theme").forEach(
    (b) =>
      (b.onclick = () => {
        document.documentElement.classList.toggle("dark");
        try {
          localStorage.setItem(
            "theme",
            document.documentElement.classList.contains("dark")
              ? "dark"
              : "light",
          );
        } catch {}
      }),
  );
}
function heading(title, desc, action = "") {
  return `<div class="heading"><div><div class="eyebrow">SKY FIRST / RESEARCH CENTER</div><h1>${esc(title)}</h1><p>${esc(desc || "")}</p></div>${action}</div>`;
}
const empty = (
  label = "Chưa có hồ sơ",
  hint = "Bắt đầu bằng cách tạo hồ sơ mới hoặc thay đổi bộ lọc.",
) =>
  `<div class="empty"><div>◇</div><h3>${esc(label)}</h3><p>${esc(hint)}</p></div>`;
function card(r, publicMode = false) {
  return `<a class="record-card" href="${publicMode ? "/record/" + r.id : "#w/detail/" + r.id}"><div class="card-top"><span>${esc(CATALOG[r.kind]?.icon || "◇")} ${esc(CATALOG[r.kind]?.label || r.kind)}</span>${publicMode ? '<span class="badge published">Công khai</span>' : badge(r.status)}</div><h3>${esc(r.title)}</h3><p>${esc(r.summary || "Chưa có tóm tắt.")}</p><div class="card-bottom"><code>${esc(r.code || "")}</code><span>${date(r.updated_at || r.created_at)} ↗</span></div></a>`;
}
function publicShell(content) {
  return `<header class="public-top"><a class="brand" href="/"><img src="/mark.svg" alt=""><span>SKY FIRST<small>RESEARCH & INNOVATION</small></span></a><nav><a href="/about">Trung tâm</a><a href="/explore">Khám phá</a><a href="/explore?kind=publications">Công bố</a><a href="/explore?kind=events">Sự kiện</a></nav><a class="button" href="/#${me ? "w/dashboard" : "login"}">${me ? "Không gian làm việc" : "Đăng nhập"} ↗</a><button class="icon theme" aria-label="Đổi giao diện">◐</button></header><main id="main" tabindex="-1">${content}</main><footer class="public-footer"><div><h2>SKY FIRST</h2><p>Nghiên cứu có chiều sâu.<br>Đổi mới vì cộng đồng.</p></div><div><a href="/about">Giới thiệu</a><a href="/explore?kind=datasets">Dataset</a><a href="/explore?kind=teams">Nhóm nghiên cứu</a><a href="/explore?kind=profiles">Nhà nghiên cứu</a></div><div><a href="/#w/ideas">Đề xuất ý tưởng</a><a href="/#w/collaborations">Hợp tác nghiên cứu</a><a href="/contact">Liên hệ</a><a href="/privacy">Quyền riêng tư</a></div><p class="muted">${esc(BRAND)}</p></footer>`;
}
async function publicPage() {
  const path = location.pathname;
  let content = "";
  const settings = (await api("/public/settings")).settings;
  if (path.startsWith("/record/")) {
    const {
      item: r,
      files,
      metrics,
    } = await api("/public/records/" + path.split("/")[2]);
    document.title = r.title + " · SKY FIRST";
    content = `<article class="article"><a href="/explore">← Kho nghiên cứu</a><div class="eyebrow">${esc(CATALOG[r.kind]?.label)} · ${esc(r.code)}</div><h1>${esc(r.title)}</h1><p class="lead">${esc(r.summary)}</p>${r.kind === "profiles" && files.some((f) => f.mime.startsWith("image/")) ? `<img class="profile-image" src="/api/v1/public/files/${files.find((f) => f.mime.startsWith("image/")).id}?preview=1" alt="${esc(r.title)}">` : ""}<p class="muted small">${metrics?.views || 0} lượt xem · ${metrics?.downloads || 0} lượt tải</p>${CATALOG[
      r.kind
    ].fields
      .filter(([k]) => r.data[k])
      .map(
        ([k, label]) =>
          `<section><h2>${esc(label)}</h2><p class="prose">${esc(r.data[k])}</p></section>`,
      )
      .join(
        "",
      )}<div class="panel"><h2>Tài liệu đính kèm</h2>${files.map((f) => `<a class="file" href="/api/v1/public/files/${f.id}">↓ ${esc(f.name)} <small>${(f.size / 1024).toFixed(1)} KB</small></a>`).join("") || "Chưa có tệp đính kèm."}</div>${r.kind === "events" ? '<a class="button" href="/#w/detail/' + r.id + '">Đăng nhập để đăng ký</a>' : ""}</article>`;
  } else if (path === "/about" || path === "/contact" || path === "/privacy") {
    const about = path === "/about";
    content = `<article class="article"><div class="eyebrow">VỀ TRUNG TÂM</div><h1>${about ? "Nơi những câu hỏi mở ra khả năng mới." : path === "/contact" ? "Kết nối cùng SKY FIRST" : "Quyền riêng tư & sử dụng dữ liệu"}</h1>${
      about
        ? `<p class="lead">${esc(settings.intro || BRAND)}</p>${[
            [
              "Sứ mệnh",
              settings.mission ||
                "Kết nối con người, tri thức và phương pháp để phát triển các giải pháp hữu ích.",
            ],
            [
              "Tầm nhìn",
              settings.vision ||
                "Xây dựng môi trường nghiên cứu cởi mở, có trách nhiệm và hướng đến tác động cộng đồng.",
            ],
            [
              "Giá trị",
              settings.values ||
                "Trung thực · Hợp tác · Tôn trọng dữ liệu · Học hỏi liên tục",
            ],
          ]
            .map(([a, b]) => `<h2>${a}</h2><p class="prose">${esc(b)}</p>`)
            .join("")}`
        : path === "/contact"
          ? `<p class="prose">${esc(settings.contact || "Vui lòng đăng nhập và gửi hồ sơ tại mục Đề xuất hợp tác. Quản trị viên có thể cập nhật thông tin liên hệ của Trung tâm.")}</p><a class="button" href="/#w/collaborations">Gửi đề xuất hợp tác</a>`
          : "<p>Hệ thống lưu thông tin tài khoản và hồ sơ bạn gửi để phục vụ quản lý nghiên cứu. Hồ sơ nội bộ và tệp đính kèm được truy cập theo quyền; nội dung chỉ xuất hiện công khai sau khi được duyệt công bố. Liên hệ quản trị viên để yêu cầu kiểm tra, cập nhật hoặc xử lý thông tin cá nhân.</p>"
    }</article>`;
  } else if (path === "/explore") {
    const params = new URLSearchParams(location.search),
      q = params.get("q") || "",
      kind = params.get("kind") || "",
      data = await api("/public/search?" + params);
    content = `<section class="public-section">${heading("Khám phá tri thức", "Đề tài, công bố và nguồn lực nghiên cứu được chia sẻ.")}<form class="filters" action="/explore"><input name="q" placeholder="Tìm kiếm…" value="${esc(q)}"><select name="kind"><option value="">Tất cả nội dung</option>${PUBLIC_KINDS.map((k) => `<option value="${k}" ${kind === k ? "selected" : ""}>${CATALOG[k].label}</option>`).join("")}</select><button class="button">Tìm kiếm</button></form><p class="muted">${data.total} kết quả</p><div class="cards">${data.items.map((r) => card(r, true)).join("")}</div>${!data.items.length ? empty("Chưa có nội dung phù hợp", "Nội dung được duyệt công bố sẽ xuất hiện tại đây.") : ""}<div class="pagination">${data.page > 1 ? `<a href="?q=${encodeURIComponent(q)}&kind=${kind}&page=${data.page - 1}">← Trước</a>` : ""}${data.page * 24 < data.total ? `<a href="?q=${encodeURIComponent(q)}&kind=${kind}&page=${data.page + 1}">Tiếp →</a>` : ""}</div></section>`;
  } else {
    const data = await api("/public/search");
    content = `<section class="hero"><div><div class="eyebrow">SKY FIRST RESEARCH & INNOVATION</div><h1>Từ câu hỏi hôm nay.<br><em>Đến giải pháp<br>ngày mai.</em></h1><p>${esc(settings.intro || "Một không gian để kết nối ý tưởng, phát triển nghiên cứu và cùng tạo nên những thay đổi có ý nghĩa.")}</p><div class="actions"><a class="button lime" href="/explore">Khám phá nghiên cứu ↗</a><a class="text-link" href="/#w/ideas">Đề xuất ý tưởng →</a></div><div class="hero-stat"><b>${data.total}</b><span>hồ sơ đã công bố<br>và nguồn lực chia sẻ</span></div></div><div class="orbital" aria-hidden="true"><div class="orbit o1"></div><div class="orbit o2"></div><div class="orbit o3"></div><div class="core">R<span>×</span>I</div><span class="orbit-label l1">CURIOSITY</span><span class="orbit-label l2">COLLABORATION</span><span class="orbit-label l3">IMPACT</span></div></section><section class="public-section"><div class="section-heading"><div><div class="eyebrow">NHỮNG HƯỚNG ĐI</div><h2>Tri thức gặp thực tiễn.</h2></div><a href="/about">Tìm hiểu trung tâm ↗</a></div><div class="fields">${[
      [
        "01",
        "Giáo dục & học tập",
        "Nghiên cứu trải nghiệm học tập và cơ hội tiếp cận tri thức.",
      ],
      [
        "02",
        "Công nghệ & sáng tạo",
        "Thử nghiệm những cách giải quyết vấn đề mới.",
      ],
      [
        "03",
        "Cộng đồng & phát triển",
        "Lắng nghe nhu cầu và đo lường tác động thực tế.",
      ],
    ]
      .map(
        ([n, a, b]) => `<div><span>${n}</span><h3>${a}</h3><p>${b}</p></div>`,
      )
      .join(
        "",
      )}</div></section><section class="public-section tint"><div class="section-heading"><div><div class="eyebrow">KNOWLEDGE IN MOTION</div><h2>Mới từ không gian nghiên cứu.</h2></div><a href="/explore">Xem tất cả ↗</a></div><div class="cards">${data.items
      .slice(0, 6)
      .map((r) => card(r, true))
      .join(
        "",
      )}</div>${data.items.length ? "" : empty("Sẵn sàng cho những công bố đầu tiên", "Các hồ sơ được duyệt sẽ được giới thiệu tại đây.")}</section><section class="cta"><h2>Một ý tưởng tốt bắt đầu<br>bằng một cuộc trao đổi.</h2><a class="button lime" href="/#w/collaborations">Kết nối nghiên cứu ↗</a></section>`;
  }
  app.innerHTML = publicShell(content);
  bindChrome();
  if (path.startsWith("/record/")) {
    const id = path.split("/")[2];
    const related = await api("/public/related?id=" + id).catch(() => null);
    if (related?.items.length)
      document
        .querySelector(".article")
        .insertAdjacentHTML(
          "beforeend",
          '<h2>Công trình & đóng góp công khai</h2><div class="cards">' +
            related.items.map((r) => card(r, true)).join("") +
            "</div>",
        );
  }
}
async function loginPage(type, token) {
  const setup = type === "setup",
    reset = type === "reset";
  app.innerHTML = `<div class="auth"><a class="brand" href="/"><img src="/mark.svg" alt=""><span>SKY FIRST<small>RESEARCH & INNOVATION</small></span></a><div class="auth-grid"><div><div class="eyebrow">KHÔNG GIAN CỦA NHỮNG KHẢ NĂNG</div><h1>Nghiên cứu.<br>Kết nối.<br><em>Tạo tác động.</em></h1><p>Mỗi ý tưởng đều cần một hành trình. Bắt đầu hành trình của bạn tại SKY FIRST.</p></div><form id="authForm" class="panel"><h2>${setup ? "Thiết lập lần đầu" : reset ? "Đặt lại mật khẩu" : "Chào mừng trở lại"}</h2><p class="muted">${setup ? "Tạo quản trị viên đầu tiên bằng mã thiết lập." : reset ? "Liên kết chỉ dùng một lần." : "Đăng nhập bằng tài khoản được Trung tâm cấp."}</p>${setup ? '<label>Họ và tên<input name="name" required autocomplete="name"></label><label>Mã thiết lập<input name="secret" type="password" required autocomplete="off"></label>' : ""}${!reset ? '<label>Email<input name="email" type="email" autocomplete="username" required></label>' : ""}<label>Mật khẩu<input name="password" type="password" minlength="12" maxlength="200" autocomplete="${setup || reset ? "new-password" : "current-password"}" required></label><button class="button full" type="submit">${setup ? "Tạo quản trị viên" : reset ? "Lưu mật khẩu" : "Đăng nhập"} →</button>${!setup && !reset ? '<p class="muted small">Quên mật khẩu? Liên hệ quản trị viên để xác minh và nhận liên kết đặt lại.</p>' : ""}<a href="/">← Về website</a></form></div></div>`;
  formSubmit("#authForm", async (b) => {
    await send(
      setup ? "/setup" : reset ? "/reset" : "/login",
      reset ? { token, password: b.password } : b,
    );
    if (setup || reset) {
      toast("Thành công. Hãy đăng nhập.");
      nav("login");
    } else {
      me = (await api("/me")).user;
      nav("w/dashboard");
    }
  });
}
async function dashboard() {
  const d = await api("/dashboard");
  const counts = {};
  d.stats.forEach((x) => (counts[x.kind] = (counts[x.kind] || 0) + x.n));
  return (
    heading(
      "Không gian nghiên cứu",
      `Xin chào ${me.name}. Hôm nay bạn muốn khám phá điều gì?`,
      '<a class="button" href="#w/projects">Mở đề tài ↗</a>',
    ) +
    `<div class="stats">${[
      ["projects", "Đề tài & dự án"],
      ["tasks", "Công việc"],
      ["publications", "Công bố"],
      ["datasets", "Dataset"],
    ]
      .map(
        ([k, l]) =>
          `<a class="stat" href="#w/${k}"><span>${l}</span><b>${counts[k] || 0}</b><small>Trong phạm vi của bạn ↗</small></a>`,
      )
      .join(
        "",
      )}</div><div class="dashboard-grid"><section class="panel"><div class="section-heading"><h2>Đang chuyển động</h2><span class="dot"></span></div><div class="cards compact">${
      d.recent
        .slice(0, 6)
        .map((r) => card(r))
        .join("") || empty()
    }</div></section><div><section class="panel"><h2>Mốc thời gian sắp tới</h2>${d.deadlines.map((r) => `<a class="deadline" href="#w/detail/${r.id}"><span class="date-chip">${esc(r.data.due?.slice(5) || "—")}</span><div><b>${esc(r.title)}</b><small>${STATUS[r.status] || r.status}</small></div></a>`).join("") || '<p class="muted">Chưa có hạn công việc.</p>'}</section><section class="panel"><h2>Phản biện cần thực hiện</h2>${d.reviews.map((v) => `<a class="file" href="#w/detail/${v.record_id}">${esc(v.title)} →</a>`).join("") || '<p class="muted">Bạn không có phiếu đang chờ.</p>'}</section></div></div>`
  );
}
async function list(kind, search = "") {
  const spec = CATALOG[kind];
  const params = new URLSearchParams({
    page: String(page),
    ...(spec ? { kind } : {}),
    q: search || $("#filterQ")?.value || "",
    status: $("#filterStatus")?.value || "",
  });
  const d = await api("/records?" + params);
  const content =
    heading(
      spec?.label || "Tìm kiếm toàn hệ thống",
      spec?.intro || "Kết quả trong phạm vi bạn được truy cập.",
      spec && has("create")
        ? '<button class="button" id="newRecord">+ Tạo hồ sơ</button>'
        : "",
    ) +
    `<form id="filters" class="filters"><input id="filterQ" value="${esc(params.get("q"))}" placeholder="Tên, mã hoặc từ khóa" aria-label="Tìm hồ sơ"><select id="filterStatus" aria-label="Trạng thái"><option value="">Mọi trạng thái</option>${Object.entries(
      STATUS,
    )
      .map(
        ([k, l]) =>
          `<option value="${k}" ${params.get("status") === k ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select><button class="button" type="submit">Lọc</button><select id="viewMode" aria-label="Kiểu hiển thị"><option value="list" ${mode === "list" ? "selected" : ""}>Danh sách</option><option value="board" ${mode === "board" ? "selected" : ""}>Board</option><option value="timeline" ${mode === "timeline" ? "selected" : ""}>Timeline</option></select></form><p class="muted">${d.total} hồ sơ · Trang ${d.page}</p>${
      mode === "board"
        ? `<div class="board">${[...new Set(d.items.map((x) => x.status))]
            .map(
              (s) =>
                `<section><h3>${STATUS[s]}</h3>${d.items
                  .filter((x) => x.status === s)
                  .map((r) => card(r))
                  .join("")}</section>`,
            )
            .join("")}</div>`
        : mode === "timeline"
          ? `<div class="panel">${[...d.items]
              .sort((a, b) =>
                (a.data.due || a.created_at).localeCompare(
                  b.data.due || b.created_at,
                ),
              )
              .map(
                (r) =>
                  `<a class="deadline" href="#w/detail/${r.id}"><span class="date-chip">${date(r.data.due || r.created_at)}</span><div><b>${esc(r.title)}</b><small>${STATUS[r.status]}</small></div></a>`,
              )
              .join("")}</div>`
          : `<div class="cards">${d.items.map((r) => card(r)).join("")}</div>`
    }${!d.items.length ? empty() : ""}<div class="pagination"><button id="prev" ${page <= 1 ? "disabled" : ""}>← Trước</button><span>${page} / ${Math.max(1, Math.ceil(d.total / d.size))}</span><button id="next" ${page * d.size >= d.total ? "disabled" : ""}>Tiếp →</button></div>`;
  app.innerHTML = chrome(content, kind);
  bindChrome();
  if ($("#newRecord")) $("#newRecord").onclick = () => recordForm(kind);
  $("#filters").onsubmit = (e) => {
    e.preventDefault();
    page = 1;
    list(kind);
  };
  $("#viewMode").onchange = (e) => {
    mode = e.target.value;
    list(kind);
  };
  $("#prev").onclick = () => {
    page--;
    list(kind, search);
  };
  $("#next").onclick = () => {
    page++;
    list(kind, search);
  };
}
function inputField([key, label, type, required, options], value = "") {
  let control;
  if (type === "textarea")
    control = `<textarea name="${key}" rows="4" ${required ? "required" : ""}>${esc(value)}</textarea>`;
  else if (type === "select" || type === "user")
    control = `<select name="${key}" ${required ? "required" : ""}><option value="">Chọn…</option>${(type === "user" ? directory.map((x) => [x.id, x.name]) : options.map((x) => [x, x])).map(([v, l]) => `<option value="${esc(v)}" ${v === value ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  else
    control = `<input name="${key}" type="${type}" value="${esc(value)}" ${required ? "required" : ""} ${type === "number" ? 'min="0" step="any"' : ""}>`;
  return `<label>${esc(label)}${required ? " *" : ""}${control}</label>`;
}
async function recordForm(kind, r) {
  const spec = CATALOG[kind];
  let projects = [];
  if (spec.project && !r) {
    let p = 1;
    for (;;) {
      const d = await api("/records?kind=projects&page=" + p);
      projects.push(...d.items);
      if (p++ * d.size >= d.total) break;
    }
  }
  modal(
    r ? "Sửa hồ sơ" : "Tạo " + spec.label,
    `<form id="recordForm"><div class="form-grid"><label class="wide">Tên hồ sơ *<input name="title" maxlength="240" value="${esc(r?.title)}" required></label><label class="wide">Tóm tắt<textarea name="summary" rows="3">${esc(r?.summary)}</textarea></label>${spec.project && !r ? `<label class="wide">Đề tài *<select name="project_id" required><option value="">Chọn đề tài</option>${projects.map((x) => `<option value="${x.id}">${esc(x.title)}</option>`).join("")}</select></label>` : ""}${spec.fields.map((f) => inputField([f[0], f[1], f[2], false, f[4]], r?.data?.[f[0]])).join("")}<label>Phạm vi truy cập<select name="access">${[
      ["restricted", "Nhóm đề tài"],
      ["confidential", "Bảo mật (chủ hồ sơ + người được giao)"],
      ["internal", "Nội bộ Trung tâm"],
      ["public", "Cho phép công bố công khai"],
    ]
      .map(
        ([v, l]) =>
          `<option value="${v}" ${r?.access === v ? "selected" : ""}>${l}</option>`,
      )
      .join(
        "",
      )}</select></label></div>${kind === "forms" ? '<section class="panel"><h3>Thiết kế biểu mẫu</h3><div id="formFields"></div><button type="button" id="addField">+ Thêm trường</button></section>' : ""}<p class="muted">Có thể lưu bản nháp chưa đủ thông tin. Khi gửi xét duyệt, các trường bắt buộc sẽ được kiểm tra.</p><button type="submit" class="button">Lưu bản nháp</button></form>`,
  );
  let fields = r?.data?.fields ? structuredClone(r.data.fields) : [];
  function drawFields() {
    $("#formFields").innerHTML = fields
      .map(
        (f, i) =>
          `<div class="builder-row"><input data-field="${i}" data-key="label" value="${esc(f.label)}" placeholder="Tên trường"><select data-field="${i}" data-key="type">${["text", "textarea", "email", "number", "date", "select", "file"].map((t) => `<option ${f.type === t ? "selected" : ""}>${t}</option>`).join("")}</select><input data-field="${i}" data-key="options" value="${esc(f.options?.join("|"))}" placeholder="Lựa chọn, cách nhau bằng |"><label><input type="checkbox" data-field="${i}" data-key="required" ${f.required ? "checked" : ""}> Bắt buộc</label><button type="button" data-remove="${i}">×</button></div>`,
      )
      .join("");
    $$("[data-field]").forEach(
      (el) =>
        (el.onchange = () => {
          const f = fields[el.dataset.field];
          f[el.dataset.key] =
            el.dataset.key === "required"
              ? el.checked
              : el.dataset.key === "options"
                ? el.value
                    .split("|")
                    .map((x) => x.trim())
                    .filter(Boolean)
                : el.value;
        }),
    );
    $$("[data-remove]").forEach(
      (b) =>
        (b.onclick = () => {
          fields.splice(+b.dataset.remove, 1);
          drawFields();
        }),
    );
  }
  if (kind === "forms") {
    drawFields();
    $("#addField").onclick = () => {
      fields.push({
        key: "field_" + crypto.randomUUID().slice(0, 8),
        label: "Trường mới",
        type: "text",
        required: false,
        options: [],
      });
      drawFields();
    };
  }
  formSubmit("#recordForm", async (b) => {
    const data = {};
    spec.fields.forEach(([k]) => (data[k] = b[k] || ""));
    if (kind === "forms") data.fields = fields;
    const out = await send(
      r ? "/records/" + r.id : "/records",
      {
        kind,
        title: b.title,
        summary: b.summary,
        access: b.access,
        project_id: b.project_id,
        data,
        version: r?.version,
      },
      r ? "PATCH" : "POST",
    );
    dirty = false;
    close();
    toast("Đã lưu hồ sơ.");
    nav("w/detail/" + out.item.id);
    await route();
  });
}
async function detail(id) {
  const d = await api("/records/" + id),
    r = d.item;
  current = r;
  let children = [];
  if (r.kind === "projects") {
    let page = 1;
    for (;;) {
      const x = await api("/records?project=" + id + "&page=" + page);
      children.push(...x.items);
      if (page++ * x.size >= x.total) break;
    }
  }
  const statusActions = Object.entries(ACTIONS)
    .map(([k, l]) => `<option value="${k}">${l}</option>`)
    .join("");
  const content = `<a href="#w/${r.kind}" class="back">← ${CATALOG[r.kind].label}</a>${heading(r.title, r.code, `${d.can_edit ? '<button id="editRecord" class="button">Sửa hồ sơ</button>' : ""}`)}<div class="record-meta">${badge(r.status)}<span>Phiên bản ${r.version}</span><span>${esc(r.access)}</span><span>Cập nhật ${date(r.updated_at)}</span></div><div class="tabs" role="tablist">${[
    ["overview", "Tổng quan"],
    ...(r.kind === "projects"
      ? [
          ["journey", "Journey"],
          ["children", "Tasks / Timeline / Dataset / Finance"],
        ]
      : []),
    ...(["projects", "teams"].includes(r.kind)
      ? [["members", "Thành viên"]]
      : []),
    ["files", "Tệp"],
    ["discussions", "Thảo luận"],
    ["reviews", "Phản biện"],
    ["activity", "Lịch sử"],
  ]
    .map(
      ([k, l], i) =>
        `<button role="tab" aria-selected="${i === 0}" data-tab="${k}" class="${i === 0 ? "active" : ""}">${l}</button>`,
    )
    .join("")}</div>
 <section data-pane="overview"><div class="detail-grid"><div><div class="panel"><p class="lead">${esc(r.summary || "Chưa có tóm tắt.")}</p>${CATALOG[
   r.kind
 ].fields
   .filter(([k]) => r.data[k] !== "" && r.data[k] != null)
   .map(
     ([k, l, t]) =>
       `<section class="field-value"><h3>${esc(l)}</h3><p class="prose">${esc(t === "user" ? name(r.data[k]) : r.data[k])}</p></section>`,
   )
   .join(
     "",
   )}</div>${r.kind === "publications" ? `<div class="panel"><h3>Trích dẫn gợi ý</h3><p class="prose">${esc(r.data.authors)}. (${new Date(r.created_at).getFullYear()}). ${esc(r.title)}. SKY FIRST. ${location.origin}/record/${r.id}</p><small>Kiểm tra tên tác giả và thông tin nguồn trước khi sử dụng.</small></div>` : ""}</div><aside><div class="panel"><h3>Quy trình xử lý</h3><p class="muted">Máy chủ kiểm tra quyền và điều kiện của từng bước.</p><form id="transitionForm"><label>Thao tác<select name="action">${statusActions}</select></label><label>Lý do / kết luận<textarea name="note" required rows="3"></textarea></label><button type="submit" class="button full">Thực hiện</button></form></div>${r.kind === "ideas" ? '<div class="panel"><button id="vote">Bình chọn nội bộ</button><button id="convert">Chuyển thành dự án</button></div>' : ""}${r.kind === "events" ? '<div class="panel"><button id="registerEvent" class="button">Đăng ký tham dự</button><button id="participants">Danh sách & điểm danh</button></div>' : ""}${r.kind === "forms" ? '<div class="panel"><button id="fillForm" class="button">Điền biểu mẫu</button><button id="responses">Xem phản hồi</button></div>' : ""}${d.can_edit && r.status === "draft" ? '<button id="deleteRecord" class="danger">Xóa bản nháp</button>' : ""}</aside></div></section>
 <section data-pane="journey" hidden><div class="journey-grid">${d.journey.map((j) => `<button class="journey-step" data-step="${j.step}"><span class="step-number">${String(j.step + 1).padStart(2, "0")}</span><div><h3>${JOURNEY[j.step]}</h3><p>${esc(name(j.assignee))} · ${date(j.deadline)}</p><progress max="100" value="${j.progress}"></progress><small>${j.progress}% · ${j.progress === 100 ? "Hoàn thành" : j.progress ? "Đang thực hiện" : "Chưa bắt đầu"}</small></div></button>`).join("")}</div></section>
 <section data-pane="children" hidden><div class="filters"><select id="childKind"><option value="">Toàn bộ nội dung đề tài</option>${Object.entries(
   CATALOG,
 )
   .filter(([, s]) => s.project)
   .map(([k, s]) => `<option value="${k}">${s.label}</option>`)
   .join(
     "",
   )}</select><button id="childNew" class="button">+ Tạo nội dung liên quan</button></div><div class="cards" id="childrenCards">${children.map((x) => card(x)).join("")}</div></section>
 <section data-pane="members" hidden><div class="panel"><h2>Nhóm thực hiện</h2>${d.members.map((m) => `<div class="row"><span><b>${esc(m.name)}</b> · ${esc(m.role)}</span>${has("manage") || d.is_lead ? `<button data-remove-member="${m.user_id}" class="quiet">Gỡ</button>` : ""}</div>`).join("")}${has("manage") || d.is_lead ? `<form id="memberForm" class="filters"><select name="user_id">${directory.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select><select name="role"><option value="member">Thành viên</option><option value="lead">Đồng chủ nhiệm</option><option value="advisor">Cố vấn</option></select><button class="button" type="submit">Thêm / cập nhật</button></form>` : ""}</div></section>
 <section data-pane="files" hidden><div class="panel"><h2>Tài liệu & tệp đính kèm</h2><p class="muted">Tối đa 10 MB/tệp. PDF, tài liệu Office, CSV, JSON, TXT hoặc ảnh. Tệp theo quyền của hồ sơ.</p>${d.can_edit ? `<form id="uploadForm"><label>Chọn tệp<input type="file" name="file" required></label>${r.kind === "projects" ? `<label>Bước Journey<select name="step"><option value="">Tệp chung</option>${JOURNEY.map((j, i) => `<option value="${i}">${i + 1}. ${j}</option>`).join("")}</select></label>` : ""}<button type="submit" class="button">Tải lên</button></form>` : ""}${d.files.map((f) => `<div class="row"><a class="file" href="/api/v1/files/${f.id}">↓ ${esc(f.name)} · ${(f.size / 1024).toFixed(1)} KB · v${f.version}</a>${d.can_edit ? `<button class="quiet" data-file-delete="${f.id}">Xóa</button>` : ""}</div>`).join("") || empty("Chưa có tệp", "Tải tài liệu khi hồ sơ đang mở để chỉnh sửa.")}</div></section>
 <section data-pane="discussions" hidden><div class="panel"><h2>Trao đổi nghiên cứu</h2>${d.comments.map((c) => `<div class="comment"><b>${esc(c.name)}</b><small>${date(c.created_at)}</small><p class="prose">${esc(c.content)}</p></div>`).join("")}<form id="commentForm"><textarea name="content" required placeholder="Ghi nhận xét hoặc câu hỏi…" rows="4"></textarea><button type="submit" class="button">Gửi trao đổi</button></form></div></section>
 <section data-pane="reviews" hidden><div class="panel"><h2>Các vòng phản biện</h2>${d.reviews.map((v) => `<div class="review"><div class="row"><h3>${esc(v.name)} · Vòng ${v.round}</h3><span>${v.submitted_at ? v.score + "/100" : "Chờ đánh giá"}</span></div><p class="prose">${esc(v.comment)}</p><small>${esc(v.verdict || "Chưa có kết luận")} · Hạn ${date(v.deadline)}</small>${v.response ? "<p>Phản hồi tác giả: " + esc(v.response) + "</p>" : ""}${v.reviewer_id === me.id && !v.submitted_at ? `<button data-review="${v.id}" class="button">Gửi phiếu phản biện</button>` : ""}${d.is_lead ? `<button data-response="${v.id}">Phản hồi tác giả</button>` : ""}</div>`).join("") || '<p class="muted">Chưa phân công phản biện.</p>'}${has("manage") || has("ethics") ? `<form id="assignReview"><div class="form-grid"><label>Người phản biện<select name="reviewer_id">${directory.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>Vòng<input type="number" name="round" value="1" min="1" max="100" required></label><label>Hạn phản biện<input name="deadline" type="date" required></label></div><button type="submit" class="button">Phân công</button></form>` : ""}</div></section>
 <section data-pane="activity" hidden><div class="panel"><h2>Lịch sử cập nhật</h2>${d.history.map((h) => `<div class="activity"><span class="dot"></span><div><b>${esc(ACTIONS[h.action] || h.action)}</b><p>${esc(h.note)}</p><small>${esc(name(h.actor_id))} · ${date(h.created_at)}</small></div></div>`).join("") || '<p class="muted">Chưa có cập nhật sau khi tạo.</p>'}</div></section>`;
  app.innerHTML = chrome(content, r.kind);
  bindChrome();
  $$("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        $$("[data-tab]").forEach((x) => {
          x.classList.toggle("active", x === b);
          x.setAttribute("aria-selected", String(x === b));
        });
        $$("[data-pane]").forEach(
          (x) => (x.hidden = x.dataset.pane !== b.dataset.tab),
        );
      }),
  );
  const refresh = async () => {
    const tab = $("[data-tab].active")?.dataset.tab;
    toast("Đã cập nhật.");
    await detail(id);
    if (tab) $(`[data-tab="${tab}"]`)?.click();
  };
  if ($("#editRecord")) $("#editRecord").onclick = () => recordForm(r.kind, r);
  formSubmit("#transitionForm", async (b) => {
    if (!confirm("Xác nhận " + ACTIONS[b.action] + "?")) return;
    await send("/records/" + id + "/transition", { ...b, version: r.version });
    await refresh();
  });
  if ($("#deleteRecord"))
    $("#deleteRecord").onclick = async () => {
      if (confirm("Xóa bản nháp này?"))
        try {
          await api("/records/" + id, { method: "DELETE" });
          nav("w/" + r.kind);
        } catch (e) {
          toast(e.message, true);
        }
    };
  if ($("#memberForm"))
    formSubmit("#memberForm", async (b) => {
      await send("/records/" + id + "/members", b);
      await refresh();
    });
  $$("[data-remove-member]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirm("Gỡ thành viên này?"))
          try {
            await send(
              "/records/" + id + "/members",
              { user_id: b.dataset.removeMember },
              "DELETE",
            );
            await refresh();
          } catch (e) {
            toast(e.message, true);
          }
      }),
  );
  formSubmit("#commentForm", async (b) => {
    await send("/records/" + id + "/comments", b);
    await refresh();
  });
  if ($("#assignReview"))
    formSubmit("#assignReview", async (b) => {
      await send("/records/" + id + "/reviews", {
        ...b,
        round: Number(b.round),
      });
      await refresh();
    });
  if ($("#uploadForm"))
    formSubmit("#uploadForm", async (_, f) => {
      const file = f.querySelector("input").files[0];
      if (file.size > 10485760) throw Error("Tệp vượt quá 10 MB.");
      await api(
        "/records/" +
          id +
          "/files?name=" +
          encodeURIComponent(file.name) +
          "&step=" +
          encodeURIComponent(f.elements.step?.value || ""),
        { method: "POST", body: file },
      );
      await refresh();
    });
  $$("[data-file-delete]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (confirm("Ẩn tệp khỏi hồ sơ?"))
          try {
            await api("/files/" + b.dataset.fileDelete, { method: "DELETE" });
            await refresh();
          } catch (e) {
            toast(e.message, true);
          }
      }),
  );
  $$("[data-review]").forEach(
    (b) =>
      (b.onclick = () => {
        modal(
          "Phiếu phản biện",
          `<form id="reviewForm"><div class="form-grid"><label>Tính mới (0–25)<input name="novelty" type="number" min="0" max="25"></label><label>Phương pháp (0–25)<input name="method" type="number" min="0" max="25"></label><label>Minh chứng (0–25)<input name="evidence" type="number" min="0" max="25"></label><label>Tác động (0–25)<input name="impact" type="number" min="0" max="25"></label></div><label>Điểm tổng (0–100)<input type="number" name="score" min="0" max="100" required></label><label>Nhận xét theo tiêu chí: tính mới, phương pháp, minh chứng, tác động<textarea name="comment" rows="7" required></textarea></label><label>Khuyến nghị<select name="verdict"><option value="accepted">Chấp nhận</option><option value="revision">Yêu cầu sửa</option><option value="rejected">Không chấp nhận</option></select></label><button type="submit" class="button">Gửi phiếu và khóa kết quả</button></form>`,
        );
        formSubmit("#reviewForm", async (data) => {
          await send(
            "/reviews/" + b.dataset.review,
            {
              score: Number(data.score),
              comment: data.comment,
              verdict: data.verdict,
              rubric: {
                novelty: Number(data.novelty || 0),
                method: Number(data.method || 0),
                evidence: Number(data.evidence || 0),
                impact: Number(data.impact || 0),
              },
            },
            "PATCH",
          );
          close();
          await refresh();
        });
      }),
  );
  $$("[data-response]").forEach(
    (b) =>
      (b.onclick = () => {
        modal(
          "Phản hồi tác giả",
          '<form id="responseForm"><label>Nội dung<textarea name="response" rows="6" required></textarea></label><button type="submit" class="button">Gửi phản hồi</button></form>',
        );
        formSubmit("#responseForm", async (data) => {
          await send("/reviews/" + b.dataset.response, data, "PATCH");
          close();
          await refresh();
        });
      }),
  );
  $$("[data-step]").forEach(
    (b) =>
      (b.onclick = () => {
        const j = d.journey.find((x) => x.step === +b.dataset.step);
        modal(
          JOURNEY[j.step],
          `<form id="journeyForm"><div class="form-grid">${inputField(["progress", "Hoàn thành (%)", "number", true], j.progress)}${inputField(["assignee", "Người phụ trách", "user", false], j.assignee)}${inputField(["deadline", "Hạn hoàn thành", "date"], j.deadline)}</div><label>Checklist (dùng [x] cho việc đã xong)<textarea name="checklist" rows="5">${esc(
            JSON.parse(j.checklist)
              .map((x) => (x.done ? "[x] " : "[ ] ") + x.text)
              .join("\n"),
          )}</textarea></label><label>Ghi chú<textarea name="note" rows="4">${esc(j.note)}</textarea></label><div class="panel"><h3>Tệp của bước này</h3>${
            d.files
              .filter((f) => f.journey_step === j.step)
              .map(
                (f) =>
                  `<a class="file" href="/api/v1/files/${f.id}">${esc(f.name)}</a>`,
              )
              .join("") ||
            "Chưa có tệp. Chọn bước Journey khi tải tệp trong tab Tệp."
          }</div><button type="submit" class="button">Lưu bước</button></form>`,
        );
        formSubmit("#journeyForm", async (data) => {
          await send(
            "/records/" + id + "/journey",
            {
              ...data,
              step: j.step,
              version: j.version,
              progress: Number(data.progress),
              checklist: data.checklist
                .split("\n")
                .filter((x) => x.trim())
                .map((x) => ({
                  done: x.startsWith("[x]"),
                  text: x.replace(/^\[[ x]\]\s*/, ""),
                })),
            },
            "PATCH",
          );
          close();
          await refresh();
        });
      }),
  );
  if ($("#childKind")) {
    $("#childKind").onchange = (e) =>
      ($("#childrenCards").innerHTML = children
        .filter((x) => !e.target.value || x.kind === e.target.value)
        .map((x) => card(x))
        .join(""));
    $("#childNew").onclick = () => recordForm($("#childKind").value || "tasks");
  }
  if ($("#vote"))
    $("#vote").onclick = async () => {
      try {
        const x = await send("/records/" + id + "/vote", {});
        toast("Tổng bình chọn: " + x.count);
      } catch (e) {
        toast(e.message, true);
      }
    };
  if ($("#convert"))
    $("#convert").onclick = async () => {
      try {
        const x = await send("/records/" + id + "/convert", {});
        nav("w/detail/" + x.item.id);
      } catch (e) {
        toast(e.message, true);
      }
    };
  if ($("#registerEvent"))
    $("#registerEvent").onclick = async () => {
      try {
        await send("/records/" + id + "/registrations", {});
        toast("Đã đăng ký tham dự.");
      } catch (e) {
        toast(e.message, true);
      }
    };
  if ($("#participants"))
    $("#participants").onclick = async () => {
      try {
        const x = await api("/records/" + id + "/registrations");
        modal(
          "Đăng ký & điểm danh",
          x.items
            .map(
              (p) =>
                `<label class="row">${esc(p.name)} · ${esc(p.email)}<input type="checkbox" data-attend="${p.user_id}" ${p.attended ? "checked" : ""}></label>`,
            )
            .join("") || empty(),
        );
        $$("[data-attend]").forEach(
          (c) =>
            (c.onchange = async () => {
              try {
                await send(
                  "/records/" + id + "/registrations",
                  { user_id: c.dataset.attend, attended: c.checked },
                  "PATCH",
                );
              } catch (e) {
                c.checked = !c.checked;
                toast(e.message, true);
              }
            }),
        );
      } catch (e) {
        toast(e.message, true);
      }
    };
  if ($("#fillForm"))
    $("#fillForm").onclick = () => {
      modal(
        r.title,
        `<p>${esc(r.data.privacy)}</p><form id="responseEntry">${(r.data.fields || []).map((f) => (f.type === "file" ? `<label>${esc(f.label)}<input type="file" name="${f.key}" ${f.required ? "required" : ""}></label>` : inputField([f.key, f.label, f.type, f.required, f.options]))).join("")}<button type="submit" class="button">Gửi phản hồi</button></form>`,
      );
      formSubmit("#responseEntry", async (answers, form) => {
        for (const f of r.data.fields || []) {
          if (f.type === "file") {
            const file = form.elements[f.key].files[0];
            answers[f.key] = "";
            if (file) {
              const out = await api(
                "/records/" +
                  id +
                  "/response-files?name=" +
                  encodeURIComponent(file.name),
                { method: "POST", body: file },
              );
              answers[f.key] = out.id;
            }
          }
        }
        await send("/records/" + id + "/responses", { answers });
        close();
        toast("Đã ghi nhận phản hồi.");
      });
    };
  if ($("#responses"))
    $("#responses").onclick = async () => {
      try {
        const x = await api("/records/" + id + "/responses");
        modal(
          "Phản hồi biểu mẫu",
          x.items
            .map(
              (a) =>
                `<div class="panel"><b>${esc(name(a.user_id))} · ${date(a.created_at)}</b>${Object.entries(
                  JSON.parse(a.answers),
                )
                  .map(
                    ([k, v]) =>
                      `<p><b>${esc(r.data.fields?.find((f) => f.key === k)?.label || k)}:</b> ${r.data.fields?.find((f) => f.key === k)?.type === "file" && v ? `<a href="/api/v1/response-files/${encodeURIComponent(v)}">Tải tệp đính kèm</a>` : esc(v)}</p>`,
                  )
                  .join("")}</div>`,
            )
            .join("") || empty(),
        );
      } catch (e) {
        toast(e.message, true);
      }
    };
}
async function adminPage(view) {
  let html = "";
  if (view === "users") {
    const d = await api("/admin/users");
    html =
      heading(
        "Tài khoản & quyền truy cập",
        "Tạo tài khoản, phân vai và khóa truy cập.",
        '<button id="newUser" class="button">+ Tạo tài khoản</button>',
      ) +
      `<div class="panel table-wrap"><table><thead><tr><th>Thành viên</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>${d.items.map((u) => `<tr><td><b>${esc(u.name)}</b><small>${esc(u.email)}</small></td><td>${esc(u.roles)}</td><td>${u.active ? "Hoạt động" : "Đã khóa"}</td><td><button data-user="${u.id}">Phân quyền</button><button data-reset="${u.id}">Đặt lại mật khẩu</button></td></tr>`).join("")}</tbody></table></div>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    const options = Object.entries(d.roles)
      .map(([k, l]) => `<option value="${k}">${l}</option>`)
      .join("");
    $("#newUser").onclick = () => {
      modal(
        "Tạo tài khoản",
        '<form id="userForm"><label>Họ tên<input name="name" required></label><label>Email<input name="email" type="email" required></label><label>Mật khẩu tạm<input name="password" type="password" minlength="12" required autocomplete="new-password"></label><label>Vai trò<select name="role">' +
          options +
          '</select></label><button type="submit" class="button">Tạo tài khoản</button></form>',
      );
      formSubmit("#userForm", async (b) => {
        await send("/admin/users", b);
        close();
        toast("Đã tạo. Bàn giao mật khẩu tạm qua kênh riêng.");
        adminPage(view);
      });
    };
    $$("[data-user]").forEach(
      (b) =>
        (b.onclick = () => {
          const u = d.items.find((x) => x.id === b.dataset.user);
          modal(
            "Quyền của " + u.name,
            `<form id="rights"><label>Vai trò<select name="role">${options}</select></label><label><input type="checkbox" name="active" ${u.active ? "checked" : ""}> Cho phép đăng nhập</label><button type="submit" class="button">Lưu quyền</button></form>`,
          );
          $("#rights select").value = u.roles?.split(",")[0];
          formSubmit("#rights", async (f) => {
            await send(
              "/admin/users",
              { id: u.id, role: f.role, active: !!f.active },
              "PATCH",
            );
            close();
            adminPage(view);
          });
        }),
    );
    $$("[data-reset]").forEach(
      (b) =>
        (b.onclick = async () => {
          try {
            const d = await send("/admin/reset", { user_id: b.dataset.reset });
            modal(
              "Liên kết đặt lại mật khẩu",
              `<p>Chỉ chuyển cho chủ tài khoản sau khi xác minh. Liên kết hết hạn sau 30 phút.</p><textarea readonly rows="4">${esc(d.url)}</textarea>`,
            );
          } catch (e) {
            toast(e.message, true);
          }
        }),
    );
    return;
  }
  if (view === "roles") {
    const d = await api("/admin/roles");
    html =
      heading(
        "Vai trò & quyền",
        "Quyền được kiểm tra tại API cho mỗi thao tác.",
      ) +
      `<div class="panel"><form id="roleForm"><label>Vai trò<select name="role" id="roleSelect">${Object.entries(
        d.roles,
      )
        .filter(([k]) => k !== "system_admin")
        .map(([k, l]) => `<option value="${k}">${l}</option>`)
        .join(
          "",
        )}</select></label><div class="permission-grid">${Object.entries(
        d.permissions,
      )
        .map(
          ([k, l]) => `<label><input type="checkbox" name="${k}"> ${l}</label>`,
        )
        .join(
          "",
        )}</div><button type="submit" class="button">Lưu quyền</button></form><p class="muted">System Admin được bảo vệ để duy trì khả năng quản trị hệ thống.</p></div>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    const draw = () => {
      $$("#roleForm input").forEach(
        (i) =>
          (i.checked = d.grants.some(
            (x) => x.role === $("#roleSelect").value && x.permission === i.name,
          )),
      );
    };
    $("#roleSelect").onchange = draw;
    draw();
    formSubmit("#roleForm", async (b) => {
      await send(
        "/admin/roles",
        {
          role: b.role,
          permissions: Object.keys(b).filter((k) => k !== "role"),
        },
        "PATCH",
      );
      toast("Đã cập nhật quyền.");
      adminPage(view);
    });
    return;
  }
  if (view === "settings") {
    const d = await api("/admin/settings");
    html =
      heading(
        "Cài đặt Trung tâm",
        "Cập nhật nội dung giới thiệu và quy tắc vận hành.",
      ) +
      `<form id="settingsForm" class="panel">${[
        ["intro", "Giới thiệu"],
        ["mission", "Sứ mệnh"],
        ["vision", "Tầm nhìn"],
        ["values", "Giá trị"],
        ["contact", "Thông tin liên hệ"],
      ]
        .map(([k, l]) => inputField([k, l, "textarea"], d.settings[k]))
        .join(
          "",
        )}${inputField(["prefix", "Tiền tố mã hồ sơ", "text", true], d.settings.prefix || "SFRC")}<label>Bình chọn ý tưởng<select name="vote_enabled"><option value="false">Tắt</option><option value="true" ${d.settings.vote_enabled === "true" ? "selected" : ""}>Bật</option></select></label><button type="submit" class="button">Lưu cấu hình</button></form>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    formSubmit("#settingsForm", async (b) => {
      await send("/admin/settings", b, "PATCH");
      toast("Đã lưu cấu hình.");
    });
    return;
  }
  if (view === "audit") {
    const d = await api("/admin/audit?page=" + page);
    html =
      heading("Audit log", "Nhật ký thao tác quản trị, quyền, hồ sơ và tệp.") +
      `<div class="panel table-wrap"><table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Đối tượng / Chi tiết</th></tr></thead><tbody>${d.items.map((x) => `<tr><td>${esc(x.created_at)}</td><td>${esc(x.name || "Hệ thống / khách")}</td><td>${esc(x.action)}</td><td><code>${esc(x.target_id || "")}</code><small>${esc(x.detail)}</small></td></tr>`).join("")}</tbody></table></div><div class="pagination"><button id="auditPrev" ${page <= 1 ? "disabled" : ""}>← Trước</button><span>Trang ${page}</span><button id="auditNext" ${d.items.length < 100 ? "disabled" : ""}>Tiếp →</button></div>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    $("#auditPrev").onclick = () => {
      page--;
      adminPage(view);
    };
    $("#auditNext").onclick = () => {
      page++;
      adminPage(view);
    };
    return;
  }
  if (view === "export") {
    const d = await api("/admin/export");
    html =
      heading(
        "Xuất dữ liệu nghiệp vụ",
        "Xuất JSON theo bảng; sao lưu toàn bộ D1/R2 theo hướng dẫn vận hành.",
      ) +
      `<div class="panel"><select id="exportTable">${d.tables.map((t) => `<option>${t}</option>`).join("")}</select><button id="downloadExport" class="button">Tải dữ liệu JSON</button><p class="muted">Không chứa mật khẩu hoặc token phiên. Tệp xuất có thể chứa dữ liệu nội bộ.</p></div>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    $("#downloadExport").onclick = async () => {
      const b = $("#downloadExport");
      b.disabled = true;
      try {
        let offset = 0,
          items = [];
        do {
          const x = await api(
            "/admin/export?table=" +
              $("#exportTable").value +
              "&offset=" +
              offset,
          );
          items.push(...x.items);
          offset = x.next_offset;
        } while (offset !== null);
        download(
          $("#exportTable").value + ".json",
          JSON.stringify(items, null, 2),
          "application/json",
        );
      } catch (e) {
        toast(e.message, true);
      } finally {
        b.disabled = false;
      }
    };
    return;
  }
  if (view === "notices") {
    html =
      heading("Thông báo hệ thống", "Gửi tới thành viên hoặc toàn Trung tâm.") +
      `<form id="noticeForm" class="panel"><label>Người nhận<select name="user_id"><option value="">Toàn bộ thành viên</option>${directory.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("")}</select></label><label>Nội dung<textarea name="title" required maxlength="500"></textarea></label><button type="submit" class="button">Gửi thông báo</button></form>`;
    app.innerHTML = chrome(html, view);
    bindChrome();
    formSubmit("#noticeForm", async (b) => {
      await send("/admin/notices", b);
      toast("Đã gửi thông báo.");
    });
    return;
  }
}
function download(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function simplePage(view) {
  if (view === "finance") {
    const d = await api("/finance/summary");
    const sum = (t) =>
      d.items.filter((x) => x.type === t).reduce((n, x) => n + x.amount, 0);
    return (
      heading(
        "Tổng hợp kinh phí",
        "Chỉ tổng hợp các khoản đã được duyệt hoặc hoàn thành. Đơn vị: VND.",
      ) +
      `<div class="stats">${[
        ["Dự toán", sum("Dự toán")],
        ["Đã nhận", sum("Khoản thu")],
        ["Đã chi", sum("Thực chi")],
        ["Số dư thu − chi", sum("Khoản thu") - sum("Thực chi")],
      ]
        .map(
          ([a, b]) =>
            `<div class="stat"><span>${a}</span><b>${b.toLocaleString("vi-VN")}</b></div>`,
        )
        .join(
          "",
        )}</div><div class="panel">${d.items.map((x) => `<p><a href="#w/detail/${x.project_id}">${esc(x.project_id)}</a> · ${esc(x.type)}: ${x.amount.toLocaleString("vi-VN")}</p>`).join("")}</div>`
    );
  }
  if (view === "storage") {
    const d = await api("/admin/storage");
    return (
      heading(
        "Kho tệp",
        "Metadata và phiên bản tệp đã tải lên. Quyền tải vẫn theo hồ sơ.",
      ) +
      `<div class="panel table-wrap"><table><thead><tr><th>Tệp</th><th>Hồ sơ</th><th>Dung lượng</th><th>Trạng thái</th></tr></thead><tbody>${d.items.map((f) => `<tr><td>${esc(f.name)}</td><td><a href="#w/detail/${f.record_id}">${esc(f.title)}</a></td><td>${(f.size / 1024).toFixed(1)} KB</td><td>${f.deleted ? "Đã ẩn" : "Đang sử dụng"} · v${f.version}</td></tr>`).join("")}</tbody></table></div>`
    );
  }
  if (view === "security" || me.force_change) {
    const d = await api("/sessions").catch(() => ({ items: [] }));
    return (
      heading(
        "Tài khoản & bảo mật",
        me.force_change
          ? "Bạn cần đổi mật khẩu tạm trước khi tiếp tục."
          : "Quản lý mật khẩu và phiên đăng nhập.",
      ) +
      `<div class="detail-grid"><form id="passwordForm" class="panel"><h2>Đổi mật khẩu</h2><label>Mật khẩu hiện tại<input name="current" type="password" required autocomplete="current-password"></label><label>Mật khẩu mới<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"></label><button type="submit" class="button">Đổi mật khẩu và đăng xuất</button></form><div class="panel"><h2>Các phiên đang hoạt động</h2>${d.items.map((s) => `<p>Tạo ${date(s.created_at)} · Hết hạn ${new Date(s.expires * 1000).toLocaleString("vi-VN")}</p>`).join("")}<button id="revokeSessions" class="danger">Đăng xuất tất cả thiết bị</button></div></div>`
    );
  }
  if (view === "notifications") {
    const d = await api("/notifications");
    return (
      heading(
        "Thông báo",
        "Cập nhật phân công, xử lý hồ sơ và hạn công việc.",
        '<button id="readAll">Đánh dấu đã đọc</button>',
      ) +
      `<div class="panel">${d.items.map((n) => `<a class="notification ${n.seen ? "" : "unread"}" href="${n.record_id ? "#w/detail/" + n.record_id : "#w/notifications"}"><span class="dot"></span><div><b>${esc(n.title)}</b><small>${date(n.created_at)}</small></div></a>`).join("") || empty("Chưa có thông báo", "Các cập nhật liên quan đến bạn sẽ xuất hiện tại đây.")}</div>`
    );
  }
  if (view === "reviews") {
    const d = await api("/reviews");
    return (
      heading("Phản biện", "Các phiếu đánh giá được phân công.") +
      `<div class="panel">${d.items.map((v) => `<a class="deadline" href="#w/detail/${v.record_id}"><div><b>${esc(v.title)}</b><small>Vòng ${v.round} · ${v.submitted_at ? "Đã gửi: " + v.score + "/100" : "Đang chờ"} · ${date(v.deadline)}</small></div><span>↗</span></a>`).join("") || empty()}</div>`
    );
  }
  if (view === "journey") {
    const d = await api("/records?kind=projects");
    return (
      heading(
        "Research Journey",
        "15 bước đưa ý tưởng thành kết quả có thể chia sẻ.",
      ) +
      `<div class="journey-intro">${JOURNEY.map((j, i) => `<span>${String(i + 1).padStart(2, "0")} · ${j}</span>`).join("")}</div><div class="cards">${d.items.map((x) => card(x)).join("")}</div>`
    );
  }
}
async function renderRoute() {
  const seq = ++routeSequence;
  if (dialog.open) close();
  const hash = location.hash.slice(1),
    parts = hash.split("/");
  try {
    if (!hash) {
      await publicPage();
      return;
    }
    if (["login", "setup", "reset"].includes(parts[0])) {
      await loginPage(parts[0], parts[1]);
      return;
    }
    if (parts[0] !== "w") {
      location.hash = "";
      return;
    }
    if (!me) {
      try {
        me = (await api("/me")).user;
      } catch {
        nav("login");
        return;
      }
    }
    if (!directory.length)
      directory = (await api("/users/directory").catch(() => ({ items: [] })))
        .items;
    const v = me.force_change ? "security" : parts[1] || "dashboard";
    if (seq !== routeSequence) return;
    app.innerHTML = chrome(
      '<div class="loading">Đang tải không gian nghiên cứu…</div>',
      v,
    );
    bindChrome();
    if (CATALOG[v] || v === "search") {
      await list(v, decodeURIComponent(parts.slice(2).join("/")));
      return;
    }
    if (v === "detail") {
      await detail(parts[2]);
      return;
    }
    if (
      ["users", "roles", "settings", "audit", "export", "notices"].includes(v)
    ) {
      await adminPage(v);
      return;
    }
    const content = v === "dashboard" ? await dashboard() : await simplePage(v);
    if (seq !== routeSequence) return;
    app.innerHTML = chrome(content || empty("Không tìm thấy trang"), v);
    bindChrome();
    if ($("#passwordForm"))
      formSubmit("#passwordForm", async (b) => {
        await send("/password", b);
        me = null;
        nav("login");
      });
    if ($("#revokeSessions"))
      $("#revokeSessions").onclick = async () => {
        await api("/sessions", { method: "DELETE" });
        me = null;
        nav("login");
      };
    if ($("#readAll"))
      $("#readAll").onclick = async () => {
        await send("/notifications", {});
        route();
      };
  } catch (e) {
    if (seq !== routeSequence) return;
    const message = `<div class="panel error-panel"><h2>Không thể mở nội dung</h2><p>${esc(e.message)}</p><button id="retry" class="button">Thử lại</button><a href="/">Về trang chủ</a></div>`;
    app.innerHTML = me ? chrome(message) : publicShell(message);
    bindChrome();
    $("#retry").onclick = route;
  }
}
let routeBusy = false,
  routePending = false;
async function route() {
  routePending = true;
  if (routeBusy) return;
  routeBusy = true;
  try {
    while (routePending) {
      routePending = false;
      await renderRoute();
    }
  } finally {
    routeBusy = false;
  }
}
try {
  document.documentElement.classList.toggle(
    "dark",
    localStorage.getItem("theme") === "dark",
  );
} catch {}
window.addEventListener("hashchange", () => {
  page = 1;
  route();
});
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
document.addEventListener("input", (e) => {
  if (e.target.closest("#recordForm")) dirty = true;
});
dialog.addEventListener("cancel", (e) => {
  if (dirty && !confirm("Bỏ thay đổi chưa lưu?")) e.preventDefault();
  else dirty = false;
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#sidebar")?.classList.remove("open");
});
route();

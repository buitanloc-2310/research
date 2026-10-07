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
  lastFocus = null,
  publicSite = null,
  cmsMediaQuery = "",
  cmsMediaType = "all",
  cmsMediaPage = 1;
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
      throw Object.assign(Error((d.error || "Không thực hiện được yêu cầu.") + (d.request_id ? ` · Mã yêu cầu: ${d.request_id}` : "")), {
        status: r.status,
        requestId: d.request_id || null,
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
function resetDialog() {
  dialog.innerHTML = "";
  dialog.classList.remove("studio", "page-builder-dialog", "preview-dialog");
  lastFocus?.focus?.();
}
function close() {
  if (dialog.open) dialog.close();
  resetDialog();
}
dialog.addEventListener("close", () => {
  if (dialog.innerHTML) resetDialog();
});
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
          ["settings", "Cài đặt hệ thống"],
          ["website", "Cloud CMS Studio"],
          ["email", "Email outbox"],
          ["export", "Xuất dữ liệu"],
        ]
      : []),
    ...(has("audit") ? [["audit", "Audit log"]] : []),
    ...(has("manage") ? [["notices", "Gửi thông báo"]] : []),
  ];
  const commands = [...links.map(([id,label,icon]) => ({id,label,icon:icon||"→",group:"Workspace"})), ...admin.map(([id,label]) => ({id,label,icon:"⌘",group:"Admin"}))];
  return `<div class="workspace"><aside id="sidebar"><a class="brand" href="/"><img src="/sky-first-logo.png" alt=""><span>SKY FIRST<small>RESEARCH & INNOVATION CENTER</small></span></a><div class="nav-label">KHÔNG GIAN NGHIÊN CỨU</div><nav>${links.map(([id, label, icon]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>${icon}</span>${esc(label)}</a>`).join("")}</nav>${admin.length ? `<div class="nav-label">ADMIN CONTROL CENTER</div><nav>${admin.map(([id, label]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>⌘</span>${label}</a>`).join("")}</nav>` : ""}<div class="sidebar-foot">Hỏi sâu hơn.<br>Tạo thay đổi tốt hơn.</div></aside><div class="work-main"><header class="work-top"><button class="icon" id="menu" aria-label="Mở menu" aria-expanded="false">☰</button><form id="globalSearch"><span class="search-glyph" aria-hidden="true">⌕</span><input name="q" placeholder="Tìm đề tài, tài liệu, nghiên cứu…" aria-label="Tìm toàn hệ thống"><kbd>/</kbd></form><button id="commandOpen" class="command-open" type="button" aria-label="Mở lệnh nhanh"><span>⌘</span><b>Lệnh nhanh</b><kbd>⌘K</kbd></button><button class="icon theme" aria-label="Đổi giao diện sáng tối">◐</button><a href="#w/notifications" class="icon" aria-label="Thông báo">◉</a><button id="logout" class="quiet">Đăng xuất</button><span class="avatar" title="${esc(me?.name)}">${esc(me?.name?.slice(0, 1) || "S")}</span></header><main id="main" tabindex="-1">${content}</main><footer>SKY FIRST · Research & Innovation Center Workspace</footer></div><div id="commandPalette" class="command-palette" hidden><button class="command-backdrop" data-command-close aria-label="Đóng bảng lệnh"></button><section class="command-card" role="dialog" aria-modal="true" aria-labelledby="commandTitle"><div class="command-search"><span aria-hidden="true">⌕</span><input id="commandInput" autocomplete="off" placeholder="Đi đến trang hoặc chức năng…" aria-label="Tìm lệnh"><kbd>ESC</kbd></div><div class="command-title" id="commandTitle">ĐIỀU HƯỚNG NHANH</div><div id="commandResults">${commands.map(c=>`<button type="button" class="command-item" data-command="${esc(c.id)}" data-search="${esc((c.label+' '+c.group).toLowerCase())}"><span>${esc(c.icon)}</span><div><b>${esc(c.label)}</b><small>${esc(c.group)}</small></div><i>↗</i></button>`).join("")}</div></section></div></div>`;
}
function openCommandPalette() {
  const palette = $("#commandPalette");
  if (!palette) return;
  lastFocus = document.activeElement;
  palette.hidden = false;
  document.body.classList.add("palette-open");
  const input = $("#commandInput");
  if (input) {
    input.value = "";
    $$(".command-item").forEach((x) => (x.hidden = false));
    requestAnimationFrame(() => input.focus());
  }
}
function closeCommandPalette() {
  const palette = $("#commandPalette");
  if (!palette || palette.hidden) return;
  palette.hidden = true;
  document.body.classList.remove("palette-open");
  lastFocus?.focus?.();
}
function bindChrome() {
  const menu = $("#menu");
  if (menu)
    menu.onclick = () => {
      const open = $("#sidebar").classList.toggle("open");
      menu.setAttribute("aria-expanded", String(open));
    };
  const publicMenu = $(".public-menu");
  if (publicMenu) {
    publicMenu.onclick = () => {
      const navEl = $("#publicNav");
      const open = navEl?.classList.toggle("open");
      publicMenu.setAttribute("aria-expanded", String(!!open));
    };
    $$("#publicNav a").forEach(a => a.addEventListener("click", () => {
      $("#publicNav")?.classList.remove("open");
      publicMenu.setAttribute("aria-expanded", "false");
    }));
  }
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
  if ($("#commandOpen")) $("#commandOpen").onclick = openCommandPalette;
  $$('[data-command-close]').forEach((b) => (b.onclick = closeCommandPalette));
  $$('[data-command]').forEach((b) => (b.onclick = () => {
    closeCommandPalette();
    nav("w/" + b.dataset.command);
  }));
  if ($("#commandInput")) $("#commandInput").oninput = (e) => {
    const q = e.target.value.trim().toLowerCase();
    $$(".command-item").forEach((item) => {
      item.hidden = q && !item.dataset.search.includes(q);
    });
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
        } catch (error) {
          void error; // Theme persistence is optional when storage is unavailable.
        }
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
function mediaSrc(id, admin = false) {
  return id ? `/api/v1/${admin ? "admin/cms" : "public"}/media/${encodeURIComponent(id)}` : "/sky-first-logo.png";
}
async function loadPublicSite() {
  if (!publicSite) {
    publicSite = await api("/public/site").catch(() => null);
    const favicon = publicSite?.settings?.favicon_media_id;
    if (favicon) {
      const link = document.querySelector('link[rel="icon"]');
      if (link) link.href = mediaSrc(favicon);
    }
  }
  return publicSite;
}
function currentNav(url) {
  try {
    const u = new URL(url, location.origin);
    if (u.pathname !== location.pathname) return false;
    const kind = u.searchParams.get("kind");
    return kind ? new URLSearchParams(location.search).get("kind") === kind : !u.search;
  } catch { return false; }
}
function renderPublicNavigation(navs = []) {
  const roots = navs.filter((x) => !x.parent_id && x.url !== "/");
  return roots.map((item) => {
    const children = navs.filter((x) => x.parent_id === item.id);
    const active = currentNav(item.url) || children.some((x) => currentNav(x.url));
    const attrs = `${item.new_tab ? ' target="_blank" rel="noopener noreferrer"' : ""}`;
    if (!children.length)
      return `<a href="${esc(item.url)}" class="${active ? "active" : ""}" ${active ? 'aria-current="page"' : ""}${attrs}>${esc(item.label)}</a>`;
    return `<div class="public-nav-group ${active ? "active" : ""}"><a href="${esc(item.url)}"${attrs}>${esc(item.label)} <span aria-hidden="true">⌄</span></a><div class="public-subnav">${children.map((child) => `<a href="${esc(child.url)}" class="${currentNav(child.url) ? "active" : ""}" ${child.new_tab ? 'target="_blank" rel="noopener noreferrer"' : ""}>${esc(child.label)}<span aria-hidden="true">↗</span></a>`).join("")}</div></div>`;
  }).join("");
}

function footerDefaults(st = {}) {
  return [
    { id:"f-center-about", column_key:"center", heading:"Trung tâm", label:"Giới thiệu", url:"/about", position:0 },
    { id:"f-center-contact", column_key:"center", heading:"Trung tâm", label:"Liên hệ", url:"/contact", position:10 },
    { id:"f-center-privacy", column_key:"center", heading:"Trung tâm", label:"Quyền riêng tư", url:"/privacy", position:20 },
    { id:"f-discover-explore", column_key:"discover", heading:"Khám phá", label:"Kho nghiên cứu", url:"/explore", position:0 },
    { id:"f-discover-publications", column_key:"discover", heading:"Khám phá", label:"Công bố", url:"/explore?kind=publications", position:10 },
    { id:"f-discover-datasets", column_key:"discover", heading:"Khám phá", label:"Dataset", url:"/explore?kind=datasets", position:20 },
    { id:"f-discover-events", column_key:"discover", heading:"Khám phá", label:"Sự kiện", url:"/explore?kind=events", position:30 },
    { id:"f-eco-main", column_key:"ecosystem", heading:"Hệ sinh thái Sky First", label:"Trang Thông tin Sky First Network", url:"https://skyfirst.io.vn", position:0 },
    { id:"f-eco-ctt", column_key:"ecosystem", heading:"Hệ sinh thái Sky First", label:"Cổng Thông tin Sky First", url:"https://ctt.skyfirst.io.vn", position:10 },
    { id:"f-eco-tnv", column_key:"ecosystem", heading:"Hệ sinh thái Sky First", label:"Trung tâm Tình nguyện viên Sky First", url:"https://tnv.skyfirst.io.vn", position:20 },
    { id:"f-eco-member", column_key:"ecosystem", heading:"Hệ sinh thái Sky First", label:"Trung tâm Thành viên số Sky First", url:"https://member.skyfirst.io.vn", position:30 },
    { id:"f-eco-slc", column_key:"ecosystem", heading:"Hệ sinh thái Sky First", label:"Sky First Learning Center", url:"https://slc.skyfirst.io.vn", position:40 },
    { id:"f-connect-facebook", column_key:"connect", heading:"Kết nối", label:"Facebook", url:st.facebook || "https://fb.com/skyfirstnetwork", position:0 },
    { id:"f-connect-group", column_key:"connect", heading:"Kết nối", label:"Cộng đồng Facebook", url:st.facebook_group || "https://fb.com/groups/sfn.network", position:10 },
    { id:"f-connect-phone", column_key:"connect", heading:"Kết nối", label:"Hotline/Zalo", url:`tel:${String(st.hotline || "0924 910 210").replace(/\D/g,"")}`, position:20 },
    { id:"f-connect-email", column_key:"connect", heading:"Kết nối", label:"Email Trung tâm", url:`mailto:${st.email || "research@skyfirst.io.vn"}`, position:30 },
    { id:"f-connect-support", column_key:"connect", heading:"Kết nối", label:"Email hỗ trợ", url:`mailto:${st.support_email || "support@skyfirst.io.vn"}`, position:40 },
  ];
}
function publicShell(content, site = publicSite) {
  const st = site?.settings || {};
  const logo = mediaSrc(st.logo_media_id);
  const v4Nav = [
    {id:"n-center",label:"TRUNG TÂM",url:"/about"},
    {id:"n-center-1",parent_id:"n-center",label:"Giới thiệu",url:"/about"},{id:"n-center-2",parent_id:"n-center",label:"Định hướng phát triển",url:"/orientation"},{id:"n-center-3",parent_id:"n-center",label:"Lĩnh vực nghiên cứu & quan tâm",url:"/fields"},{id:"n-center-4",parent_id:"n-center",label:"Cơ cấu hoạt động",url:"/structure"},{id:"n-center-5",parent_id:"n-center",label:"Về Sky First Network",url:"/sky-first-network"},
    {id:"n-research",label:"NGHIÊN CỨU",url:"/research"},
    {id:"n-r1",parent_id:"n-research",label:"Tổng quan nghiên cứu",url:"/research"},{id:"n-r2",parent_id:"n-research",label:"Ý tưởng & Chủ đề",url:"/ideas"},{id:"n-r3",parent_id:"n-research",label:"Đề tài & Dự án",url:"/explore?kind=projects"},{id:"n-r4",parent_id:"n-research",label:"Nhóm nghiên cứu",url:"/research-groups"},{id:"n-r5",parent_id:"n-research",label:"Dữ liệu & Dataset",url:"/explore?kind=datasets"},{id:"n-r6",parent_id:"n-research",label:"Công bố & Ấn phẩm",url:"/explore?kind=publications"},{id:"n-r7",parent_id:"n-research",label:"Kết quả & Tác động",url:"/impact"},
    {id:"n-people",label:"CON NGƯỜI & TRI THỨC",url:"/people"},
    {id:"n-p1",parent_id:"n-people",label:"Con người",url:"/people"},{id:"n-p2",parent_id:"n-people",label:"Hồ sơ thành viên",url:"/explore?kind=profiles"},{id:"n-p3",parent_id:"n-people",label:"Lĩnh vực quan tâm",url:"/fields"},{id:"n-p4",parent_id:"n-people",label:"Kho tri thức",url:"/knowledge"},{id:"n-p5",parent_id:"n-people",label:"Tài nguyên & Tài liệu",url:"/resources"},{id:"n-p6",parent_id:"n-people",label:"Khám phá tri thức",url:"/explore"},
    {id:"n-innovation",label:"ĐỔI MỚI",url:"/innovation"},
    {id:"n-i1",parent_id:"n-innovation",label:"Sáng kiến",url:"/innovation"},{id:"n-i2",parent_id:"n-innovation",label:"Công nghệ & Chuyển đổi số",url:"/digital"},{id:"n-i3",parent_id:"n-innovation",label:"AI & Công nghệ mới",url:"/emerging-tech"},{id:"n-i4",parent_id:"n-innovation",label:"Giải pháp cộng đồng",url:"/community-solutions"},{id:"n-i5",parent_id:"n-innovation",label:"Thử nghiệm & Phát triển",url:"/experiments"},{id:"n-i6",parent_id:"n-innovation",label:"Không gian ý tưởng",url:"/ideas"},
    {id:"n-activity",label:"HOẠT ĐỘNG",url:"/activities"},
    {id:"n-a1",parent_id:"n-activity",label:"Tin tức",url:"/news"},{id:"n-a2",parent_id:"n-activity",label:"Sự kiện & Hội thảo",url:"/explore?kind=events"},{id:"n-a3",parent_id:"n-activity",label:"Chương trình & Dự án",url:"/programs"},{id:"n-a4",parent_id:"n-activity",label:"Hoạt động cộng đồng",url:"/community"},{id:"n-a5",parent_id:"n-activity",label:"Cơ hội tham gia",url:"/opportunities"},{id:"n-a6",parent_id:"n-activity",label:"Lịch hoạt động",url:"/explore?kind=events"},
    {id:"n-connect",label:"KẾT NỐI",url:"/contact"},
    {id:"n-c1",parent_id:"n-connect",label:"Hợp tác",url:"/collaboration"},{id:"n-c2",parent_id:"n-connect",label:"Mạng lưới & Cộng đồng",url:"/network"},{id:"n-c3",parent_id:"n-connect",label:"Dành cho cá nhân",url:"/for-people"},{id:"n-c4",parent_id:"n-connect",label:"Dành cho tổ chức",url:"/for-organizations"},{id:"n-c5",parent_id:"n-connect",label:"Gửi đề xuất",url:"/proposals"},{id:"n-c6",parent_id:"n-connect",label:"Liên hệ",url:"/contact"}
  ];
  const navs = site?.navigation?.length ? site.navigation : v4Nav;
  const footer = site?.footer?.length ? site.footer : footerDefaults(st);
  const footerOrder = ["center", "discover", "ecosystem", "connect"];
  const columns = [...new Set(footer.map(x => x.column_key))].sort((a,b) => {
    const ai = footerOrder.indexOf(a), bi = footerOrder.indexOf(b);
    if (ai < 0 && bi < 0) return a.localeCompare(b, "vi");
    if (ai < 0) return 1;
    if (bi < 0) return -1;
    return ai - bi;
  });
  const nameVi = st.center_name || "TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST";
  const nameEn = st.english_name || "SKY FIRST RESEARCH & INNOVATION CENTER";
  const email = st.email || "research@skyfirst.io.vn";
  const hotline = st.hotline || "0924 910 210";
  return `<header class="public-top"><a class="brand public-brand" href="/" aria-label="${esc(nameVi)}"><img src="${esc(logo)}" alt="Logo Trung tâm"><span><b>SKY FIRST</b><small>RESEARCH & INNOVATION CENTER</small></span></a><nav id="publicNav" class="public-nav" aria-label="Điều hướng chính">${renderPublicNavigation(navs)}</nav><div class="public-actions"><a class="header-search" href="/explore" aria-label="Tìm kiếm nội dung">⌕</a><button class="icon theme" aria-label="Đổi giao diện sáng tối" title="Đổi giao diện">◐</button><button class="icon public-menu" aria-label="Mở menu website" aria-controls="publicNav" aria-expanded="false">☰</button></div></header><main id="main" tabindex="-1">${content}</main><footer class="public-footer premium"><section class="footer-brand"><img src="${esc(logo)}" alt=""><div><h2>${esc(nameVi)}</h2><p>${esc(st.description || "Nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng.")}</p><div class="footer-contact"><a href="mailto:${esc(email)}"><span>✉</span>${esc(email)}</a><a href="tel:${esc(hotline.replace(/\D/g,""))}"><span>⌕</span>${esc(hotline)}</a></div></div></section>${columns.map(c=>{const items=footer.filter(x=>x.column_key===c);return `<section class="footer-column footer-${esc(c)}"><h3>${esc(items[0]?.heading||c)}</h3>${items.map(x=>`<a href="${esc(x.url)}" ${/^https?:/i.test(x.url)?'target="_blank" rel="noopener noreferrer"':''}><span>${esc(x.label)}</span><b aria-hidden="true">${/^https?:/i.test(x.url)?"↗":"›"}</b></a>`).join("")}</section>`}).join("")}<div class="footer-bottom"><span>${esc(st.copyright || "© 2026 Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First.")}</span><nav aria-label="Liên kết cuối trang"><a href="/privacy">Chính sách bảo mật</a><a href="/contact">Liên hệ</a><a class="workspace-link" href="/#${me ? "w/dashboard" : "login"}">Workspace ↗</a></nav></div><div class="footer-signature" aria-hidden="true">${esc(nameEn)}</div></footer>`;
}
function renderCmsBlock(block) {
  if (!block?.enabled) return "";
  const d = block.data || {};
  if (block.type === "hero") return `<section class="cms-hero"><div class="cms-hero-inner"><div class="eyebrow">${esc(d.eyebrow||"")}</div><h1>${esc(d.title||"")}</h1><p>${esc(d.text||"")}</p><div class="actions">${d.primaryLabel&&d.primaryUrl?`<a class="button" href="${esc(d.primaryUrl)}">${esc(d.primaryLabel)} <span aria-hidden="true">↗</span></a>`:""}${d.secondaryLabel&&d.secondaryUrl?`<a class="text-link" href="${esc(d.secondaryUrl)}">${esc(d.secondaryLabel)} <span aria-hidden="true">→</span></a>`:""}</div></div><div class="research-visual compact" aria-hidden="true"><div class="visual-grid"></div><div class="visual-orbit orbit-a"></div><div class="visual-orbit orbit-b"></div><div class="visual-node node-a"></div><div class="visual-node node-b"></div><div class="visual-node node-c"></div><div class="visual-core">R<span>&</span>I</div></div></section>`;
  if (block.type === "heading") return `<section class="cms-section"><div class="section-kicker">${esc(d.eyebrow||"")}</div><h2>${esc(d.title||"")}</h2><p class="lead">${esc(d.text||"")}</p></section>`;
  if (block.type === "rich_text") return `<section class="cms-section narrow"><h2>${esc(d.heading||"")}</h2><div class="prose cms-prose">${esc(d.text||"").replace(/\n/g,"<br>")}</div></section>`;
  if (block.type === "image") return `<figure class="cms-image">${d.media_id?`<img src="${mediaSrc(d.media_id)}" alt="${esc(d.alt||"")}" loading="lazy">`:""}${d.caption?`<figcaption>${esc(d.caption)}</figcaption>`:""}</figure>`;
  if (block.type === "cta") return `<section class="cms-cta"><div><span class="section-kicker">KẾT NỐI</span><h2>${esc(d.title||"")}</h2><p>${esc(d.text||"")}</p></div>${d.label&&d.url?`<a class="button light" href="${esc(d.url)}">${esc(d.label)} <span aria-hidden="true">↗</span></a>`:""}</section>`;
  if (block.type === "statistics") return `<section class="cms-section"><h2>${esc(d.heading||"")}</h2><div class="cms-stats">${(d.items||[]).filter(x=>x.value||x.label).map(x=>`<div><b>${esc(x.value||"")}</b><span>${esc(x.label||"")}</span></div>`).join("")}</div></section>`;
  if (["cards","feature_grid","partners"].includes(block.type)) return `<section class="cms-section"><div class="section-heading"><div><span class="section-kicker">${block.type==="feature_grid"?"TRỌNG TÂM":"NỘI DUNG"}</span><h2>${esc(d.heading||"")}</h2></div></div><div class="cms-grid">${(d.items||[]).map((x,i)=>`<${x.url?`a href="${esc(x.url)}"`:'div'} class="cms-card">${x.media_id?`<img src="${mediaSrc(x.media_id)}" alt="" loading="lazy">`:`<div class="cms-card-mark" aria-hidden="true">${String(i+1).padStart(2,"0")}</div>`}<h3>${esc(x.title||"")}</h3><p>${esc(x.text||"")}</p>${x.url?'<span>Khám phá <b aria-hidden="true">↗</b></span>':""}</${x.url?'a':'div'}>`).join("")}</div></section>`;
  if (block.type === "faq") return `<section class="cms-section narrow"><span class="section-kicker">FAQ</span><h2>${esc(d.heading||"Câu hỏi thường gặp")}</h2><div class="cms-faq">${(d.items||[]).map(x=>`<details><summary>${esc(x.title||x.question||"")}<span aria-hidden="true">+</span></summary><p>${esc(x.text||x.answer||"")}</p></details>`).join("")}</div></section>`;
  return "";
}
function renderCmsPage(page) {
  return `<div class="cms-page">${(page.blocks||[]).map(renderCmsBlock).join("")}</div>`;
}
function publicRecordCard(r, mode = "grid") {
  const d = r.data || {};
  if (r.kind === "events" || mode === "events") {
    const start = d.start ? new Date(d.start) : null;
    const day = start && !Number.isNaN(start.valueOf()) ? String(start.getDate()).padStart(2,"0") : "--";
    const month = start && !Number.isNaN(start.valueOf()) ? `Th${start.getMonth()+1}` : "Sự kiện";
    return `<a class="event-row" href="/record/${esc(r.id)}"><div class="event-date"><b>${day}</b><span>${month}</span></div><div class="event-copy"><span class="content-type">${esc(CATALOG[r.kind]?.label || "Sự kiện")}</span><h3>${esc(r.title)}</h3><p>${esc(r.summary || "")}</p><div class="record-meta">${d.location?`<span>⌖ ${esc(d.location)}</span>`:""}<span>${date(r.created_at)}</span></div></div><span class="record-arrow" aria-hidden="true">↗</span></a>`;
  }
  if (r.kind === "publications" || mode === "publications") {
    return `<a class="publication-row" href="/record/${esc(r.id)}"><div class="publication-mark" aria-hidden="true">↗</div><div><span class="content-type">Công bố khoa học</span><h3>${esc(r.title)}</h3><p>${esc(r.summary || d.abstract || "")}</p><div class="record-meta">${d.authors?`<span>${esc(d.authors)}</span>`:""}<span>${date(r.created_at)}</span></div></div><span class="record-arrow" aria-hidden="true">↗</span></a>`;
  }
  if (r.kind === "datasets" || mode === "datasets") {
    return `<a class="knowledge-card dataset-card" href="/record/${esc(r.id)}"><div class="knowledge-card-head"><span class="content-type">Dataset</span><span class="dataset-icon" aria-hidden="true">▦</span></div><h3>${esc(r.title)}</h3><p>${esc(r.summary || "Mô tả dữ liệu công khai.")}</p><div class="record-meta"><span>${d.edition?`Phiên bản ${esc(d.edition)}`:esc(r.code || "")}</span><span>${date(r.created_at)} ↗</span></div></a>`;
  }
  return `<a class="knowledge-card" href="/record/${esc(r.id)}"><div class="knowledge-card-head"><span class="content-type">${esc(CATALOG[r.kind]?.label || r.kind)}</span><span class="mini-symbol" aria-hidden="true">${esc(CATALOG[r.kind]?.icon || "◇")}</span></div><h3>${esc(r.title)}</h3><p>${esc(r.summary || "")}</p><div class="record-meta"><span>${esc(r.code || "")}</span><span>${date(r.created_at)} ↗</span></div></a>`;
}
function exploreHeading(kind) {
  return ({
    publications:["Công bố khoa học","Các bài báo, báo cáo và kết quả nghiên cứu đã được công khai."],
    events:["Sự kiện & hội thảo","Theo dõi các hoạt động trao đổi, đào tạo và kết nối nghiên cứu."],
    datasets:["Dữ liệu & nguồn lực","Khám phá các dataset được mô tả và chia sẻ theo điều kiện sử dụng."],
    projects:["Đề tài & dự án","Những hồ sơ nghiên cứu và đổi mới sáng tạo đã được công bố."],
    contributions:["Đóng góp công khai","Ghi nhận những đóng góp đã được duyệt và công bố."],
  })[kind] || ["Khám phá tri thức","Tìm kiếm đề tài, công bố, dữ liệu, sự kiện và nguồn lực nghiên cứu."];
}
function categoryChips(q, kind) {
  const items = [["","Tất cả"],["publications","Công bố"],["events","Sự kiện"],["datasets","Dataset"],["projects","Dự án"],["contributions","Đóng góp"]];
  return `<nav class="category-chips" aria-label="Lọc loại nội dung">${items.map(([k,l])=>{const p=new URLSearchParams();if(q)p.set("q",q);if(k)p.set("kind",k);return `<a href="/explore${p.toString()?`?${p}`:""}" class="${kind===k?"active":""}" ${kind===k?'aria-current="page"':''}>${l}</a>`}).join("")}</nav>`;
}
function fallbackHome(settings, data) {
  const live = data.total > 0 ? `<div class="live-proof"><b>${data.total}</b><span>Nội dung công khai đang có trong thư viện</span></div>` : "";
  const recent = data.items.length ? `<section class="public-section latest-section"><div class="section-heading"><div><span class="section-kicker">NỘI DUNG MỚI</span><h2>Tri thức đang được chia sẻ.</h2><p>Những hồ sơ mới nhất đã qua quy trình công bố của hệ thống.</p></div><a class="section-link" href="/explore">Xem thư viện <span aria-hidden="true">↗</span></a></div><div class="knowledge-grid">${data.items.slice(0,6).map(r=>publicRecordCard(r)).join("")}</div></section>` : `<section class="public-section latest-section"><div class="section-heading"><div><span class="section-kicker">NỘI DUNG MỚI</span><h2>Không gian sẵn sàng cho công bố đầu tiên.</h2><p>Khi hồ sơ được duyệt và công khai, nội dung thật sẽ xuất hiện tại đây.</p></div><a class="section-link" href="/explore">Mở thư viện <span aria-hidden="true">↗</span></a></div>${empty("Chưa có nội dung công khai","Bạn có thể khám phá cấu trúc thư viện hoặc quay lại sau khi có công bố mới.")}</section>`;
  return `<section class="hero new-hero"><div class="hero-copy"><div class="eyebrow">SKY FIRST RESEARCH & INNOVATION CENTER</div><h1>Từ câu hỏi hôm nay.<br><em>Đến giải pháp ngày mai.</em></h1><p>${esc(settings.intro || settings.description || "Kết nối câu hỏi, dữ liệu và con người để phát triển những giải pháp có ích trong thực tế.")}</p><div class="actions"><a class="button" href="/explore">Khám phá nghiên cứu <span aria-hidden="true">↗</span></a><a class="text-link" href="/about">Về Trung tâm <span aria-hidden="true">→</span></a></div>${live}</div><div class="research-visual" aria-hidden="true"><div class="visual-grid"></div><div class="visual-orbit orbit-a"></div><div class="visual-orbit orbit-b"></div><div class="visual-orbit orbit-c"></div><div class="visual-node node-a"></div><div class="visual-node node-b"></div><div class="visual-node node-c"></div><div class="visual-core">SF<span>•</span>R&I</div><div class="visual-tag tag-a">RESEARCH</div><div class="visual-tag tag-b">DATA</div><div class="visual-tag tag-c">INNOVATION</div></div></section><section class="public-section focus-section"><div class="section-heading"><div><span class="section-kicker">LĨNH VỰC TRỌNG TÂM</span><h2>Đi sâu vào những vấn đề có ý nghĩa.</h2><p>Bốn hướng giúp kết nối tri thức với nhu cầu thực tế.</p></div><a class="section-link" href="/about">Cách chúng tôi tiếp cận <span aria-hidden="true">↗</span></a></div><div class="focus-grid">${[["01","Giáo dục & học tập","Hiểu cách con người học, tiếp cận tri thức và phát triển năng lực."],["02","Công nghệ & sáng tạo","Thử nghiệm công cụ, phương pháp và mô hình giải quyết vấn đề."],["03","Cộng đồng & phát triển","Bắt đầu từ nhu cầu thật và theo dõi tác động sau triển khai."],["04","Dữ liệu & tri thức mở","Tổ chức dữ liệu rõ ràng để tri thức có thể được hiểu và tái sử dụng."]].map(([n,a,b])=>`<article class="focus-card"><span>${n}</span><div class="focus-icon" aria-hidden="true">${n==="01"?"▤":n==="02"?"✦":n==="03"?"◎":"▦"}</div><h3>${a}</h3><p>${b}</p></article>`).join("")}</div></section><section class="process-section"><div class="process-heading"><span class="section-kicker light-kicker">CÁCH CHÚNG TÔI HOẠT ĐỘNG</span><h2>Từ ý tưởng đến tác động thực tế.</h2><p>Một nhịp làm việc rõ ràng để nghiên cứu không dừng ở ý tưởng.</p></div><div class="process-grid">${[["01","Tiếp nhận ý tưởng","Làm rõ vấn đề và câu hỏi cần khám phá."],["02","Nghiên cứu & phát triển","Thử nghiệm, thu thập dữ liệu và hoàn thiện phương án."],["03","Công bố & chia sẻ","Đưa kết quả phù hợp đến cộng đồng một cách có trách nhiệm."],["04","Tạo tác động","Theo dõi ứng dụng, phản hồi và cơ hội cải tiến tiếp theo."]].map(([n,a,b])=>`<div class="process-step"><b>${n}</b><h3>${a}</h3><p>${b}</p></div>`).join("")}</div></section><section class="v4-fields public-section"><div class="section-heading"><div><span class="section-kicker">18 LĨNH VỰC NGHIÊN CỨU & QUAN TÂM</span><h2>Một bản đồ mở cho những câu hỏi liên ngành.</h2><p>Danh mục giúp kết nối con người, ý tưởng, đề tài, dữ liệu và hoạt động; không phải tuyên bố Trung tâm chuyên sâu đồng thời ở mọi lĩnh vực.</p></div><a class="section-link" href="/fields">Khám phá lĩnh vực ↗</a></div><div class="field-cloud">${["Giáo dục & Đào tạo","Phát triển Người trẻ","Tình nguyện & Cộng đồng","Môi trường & PTBV","Nghiên cứu & Đổi mới sáng tạo","Chương trình & Dự án","Sự kiện & Hoạt động","Kết nối & Hợp tác","Truyền thông & Lan tỏa","Công nghệ & Chuyển đổi số","Dữ liệu & Khoa học dữ liệu","AI & Công nghệ mới","Xã hội & Hành vi","Văn hóa & Sáng tạo","Kỹ năng & Năng lực tương lai","Tiếp cận & Bình đẳng cơ hội","Quản trị & Phát triển tổ chức","Đo lường Tác động"].map((x,i)=>`<a href="/fields"><b>${String(i+1).padStart(2,"0")}</b>${x}</a>`).join("")}</div></section><section class="v4-journey"><div><span class="section-kicker light-kicker">RESEARCH JOURNEY</span><h2>Một hành trình có thể theo dõi, không phải một hộp đen.</h2><p>Từ câu hỏi ban đầu đến dữ liệu, công bố và tác động, mỗi giai đoạn đều có mục tiêu và bằng chứng riêng.</p></div><div class="journey-track">${["IDEA","PROPOSAL","REVIEW","ETHICS","RESEARCH","DATA","ACCEPTANCE","PUBLICATION","IMPACT"].map((x,i)=>`<span><b>${String(i+1).padStart(2,"0")}</b>${x}</span>`).join("")}</div></section><section class="people-knowledge public-section"><div class="section-heading"><div><span class="section-kicker">CON NGƯỜI × TRI THỨC</span><h2>Tri thức được tạo nên bởi những mối liên kết.</h2><p>Hồ sơ công khai có thể kết nối lĩnh vực quan tâm, nhóm, dự án, dataset, công bố và đóng góp thực tế.</p></div><a class="section-link" href="/people">Khám phá con người ↗</a></div><div class="knowledge-network" aria-label="Mô hình liên kết tri thức"><span>PEOPLE</span><i>↔</i><span>INTEREST</span><i>↔</i><span>PROJECT</span><i>↔</i><span>DATASET</span><i>↔</i><span>PUBLICATION</span></div></section>${recent}<section class="public-section knowledge-space"><div class="section-heading"><div><span class="section-kicker">KHÔNG GIAN TRI THỨC</span><h2>Mỗi loại nội dung có một cách để khám phá.</h2></div></div><div class="portal-grid"><a href="/explore?kind=publications"><span>↗</span><h3>Công bố</h3><p>Kết quả, báo cáo và bài viết nghiên cứu đã được chia sẻ.</p></a><a href="/explore?kind=datasets"><span>▦</span><h3>Dataset</h3><p>Nguồn dữ liệu đi kèm mô tả và điều kiện sử dụng rõ ràng.</p></a><a href="/explore?kind=events"><span>◷</span><h3>Sự kiện</h3><p>Không gian trao đổi, hội thảo và hoạt động đào tạo.</p></a></div></section><section class="join-band"><div><span class="section-kicker light-kicker">KẾT NỐI</span><h2>Một câu hỏi tốt có thể bắt đầu từ một cuộc trao đổi.</h2><p>Trao đổi về nghiên cứu, đề xuất ý tưởng hoặc một cơ hội hợp tác phù hợp.</p></div><a class="button light" href="/contact">Kết nối cùng Trung tâm <span aria-hidden="true">↗</span></a></section>`;
}
function fallbackAbout(settings) {
  const values = String(settings.values || "Trung thực · Hợp tác · Tôn trọng dữ liệu · Học hỏi liên tục").split(/[·•|]/).map(x=>x.trim()).filter(Boolean).slice(0,6);
  return `<section class="about-hero"><div><span class="section-kicker">VỀ TRUNG TÂM</span><h1>Nơi những câu hỏi mở ra khả năng mới.</h1><p>${esc(settings.intro || settings.description || "Một không gian nghiên cứu và đổi mới sáng tạo hướng đến những vấn đề có ý nghĩa trong thực tế.")}</p></div><div class="research-visual compact" aria-hidden="true"><div class="visual-grid"></div><div class="visual-orbit orbit-a"></div><div class="visual-orbit orbit-b"></div><div class="visual-node node-a"></div><div class="visual-node node-b"></div><div class="visual-core">S<span>F</span></div></div></section><section class="public-section about-pillars"><div class="pillar-grid"><article><div class="pillar-icon">◫</div><span class="section-kicker">SỨ MỆNH</span><h2>Sứ mệnh</h2><p>${esc(settings.mission || "Kết nối con người, tri thức và phương pháp để phát triển các giải pháp hữu ích.")}</p></article><article><div class="pillar-icon">⌁</div><span class="section-kicker">TẦM NHÌN</span><h2>Tầm nhìn</h2><p>${esc(settings.vision || "Xây dựng môi trường nghiên cứu cởi mở, có trách nhiệm và hướng đến tác động cộng đồng.")}</p></article><article><div class="pillar-icon">◇</div><span class="section-kicker">GIÁ TRỊ CỐT LÕI</span><h2>Cách chúng tôi giữ chất lượng</h2><div class="value-tags">${values.map(v=>`<span>${esc(v)}</span>`).join("")}</div></article></div></section><section class="public-section about-fields"><div class="section-heading"><div><span class="section-kicker">LĨNH VỰC HOẠT ĐỘNG</span><h2>Tập trung vào những điểm giao giữa tri thức và thực tiễn.</h2></div></div><div class="focus-grid">${[["01","Giáo dục & học tập","Trải nghiệm học tập, tiếp cận tri thức và phát triển năng lực."],["02","Công nghệ & sáng tạo","Công cụ và phương pháp mới cho những vấn đề cụ thể."],["03","Cộng đồng & phát triển","Nhu cầu cộng đồng, mức độ phù hợp và tác động sau triển khai."],["04","Dữ liệu & tri thức mở","Cách tổ chức, mô tả và chia sẻ tri thức có trách nhiệm."]].map(([n,a,b])=>`<article class="focus-card"><span>${n}</span><h3>${a}</h3><p>${b}</p></article>`).join("")}</div></section><section class="approach-section"><div class="section-heading"><div><span class="section-kicker">CÁCH TIẾP CẬN</span><h2>Rõ câu hỏi. Rõ dữ liệu. Rõ tác động.</h2></div></div><div class="approach-grid"><div><b>01</b><h3>Lắng nghe</h3><p>Bắt đầu từ bối cảnh và nhu cầu thực tế.</p></div><div><b>02</b><h3>Kiểm chứng</h3><p>Dùng dữ liệu, phương pháp và phản biện để làm rõ giả định.</p></div><div><b>03</b><h3>Chia sẻ</h3><p>Công bố phù hợp với mức độ sẵn sàng và quyền truy cập.</p></div><div><b>04</b><h3>Học lại</h3><p>Quan sát tác động để tiếp tục cải tiến.</p></div></div></section><section class="public-section participation"><div><span class="section-kicker">AI CÓ THỂ KẾT NỐI</span><h2>Không gian dành cho những người muốn cùng làm rõ một vấn đề.</h2></div><div class="participation-list"><span>Nhà nghiên cứu</span><span>Giảng viên & chuyên gia</span><span>Sinh viên & người trẻ</span><span>Tổ chức & đối tác</span><span>Cộng đồng xã hội</span></div></section><section class="join-band"><div><span class="section-kicker light-kicker">BẮT ĐẦU TỪ MỘT CUỘC TRAO ĐỔI</span><h2>Có một câu hỏi, đề xuất hay cơ hội hợp tác?</h2></div><a class="button light" href="/contact">Kết nối cùng Trung tâm <span aria-hidden="true">↗</span></a></section>`;
}
function fallbackContact(settings) {
  const email = settings.email || "research@skyfirst.io.vn", support = settings.support_email || "support@skyfirst.io.vn", hotline = settings.hotline || "0924 910 210";
  return `<section class="contact-hero"><div><span class="section-kicker">KẾT NỐI</span><h1>Bắt đầu bằng một trao đổi rõ ràng.</h1><p>Chọn đúng đầu mối để câu hỏi của bạn được tiếp nhận nhanh hơn.</p></div></section><section class="public-section contact-section"><div class="contact-intents"><article><span>01</span><h3>Hợp tác nghiên cứu</h3><p>Trao đổi về đề tài, nghiên cứu chung hoặc nguồn lực chuyên môn.</p></article><article><span>02</span><h3>Đề xuất ý tưởng</h3><p>Chia sẻ một vấn đề, nhu cầu hoặc hướng thử nghiệm đáng khám phá.</p></article><article><span>03</span><h3>Truyền thông / đối tác</h3><p>Kết nối về nội dung công khai, hoạt động hoặc phối hợp phù hợp.</p></article><article><span>04</span><h3>Hỗ trợ hệ thống</h3><p>Nhận hỗ trợ khi gặp vấn đề với tài khoản hoặc nền tảng.</p></article></div><div class="contact-panel"><div><span class="section-kicker">THÔNG TIN CHÍNH THỨC</span><h2>Kết nối với Trung tâm</h2><p>Không có form giả: các kênh dưới đây mở trực tiếp đầu mối đang được cấu hình cho hệ thống.</p></div><div class="contact-links"><a href="mailto:${esc(email)}"><span class="contact-icon">✉</span><div><small>Email Trung tâm</small><b>${esc(email)}</b></div><i>↗</i></a><a href="mailto:${esc(support)}"><span class="contact-icon">?</span><div><small>Email hỗ trợ</small><b>${esc(support)}</b></div><i>↗</i></a><a href="tel:${esc(hotline.replace(/\D/g,""))}"><span class="contact-icon">⌕</span><div><small>Hotline / Zalo</small><b>${esc(hotline)}</b></div><i>↗</i></a><a href="${esc(settings.website || "https://research.skyfirst.io.vn")}" target="_blank" rel="noopener noreferrer"><span class="contact-icon">◎</span><div><small>Website</small><b>research.skyfirst.io.vn</b></div><i>↗</i></a></div></div></section><section class="contact-note"><div><h2>Đã có tài khoản trong hệ thống?</h2><p>${me?"Bạn có thể mở hồ sơ hợp tác hoặc ý tưởng trực tiếp trong không gian làm việc.":"Đăng nhập để sử dụng các workflow nội bộ đã được phân quyền."}</p></div><a class="button" href="/#${me?"w/collaborations":"login"}">${me?"Mở hồ sơ hợp tác":"Đăng nhập"} <span aria-hidden="true">↗</span></a></section>`;
}
async function publicPage() {
  const path = location.pathname;
  let content = "";
  const site = await loadPublicSite();
  const settings = site?.settings || {};
  const cmsSlug = path === "/" ? "home" : path.slice(1);
  if (!path.startsWith("/record/") && path !== "/explore" && /^\/(?:[a-z0-9-]+)?$/.test(path)) {
    const cms = await api("/public/pages/" + cmsSlug).catch(e => e.status === 404 ? null : Promise.reject(e));
    if (cms?.page) {
      const page = cms.page;
      document.title = (page.seo_title || page.title) + " · SKY FIRST";
      content = renderCmsPage(page);
      if (page.slug === "home") {
        const data = await api("/public/search");
        content += data.items.length ? `<section class="public-section latest-section cms-live-feed"><div class="section-heading"><div><span class="section-kicker">NỘI DUNG MỚI</span><h2>Mới từ không gian nghiên cứu.</h2><p>Dữ liệu thật từ các hồ sơ đã được công bố.</p></div><a class="section-link" href="/explore">Xem thư viện ↗</a></div><div class="knowledge-grid">${data.items.slice(0,6).map(r=>publicRecordCard(r)).join("")}</div></section>` : "";
      }
      app.innerHTML = publicShell(content, site);
      bindChrome();
      return;
    }
  }
  if (path.startsWith("/record/")) {
    const { item: r, files, metrics } = await api("/public/records/" + path.split("/")[2]);
    document.title = r.title + " · SKY FIRST";
    content = `<article class="article record-detail"><a class="back-link" href="/explore">← Trở lại thư viện</a><div class="record-detail-head"><div><div class="eyebrow">${esc(CATALOG[r.kind]?.label)} · ${esc(r.code)}</div><h1>${esc(r.title)}</h1><p class="lead">${esc(r.summary)}</p><p class="muted small">${metrics?.views || 0} lượt xem · ${metrics?.downloads || 0} lượt tải</p></div><div class="record-detail-mark" aria-hidden="true">${esc(CATALOG[r.kind]?.icon || "◇")}</div></div>${r.kind === "profiles" && files.some((f) => f.mime.startsWith("image/")) ? `<img class="profile-image" src="/api/v1/public/files/${files.find((f) => f.mime.startsWith("image/")).id}?preview=1" alt="${esc(r.title)}">` : ""}<div class="record-sections">${CATALOG[r.kind].fields.filter(([k]) => r.data[k]).map(([k, label]) => `<section><h2>${esc(label)}</h2><p class="prose">${esc(r.data[k])}</p></section>`).join("")}</div><div class="panel attachments"><h2>Tài liệu đính kèm</h2>${files.map((f) => `<a class="file" href="/api/v1/public/files/${f.id}">↓ <span>${esc(f.name)}</span><small>${(f.size / 1024).toFixed(1)} KB</small></a>`).join("") || "<p class=\"muted\">Chưa có tệp đính kèm.</p>"}</div>${r.kind === "events" ? '<a class="button" href="/#w/detail/' + r.id + '">Đăng nhập để đăng ký ↗</a>' : ""}</article>`;
  } else if (path === "/about") {
    document.title = "Giới thiệu Trung tâm · SKY FIRST";
    content = fallbackAbout(settings);
  } else if (path === "/contact") {
    document.title = "Kết nối cùng Trung tâm · SKY FIRST";
    content = fallbackContact(settings);
  } else if (path === "/privacy") {
    document.title = "Quyền riêng tư & sử dụng dữ liệu · SKY FIRST";
    content = `<article class="article policy-page"><span class="section-kicker">QUYỀN RIÊNG TƯ</span><h1>Quyền riêng tư & sử dụng dữ liệu</h1><p class="lead">Dữ liệu được xử lý theo mục đích vận hành hệ thống nghiên cứu và theo quyền truy cập của từng tài khoản.</p><section><h2>Nguyên tắc</h2><p>Hồ sơ nội bộ và tệp đính kèm chỉ được truy cập theo quyền. Nội dung chỉ xuất hiện công khai sau khi đi qua workflow công bố phù hợp.</p></section><section><h2>Hỗ trợ</h2><p>Liên hệ <a href="mailto:${esc(settings.support_email || "support@skyfirst.io.vn")}">${esc(settings.support_email || "support@skyfirst.io.vn")}</a> nếu cần hỗ trợ về dữ liệu hoặc quyền truy cập.</p></section></article>`;
  } else if (path === "/explore") {
    const params = new URLSearchParams(location.search), q = params.get("q") || "", kind = params.get("kind") || "", data = await api("/public/search?" + params);
    const [title,desc] = exploreHeading(kind);
    document.title = title + " · SKY FIRST";
    const view = kind === "events" ? "events" : kind === "publications" ? "publications" : kind === "datasets" ? "datasets" : "grid";
    content = `<section class="explore-hero v4-explore"><span class="section-kicker">THƯ VIỆN TRI THỨC · RESEARCH CLOUD</span><h1>${esc(title)}</h1><p>${esc(desc)}</p><div class="explore-principles"><span>Metadata rõ ràng</span><span>Liên kết nguồn gốc</span><span>Công bố có trách nhiệm</span></div></section><section class="explore-context"><article><b>01</b><h2>Không chỉ là danh sách tệp.</h2><p>Mỗi nội dung công khai được đặt trong bối cảnh của dự án, con người và dữ liệu liên quan khi hệ thống có quan hệ thực.</p></article><article><b>02</b><h2>Tìm kiếm theo ngữ cảnh.</h2><p>Dùng từ khóa và bộ lọc để đi từ một câu hỏi đến các hồ sơ nghiên cứu, dataset, công bố hoặc hoạt động phù hợp.</p></article><article><b>03</b><h2>Không tạo dữ liệu giả.</h2><p>Khi chưa có hồ sơ công khai, trang vẫn giải thích cấu trúc tri thức nhưng không tự tạo thành tựu, số liệu hay công bố.</p></article></section><section class="explore-shell"><form class="filters explore-filters" action="/explore"><div class="search-field"><span aria-hidden="true">⌕</span><input name="q" placeholder="Tìm theo tiêu đề, tóm tắt hoặc nội dung…" value="${esc(q)}" aria-label="Từ khóa tìm kiếm"></div><select name="kind" aria-label="Loại nội dung"><option value="">Tất cả nội dung</option>${PUBLIC_KINDS.map((k) => `<option value="${k}" ${kind === k ? "selected" : ""}>${CATALOG[k].label}</option>`).join("")}</select><button class="button">Tìm kiếm <span aria-hidden="true">↗</span></button></form>${categoryChips(q,kind)}<div class="results-head"><div><b>${data.total}</b><span>kết quả${q?` cho “${esc(q)}”`:""}</span></div>${(q||kind)?'<a href="/explore">Xóa bộ lọc</a>':""}</div><div class="explore-results ${view}">${data.items.map((r) => publicRecordCard(r,view)).join("")}</div>${!data.items.length ? `<div class="empty polished"><div aria-hidden="true">◇</div><h3>Chưa tìm thấy nội dung phù hợp</h3><p>Thử một từ khóa rộng hơn, đổi danh mục hoặc xóa bộ lọc hiện tại.</p><a class="button secondary" href="/explore">Xem tất cả nội dung</a></div>` : ""}<div class="pagination">${data.page > 1 ? `<a href="?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}&page=${data.page - 1}">← Trước</a>` : ""}<span>Trang ${data.page}</span>${data.page * 24 < data.total ? `<a href="?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}&page=${data.page + 1}">Tiếp →</a>` : ""}</div></section>`;
  } else if (path === "/") {
    const data = await api("/public/search");
    content = fallbackHome(settings, data);
  } else if (["/orientation","/fields","/structure","/sky-first-network","/research","/ideas","/research-groups","/impact","/people","/knowledge","/resources","/innovation","/digital","/emerging-tech","/community-solutions","/experiments","/activities","/news","/programs","/community","/opportunities","/collaboration","/network","/for-people","/for-organizations","/proposals"].includes(path)) {
    const pageMap={
      "/orientation":["ĐỊNH HƯỚNG PHÁT TRIỂN","Nghiên cứu để hiểu sâu hơn. Đổi mới để tạo thay đổi tốt hơn.","Trung tâm phát triển như một không gian kết nối câu hỏi, phương pháp, dữ liệu và con người trong hệ sinh thái Sky First. Định hướng ưu tiên chất lượng quá trình, khả năng kiểm chứng và giá trị ứng dụng thay vì chạy theo số lượng công bố."],
      "/fields":["LĨNH VỰC NGHIÊN CỨU & QUAN TÂM","18 hướng mở cho những câu hỏi có ý nghĩa.","Danh mục lĩnh vực là hệ phân loại để kết nối mối quan tâm của thành viên với ý tưởng, đề tài, dữ liệu và hoạt động. Một lĩnh vực chỉ hiển thị hồ sơ thực tế khi hệ thống có dữ liệu công khai phù hợp."],
      "/people":["CON NGƯỜI & TRI THỨC","Con người là điểm bắt đầu của mạng tri thức.","Không phải mọi thành viên đều được gọi là nhà nghiên cứu. Hồ sơ công khai phản ánh đúng vai trò, lĩnh vực quan tâm, dự án và đóng góp thực tế; các học vị, ORCID hay Google Scholar chỉ xuất hiện khi có thông tin xác thực được cung cấp."],
      "/research":["NGHIÊN CỨU","Từ câu hỏi đến bằng chứng và tác động.","Nghiên cứu tại Sky First được tổ chức như một hành trình có thể theo dõi: hình thành ý tưởng, xây dựng đề xuất, phản biện, xem xét đạo đức khi cần, triển khai, quản trị dữ liệu, nghiệm thu, chia sẻ kết quả và quan sát tác động."],
      "/innovation":["ĐỔI MỚI","Biến hiểu biết thành thử nghiệm có trách nhiệm.","Đổi mới không đồng nghĩa gắn nhãn công nghệ lên mọi vấn đề. Không gian này tập trung vào cách một ý tưởng được làm rõ, thử nghiệm, đánh giá và cải tiến trước khi trở thành giải pháp có khả năng ứng dụng."],
      "/activities":["HOẠT ĐỘNG","Nơi tri thức được trao đổi và đưa vào thực tế.","Sự kiện, hội thảo, chương trình và hoạt động cộng đồng là những điểm chạm để chia sẻ câu hỏi, phương pháp và kết quả. Chỉ các hoạt động được công khai trong hệ thống mới xuất hiện ở danh mục dữ liệu."],
      "/collaboration":["KẾT NỐI & HỢP TÁC","Bắt đầu từ một vấn đề đủ rõ để cùng giải quyết.","Trung tâm mở các hướng kết nối phù hợp với cá nhân, nhóm và tổ chức có nhu cầu trao đổi tri thức, dữ liệu, chuyên môn hoặc phối hợp hoạt động. Mọi mô tả hợp tác phải phản ánh quan hệ thực tế, không tự tạo danh nghĩa đối tác."],
      "/structure":["CƠ CẤU HOẠT ĐỘNG","Một cấu trúc phục vụ công việc, không phải danh xưng.","Cơ cấu được trình bày theo vai trò và phạm vi công việc thực tế trong Sky First Network. Website không sử dụng sơ đồ để ngụ ý tư cách pháp nhân hay tổ chức khoa học và công nghệ độc lập."],
      "/sky-first-network":["SKY FIRST NETWORK","Một phần của hệ sinh thái Sky First.","Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First là đơn vị, mô hình hoạt động thuộc Sky First Network. Tên gọi Trung tâm nhận diện phạm vi hoạt động và không mặc nhiên xác lập tư cách pháp nhân độc lập."],
    };
    const fallback=path.includes("digital")?["CÔNG NGHỆ & CHUYỂN ĐỔI SỐ","Công nghệ là hạ tầng để làm việc tốt hơn.","Không gian tập trung vào cách công nghệ, dữ liệu và tự động hóa có thể hỗ trợ giáo dục, nghiên cứu và hoạt động cộng đồng. Các công nghệ chỉ được giới thiệu như năng lực hoặc dự án khi có triển khai thực tế."]:path.includes("emerging")?["AI & CÔNG NGHỆ MỚI","Khám phá công nghệ mới với trách nhiệm.","Trí tuệ nhân tạo và các công nghệ mới được tiếp cận từ nhu cầu, bằng chứng và rủi ro. Trung tâm không gắn nhãn AI cho tính năng không sử dụng AI thực tế."]:path.includes("ideas")?["KHÔNG GIAN Ý TƯỞNG","Mọi dự án đều từng bắt đầu bằng một câu hỏi.","Không gian ý tưởng giúp ghi nhận vấn đề, giả định và hướng khám phá trước khi trở thành đề xuất nghiên cứu hoặc dự án. Ý tưởng không được trình bày như kết quả đã kiểm chứng."]:path.includes("knowledge")||path.includes("resources")?["TRI THỨC & TÀI NGUYÊN","Tổ chức để tri thức có thể được tìm thấy và hiểu lại.","Tài nguyên được kết nối với nguồn gốc, bối cảnh và quyền truy cập phù hợp. Mục tiêu là giúp người đọc hiểu một tài liệu đến từ đâu và liên quan thế nào đến các hồ sơ khác."]:path.includes("network")?["MẠNG LƯỚI & CỘNG ĐỒNG","Kết nối con người quanh những vấn đề chung.","Mạng lưới được hình thành từ các mối liên hệ và hoạt động có thật. Website ưu tiên mô tả vai trò, chủ đề và đóng góp thay vì tạo cảm giác về quy mô không có dữ liệu hỗ trợ."]:["RESEARCH × INNOVATION","Một không gian đang được xây dựng từ dữ liệu thật.","Trang này cung cấp bối cảnh cho một phần của hệ sinh thái nghiên cứu và đổi mới. Nội dung động chỉ xuất hiện khi có hồ sơ công khai phù hợp trong hệ thống."];
    const [ey,title,lead]=pageMap[path]||fallback;
    content=`<section class="editorial-hero"><span class="section-kicker">${ey}</span><h1>${title}</h1><p>${lead}</p></section><section class="editorial-grid"><article><b>01</b><h2>Bắt đầu từ câu hỏi</h2><p>Một chủ đề được làm rõ bằng bối cảnh, nhu cầu và câu hỏi trước khi lựa chọn phương pháp hoặc công nghệ.</p></article><article><b>02</b><h2>Kết nối dữ liệu</h2><p>Hồ sơ, dữ liệu và tài liệu được tổ chức để có thể truy vết mối liên hệ khi thông tin thực tế tồn tại.</p></article><article><b>03</b><h2>Chia sẻ có trách nhiệm</h2><p>Không phải mọi dữ liệu đều nên công khai. Quyền truy cập, riêng tư và mức độ sẵn sàng luôn là một phần của quá trình.</p></article></section><section class="editorial-quote"><p>“Tri thức không kết thúc khi một dự án hoàn thành.”</p><span>SKY FIRST RESEARCH & INNOVATION</span></section><section class="public-section"><div class="section-heading"><div><span class="section-kicker">KHÁM PHÁ TIẾP</span><h2>Từ nội dung đến những liên kết thực tế.</h2><p>Khám phá các hồ sơ đã được công khai trong Research Cloud hoặc kết nối với Trung tâm để trao đổi một đề xuất phù hợp.</p></div></div><div class="portal-grid"><a href="/explore"><span>⌕</span><h3>Khám phá tri thức</h3><p>Tìm dự án, công bố, dataset và hoạt động.</p></a><a href="/fields"><span>◎</span><h3>Lĩnh vực quan tâm</h3><p>Đi qua 18 nhóm chủ đề liên ngành.</p></a><a href="/contact"><span>↗</span><h3>Kết nối</h3><p>Bắt đầu một cuộc trao đổi rõ ràng.</p></a></div></section>`;
    document.title=title+" · SKY FIRST";
  } else {
    content = `<section class="public-section"><div class="empty polished"><div>404</div><h1>Không tìm thấy trang</h1><p>Trang bạn yêu cầu không tồn tại hoặc chưa được công bố.</p><a class="button" href="/">Về trang chủ</a></div></section>`;
    document.title = "Không tìm thấy trang · SKY FIRST";
  }
  app.innerHTML = publicShell(content, site);
  bindChrome();
  if (path.startsWith("/record/")) {
    const id = path.split("/")[2], related = await api("/public/related?id=" + id).catch(() => null);
    if (related?.items.length) document.querySelector(".article").insertAdjacentHTML("beforeend", '<section class="related-section"><span class="section-kicker">LIÊN QUAN</span><h2>Công trình & đóng góp công khai</h2><div class="knowledge-grid">' + related.items.map((r) => publicRecordCard(r)).join("") + "</div></section>");
  }
}

async function loginPage(type, token) {
  const reset = type === "reset";
  let setup = type === "setup";
  if (!reset) {
    const setupState = await api("/setup");
    if (type === "login" && setupState.required) {
      location.hash = "setup";
      return;
    }
    if (setup && !setupState.required) {
      location.hash = "login";
      return;
    }
    setup = setupState.required;
  }
  const site = await loadPublicSite();
  const st = site?.settings || {};
  const setupFields = setup
    ? '<label>Họ và tên<input name="name" required maxlength="160" autocomplete="name"></label><label>Email<input name="email" type="email" maxlength="200" autocomplete="username" required></label><label>Mật khẩu<div class="password-field"><input name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required><button type="button" class="password-toggle" data-password-toggle="password" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div></label><label>Xác nhận mật khẩu<div class="password-field"><input name="confirm_password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required><button type="button" class="password-toggle" data-password-toggle="confirm_password" aria-label="Hiện mật khẩu xác nhận" aria-pressed="false">Hiện</button></div></label><label>SETUP_SECRET<div class="password-field"><input name="secret" type="password" required autocomplete="off" spellcheck="false"><button type="button" class="password-toggle" data-password-toggle="secret" aria-label="Hiện SETUP_SECRET" aria-pressed="false">Hiện</button></div></label><div class="setup-note"><b>Khởi tạo một lần</b><span>SETUP_SECRET chỉ được kiểm tra ở máy chủ. Sau khi Root Admin được tạo, màn hình này tự khóa và không thể dùng lại.</span></div>'
    : "";
  const loginFields = !setup && !reset
    ? '<label>Email<input name="email" type="email" maxlength="200" autocomplete="username" required></label><label>Mật khẩu<div class="password-field"><input name="password" type="password" minlength="12" maxlength="200" autocomplete="current-password" required><button type="button" class="password-toggle" data-password-toggle="password" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div></label>'
    : "";
  const resetFields = reset
    ? '<label>Mật khẩu mới<div class="password-field"><input name="password" type="password" minlength="12" maxlength="200" autocomplete="new-password" required><button type="button" class="password-toggle" data-password-toggle="password" aria-label="Hiện mật khẩu" aria-pressed="false">Hiện</button></div></label>'
    : "";
  app.innerHTML = `<div class="auth"><div class="auth-shell"><section class="auth-identity"><a class="brand" href="/"><img src="${esc(mediaSrc(st.logo_media_id))}" alt="Logo Trung tâm"><span>SKY FIRST<small>RESEARCH & INNOVATION CENTER</small></span></a><div class="auth-copy"><div class="eyebrow">TRUNG TÂM NGHIÊN CỨU ĐỔI MỚI & SÁNG TẠO SKY FIRST</div><h1>Nghiên cứu.<br>Đổi mới.<br><em>Tạo tác động.</em></h1><p>${esc(st.tagline || "Một không gian nghiên cứu hiện đại để kết nối tri thức, con người và những giải pháp có trách nhiệm.")}</p><div class="auth-principles"><span>Research</span><span>Innovation</span><span>Knowledge</span><span>Impact</span></div></div></section><section class="auth-form-wrap"><form id="authForm" class="panel"><div class="auth-form-head"><img src="${esc(mediaSrc(st.logo_media_id))}" alt=""><div><span class="eyebrow">SKY FIRST R&I CENTER</span><h2>${setup ? "Khởi tạo hệ thống" : reset ? "Đặt lại mật khẩu" : "Chào mừng trở lại"}</h2></div></div><p class="muted">${setup ? "Tạo Root Admin đầu tiên để đưa hệ thống vào vận hành." : reset ? "Liên kết đặt lại chỉ dùng một lần và có thời hạn." : "Đăng nhập bằng tài khoản được Trung tâm cấp để vào không gian nghiên cứu."}</p>${setupFields}${loginFields}${resetFields}<button class="button full" type="submit">${setup ? "Khởi tạo Root Admin" : reset ? "Lưu mật khẩu" : "Đăng nhập"} <span aria-hidden="true">→</span></button>${!setup && !reset ? '<div class="auth-help"><b>Quên mật khẩu?</b><span>Liên hệ quản trị viên để xác minh và nhận liên kết đặt lại an toàn.</span></div>' : ""}<a class="back-link" href="/">← Về website Trung tâm</a></form></section></div></div>`;
  $$('[data-password-toggle]').forEach((button) => {
    button.onclick = () => {
      const input = $(`#authForm input[name="${button.dataset.passwordToggle}"]`);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Ẩn" : "Hiện";
      button.setAttribute("aria-pressed", String(show));
      button.setAttribute("aria-label", `${show ? "Ẩn" : "Hiện"} ${button.dataset.passwordToggle === "secret" ? "SETUP_SECRET" : "mật khẩu"}`);
    };
  });
  formSubmit("#authForm", async (b) => {
    if (setup && b.password !== b.confirm_password)
      throw Error("Mật khẩu xác nhận không khớp.");
    await send(
      setup ? "/setup" : reset ? "/reset" : "/login",
      reset ? { token, password: b.password } : b,
    );
    if (setup) {
      toast("Khởi tạo Root Admin thành công. Hãy đăng nhập.");
      location.hash = "login";
    } else if (reset) {
      toast("Đã đặt lại mật khẩu. Hãy đăng nhập.");
      location.hash = "login";
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
  const routeHash = "#w/detail/" + id;
  if (location.hash !== routeHash) return;
  const d = await api("/records/" + id),
    r = d.item;
  let children = [];
  if (r.kind === "projects") {
    let page = 1;
    for (;;) {
      const x = await api("/records?project=" + id + "&page=" + page);
      children.push(...x.items);
      if (page++ * x.size >= x.total) break;
    }
  }
  // A save can finish after the user has moved to another route.
  // Do not let its delayed detail refresh overwrite the new screen.
  if (location.hash !== routeHash) return;
  current = r;
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

const BLOCK_LABELS = {
  hero:"Hero", heading:"Heading", rich_text:"Rich Text", image:"Image", cta:"CTA",
  statistics:"Statistics", cards:"Cards", feature_grid:"Feature Grid",
  partners:"Partners / Links", faq:"FAQ",
};
const CMS_ACTION_LABELS = {
  cms_site_settings:"Site Settings",
  cms_page_create:"Tạo trang",
  cms_page_update:"Sửa trang",
  cms_page_publish:"Publish",
  cms_page_duplicate:"Nhân bản trang",
  cms_page_delete:"Xóa trang",
  cms_block_create:"Thêm block",
  cms_block_update:"Sửa block",
  cms_block_delete:"Xóa block",
  cms_block_duplicate:"Nhân bản block",
  cms_blocks_reorder:"Sắp xếp block",
  cms_revision_restore:"Khôi phục revision",
  cms_nav_create:"Thêm menu",
  cms_nav_update:"Sửa menu",
  cms_nav_delete:"Xóa menu",
  cms_footer_create:"Thêm footer",
  cms_footer_update:"Sửa footer",
  cms_footer_delete:"Xóa footer",
  cms_media_upload:"Upload media",
  cms_media_update:"Sửa media",
  cms_media_delete:"Xóa media",
};
function mediaOptions(items, selected="") {
  const images = items.filter(x=>x.mime.startsWith("image/"));
  const retained = selected && !images.some(x=>x.id===selected)
    ? `<option value="${esc(selected)}" selected>Đang chọn · ${esc(selected)}</option>`
    : "";
  return `<option value="">— Không chọn —</option>${retained}${images.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${esc(x.name)}</option>`).join("")}`;
}
function listLines(items=[], type="cards") {
  return items.map(x => type==="statistics"
    ? `${x.value||""} | ${x.label||""}`
    : `${x.title||x.question||""} | ${x.text||x.answer||""} | ${x.url||""} | ${x.media_id||""}`).join("\n");
}
function parseListLines(value, type) {
  return String(value||"").split("\n").map(x=>x.trim()).filter(Boolean).map(line=>{
    const [a="",b="",c="",d=""] = line.split("|").map(x=>x.trim());
    if(type==="statistics") return {value:a,label:b};
    const out={title:a,text:b};
    if(c) out.url=c;
    if(d) out.media_id=d;
    return out;
  });
}
function blockEditorFields(block, media) {
  const d=block?.data||{}, type=block?.type||"hero";
  const commonMedia = `<label>Media<select name="media_id">${mediaOptions(media,d.media_id)}</select></label>`;
  if(type==="hero") return `<div class="form-grid"><label>Eyebrow<input name="eyebrow" value="${esc(d.eyebrow)}" maxlength="160"></label><label>Tiêu đề<input name="title" value="${esc(d.title)}" required maxlength="500"></label><label class="wide">Sapo<textarea name="text" rows="4">${esc(d.text)}</textarea></label><label>Nút chính<input name="primaryLabel" value="${esc(d.primaryLabel)}"></label><label>URL nút chính<input name="primaryUrl" value="${esc(d.primaryUrl)}"></label><label>Nút phụ<input name="secondaryLabel" value="${esc(d.secondaryLabel)}"></label><label>URL nút phụ<input name="secondaryUrl" value="${esc(d.secondaryUrl)}"></label></div>`;
  if(type==="heading") return `<label>Eyebrow<input name="eyebrow" value="${esc(d.eyebrow)}"></label><label>Tiêu đề<input name="title" value="${esc(d.title)}" required></label><label>Mô tả<textarea name="text" rows="5">${esc(d.text)}</textarea></label>`;
  if(type==="rich_text") return `<label>Tiêu đề<input name="heading" value="${esc(d.heading)}"></label><label>Nội dung<textarea name="text" rows="12">${esc(d.text)}</textarea><small>Văn bản được escape khi render public; không chèn HTML tùy ý.</small></label>`;
  if(type==="image") return `${commonMedia}<label>Alt text<input name="alt" value="${esc(d.alt)}" maxlength="500"></label><label>Chú thích<textarea name="caption" rows="3">${esc(d.caption)}</textarea></label>`;
  if(type==="cta") return `<label>Tiêu đề<input name="title" value="${esc(d.title)}" required></label><label>Mô tả<textarea name="text" rows="4">${esc(d.text)}</textarea></label><div class="form-grid"><label>Nhãn nút<input name="label" value="${esc(d.label)}"></label><label>URL<input name="url" value="${esc(d.url)}"></label></div>`;
  if(type==="statistics") return `<label>Tiêu đề<input name="heading" value="${esc(d.heading)}"></label><label>Dữ liệu — mỗi dòng: Giá trị | Nhãn<textarea name="items" rows="10">${esc(listLines(d.items,"statistics"))}</textarea><small>Chỉ dùng số liệu có nguồn. Có thể để block tắt nếu chưa có dữ liệu xác thực.</small></label>`;
  if(["cards","feature_grid","partners","faq"].includes(type)) return `<label>Tiêu đề nhóm<input name="heading" value="${esc(d.heading)}"></label><label>${type==="faq"?"Mỗi dòng: Câu hỏi | Trả lời":"Mỗi dòng: Tiêu đề | Mô tả | URL | Media ID (tuỳ chọn)"}<textarea name="items" rows="12">${esc(listLines(d.items,type))}</textarea><small>${type==="faq"?"Một câu hỏi trên mỗi dòng.":"Media ID có thể lấy trong Media Cloud; URL và Media ID được phép để trống."}</small></label>`;
  return "";
}
function blockDataFromForm(type, f) {
  const b=Object.fromEntries(new FormData(f));
  if(["statistics","cards","feature_grid","partners","faq"].includes(type)) b.items=parseListLines(b.items,type);
  delete b.type; delete b.enabled;
  return b;
}
function builderPreview(page, revision=false) {
  return `<div class="builder-preview-page ${revision?"revision-preview":""}">${renderCmsPage(page)}</div>`;
}
async function editCmsBlock(pageId, block, media) {
  const type=block?.type||"hero";
  modal(block?`Sửa block · ${BLOCK_LABELS[type]}`:"Thêm block", `<div class="block-editor-shell"><form id="cmsBlockForm" class="block-editor-form">${block?"":`<label>Loại block<select name="type">${Object.entries(BLOCK_LABELS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select></label><div id="dynamicBlockFields"></div>`}${block?blockEditorFields(block,media):""}<label class="toggle-row"><input type="checkbox" name="enabled" ${block?.enabled!==false?"checked":""}> <span><b>Hiển thị block</b><small>Block tắt vẫn được lưu trong Draft nhưng không render.</small></span></label><div class="dialog-actions"><button type="button" id="backToBuilder">← Page Builder</button><button class="button" type="submit">Lưu vào Draft</button></div></form><aside class="block-editor-help"><span class="section-kicker">BLOCK</span><h3>${esc(BLOCK_LABELS[type])}</h3><p>Mỗi block là một đơn vị nội dung độc lập. Lưu block chỉ cập nhật Draft; website public chỉ thay đổi sau khi Publish trang.</p><div class="safe-note">Không có HTML tùy ý, không lưu media base64 và không bypass Published snapshot.</div></aside></div>`);
  dialog.classList.add("studio");
  const form=$("#cmsBlockForm");
  const back=()=>{close();openCmsPage(pageId)};
  $("#backToBuilder").onclick=back;
  dialog.querySelector("[data-close]").onclick=back;
  if(!block){
    const draw=()=>{
      $("#dynamicBlockFields").innerHTML=blockEditorFields({type:form.type.value,data:{}},media);
      $(".block-editor-help h3").textContent=BLOCK_LABELS[form.type.value]||form.type.value;
    };
    form.type.onchange=draw; draw();
  }
  form.onsubmit=async e=>{
    e.preventDefault();
    const button=form.querySelector('[type="submit"]'); button.disabled=true;
    const type2=block?.type||form.type.value;
    try{
      const payload={page_id:pageId,type:type2,enabled:form.enabled.checked,data:blockDataFromForm(type2,form)};
      if(block) await send(`/admin/cms/blocks/${block.id}`,payload,"PATCH"); else await send("/admin/cms/blocks",payload);
      close(); toast("Đã lưu block vào Draft."); await openCmsPage(pageId);
    }catch(err){toast(err.message,true);button.disabled=false}
  };
}
async function openCmsPage(id) {
  const [d,m,revisions]=await Promise.all([
    api(`/admin/cms/pages/${id}`),
    api("/admin/cms/media?type=image&limit=60"),
    api(`/admin/cms/pages/${id}/revisions`),
  ]);
  const p=d.page;
  const published=!!d.published;
  const statusLabel=published?(d.has_unpublished_changes?"Published · Có Draft mới":"Published"):"Draft";
  modal(`Cloud Page Builder · /${p.slug==="home"?"":p.slug}`, `<div class="cms-builder-v3">
    <header class="builder-toolbar">
      <div class="builder-status"><span class="status-dot ${published?"live":"draft"}"></span><div><b>${esc(statusLabel)}</b><small>Version ${p.version}${p.published_at?` · Publish ${date(p.published_at)}`:""}</small></div></div>
      <div class="device-switch" role="group" aria-label="Kích thước preview"><button class="active" data-device="desktop">Desktop</button><button data-device="tablet">Tablet</button><button data-device="mobile">Mobile</button></div>
      <div class="builder-toolbar-actions"><button id="refreshCmsPreview">Preview Draft</button><button id="duplicateCmsPage">Nhân bản</button><button id="publishCmsPage" class="button">Publish</button></div>
    </header>
    <div class="builder-layout">
      <aside class="builder-settings">
        <div class="builder-panel-title"><span class="section-kicker">PAGE</span><h3>Thiết lập trang</h3></div>
        <form id="cmsPageForm">
          <label>Tiêu đề<input name="title" value="${esc(p.title)}" required></label>
          <label>Slug<div class="slug-input"><span>/</span><input name="slug" value="${esc(p.slug)}" required></div></label>
          <label>Mô tả<textarea name="description" rows="4">${esc(p.description)}</textarea></label>
          <details class="editor-details" open><summary>SEO & chia sẻ</summary>
            <label>SEO title<input name="seo_title" value="${esc(p.seo_title)}" maxlength="240"></label>
            <label>Meta description<textarea name="meta_description" rows="4" maxlength="500">${esc(p.meta_description)}</textarea></label>
            <label>Social image<select name="social_media_id">${mediaOptions(m.items,p.social_media_id)}</select></label>
            <label>Canonical URL<input name="canonical_url" value="${esc(p.canonical_url)}" placeholder="https://research.skyfirst.io.vn/..."></label>
            <label class="toggle-row compact"><input type="checkbox" name="noindex" ${p.noindex?"checked":""}> <span><b>noindex</b><small>Không cho công cụ tìm kiếm lập chỉ mục trang.</small></span></label>
          </details>
          <button class="button full" type="submit">Save Draft · Thông tin trang</button>
        </form>
        <div class="seo-preview"><span>SEARCH PREVIEW</span><b>${esc(p.seo_title||p.title)}</b><small>research.skyfirst.io.vn/${p.slug==="home"?"":esc(p.slug)}</small><p>${esc(p.meta_description||p.description||"Thêm meta description để kiểm soát phần mô tả tìm kiếm.")}</p></div>
      </aside>
      <section class="builder-stage">
        <div class="builder-stage-bar"><span id="previewModeLabel">DRAFT PREVIEW</span><span>Nội dung chưa Publish không xuất hiện public.</span></div>
        <div id="builderViewport" class="builder-viewport" data-device="desktop"><div id="builderCanvas" class="builder-canvas">${builderPreview(p)}</div></div>
      </section>
      <aside class="builder-outline">
        <div class="builder-panel-title"><div><span class="section-kicker">BLOCKS</span><h3>Cấu trúc trang</h3></div><button id="addCmsBlock" class="button compact-button">+ Block</button></div>
        <div id="cmsBlockList" class="cms-block-list v3">${p.blocks.map((b,i)=>`<div class="cms-block-row" draggable="true" data-drag-block="${b.id}"><button class="drag-handle" type="button" aria-label="Kéo block">⠿</button><div class="block-row-copy"><b>${esc(BLOCK_LABELS[b.type]||b.type)}</b><small>${b.enabled?"Đang bật":"Đang tắt"} · #${i+1}</small></div><div class="block-row-actions"><button data-block-up="${b.id}" aria-label="Đưa lên" ${i===0?"disabled":""}>↑</button><button data-block-down="${b.id}" aria-label="Đưa xuống" ${i===p.blocks.length-1?"disabled":""}>↓</button><button data-block-duplicate="${b.id}" aria-label="Nhân bản">⧉</button><button data-block-edit="${b.id}">Sửa</button><button data-block-delete="${b.id}" class="danger-lite">×</button></div></div>`).join("")||empty("Chưa có block","Thêm block để bắt đầu xây dựng trang.")}</div>
        <details class="revision-panel" ${revisions.items.length?"":"open"}><summary>Revision History <span>${revisions.items.length}</span></summary><div class="revision-list">${revisions.items.map(r=>`<button type="button" data-revision="${r.id}"><b>r${r.revision_no} · ${esc((CMS_ACTION_LABELS[`cms_${r.kind}`]||r.kind).replaceAll("_"," "))}</b><small>${esc(r.actor_name||"Hệ thống")} · ${date(r.created_at)}</small></button>`).join("")||'<p class="muted small">Revision đầu tiên sẽ được tạo khi trang được chỉnh sửa.</p>'}</div></details>
        <button id="restoreRevision" class="button secondary full" hidden>Khôi phục revision này về Draft</button>
        ${!["home","about","contact","privacy"].includes(p.slug)?'<button id="deleteCmsPage" class="danger-lite full">Xóa trang tùy chỉnh</button>':""}
      </aside>
    </div>
  </div>`);
  dialog.classList.add("studio","page-builder-dialog");

  const viewport=$("#builderViewport"), canvas=$("#builderCanvas"), modeLabel=$("#previewModeLabel");
  $$('[data-device]').forEach(btn=>btn.onclick=()=>{
    $$('[data-device]').forEach(x=>x.classList.toggle("active",x===btn));
    viewport.dataset.device=btn.dataset.device;
  });
  formSubmit("#cmsPageForm", async b=>{
    await send(`/admin/cms/pages/${id}`,{...b,noindex:$("#cmsPageForm [name=noindex]").checked,version:p.version},"PATCH");
    toast("Đã lưu thông tin trang vào Draft."); close(); await openCmsPage(id);
  });
  $("#addCmsBlock").onclick=()=>editCmsBlock(id,null,m.items);
  $$('[data-block-edit]').forEach(btn=>btn.onclick=()=>editCmsBlock(id,p.blocks.find(x=>x.id===btn.dataset.blockEdit),m.items));
  $$('[data-block-duplicate]').forEach(btn=>btn.onclick=async()=>{try{await send(`/admin/cms/blocks/${btn.dataset.blockDuplicate}/duplicate`,{});toast("Đã nhân bản block.");close();await openCmsPage(id)}catch(e){toast(e.message,true)}});
  $$('[data-block-delete]').forEach(btn=>btn.onclick=async()=>{if(!confirm("Xóa block này khỏi Draft? Revision trước đó vẫn được giữ."))return;try{await api(`/admin/cms/blocks/${btn.dataset.blockDelete}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});close();await openCmsPage(id)}catch(e){toast(e.message,true)}});
  const reorder=async(bid,dir)=>{const ids=p.blocks.map(x=>x.id),i=ids.indexOf(bid),j=i+dir;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await send(`/admin/cms/pages/${id}/reorder`,{ids});close();await openCmsPage(id)};
  $$('[data-block-up]').forEach(b=>b.onclick=()=>reorder(b.dataset.blockUp,-1));
  $$('[data-block-down]').forEach(b=>b.onclick=()=>reorder(b.dataset.blockDown,1));

  let dragged=null;
  $$('[data-drag-block]').forEach(row=>{
    row.addEventListener("dragstart",()=>{dragged=row.dataset.dragBlock;row.classList.add("dragging")});
    row.addEventListener("dragend",()=>{row.classList.remove("dragging");dragged=null});
    row.addEventListener("dragover",e=>{e.preventDefault();row.classList.add("drag-over")});
    row.addEventListener("dragleave",()=>row.classList.remove("drag-over"));
    row.addEventListener("drop",async e=>{e.preventDefault();row.classList.remove("drag-over");const target=row.dataset.dragBlock;if(!dragged||dragged===target)return;const ids=p.blocks.map(x=>x.id),from=ids.indexOf(dragged),to=ids.indexOf(target);ids.splice(to,0,ids.splice(from,1)[0]);try{await send(`/admin/cms/pages/${id}/reorder`,{ids});close();await openCmsPage(id)}catch(err){toast(err.message,true)}});
  });

  $("#refreshCmsPreview").onclick=async()=>{try{const x=await api(`/admin/cms/pages/${id}/preview`);canvas.innerHTML=builderPreview(x.page);modeLabel.textContent="DRAFT PREVIEW · REFRESHED";toast("Preview Draft đã được làm mới.")}catch(e){toast(e.message,true)}};
  $("#publishCmsPage").onclick=async()=>{if(!confirm("Publish Draft hiện tại ra website công khai? Bản Published cũ chỉ được thay thế sau khi thao tác thành công."))return;try{await send(`/admin/cms/pages/${id}/publish`,{});publicSite=null;toast("Đã Publish trang.");close();await adminPage("website")}catch(e){toast(e.message,true)}};
  $("#duplicateCmsPage").onclick=async()=>{if(!confirm("Tạo một bản sao Draft của trang này?"))return;try{const x=await send(`/admin/cms/pages/${id}/duplicate`,{});toast("Đã tạo bản sao Draft.");close();await openCmsPage(x.id)}catch(e){toast(e.message,true)}};

  $$('[data-revision]').forEach(btn=>btn.onclick=async()=>{try{const x=await api(`/admin/cms/pages/${id}/revisions/${btn.dataset.revision}`);canvas.innerHTML=builderPreview(x.revision.snapshot,true);modeLabel.textContent=`REVISION r${x.revision.revision_no} · READ ONLY`;const restore=$("#restoreRevision");restore.hidden=false;restore.dataset.revisionId=x.revision.id;restore.scrollIntoView({block:"nearest"})}catch(e){toast(e.message,true)}});
  $("#restoreRevision").onclick=async e=>{const rid=e.currentTarget.dataset.revisionId;if(!rid)return;if(!confirm("Khôi phục revision này về Draft? Website public vẫn giữ bản Published hiện tại cho tới khi bạn Publish lại."))return;try{await send(`/admin/cms/pages/${id}/restore`,{revision_id:rid});toast("Đã khôi phục revision về Draft.");close();await openCmsPage(id)}catch(err){toast(err.message,true)}};
  const deletePage=$("#deleteCmsPage");
  if(deletePage) deletePage.onclick=async()=>{if(!confirm("Xóa trang tùy chỉnh này? Revision và blocks của trang cũng sẽ bị xóa."))return;try{await api(`/admin/cms/pages/${id}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});publicSite=null;close();toast("Đã xóa trang.");await adminPage("website")}catch(e){toast(e.message,true)}};
}
function cmsPageState(page){
  if(page.status!=="published") return '<span class="badge draft">Draft</span>';
  if(page.has_unpublished_changes) return '<span class="badge review">Published + Draft</span>';
  return '<span class="badge published">Published</span>';
}
function navParentOptions(items,item){
  return `<option value="">— Cấp chính —</option>${items.filter(x=>x.id!==item?.id&&!x.parent_id).map(x=>`<option value="${x.id}" ${item?.parent_id===x.id?"selected":""}>${esc(x.label)}</option>`).join("")}`;
}
async function uploadCmsMedia(file){
  if(!file) return;
  const label=$("#mediaUploadState");
  if(label) label.textContent=`Đang tải ${file.name}…`;
  try{
    const r=await fetch(`/api/v1/admin/cms/media?name=${encodeURIComponent(file.name)}`,{method:"POST",credentials:"same-origin",headers:{"x-requested-with":"SFRC"},body:file});
    const d=await r.json().catch(()=>({}));
    if(!r.ok) throw Error((d.error||"Upload lỗi")+(d.request_id?` · Mã yêu cầu: ${d.request_id}`:""));
    toast("Đã upload media lên R2."); cmsMediaPage=1; await websiteCmsPage();
  }catch(err){toast(err.message,true);if(label)label.textContent="Upload thất bại — kiểm tra định dạng và thử lại."}
}
async function websiteCmsPage() {
  const typeParam=cmsMediaType==="all"?"":`&type=${encodeURIComponent(cmsMediaType)}`;
  const mediaPath=`/admin/cms/media?q=${encodeURIComponent(cmsMediaQuery)}&page=${cmsMediaPage}&limit=24${typeParam}`;
  const [overview,site,pages,nav,footer,media]=await Promise.all([
    api("/admin/cms/overview"),api("/admin/cms/site"),api("/admin/cms/pages"),api("/admin/cms/navigation"),api("/admin/cms/footer"),api(mediaPath),
  ]);
  const st=site.settings,c=overview.counts||{};
  const html=`<div class="cms-studio-head">${heading("Cloud CMS Studio","Quản trị website, nội dung, SEO và media trên Cloudflare — không cần mở source code.",'<button id="newCmsPage" class="button">+ Tạo trang</button>')}<div class="cms-health"><span><i></i>D1 CMS</span><span><i></i>R2 Media</span><span><i></i>Draft / Published</span></div></div>
  <div class="cms-kpis"><button data-cms-scroll="pages"><span>Pages</span><b>${c.pages||0}</b><small>${c.changed||0} trang có Draft mới</small></button><button data-cms-scroll="pages"><span>Published</span><b>${c.published||0}</b><small>${c.drafts||0} trang chưa publish</small></button><button data-cms-scroll="media"><span>Media Cloud</span><b>${c.media||0}</b><small>${c.images||0} hình ảnh</small></button><button data-cms-scroll="navigation"><span>Navigation</span><b>${c.navigation||0}</b><small>${c.footer||0} footer links</small></button></div>
  <div class="cms-studio-dashboard">
    <section class="panel cms-pages-panel" id="cmsSection-pages"><div class="section-heading"><div><span class="section-kicker">CONTENT</span><h2>Pages</h2><p class="muted">Draft → Preview → Publish · revision được lưu tự động.</p></div></div><div class="cms-page-list v3">${pages.items.map(x=>`<article class="cms-page-card"><button class="cms-page-main" data-cms-page="${x.id}"><span class="page-icon">${x.slug==="home"?"⌂":"□"}</span><span><b>${esc(x.title)}</b><small>/${x.slug==="home"?"":esc(x.slug)} · cập nhật ${date(x.updated_at)}</small></span></button><div class="cms-page-actions">${cmsPageState(x)}<button data-cms-page-duplicate="${x.id}" title="Nhân bản">⧉</button><button data-cms-page="${x.id}">Mở Builder →</button></div></article>`).join("")}</div></section>
    <aside class="panel cms-activity"><div class="section-heading"><div><span class="section-kicker">ACTIVITY</span><h2>Gần đây</h2></div></div><div class="cms-activity-list">${overview.recent.map(x=>`<div><span class="activity-dot"></span><div><b>${esc(CMS_ACTION_LABELS[x.action]||x.action)}</b><small>${esc(x.actor_name||"Hệ thống")} · ${date(x.created_at)}</small></div></div>`).join("")||'<p class="muted">Chưa có hoạt động CMS.</p>'}</div></aside>

    <section class="panel cms-site-panel"><div class="section-heading"><div><span class="section-kicker">GLOBAL</span><h2>Site Identity & SEO</h2><p class="muted">Thông tin dùng xuyên suốt website, metadata và giao diện đăng nhập.</p></div><span class="badge published">Global</span></div><form id="cmsSiteForm" class="form-grid"><label class="wide">Tên Trung tâm<input name="center_name" value="${esc(st.center_name)}"></label><label class="wide">English name<input name="english_name" value="${esc(st.english_name)}"></label><label class="wide">Tagline<input name="tagline" value="${esc(st.tagline)}"></label><label class="wide">Description<textarea name="description" rows="4">${esc(st.description)}</textarea></label><label>Logo<select name="logo_media_id">${mediaOptions(media.items,st.logo_media_id)}</select></label><label>Favicon<select name="favicon_media_id">${mediaOptions(media.items,st.favicon_media_id)}</select></label><label>Website<input name="website" value="${esc(st.website)}"></label><label>Hotline/Zalo<input name="hotline" value="${esc(st.hotline)}"></label><label>Email Trung tâm<input name="email" value="${esc(st.email)}"></label><label>Email hỗ trợ<input name="support_email" value="${esc(st.support_email)}"></label><label>Facebook<input name="facebook" value="${esc(st.facebook)}"></label><label>Facebook Group<input name="facebook_group" value="${esc(st.facebook_group)}"></label><label class="wide">Copyright<input name="copyright" value="${esc(st.copyright)}"></label><label class="wide">Global SEO title<input name="global_seo_title" value="${esc(st.global_seo_title||"")}"></label><label class="wide">Global SEO description<textarea name="global_seo_description" rows="3">${esc(st.global_seo_description||"")}</textarea></label><label>Default share image<select name="default_social_media_id">${mediaOptions(media.items,st.default_social_media_id)}</select></label><label>Theme color<input name="theme_color" value="${esc(st.theme_color||"#0759A6")}" pattern="#[0-9A-Fa-f]{6}"></label><div class="wide"><button class="button" type="submit">Lưu Site Settings</button></div></form></section>

    <section class="panel" id="cmsSection-navigation"><div class="section-heading"><div><span class="section-kicker">STRUCTURE</span><h2>Header / Navigation</h2><p class="muted">Tối đa hai cấp; menu con tự hiển thị thành dropdown.</p></div><button id="addNav">+ Link</button></div><div class="cms-simple-list v3">${nav.items.map((x,i)=>`<div><span class="sort-grip">⋮⋮</span><span class="list-copy"><b>${x.parent_id?"↳ ":""}${esc(x.label)}</b><small>${esc(x.url)} · ${x.enabled?"Bật":"Tắt"}${x.new_tab?" · tab mới":""}</small></span><span class="list-actions"><button data-nav-up="${x.id}" ${i===0?"disabled":""}>↑</button><button data-nav-down="${x.id}" ${i===nav.items.length-1?"disabled":""}>↓</button><button data-nav-edit="${x.id}">Sửa</button><button data-nav-delete="${x.id}" class="danger-lite">×</button></span></div>`).join("")}</div></section>

    <section class="panel"><div class="section-heading"><div><span class="section-kicker">FOOTER</span><h2>Footer Builder</h2><p class="muted">Brand / Trung tâm / Khám phá / Hệ sinh thái / Kết nối.</p></div><button id="addFooter">+ Link</button></div><div class="cms-simple-list v3">${footer.items.map((x,i)=>`<div><span class="sort-grip">⋮⋮</span><span class="list-copy"><b>${esc(x.heading)} · ${esc(x.label)}</b><small>${esc(x.url)} · ${x.enabled?"Bật":"Tắt"}</small></span><span class="list-actions"><button data-footer-up="${x.id}" ${i===0?"disabled":""}>↑</button><button data-footer-down="${x.id}" ${i===footer.items.length-1?"disabled":""}>↓</button><button data-footer-edit="${x.id}">Sửa</button><button data-footer-delete="${x.id}" class="danger-lite">×</button></span></div>`).join("")}</div></section>

    <section class="panel cms-media-panel wide-dashboard" id="cmsSection-media"><div class="section-heading"><div><span class="section-kicker">R2 STORAGE</span><h2>Media Cloud</h2><p class="muted">Tìm kiếm server-side, metadata, tái sử dụng và safe-delete.</p></div><label class="button file-button">Upload<input id="cmsMediaUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden></label></div><label id="mediaDropzone" class="media-dropzone"><input id="cmsMediaDrop" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden><span>⇧</span><div><b>Thả file vào đây</b><small>PNG, JPG, WEBP, GIF hoặc PDF · tối đa 10 MB</small></div><i id="mediaUploadState">R2 / STORAGE</i></label><form id="cmsMediaSearchForm" class="media-tools"><div class="search-field"><span>⌕</span><input name="q" value="${esc(cmsMediaQuery)}" placeholder="Tìm theo tên, ALT hoặc mô tả…"></div><select name="type"><option value="all" ${cmsMediaType==="all"?"selected":""}>Tất cả</option><option value="image" ${cmsMediaType==="image"?"selected":""}>Hình ảnh</option><option value="pdf" ${cmsMediaType==="pdf"?"selected":""}>PDF</option></select><button>Tìm</button></form><div class="media-grid v3">${media.items.map(x=>`<article class="media-item" data-media-type="${x.mime.startsWith("image/")?"image":"pdf"}">${x.mime.startsWith("image/")?`<div class="media-thumb"><img src="${mediaSrc(x.id,true)}" alt="${esc(x.alt_text)}" loading="lazy"></div>`:'<div class="media-doc">PDF</div>'}<div class="media-copy"><b>${esc(x.name)}</b><small>${(x.size/1024).toFixed(1)} KB${x.width&&x.height?` · ${x.width}×${x.height}`:""}</small><small>${x.alt_text?`ALT: ${esc(x.alt_text)}`:"Chưa có ALT"} · ${esc(x.visibility)}</small></div><div class="media-actions"><button data-media-copy="${x.id}">Copy ID</button><button data-media-refs="${x.id}">Đang dùng?</button><button data-media-edit="${x.id}">Metadata</button><button data-media-delete="${x.id}" class="danger-lite">Xóa</button></div></article>`).join("")||empty("Chưa có media","Upload logo, ảnh social hoặc media dùng cho Page Builder.")}</div><div class="pagination cms-pagination">${media.page>1?'<button id="mediaPrev">← Trước</button>':""}<span>${media.total} media · Trang ${media.page}</span>${media.page*media.limit<media.total?'<button id="mediaNext">Tiếp →</button>':""}</div></section>
  </div>`;
  app.innerHTML=chrome(html,"website"); bindChrome();

  $$('[data-cms-scroll]').forEach(b=>b.onclick=()=>document.getElementById(`cmsSection-${b.dataset.cmsScroll}`)?.scrollIntoView({behavior:"smooth",block:"start"}));
  formSubmit("#cmsSiteForm",async b=>{await send("/admin/cms/site",b,"PATCH");publicSite=null;toast("Đã lưu Site Settings.");await websiteCmsPage()});
  $$('[data-cms-page]').forEach(b=>b.onclick=()=>openCmsPage(b.dataset.cmsPage));
  $$('[data-cms-page-duplicate]').forEach(b=>b.onclick=async()=>{if(!confirm("Tạo bản sao Draft của trang này?"))return;try{const x=await send(`/admin/cms/pages/${b.dataset.cmsPageDuplicate}/duplicate`,{});toast("Đã nhân bản trang.");await openCmsPage(x.id)}catch(e){toast(e.message,true)}});
  $("#newCmsPage").onclick=()=>{modal("Tạo trang",`<form id="newPageForm"><label>Tiêu đề<input name="title" required></label><label>Slug<input name="slug" placeholder="research-highlights" required></label><label>Mô tả<textarea name="description"></textarea></label><div class="safe-note">Trang mới luôn bắt đầu ở Draft và noindex cho tới khi bạn kiểm tra SEO rồi Publish.</div><button class="button" type="submit">Tạo Draft</button></form>`);formSubmit("#newPageForm",async b=>{const x=await send("/admin/cms/pages",b);close();await openCmsPage(x.id)})};

  const editLink=(kind,item)=>{const isNav=kind==="navigation";modal(isNav?"Sửa menu":"Sửa footer",`<form id="cmsLinkForm"><label>${isNav?"Nhãn":"Cột"}<input name="${isNav?"label":"column_key"}" value="${esc(isNav?item?.label:item?.column_key)}" required></label>${isNav?`<label>Menu cha<select name="parent_id">${navParentOptions(nav.items,item)}</select></label>`:`<label>Heading<input name="heading" value="${esc(item?.heading)}" required></label><label>Nhãn<input name="label" value="${esc(item?.label)}" required></label>`}<label>URL<input name="url" value="${esc(item?.url)}" required></label><label>Thứ tự<input name="position" type="number" value="${item?.position??0}"></label><label class="toggle-row compact"><input type="checkbox" name="enabled" ${item?.enabled!==0?"checked":""}> <span><b>Bật</b><small>Ẩn mục mà không xóa dữ liệu.</small></span></label>${isNav?`<label class="toggle-row compact"><input type="checkbox" name="external" ${item?.external?"checked":""}> <span><b>External</b></span></label><label class="toggle-row compact"><input type="checkbox" name="new_tab" ${item?.new_tab?"checked":""}> <span><b>Mở tab mới</b></span></label>`:""}<button class="button" type="submit">Lưu</button></form>`);$("#cmsLinkForm").onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));b.enabled=f.enabled.checked;if(isNav){b.external=f.external.checked;b.new_tab=f.new_tab.checked}if(item)b.id=item.id;try{await send(`/admin/cms/${kind}`,b,item?"PATCH":"POST");close();publicSite=null;await websiteCmsPage()}catch(err){toast(err.message,true)}}};
  $("#addNav").onclick=()=>editLink("navigation",null); $("#addFooter").onclick=()=>editLink("footer",null);
  $$('[data-nav-edit]').forEach(b=>b.onclick=()=>editLink("navigation",nav.items.find(x=>x.id===b.dataset.navEdit)));
  $$('[data-footer-edit]').forEach(b=>b.onclick=()=>editLink("footer",footer.items.find(x=>x.id===b.dataset.footerEdit)));
  const del=async(kind,id)=>{if(!confirm("Xóa mục này?"))return;try{await api(`/admin/cms/${kind}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id})});publicSite=null;await websiteCmsPage()}catch(e){toast(e.message,true)}};
  $$('[data-nav-delete]').forEach(b=>b.onclick=()=>del("navigation",b.dataset.navDelete)); $$('[data-footer-delete]').forEach(b=>b.onclick=()=>del("footer",b.dataset.footerDelete));

  const reorderSimple=async(kind,items,id,dir)=>{const item=items.find(x=>x.id===id);if(!item)return;const siblings=items.filter(x=>kind==="navigation"?String(x.parent_id||"")===String(item.parent_id||""):x.column_key===item.column_key).sort((a,b)=>a.position-b.position);const i=siblings.findIndex(x=>x.id===id),j=i+dir;if(j<0||j>=siblings.length)return;const other=siblings[j],p1=item.position,p2=other.position;const clean=x=>kind==="navigation"?{id:x.id,label:x.label,url:x.url,position:x.position,enabled:!!x.enabled,external:!!x.external,new_tab:!!x.new_tab,parent_id:x.parent_id||""}:{id:x.id,column_key:x.column_key,heading:x.heading,label:x.label,url:x.url,position:x.position,enabled:!!x.enabled};try{await send(`/admin/cms/${kind}`,{...clean(item),position:p2},"PATCH");await send(`/admin/cms/${kind}`,{...clean(other),position:p1},"PATCH");publicSite=null;await websiteCmsPage()}catch(e){toast(e.message,true)}};
  $$('[data-nav-up]').forEach(b=>b.onclick=()=>reorderSimple("navigation",nav.items,b.dataset.navUp,-1)); $$('[data-nav-down]').forEach(b=>b.onclick=()=>reorderSimple("navigation",nav.items,b.dataset.navDown,1));
  $$('[data-footer-up]').forEach(b=>b.onclick=()=>reorderSimple("footer",footer.items,b.dataset.footerUp,-1)); $$('[data-footer-down]').forEach(b=>b.onclick=()=>reorderSimple("footer",footer.items,b.dataset.footerDown,1));

  $("#cmsMediaUpload").onchange=e=>uploadCmsMedia(e.target.files[0]);
  $("#cmsMediaDrop").onchange=e=>uploadCmsMedia(e.target.files[0]);
  const drop=$("#mediaDropzone");
  ["dragenter","dragover"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add("dragover")}));
  ["dragleave","drop"].forEach(type=>drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove("dragover")}));
  drop.addEventListener("drop",e=>uploadCmsMedia(e.dataTransfer?.files?.[0]));
  $("#cmsMediaSearchForm").onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);cmsMediaQuery=String(f.get("q")||"");cmsMediaType=String(f.get("type")||"all");cmsMediaPage=1;websiteCmsPage()};
  if($("#mediaPrev")) $("#mediaPrev").onclick=()=>{cmsMediaPage--;websiteCmsPage()};
  if($("#mediaNext")) $("#mediaNext").onclick=()=>{cmsMediaPage++;websiteCmsPage()};
  $$('[data-media-copy]').forEach(b=>b.onclick=async()=>{try{await navigator.clipboard.writeText(b.dataset.mediaCopy);toast("Đã copy Media ID.")}catch{toast("Không thể truy cập clipboard.",true)}});
  $$('[data-media-refs]').forEach(b=>b.onclick=async()=>{try{const x=await api(`/admin/cms/media/${b.dataset.mediaRefs}/references`);modal("Media references",x.items.length?`<div class="reference-list">${x.items.map(r=>`<div><b>${esc(r.type)}</b><span>${esc(r.label)}</span></div>`).join("")}</div>`:'<div class="safe-note">Media này chưa được tham chiếu bởi Site Settings, Page Builder hoặc Published snapshot.</div>')}catch(e){toast(e.message,true)}});
  $$('[data-media-edit]').forEach(b=>b.onclick=()=>{const item=media.items.find(x=>x.id===b.dataset.mediaEdit);modal("Media metadata",`<form id="mediaMetaForm"><div class="media-meta-head">${item.mime.startsWith("image/")?`<img src="${mediaSrc(item.id,true)}" alt="">`:'<div class="media-doc">PDF</div>'}<div><b>${esc(item.name)}</b><small>${esc(item.mime)} · ${(item.size/1024).toFixed(1)} KB${item.width&&item.height?` · ${item.width}×${item.height}`:""}</small></div></div><label>Alt text<input name="alt_text" value="${esc(item.alt_text)}" maxlength="300"><small>Mô tả nội dung hình cho accessibility; không nhồi từ khóa SEO.</small></label><label>Mô tả nội bộ<textarea name="description" rows="4" maxlength="2000">${esc(item.description||"")}</textarea></label><button class="button" type="submit">Lưu metadata</button></form>`);formSubmit("#mediaMetaForm",async body=>{await send(`/admin/cms/media/${item.id}`,body,"PATCH");close();await websiteCmsPage()})});
  $$('[data-media-delete]').forEach(b=>b.onclick=async()=>{if(!confirm("Xóa media này khỏi R2? Hệ thống sẽ từ chối nếu media đang được tham chiếu."))return;try{await api(`/admin/cms/media/${b.dataset.mediaDelete}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});toast("Đã xóa media.");await websiteCmsPage()}catch(e){toast(e.message,true)}});
}
async function adminPage(view) {
  let html = "";
  if (view === "website") { await websiteCmsPage(); return; }
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
  if (view === "email") {
    const d=await api("/admin/email");
    app.innerHTML=chrome(heading("Email outbox",d.configured?"Resend đã cấu hình · sent = nhà cung cấp đã nhận, chưa xác nhận tới inbox.":"Chưa cấu hình RESEND_API_KEY.",'<button id="flushEmail">Xử lý hàng đợi</button>')+`<div class="panel table-wrap"><table><thead><tr><th>Email</th><th>Trạng thái</th><th>Lần thử</th><th>Lỗi / lịch thử lại</th></tr></thead><tbody>${d.items.map(x=>`<tr><td>${esc(x.subject)}</td><td>${esc(x.status)}${x.status==='failed'?` <button data-email-retry="${esc(x.id)}">Thử lại</button>`:''}</td><td>${x.attempts}</td><td>${esc(x.last_error||'—')}<small>${x.status==='pending'&&x.next_attempt_at?esc(new Date(x.next_attempt_at*1000).toLocaleString('vi-VN')):''}</small></td></tr>`).join('')}</tbody></table></div>`,view);
    bindChrome();
    $$("[data-email-retry]").forEach(b=>b.onclick=async()=>{if(!confirm("Thử gửi lại email sau khi đã sửa cấu hình?"))return;try{await send('/admin/email/retry',{id:b.dataset.emailRetry});await adminPage(view);}catch(e){toast(e.message,true);}});
    $("#flushEmail").onclick=async()=>{try{await send('/admin/email/flush',{});await adminPage(view);}catch(e){toast(e.message,true);}};
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
      ["users", "roles", "settings", "website", "audit", "export", "notices", "email"].includes(v)
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
} catch (error) {
  void error; // Private browsing/storage policies may disable localStorage.
}
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
  const target = e.target;
  const editing = target && ["INPUT","TEXTAREA","SELECT"].includes(target.tagName);
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
    e.preventDefault();
    if ($("#commandPalette")?.hidden === false) closeCommandPalette(); else openCommandPalette();
    return;
  }
  if (e.key === "/" && !editing && $("#globalSearch input")) {
    e.preventDefault();
    $("#globalSearch input").focus();
    return;
  }
  if (e.key === "Escape") {
    closeCommandPalette();
    $("#sidebar")?.classList.remove("open");
  }
  if (e.key === "Tab" && $("#commandPalette")?.hidden === false) {
    const focusable = $$("#commandPalette .command-card input, #commandPalette .command-card button:not([hidden]):not(:disabled)").filter(x => x.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
route();


// V4 ambient research interactions: progressive enhancement only.
function initV4Motion(){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.style.setProperty('--mx','50%');document.documentElement.style.setProperty('--my','30%');
  if(!reduce){document.addEventListener('pointermove',e=>{document.documentElement.style.setProperty('--mx',e.clientX+'px');document.documentElement.style.setProperty('--my',e.clientY+'px')},{passive:true});}
  const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('in-view')}),{threshold:.08});
  document.querySelectorAll('.public-section,.process-section,.v4-journey,.explore-context,.editorial-grid,.editorial-quote').forEach(x=>obs.observe(x));
  document.querySelectorAll('[data-scramble]').forEach(el=>{const final=el.dataset.scramble||el.textContent;if(reduce){el.textContent=final;return}let n=0;const t=setInterval(()=>{n++;el.textContent=n<16?String(Math.floor(Math.random()*90000000000000+10000000000000)):final;if(n>=16)clearInterval(t)},55)});
}
window.addEventListener('load',()=>setTimeout(initV4Motion,0));

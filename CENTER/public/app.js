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
  publicSite = null;
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
          ["settings", "Cài đặt hệ thống"],
          ["website", "Website CMS"],
          ["email", "Email outbox"],
          ["export", "Xuất dữ liệu"],
        ]
      : []),
    ...(has("audit") ? [["audit", "Audit log"]] : []),
    ...(has("manage") ? [["notices", "Gửi thông báo"]] : []),
  ];
  return `<div class="workspace"><aside id="sidebar"><a class="brand" href="/"><img src="/sky-first-logo.png" alt=""><span>SKY FIRST<small>RESEARCH & INNOVATION CENTER</small></span></a><div class="nav-label">KHÔNG GIAN NGHIÊN CỨU</div><nav>${links.map(([id, label, icon]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>${icon}</span>${esc(label)}</a>`).join("")}</nav>${admin.length ? `<div class="nav-label">ADMIN CONTROL CENTER</div><nav>${admin.map(([id, label]) => `<a href="#w/${id}" class="${active === id ? "selected" : ""}"><span>⌘</span>${label}</a>`).join("")}</nav>` : ""}<div class="sidebar-foot">Hỏi sâu hơn.<br>Tạo thay đổi tốt hơn.</div></aside><div class="work-main"><header class="work-top"><button class="icon" id="menu" aria-label="Mở menu" aria-expanded="false">☰</button><form id="globalSearch"><input name="q" placeholder="Tìm đề tài, tài liệu, nghiên cứu…" aria-label="Tìm toàn hệ thống"></form><button class="icon theme" aria-label="Đổi giao diện sáng tối">◐</button><a href="#w/notifications" class="icon" aria-label="Thông báo">♧</a><button id="logout" class="quiet">Đăng xuất</button><span class="avatar" title="${esc(me?.name)}">${esc(me?.name?.slice(0, 1) || "S")}</span></header><main id="main" tabindex="-1">${content}</main><footer>SKY FIRST · Research & Innovation Center Workspace</footer></div></div>`;
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
  const navs = site?.navigation?.length ? site.navigation : [
    { label: "Trung tâm", url: "/about" },
    { label: "Khám phá", url: "/explore" },
    { label: "Công bố", url: "/explore?kind=publications" },
    { label: "Sự kiện", url: "/explore?kind=events" },
    { label: "Kết nối", url: "/contact" },
  ];
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
  return `<header class="public-top"><a class="brand public-brand" href="/" aria-label="${esc(nameVi)}"><img src="${esc(logo)}" alt="Logo Trung tâm"><span><b>SKY FIRST</b><small>RESEARCH & INNOVATION CENTER</small></span></a><nav id="publicNav" class="public-nav" aria-label="Điều hướng chính">${navs.filter(x=>x.url!=="/").map(x=>`<a href="${esc(x.url)}" class="${currentNav(x.url)?"active":""}" ${currentNav(x.url)?'aria-current="page"':''} ${x.new_tab?'target="_blank" rel="noopener noreferrer"':''}>${esc(x.label)}</a>`).join("")}<a class="mobile-only" href="/#${me ? "w/dashboard" : "login"}">${me ? "Không gian làm việc" : "Đăng nhập"}</a></nav><div class="public-actions"><a class="header-search" href="/explore" aria-label="Tìm kiếm nội dung">⌕</a><a class="button header-login" href="/#${me ? "w/dashboard" : "login"}">${me ? "Không gian làm việc" : "Đăng nhập"} <span aria-hidden="true">↗</span></a><button class="icon theme" aria-label="Đổi giao diện sáng tối" title="Đổi giao diện">◐</button><button class="icon public-menu" aria-label="Mở menu website" aria-controls="publicNav" aria-expanded="false">☰</button></div></header><main id="main" tabindex="-1">${content}</main><footer class="public-footer premium"><section class="footer-brand"><img src="${esc(logo)}" alt=""><div><h2>${esc(nameVi)}</h2><p>${esc(st.description || "Nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng.")}</p><div class="footer-contact"><a href="mailto:${esc(email)}"><span>✉</span>${esc(email)}</a><a href="tel:${esc(hotline.replace(/\D/g,""))}"><span>⌕</span>${esc(hotline)}</a></div></div></section>${columns.map(c=>{const items=footer.filter(x=>x.column_key===c);return `<section class="footer-column footer-${esc(c)}"><h3>${esc(items[0]?.heading||c)}</h3>${items.map(x=>`<a href="${esc(x.url)}" ${/^https?:/i.test(x.url)?'target="_blank" rel="noopener noreferrer"':''}><span>${esc(x.label)}</span><b aria-hidden="true">${/^https?:/i.test(x.url)?"↗":"›"}</b></a>`).join("")}</section>`}).join("")}<div class="footer-bottom"><span>${esc(st.copyright || "© 2026 Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First.")}</span><nav aria-label="Liên kết cuối trang"><a href="/privacy">Chính sách bảo mật</a><a href="/contact">Liên hệ</a><a href="${esc(st.website || "https://research.skyfirst.io.vn")}" target="_blank" rel="noopener noreferrer">Website Trung tâm</a></nav></div><div class="footer-signature" aria-hidden="true">${esc(nameEn)}</div></footer>`;
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
  return `<section class="hero new-hero"><div class="hero-copy"><div class="eyebrow">SKY FIRST RESEARCH & INNOVATION CENTER</div><h1>Từ câu hỏi hôm nay.<br><em>Đến giải pháp ngày mai.</em></h1><p>${esc(settings.intro || settings.description || "Kết nối câu hỏi, dữ liệu và con người để phát triển những giải pháp có ích trong thực tế.")}</p><div class="actions"><a class="button" href="/explore">Khám phá nghiên cứu <span aria-hidden="true">↗</span></a><a class="text-link" href="/about">Về Trung tâm <span aria-hidden="true">→</span></a></div>${live}</div><div class="research-visual" aria-hidden="true"><div class="visual-grid"></div><div class="visual-orbit orbit-a"></div><div class="visual-orbit orbit-b"></div><div class="visual-orbit orbit-c"></div><div class="visual-node node-a"></div><div class="visual-node node-b"></div><div class="visual-node node-c"></div><div class="visual-core">R<span>&</span>I</div><div class="visual-tag tag-a">NGHIÊN CỨU</div><div class="visual-tag tag-b">DỮ LIỆU</div><div class="visual-tag tag-c">TÁC ĐỘNG</div></div></section><section class="public-section focus-section"><div class="section-heading"><div><span class="section-kicker">LĨNH VỰC TRỌNG TÂM</span><h2>Đi sâu vào những vấn đề có ý nghĩa.</h2><p>Bốn hướng giúp kết nối tri thức với nhu cầu thực tế.</p></div><a class="section-link" href="/about">Cách chúng tôi tiếp cận <span aria-hidden="true">↗</span></a></div><div class="focus-grid">${[["01","Giáo dục & học tập","Hiểu cách con người học, tiếp cận tri thức và phát triển năng lực."],["02","Công nghệ & sáng tạo","Thử nghiệm công cụ, phương pháp và mô hình giải quyết vấn đề."],["03","Cộng đồng & phát triển","Bắt đầu từ nhu cầu thật và theo dõi tác động sau triển khai."],["04","Dữ liệu & tri thức mở","Tổ chức dữ liệu rõ ràng để tri thức có thể được hiểu và tái sử dụng."]].map(([n,a,b])=>`<article class="focus-card"><span>${n}</span><div class="focus-icon" aria-hidden="true">${n==="01"?"▤":n==="02"?"✦":n==="03"?"◎":"▦"}</div><h3>${a}</h3><p>${b}</p></article>`).join("")}</div></section><section class="process-section"><div class="process-heading"><span class="section-kicker light-kicker">CÁCH CHÚNG TÔI HOẠT ĐỘNG</span><h2>Từ ý tưởng đến tác động thực tế.</h2><p>Một nhịp làm việc rõ ràng để nghiên cứu không dừng ở ý tưởng.</p></div><div class="process-grid">${[["01","Tiếp nhận ý tưởng","Làm rõ vấn đề và câu hỏi cần khám phá."],["02","Nghiên cứu & phát triển","Thử nghiệm, thu thập dữ liệu và hoàn thiện phương án."],["03","Công bố & chia sẻ","Đưa kết quả phù hợp đến cộng đồng một cách có trách nhiệm."],["04","Tạo tác động","Theo dõi ứng dụng, phản hồi và cơ hội cải tiến tiếp theo."]].map(([n,a,b])=>`<div class="process-step"><b>${n}</b><h3>${a}</h3><p>${b}</p></div>`).join("")}</div></section>${recent}<section class="public-section knowledge-space"><div class="section-heading"><div><span class="section-kicker">KHÔNG GIAN TRI THỨC</span><h2>Mỗi loại nội dung có một cách để khám phá.</h2></div></div><div class="portal-grid"><a href="/explore?kind=publications"><span>↗</span><h3>Công bố</h3><p>Kết quả, báo cáo và bài viết nghiên cứu đã được chia sẻ.</p></a><a href="/explore?kind=datasets"><span>▦</span><h3>Dataset</h3><p>Nguồn dữ liệu đi kèm mô tả và điều kiện sử dụng rõ ràng.</p></a><a href="/explore?kind=events"><span>◷</span><h3>Sự kiện</h3><p>Không gian trao đổi, hội thảo và hoạt động đào tạo.</p></a></div></section><section class="join-band"><div><span class="section-kicker light-kicker">KẾT NỐI</span><h2>Một câu hỏi tốt có thể bắt đầu từ một cuộc trao đổi.</h2><p>Trao đổi về nghiên cứu, đề xuất ý tưởng hoặc một cơ hội hợp tác phù hợp.</p></div><a class="button light" href="/contact">Kết nối cùng Trung tâm <span aria-hidden="true">↗</span></a></section>`;
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
    content = `<section class="explore-hero"><span class="section-kicker">THƯ VIỆN TRI THỨC</span><h1>${esc(title)}</h1><p>${esc(desc)}</p></section><section class="explore-shell"><form class="filters explore-filters" action="/explore"><div class="search-field"><span aria-hidden="true">⌕</span><input name="q" placeholder="Tìm theo tiêu đề, tóm tắt hoặc nội dung…" value="${esc(q)}" aria-label="Từ khóa tìm kiếm"></div><select name="kind" aria-label="Loại nội dung"><option value="">Tất cả nội dung</option>${PUBLIC_KINDS.map((k) => `<option value="${k}" ${kind === k ? "selected" : ""}>${CATALOG[k].label}</option>`).join("")}</select><button class="button">Tìm kiếm <span aria-hidden="true">↗</span></button></form>${categoryChips(q,kind)}<div class="results-head"><div><b>${data.total}</b><span>kết quả${q?` cho “${esc(q)}”`:""}</span></div>${(q||kind)?'<a href="/explore">Xóa bộ lọc</a>':""}</div><div class="explore-results ${view}">${data.items.map((r) => publicRecordCard(r,view)).join("")}</div>${!data.items.length ? `<div class="empty polished"><div aria-hidden="true">◇</div><h3>Chưa tìm thấy nội dung phù hợp</h3><p>Thử một từ khóa rộng hơn, đổi danh mục hoặc xóa bộ lọc hiện tại.</p><a class="button secondary" href="/explore">Xem tất cả nội dung</a></div>` : ""}<div class="pagination">${data.page > 1 ? `<a href="?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}&page=${data.page - 1}">← Trước</a>` : ""}<span>Trang ${data.page}</span>${data.page * 24 < data.total ? `<a href="?q=${encodeURIComponent(q)}&kind=${encodeURIComponent(kind)}&page=${data.page + 1}">Tiếp →</a>` : ""}</div></section>`;
  } else if (path === "/") {
    const data = await api("/public/search");
    content = fallbackHome(settings, data);
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

const BLOCK_LABELS = {hero:"Hero",heading:"Heading",rich_text:"Rich Text",image:"Image",cta:"CTA",statistics:"Statistics",cards:"Cards",feature_grid:"Feature Grid",partners:"Partners / Links",faq:"FAQ"};
function mediaOptions(items, selected="") {
  return `<option value="">— Không chọn —</option>${items.filter(x=>x.mime.startsWith("image/")).map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${esc(x.name)}</option>`).join("")}`;
}
function listLines(items=[], type="cards") {
  return items.map(x => type==="statistics" ? `${x.value||""} | ${x.label||""}` : `${x.title||x.question||""} | ${x.text||x.answer||""} | ${x.url||""}`).join("\n");
}
function parseListLines(value, type) {
  return String(value||"").split("\n").map(x=>x.trim()).filter(Boolean).map(line=>{
    const [a="",b="",c=""] = line.split("|").map(x=>x.trim());
    return type==="statistics" ? {value:a,label:b} : {title:a,text:b,url:c};
  });
}
function blockEditorFields(block, media) {
  const d=block?.data||{}, type=block?.type||"hero";
  const commonMedia = `<label>Media<select name="media_id">${mediaOptions(media,d.media_id)}</select></label>`;
  if(type==="hero") return `<label>Eyebrow<input name="eyebrow" value="${esc(d.eyebrow)}"></label><label>Tiêu đề<input name="title" value="${esc(d.title)}" required></label><label>Nội dung<textarea name="text">${esc(d.text)}</textarea></label><div class="form-grid"><label>Nút chính<input name="primaryLabel" value="${esc(d.primaryLabel)}"></label><label>URL nút chính<input name="primaryUrl" value="${esc(d.primaryUrl)}"></label><label>Nút phụ<input name="secondaryLabel" value="${esc(d.secondaryLabel)}"></label><label>URL nút phụ<input name="secondaryUrl" value="${esc(d.secondaryUrl)}"></label></div>`;
  if(type==="heading") return `<label>Eyebrow<input name="eyebrow" value="${esc(d.eyebrow)}"></label><label>Tiêu đề<input name="title" value="${esc(d.title)}" required></label><label>Mô tả<textarea name="text">${esc(d.text)}</textarea></label>`;
  if(type==="rich_text") return `<label>Tiêu đề<input name="heading" value="${esc(d.heading)}"></label><label>Nội dung<textarea name="text" rows="9">${esc(d.text)}</textarea></label>`;
  if(type==="image") return `${commonMedia}<label>Alt text<input name="alt" value="${esc(d.alt)}"></label><label>Chú thích<input name="caption" value="${esc(d.caption)}"></label>`;
  if(type==="cta") return `<label>Tiêu đề<input name="title" value="${esc(d.title)}" required></label><label>Mô tả<textarea name="text">${esc(d.text)}</textarea></label><div class="form-grid"><label>Nhãn nút<input name="label" value="${esc(d.label)}"></label><label>URL<input name="url" value="${esc(d.url)}"></label></div>`;
  if(type==="statistics") return `<label>Tiêu đề<input name="heading" value="${esc(d.heading)}"></label><label>Dữ liệu — mỗi dòng: Giá trị | Nhãn<textarea name="items" rows="8">${esc(listLines(d.items,"statistics"))}</textarea></label>`;
  if(["cards","feature_grid","partners","faq"].includes(type)) return `<label>Tiêu đề nhóm<input name="heading" value="${esc(d.heading)}"></label><label>${type==="faq"?"Mỗi dòng: Câu hỏi | Trả lời":"Mỗi dòng: Tiêu đề | Mô tả | URL"}<textarea name="items" rows="10">${esc(listLines(d.items,type))}</textarea></label>`;
  return "";
}
function blockDataFromForm(type, f) {
  const b=Object.fromEntries(new FormData(f));
  if(["statistics","cards","feature_grid","partners","faq"].includes(type)) b.items=parseListLines(b.items,type);
  return b;
}
async function editCmsBlock(pageId, block, media) {
  const type=block?.type||"hero";
  modal(block?`Sửa block · ${BLOCK_LABELS[type]}`:"Thêm block", `<form id="cmsBlockForm">${block?"":`<label>Loại block<select name="type">${Object.entries(BLOCK_LABELS).map(([k,v])=>`<option value="${k}">${esc(v)}</option>`).join("")}</select></label><div id="dynamicBlockFields"></div>`}${block?blockEditorFields(block,media):""}<label><input type="checkbox" name="enabled" ${block?.enabled!==false?"checked":""}> Hiển thị block</label><button class="button" type="submit">Lưu block</button></form>`);
  const form=$("#cmsBlockForm");
  if(!block){
    const draw=()=>$("#dynamicBlockFields").innerHTML=blockEditorFields({type:form.type.value,data:{}},media);
    form.type.onchange=draw; draw();
  }
  form.onsubmit=async e=>{
    e.preventDefault();
    const type2=block?.type||form.type.value;
    try{
      const payload={page_id:pageId,type:type2,enabled:form.enabled.checked,data:blockDataFromForm(type2,form)};
      if(block) await send(`/admin/cms/blocks/${block.id}`,payload,"PATCH"); else await send("/admin/cms/blocks",payload);
      close(); toast("Đã lưu block."); await openCmsPage(pageId);
    }catch(err){toast(err.message,true)}
  };
}
async function openCmsPage(id) {
  const [d,m]=await Promise.all([api(`/admin/cms/pages/${id}`),api("/admin/cms/media")]);
  const p=d.page;
  modal(`Page Builder · /${p.slug==="home"?"":p.slug}`, `<div class="cms-builder"><form id="cmsPageForm" class="panel"><div class="form-grid"><label>Tiêu đề<input name="title" value="${esc(p.title)}" required></label><label>Slug<input name="slug" value="${esc(p.slug)}" required></label><label class="wide">Mô tả<textarea name="description">${esc(p.description)}</textarea></label><label>SEO title<input name="seo_title" value="${esc(p.seo_title)}"></label><label>Social image<select name="social_media_id">${mediaOptions(m.items,p.social_media_id)}</select></label><label class="wide">Meta description<textarea name="meta_description">${esc(p.meta_description)}</textarea></label><label class="wide">Canonical URL<input name="canonical_url" value="${esc(p.canonical_url)}" placeholder="https://research.skyfirst.io.vn/..."></label><label><input type="checkbox" name="noindex" ${p.noindex?"checked":""}> noindex</label></div><button class="button" type="submit">Save Draft · Thông tin trang</button></form><section class="panel"><div class="section-heading"><div><h3>Blocks</h3><p class="muted">Kéo logic bằng nút lên/xuống; Draft không xuất hiện public cho tới khi Publish.</p></div><button id="addCmsBlock" class="button">+ Thêm block</button></div><div class="cms-block-list">${p.blocks.map((b,i)=>`<div class="cms-block-row"><div><b>${esc(BLOCK_LABELS[b.type]||b.type)}</b><small>${b.enabled?"Đang bật":"Đang tắt"} · #${i+1}</small></div><div><button data-block-up="${b.id}" ${i===0?"disabled":""}>↑</button><button data-block-down="${b.id}" ${i===p.blocks.length-1?"disabled":""}>↓</button><button data-block-edit="${b.id}">Sửa</button><button data-block-delete="${b.id}" class="danger-lite">Xóa</button></div></div>`).join("")||empty("Chưa có block","Thêm block để xây dựng trang.")}</div></section><div class="cms-builder-actions"><button id="previewCmsPage">Preview Draft</button><button id="publishCmsPage" class="button">Publish</button>${!["home","about","contact","privacy"].includes(p.slug)?'<button id="deleteCmsPage" class="danger-lite">Xóa trang</button>':""}<span class="muted">Public snapshot: ${p.published_at?`đã publish · ${esc(p.published_at)}`:"chưa publish"}</span></div></div>`);
  formSubmit("#cmsPageForm", async b=>{
    await send(`/admin/cms/pages/${id}`,{...b,noindex:$("#cmsPageForm [name=noindex]").checked,version:p.version},"PATCH"); toast("Đã lưu draft."); close(); await openCmsPage(id);
  });
  $("#addCmsBlock").onclick=()=>editCmsBlock(id,null,m.items);
  $$('[data-block-edit]').forEach(btn=>btn.onclick=()=>editCmsBlock(id,p.blocks.find(x=>x.id===btn.dataset.blockEdit),m.items));
  $$('[data-block-delete]').forEach(btn=>btn.onclick=async()=>{if(!confirm("Xóa block này?"))return;try{await api(`/admin/cms/blocks/${btn.dataset.blockDelete}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});close();await openCmsPage(id)}catch(e){toast(e.message,true)}});
  const reorder=async(bid,dir)=>{const ids=p.blocks.map(x=>x.id),i=ids.indexOf(bid),j=i+dir;if(j<0||j>=ids.length)return;[ids[i],ids[j]]=[ids[j],ids[i]];await send(`/admin/cms/pages/${id}/reorder`,{ids});close();await openCmsPage(id)};
  $$('[data-block-up]').forEach(b=>b.onclick=()=>reorder(b.dataset.blockUp,-1));
  $$('[data-block-down]').forEach(b=>b.onclick=()=>reorder(b.dataset.blockDown,1));
  $("#previewCmsPage").onclick=async()=>{try{const x=await api(`/admin/cms/pages/${id}/preview`);modal("Preview Draft",`<div class="cms-preview">${renderCmsPage(x.page)}</div>`)}catch(e){toast(e.message,true)}};
  $("#publishCmsPage").onclick=async()=>{if(!confirm("Publish draft hiện tại ra website công khai?"))return;try{await send(`/admin/cms/pages/${id}/publish`,{});publicSite=null;toast("Đã publish trang.");close();await adminPage("website")}catch(e){toast(e.message,true)}};
  const deletePage = $("#deleteCmsPage");
  if(deletePage) deletePage.onclick=async()=>{if(!confirm("Xóa trang tùy chỉnh này? Thao tác không thể hoàn tác."))return;try{await api(`/admin/cms/pages/${id}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});publicSite=null;close();toast("Đã xóa trang.");await adminPage("website")}catch(e){toast(e.message,true)}};
}
async function websiteCmsPage() {
  const [site,pages,nav,footer,media]=await Promise.all([api("/admin/cms/site"),api("/admin/cms/pages"),api("/admin/cms/navigation"),api("/admin/cms/footer"),api("/admin/cms/media")]);
  const st=site.settings;
  const html=heading("Website CMS","Quản trị nội dung, nhận diện, menu, footer, trang và Media Library mà không cần mở source code.")+
  `<div class="cms-admin-grid"><section class="panel"><div class="section-heading"><h2>Site Settings</h2><span class="badge published">Global</span></div><form id="cmsSiteForm" class="form-grid"><label class="wide">Tên Trung tâm<input name="center_name" value="${esc(st.center_name)}"></label><label class="wide">English name<input name="english_name" value="${esc(st.english_name)}"></label><label class="wide">Tagline<input name="tagline" value="${esc(st.tagline)}"></label><label class="wide">Description<textarea name="description">${esc(st.description)}</textarea></label><label>Logo<select name="logo_media_id">${mediaOptions(media.items,st.logo_media_id)}</select></label><label>Favicon<select name="favicon_media_id">${mediaOptions(media.items,st.favicon_media_id)}</select></label><label>Website<input name="website" value="${esc(st.website)}"></label><label>Hotline/Zalo<input name="hotline" value="${esc(st.hotline)}"></label><label>Email Trung tâm<input name="email" value="${esc(st.email)}"></label><label>Email hỗ trợ<input name="support_email" value="${esc(st.support_email)}"></label><label>Facebook<input name="facebook" value="${esc(st.facebook)}"></label><label>Facebook Group<input name="facebook_group" value="${esc(st.facebook_group)}"></label><label class="wide">Copyright<input name="copyright" value="${esc(st.copyright)}"></label><button class="button" type="submit">Lưu Site Settings</button></form></section>
  <section class="panel"><div class="section-heading"><div><h2>Pages</h2><p class="muted">Draft → Preview → Publish.</p></div><button id="newCmsPage">+ Trang</button></div><div class="cms-page-list">${pages.items.map(x=>`<button class="cms-page-card" data-cms-page="${x.id}"><span><b>${esc(x.title)}</b><small>/${x.slug==="home"?"":esc(x.slug)}</small></span><span class="badge ${x.status}">${x.status==="published"?"Published":"Draft"}</span></button>`).join("")}</div></section>
  <section class="panel"><div class="section-heading"><h2>Header / Navigation</h2><button id="addNav">+ Link</button></div><div class="cms-simple-list">${nav.items.map(x=>`<div><span><b>${esc(x.label)}</b><small>${esc(x.url)} · ${x.enabled?"Bật":"Tắt"}</small></span><span><button data-nav-edit="${x.id}">Sửa</button><button data-nav-delete="${x.id}">Xóa</button></span></div>`).join("")}</div></section>
  <section class="panel"><div class="section-heading"><h2>Footer</h2><button id="addFooter">+ Link</button></div><div class="cms-simple-list">${footer.items.map(x=>`<div><span><b>${esc(x.heading)} · ${esc(x.label)}</b><small>${esc(x.url)} · ${x.enabled?"Bật":"Tắt"}</small></span><span><button data-footer-edit="${x.id}">Sửa</button><button data-footer-delete="${x.id}">Xóa</button></span></div>`).join("")}</div></section>
  <section class="panel cms-media-panel"><div class="section-heading"><div><h2>Media Library</h2><p class="muted">R2 binding STORAGE · không lưu base64 vào D1.</p></div><label class="button file-button">Upload<input id="cmsMediaUpload" type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf" hidden></label></div><div class="media-tools"><input id="mediaSearch" placeholder="Tìm media…"><select id="mediaTypeFilter" aria-label="Lọc loại media"><option value="all">Tất cả</option><option value="image">Hình ảnh</option><option value="pdf">PDF</option></select></div><div class="media-grid">${media.items.map(x=>`<article class="media-item" data-media-type="${x.mime.startsWith("image/")?"image":"pdf"}">${x.mime.startsWith("image/")?`<img src="${mediaSrc(x.id,true)}" alt="${esc(x.alt_text)}">`:'<div class="media-doc">PDF</div>'}<b>${esc(x.name)}</b><small>${(x.size/1024).toFixed(1)} KB · ${esc(x.visibility)}${x.alt_text?` · ALT: ${esc(x.alt_text)}`:""}</small><div class="media-actions"><button data-media-edit="${x.id}">Metadata</button><button data-media-delete="${x.id}">Xóa</button></div></article>`).join("")||empty("Chưa có media","Upload logo, ảnh social hoặc hình dùng cho Page Builder.")}</div></section></div>`;
  app.innerHTML=chrome(html,"website"); bindChrome();
  formSubmit("#cmsSiteForm",async b=>{await send("/admin/cms/site",b,"PATCH");publicSite=null;toast("Đã lưu Site Settings.")});
  $$('[data-cms-page]').forEach(b=>b.onclick=()=>openCmsPage(b.dataset.cmsPage));
  $("#newCmsPage").onclick=()=>{modal("Tạo trang",`<form id="newPageForm"><label>Tiêu đề<input name="title" required></label><label>Slug<input name="slug" placeholder="research-highlights" required></label><label>Mô tả<textarea name="description"></textarea></label><button class="button" type="submit">Tạo trang</button></form>`);formSubmit("#newPageForm",async b=>{const x=await send("/admin/cms/pages",b);close();await openCmsPage(x.id)})};
  const editLink=(kind,item)=>{const isNav=kind==="navigation";modal(isNav?"Sửa menu":"Sửa footer",`<form id="cmsLinkForm"><label>${isNav?"Nhãn":"Cột"}<input name="${isNav?"label":"column_key"}" value="${esc(isNav?item?.label:item?.column_key)}" required></label>${!isNav?`<label>Heading<input name="heading" value="${esc(item?.heading)}" required></label><label>Nhãn<input name="label" value="${esc(item?.label)}" required></label>`:""}<label>URL<input name="url" value="${esc(item?.url)}" required></label><label>Thứ tự<input name="position" type="number" value="${item?.position??0}"></label><label><input type="checkbox" name="enabled" ${item?.enabled!==0?"checked":""}> Bật</label>${isNav?`<label><input type="checkbox" name="external" ${item?.external?"checked":""}> External</label><label><input type="checkbox" name="new_tab" ${item?.new_tab?"checked":""}> Mở tab mới</label>`:""}<button class="button" type="submit">Lưu</button></form>`);$("#cmsLinkForm").onsubmit=async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));b.enabled=f.enabled.checked;if(isNav){b.external=f.external.checked;b.new_tab=f.new_tab.checked}if(item)b.id=item.id;try{await send(`/admin/cms/${kind}`,b,item?"PATCH":"POST");close();publicSite=null;await adminPage("website")}catch(err){toast(err.message,true)}}};
  $("#addNav").onclick=()=>editLink("navigation",null); $("#addFooter").onclick=()=>editLink("footer",null);
  $$('[data-nav-edit]').forEach(b=>b.onclick=()=>editLink("navigation",nav.items.find(x=>x.id===b.dataset.navEdit)));
  $$('[data-footer-edit]').forEach(b=>b.onclick=()=>editLink("footer",footer.items.find(x=>x.id===b.dataset.footerEdit)));
  const del=async(kind,id)=>{if(!confirm("Xóa mục này?"))return;await api(`/admin/cms/${kind}`,{method:"DELETE",headers:{"content-type":"application/json"},body:JSON.stringify({id})});publicSite=null;await adminPage("website")};
  $$('[data-nav-delete]').forEach(b=>b.onclick=()=>del("navigation",b.dataset.navDelete)); $$('[data-footer-delete]').forEach(b=>b.onclick=()=>del("footer",b.dataset.footerDelete));
  $("#cmsMediaUpload").onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const r=await fetch(`/api/v1/admin/cms/media?name=${encodeURIComponent(file.name)}`,{method:"POST",credentials:"same-origin",headers:{"x-requested-with":"SFRC"},body:file});const d=await r.json();if(!r.ok)throw Error(d.error||"Upload lỗi");toast("Đã upload media.");await adminPage("website")}catch(err){toast(err.message,true)}};
  $$('[data-media-edit]').forEach(b=>b.onclick=()=>{const item=media.items.find(x=>x.id===b.dataset.mediaEdit);modal("Media metadata",`<form id="mediaMetaForm"><p><b>${esc(item.name)}</b><br><small>${esc(item.mime)} · ${(item.size/1024).toFixed(1)} KB · ${esc(item.visibility)}</small></p><label>Alt text<input name="alt_text" value="${esc(item.alt_text)}" maxlength="300"></label><button class="button" type="submit">Lưu metadata</button></form>`);formSubmit("#mediaMetaForm",async body=>{await send(`/admin/cms/media/${item.id}`,body,"PATCH");close();await adminPage("website")})});
  $$('[data-media-delete]').forEach(b=>b.onclick=async()=>{if(!confirm("Xóa media này? Hệ thống sẽ chặn nếu đang được sử dụng."))return;try{await api(`/admin/cms/media/${b.dataset.mediaDelete}`,{method:"DELETE",headers:{"x-requested-with":"SFRC"}});await adminPage("website")}catch(e){toast(e.message,true)}});
  const applyMediaFilter=()=>{const q=$("#mediaSearch").value.toLowerCase(),type=$("#mediaTypeFilter").value;$$('.media-item').forEach(x=>x.hidden=!x.textContent.toLowerCase().includes(q)||(type!=="all"&&x.dataset.mediaType!==type))};
  $("#mediaSearch").oninput=applyMediaFilter; $("#mediaTypeFilter").onchange=applyMediaFilter;
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

const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

function cmsBody(page) {
  return (page.blocks || [])
    .filter((b) => b.enabled)
    .map((b) => {
      const d = b.data || {};
      if (b.type === "hero") return `<section><h1>${e(d.title || page.title)}</h1><p>${e(d.text || "")}</p></section>`;
      if (b.type === "heading") return `<section><h2>${e(d.title || "")}</h2><p>${e(d.text || "")}</p></section>`;
      if (b.type === "rich_text") return `<section><h2>${e(d.heading || "")}</h2><p>${e(d.text || "")}</p></section>`;
      if (b.type === "cta") return `<section><h2>${e(d.title || "")}</h2><p>${e(d.text || "")}</p></section>`;
      if (["cards", "feature_grid", "partners", "faq", "statistics"].includes(b.type))
        return `<section><h2>${e(d.heading || "")}</h2>${(d.items || []).map((x) => `<article><h3>${e(x.title || x.question || x.value || "")}</h3><p>${e(x.text || x.answer || x.label || "")}</p></article>`).join("")}</section>`;
      if (b.type === "image") return d.alt ? `<p>${e(d.alt)}</p>` : "";
      return "";
    })
    .join("");
}

export async function seo(request, env, requestApi) {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/robots.txt")
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain", "cache-control": "public,max-age=300" } },
    );
  if (url.pathname === "/sitemap.xml") {
    const paths = new Set(["/", "/about", "/explore", "/contact", "/privacy"]);
    const cms = await requestApi("/api/v1/public/pages").catch?.(() => null);
    if (cms?.ok) {
      const d = await cms.json();
      for (const x of d.items || []) paths.add(x.slug === "home" ? "/" : "/" + x.slug);
    }
    let page = 1;
    for (;;) {
      const r = await requestApi("/api/v1/public/search?page=" + page);
      if (!r.ok) break;
      const d = await r.json();
      for (const x of d.items) paths.add("/record/" + x.id);
      if (page++ * 24 >= d.total || page > 400) break;
    }
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        [...paths].map((p) => `<url><loc>${e(url.origin + p)}</loc></url>`).join("") +
        "</urlset>",
      { headers: { "content-type": "application/xml", "cache-control": "public,max-age=300" } },
    );
  }
  const cmsCandidate = /^\/(?:[a-z0-9-]+)?$/.test(url.pathname);
  if (
    !["/", "/about", "/explore", "/contact", "/privacy"].includes(url.pathname) &&
    !url.pathname.startsWith("/record/") &&
    !cmsCandidate
  ) return null;

  let title = "Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First";
  let description = "Nghiên cứu, đổi mới sáng tạo, tri thức và tác động cộng đồng.";
  let body = "";
  let canonical = url.origin + url.pathname;
  let noindex = false;
  let ogImage = url.origin + "/sky-first-logo.png";

  // Global SEO stays CMS-managed. Use the compatibility settings endpoint so SSR does
  // not need the heavier navigation/footer payload just to render metadata.
  try {
    const settingsResponse = await requestApi("/api/v1/public/settings");
    if (settingsResponse.ok) {
      const global = (await settingsResponse.json()).settings || {};
      title = global.global_seo_title || title;
      description = global.global_seo_description || global.description || description;
      const social = global.default_social_media_id || global.logo_media_id;
      if (social) ogImage = url.origin + "/api/v1/public/media/" + encodeURIComponent(social);
    }
  } catch {
    // Metadata falls back to static defaults; application errors are still surfaced by the page/API.
  }

  if (url.pathname.startsWith("/record/")) {
    const r = await requestApi("/api/v1/public/records/" + url.pathname.split("/")[2]);
    if (!r.ok)
      return new Response("Không tìm thấy nội dung", {
        status: 404,
        headers: { "content-type": "text/plain;charset=utf-8" },
      });
    const d = await r.json();
    title = d.item.title + " · SKY FIRST";
    description = d.item.summary;
    body = `<h1>${e(d.item.title)}</h1><p>${e(d.item.summary)}</p>${Object.values(d.item.data || {})
      .filter((v) => typeof v === "string")
      .map((v) => `<p>${e(v)}</p>`)
      .join("")}`;
  } else if (url.pathname !== "/explore") {
    const slug = url.pathname === "/" ? "home" : url.pathname.slice(1);
    const r = await requestApi("/api/v1/public/pages/" + encodeURIComponent(slug));
    if (r.ok) {
      const { page } = await r.json();
      title = page.seo_title || page.title || title;
      description = page.meta_description || page.description || description;
      canonical = page.canonical_url || canonical;
      noindex = !!page.noindex;
      if (page.social_media_id) ogImage = url.origin + "/api/v1/public/media/" + encodeURIComponent(page.social_media_id);
      body = cmsBody(page);
    } else if (!["/", "/about", "/contact", "/privacy"].includes(url.pathname)) {
      return new Response("Không tìm thấy trang", { status: 404, headers: { "content-type": "text/plain;charset=utf-8", "cache-control": "no-store" } });
    } else {
      const search = await requestApi("/api/v1/public/search" + url.search);
      if (search.ok) {
        const d = await search.json();
        body = `<h1>${e(title)}</h1><p>${e(description)}</p>${d.items.map((x) => `<article><h2><a href="/record/${e(x.id)}">${e(x.title)}</a></h2><p>${e(x.summary)}</p></article>`).join("")}`;
      }
    }
  } else {
    const r = await requestApi("/api/v1/public/search" + url.search);
    if (r.ok) {
      const d = await r.json();
      title = "Khám phá tri thức · SKY FIRST";
      description = "Đề tài, công bố, dữ liệu và nguồn lực nghiên cứu được chia sẻ bởi Trung tâm.";
      body = `<h1>${e(title)}</h1><p>${e(description)}</p>${d.items.map((x) => `<article><h2><a href="/record/${e(x.id)}">${e(x.title)}</a></h2><p>${e(x.summary)}</p></article>`).join("")}`;
    }
  }

  const asset = await env.ASSETS.fetch(new Request(new URL("/", url), request));
  let html = await asset.text();
  if (!asset.ok || !html.includes('src="/app.js"') || !html.includes('href="/style.css"'))
    return new Response("Không tải được giao diện. Kiểm tra Pages build output = public và ASSETS binding.", {
      status: 503,
      headers: { "content-type": "text/plain;charset=utf-8", "cache-control": "no-store" },
    });

  const robots = noindex ? '<meta name="robots" content="noindex,nofollow">' : '<meta name="robots" content="index,follow">';
  html = html
    .replace(/<title>.*?<\/title>/, `<title>${e(title)}</title>`)
    .replace(
      "</head>",
      `<link rel="canonical" href="${e(canonical)}"><meta property="og:url" content="${e(canonical)}"><meta property="og:image" content="${e(ogImage)}">${robots}</head>`,
    )
    .replace(/<meta\s+name="description"\s+content="[^"]*"\s*\/?>/, `<meta name="description" content="${e(description)}">`)
    .replace(/<meta\s+property="og:title"\s+content="[^"]*"\s*\/?>/, `<meta property="og:title" content="${e(title)}">`)
    .replace(/<meta\s+property="og:description"\s+content="[^"]*"\s*\/?>/, `<meta property="og:description" content="${e(description)}">`)
    .replace(/<div id="app">\s*<div class="loading">[^<]*<\/div>\s*<\/div>/, '<div id="app"><article class="article">' + body + "</article></div>");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

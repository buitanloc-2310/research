const e = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export async function seo(request, env, requestApi) {
  const url = new URL(request.url);
  if (request.method !== "GET") return null;
  if (url.pathname === "/robots.txt")
    return new Response(
      `User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: ${url.origin}/sitemap.xml\n`,
      { headers: { "content-type": "text/plain" } },
    );
  if (url.pathname === "/sitemap.xml") {
    const paths = ["/", "/about", "/explore", "/contact"];
    let page = 1;
    for (;;) {
      const r = await requestApi("/api/v1/public/search?page=" + page);
      if (!r.ok) break;
      const d = await r.json();
      paths.push(...d.items.map((x) => "/record/" + x.id));
      if (page++ * 24 >= d.total || page > 400) break;
    }
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
        paths
          .map((p) => `<url><loc>${e(url.origin + p)}</loc></url>`)
          .join("") +
        "</urlset>",
      {
        headers: {
          "content-type": "application/xml",
          "cache-control": "public,max-age=300",
        },
      },
    );
  }
  if (
    !["/", "/about", "/explore", "/contact", "/privacy"].includes(
      url.pathname,
    ) &&
    !url.pathname.startsWith("/record/")
  )
    return null;
  let title = "SKY FIRST · Trung tâm Nghiên cứu & Đổi mới Sáng tạo",
    description = "Kết nối ý tưởng, nghiên cứu và tác động cộng đồng.",
    body = "";
  const endpoint = url.pathname.startsWith("/record/")
    ? "/api/v1/public/records/" + url.pathname.split("/")[2]
    : "/api/v1/public/search" + url.search;
  const r = await requestApi(endpoint);
  if (url.pathname.startsWith("/record/") && !r.ok)
    return new Response("Không tìm thấy nội dung", {
      status: 404,
      headers: { "content-type": "text/plain;charset=utf-8" },
    });
  if (r.ok) {
    const d = await r.json();
    if (d.item) {
      title = d.item.title + " · SKY FIRST";
      description = d.item.summary;
      body = `<h1>${e(d.item.title)}</h1><p>${e(d.item.summary)}</p>${Object.values(
        d.item.data,
      )
        .filter((v) => typeof v === "string")
        .map((v) => `<p>${e(v)}</p>`)
        .join("")}`;
    } else
      body =
        "<h1>" +
        title +
        "</h1><p>" +
        description +
        "</p>" +
        d.items
          .map(
            (x) =>
              `<article><h2><a href="/record/${x.id}">${e(x.title)}</a></h2><p>${e(x.summary)}</p></article>`,
          )
          .join("");
  }
  const asset = await env.ASSETS.fetch(
    new Request(new URL("/index.html", url), request),
  );
  let html = await asset.text();
  html = html
    .replace(/<title>.*?<\/title>/, `<title>${e(title)}</title>`)
    .replace(
      "</head>",
      `<link rel="canonical" href="${e(url.origin + url.pathname)}"><meta property="og:url" content="${e(url.origin + url.pathname)}"><meta property="og:image" content="${e(url.origin)}/mark.svg"></head>`,
    )
    .replace(
      /<meta name="description" content="[^"]*">/,
      `<meta name="description" content="${e(description)}">`,
    )
    .replace(
      /<meta property="og:title" content="[^"]*">/,
      `<meta property="og:title" content="${e(title)}">`,
    )
    .replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${e(description)}">`,
    )
    .replace(
      '<div id="app"><div class="loading">Đang mở không gian nghiên cứu…</div></div>',
      '<div id="app"><article class="article">' + body + "</article></div>",
    );
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

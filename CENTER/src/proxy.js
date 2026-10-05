import { seo } from "./seo.js";
import {
  boundedBody,
  hmac,
  hash,
  canonical,
  uuid,
  secure,
  fail,
} from "./security.js";
export async function proxy(request, env) {
  try {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      const rendered = await seo(request, env, (path) =>
        proxy(new Request(new URL(path, request.url)), env),
      );
      return secure(rendered || (await env.ASSETS.fetch(request)));
    }
    if (
      !env.DATA_API_URL?.startsWith("https://") ||
      !env.API_SHARED_SECRET ||
      env.API_SHARED_SECRET.length < 32
    )
      fail(503, "Chưa cấu hình kết nối Data API.");
    const headers = new Headers();
    for (const k of ["cookie", "origin", "content-type", "x-requested-with"])
      if (request.headers.has(k)) headers.set(k, request.headers.get(k));
    headers.set(
      "x-client-ip",
      request.headers.get("cf-connecting-ip") || "unknown",
    );
    const bytes = await boundedBody(request, 11 * 1024 * 1024),
      time = String(Math.floor(Date.now() / 1000)),
      nonce = uuid();
    const target = new URL(url.pathname + url.search, env.DATA_API_URL);
    const next = new Request(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : bytes,
      redirect: "manual",
    });
    const signature = await hmac(
      env.API_SHARED_SECRET,
      canonical(next, time, nonce, await hash(bytes)),
    );
    next.headers.set("x-api-time", time);
    next.headers.set("x-api-nonce", nonce);
    next.headers.set("x-api-signature", signature);
    const timeout = AbortSignal.timeout(30000);
    return secure(await fetch(next, { signal: timeout }));
  } catch (e) {
    return secure(
      Response.json(
        {
          error: e.status
            ? e.message
            : "Không kết nối được Data API. Kiểm tra kết quả trước khi thử lại.",
        },
        { status: e.status || 502, headers: { "cache-control": "no-store" } },
      ),
    );
  }
}
export default { fetch: proxy };

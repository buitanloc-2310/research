import { seo } from "./seo.js";
import { api, publicFile } from "./api.js";
import {
  hmac,
  hash,
  canonical,
  equal,
  boundedBody,
  secure,
  uuid,
  fail,
} from "./security.js";
import { run } from "./db.js";
export async function fetchHandler(request, env) {
  try {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      if (env.MODE === "data")
        return new Response("Not found", { status: 404 });
      const rendered = await seo(request, env, (path) =>
        fetchHandler(new Request(new URL(path, request.url)), env),
      );
      return secure(rendered || (await env.ASSETS.fetch(request)));
    }
    if (env.MODE === "data") {
      if (!env.API_SHARED_SECRET || env.API_SHARED_SECRET.length < 32)
        fail(503, "API secret chưa được cấu hình.");
      const time = request.headers.get("x-api-time"),
        nonce = request.headers.get("x-api-nonce"),
        sig = request.headers.get("x-api-signature");
      if (
        !/^\d+$/.test(time || "") ||
        Math.abs(Date.now() / 1000 - Number(time)) > 60 ||
        !/^[-a-f0-9]{36}$/.test(nonce || "")
      )
        fail(401, "API authentication failed.");
      const bytes = await boundedBody(request, 11 * 1024 * 1024),
        digest = await hash(bytes);
      if (
        !equal(
          sig,
          await hmac(
            env.API_SHARED_SECRET,
            canonical(request, time, nonce, digest),
          ),
        )
      )
        fail(401, "API authentication failed.");
      try {
        await run(
          env,
          "INSERT INTO nonces(id,expires) VALUES(?,?)",
          nonce,
          Math.floor(Date.now() / 1000) + 120,
        );
      } catch {
        fail(409, "API replay rejected.");
      }
      request = new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: ["GET", "HEAD"].includes(request.method) ? undefined : bytes,
      });
    }
    const pub = request.url.match(/\/api\/(?:v1\/)?public\/files\/([^/?]+)/);
    const response = pub
      ? await publicFile(request, env, pub[1])
      : await api(request, env);
    return secure(response);
  } catch (e) {
    const status =
      e.status || (/UNIQUE constraint/i.test(e.message) ? 409 : 500);
    const requestId = uuid();
    if (status === 500)
      console.error(
        JSON.stringify({ requestId, error: String(e.message).slice(0, 200) }),
      );
    return secure(
      Response.json(
        {
          error:
            status === 500
              ? "Lỗi máy chủ. Vui lòng cung cấp mã yêu cầu cho quản trị."
              : status === 409 && !e.status
                ? "Dữ liệu trùng hoặc đã được xử lý."
                : e.message,
          request_id: requestId,
        },
        { status, headers: { "cache-control": "no-store" } },
      ),
    );
  }
}
export default {
  fetch: fetchHandler,
  async scheduled(event, env) {
    const n = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      "UPDATE records SET status='expired',version=version+1,updated_at=CURRENT_TIMESTAMP WHERE kind='ethics' AND status='approved' AND json_extract(data,'$.expires')<date('now')",
    ).run();
    await env.DB.batch(
      ["sessions", "reset_tokens", "rate_limits", "nonces"].map((t) =>
        env.DB.prepare(`DELETE FROM ${t} WHERE expires<?`).bind(n),
      ),
    );
    await env.DB.prepare(
      `INSERT INTO notifications(id,user_id,title,record_id) SELECT lower(hex(randomblob(16))),owner_id,'Sắp đến hạn: '||title,id FROM records r WHERE deleted=0 AND kind IN ('tasks','milestones') AND status NOT IN ('completed','archived') AND json_extract(data,'$.due')=date('now','+1 day') AND NOT EXISTS(SELECT 1 FROM notifications n WHERE n.record_id=r.id AND n.title='Sắp đến hạn: '||r.title AND date(n.created_at)=date('now'))`,
    ).run();
  },
};

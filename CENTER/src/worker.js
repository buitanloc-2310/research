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
import { flushOutbox } from "./notifications.js";
export async function fetchHandler(request, env) {
  try {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      if (env.MODE === "data")
        return new Response("Not found", { status: 404 });
      const rendered = await seo(request, env, (path) =>
        fetchHandler(new Request(new URL(path, request.url)), {...env, SKIP_BACKGROUND:true}),
      );
      return secure(rendered || (await env.ASSETS.fetch(request)));
    }
    if (url.pathname === "/api/v1/maintenance") {
      if (request.method !== "POST" || !env.MAINTENANCE_SECRET || env.MAINTENANCE_SECRET.length<32 || !equal(request.headers.get("authorization"),`Bearer ${env.MAINTENANCE_SECRET}`)) fail(403,"Forbidden");
      await maintenance(env);
      return secure(Response.json(await flushOutbox(env)));
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
    // Transactional email is flushed after the business transaction succeeds.
    if (!env.SKIP_BACKGROUND) {
      const delivery = maintenance(env).then(()=>flushOutbox(env)).catch(()=>console.error("background_job_failed"));
      if (env.WAIT_UNTIL) env.WAIT_UNTIL(delivery); else await delivery;
    }
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
export async function maintenance(env, force=false) {
    const n = Math.floor(Date.now() / 1000), token=uuid();
    const lock=await env.DB.prepare("INSERT INTO job_locks(name,token,expires) VALUES('maintenance',?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE job_locks.expires<?").bind(token,n+3600,n).run();
    if (!lock.meta?.changes && !force) return;
    try {
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
    } catch(e) {
      await env.DB.prepare("DELETE FROM job_locks WHERE name='maintenance' AND token=?").bind(token).run();
      throw e;
    }
}
export default {fetch:fetchHandler, async scheduled(event,env) {await maintenance(env,true);await flushOutbox(env);}};

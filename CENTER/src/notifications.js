import { uuid } from "./security.js";

const BRAND = "Sky First Research & Innovation Center";
const FROM_DEFAULT = "Sky First Research & Innovation Center <research@skyfirst.io.vn>";
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

export function emailHtml({ title, message = "", actionUrl = "", actionLabel = "Mở hệ thống", footer = "Email tự động từ Trung tâm Nghiên cứu & Đổi mới Sáng tạo Sky First." }) {
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e7edf5"><tr><td style="padding:26px 30px;background:#0b2b55;color:#fff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700">SKY FIRST</div><div style="font-size:20px;font-weight:800;margin-top:5px">RESEARCH &amp; INNOVATION</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:23px;margin:0 0 16px">${esc(title)}</h1><div style="font-size:15px;line-height:1.7;color:#40536d">${esc(message).replace(/\n/g,"<br>")}</div>${actionUrl ? `<p style="margin:26px 0 8px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#0b2b55;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${esc(actionLabel)}</a></p>` : ""}</td></tr><tr><td style="padding:18px 30px;background:#f8fafc;color:#718096;font-size:12px;line-height:1.6">${esc(footer)}<br>research@skyfirst.io.vn</td></tr></table></td></tr></table></body></html>`;
}

export async function queueEmail(env, { userId = null, recipient = null, subject, title = subject, message = "", actionUrl = "", actionLabel = "Mở hệ thống", type = "transactional" }) {
  if (!env.DB || !subject) return;
  return env.DB.prepare("INSERT INTO outbox(id,user_id,recipient,subject,payload,status) VALUES(?,?,?,?,?,'pending')")
    .bind(uuid(), userId, recipient, subject, JSON.stringify({ title, message, actionUrl, actionLabel, type }))
    .run();
}

export async function adminAlert(env, subject, message, actionUrl = "") {
  if (!env.ADMIN_ALERT_EMAIL) return;
  return queueEmail(env, { recipient: env.ADMIN_ALERT_EMAIL, subject, title: subject, message, actionUrl, type: "admin_alert" });
}

async function resend(env, to, subject, payload) {
  if (!env.RESEND_API_KEY) return { delivered: false, reason: "resend_not_configured" };
  const data = typeof payload === "string" ? JSON.parse(payload || "{}") : (payload || {});
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "authorization": `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.EMAIL_FROM || FROM_DEFAULT,
      to: [to],
      reply_to: env.EMAIL_REPLY_TO || "research@skyfirst.io.vn",
      subject,
      html: emailHtml({ title: data.title || subject, message: data.message || subject, actionUrl: data.actionUrl || "", actionLabel: data.actionLabel || "Mở hệ thống" }),
    }),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Resend ${response.status}: ${body.slice(0,300)}`);
  return { delivered: true };
}

export async function flushOutbox(env, limit = 12) {
  if (!env.RESEND_API_KEY || !env.DB) return { delivered: 0, skipped: true };
  const rows = (await env.DB.prepare("SELECT o.*,u.email user_email FROM outbox o LEFT JOIN users u ON u.id=o.user_id WHERE o.status='pending' AND o.attempts<5 ORDER BY o.created_at LIMIT ?").bind(limit).all()).results || [];
  let delivered = 0;
  for (const row of rows) {
    const to = row.recipient || row.user_email;
    if (!to) {
      await env.DB.prepare("UPDATE outbox SET status='failed',last_error='recipient_missing',attempts=attempts+1 WHERE id=?").bind(row.id).run();
      continue;
    }
    try {
      await resend(env, to, row.subject, row.payload);
      await env.DB.prepare("UPDATE outbox SET status='sent',sent_at=CURRENT_TIMESTAMP,last_error=NULL,attempts=attempts+1 WHERE id=? AND status='pending'").bind(row.id).run();
      delivered++;
    } catch (e) {
      await env.DB.prepare("UPDATE outbox SET attempts=attempts+1,last_error=?,status=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'pending' END WHERE id=?").bind(String(e.message).slice(0,500), row.id).run();
    }
  }
  return { delivered, checked: rows.length };
}

export async function deliverEmail(message, adapter) {
  if (!adapter || typeof adapter.send !== "function") return { delivered: false, reason: "adapter_not_configured" };
  return adapter.send(message);
}

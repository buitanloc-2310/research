import { uuid } from "./security.js";

const BRAND = "Sky First Research & Innovation Center";
const FROM_DEFAULT = "Sky First Research & Innovation Center <research@skyfirst.io.vn>";
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]);

export function emailHtml({ title, message = "", actionUrl = "", actionLabel = "Mở hệ thống", footer = "Email tự động từ Trung tâm Nghiên cứu Đổi mới & Sáng tạo Sky First." }) {
  if (actionUrl && !/^https?:\/\//i.test(actionUrl)) actionUrl = "";
  return `<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(title)}</title></head><body style="margin:0;background:#f4f7fb;font-family:Arial,sans-serif;color:#10233f"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 12px"><table role="presentation" width="100%" style="max-width:620px;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #e7edf5"><tr><td style="padding:26px 30px;background:#0b2b55;color:#fff"><img src="https://research.skyfirst.io.vn/sky-first-logo.png" width="80" alt="SKY FIRST" style="display:block;height:auto;margin-bottom:14px"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700">SKY FIRST</div><div style="font-size:20px;font-weight:800;margin-top:5px">RESEARCH &amp; INNOVATION</div></td></tr><tr><td style="padding:32px 30px"><h1 style="font-size:23px;margin:0 0 16px">${esc(title)}</h1><div style="font-size:15px;line-height:1.7;color:#40536d">${esc(message).replace(/\n/g,"<br>")}</div>${actionUrl ? `<p style="margin:26px 0 8px"><a href="${esc(actionUrl)}" style="display:inline-block;background:#0b2b55;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">${esc(actionLabel)}</a></p>` : ""}</td></tr><tr><td style="padding:18px 30px;background:#f8fafc;color:#718096;font-size:12px;line-height:1.6">${esc(footer)}<br>research@skyfirst.io.vn</td></tr></table></td></tr></table></body></html>`;
}

export async function queueEmail(env, { userId = null, recipient = null, subject, title = subject, message = "", actionUrl = "", actionLabel = "Mở hệ thống", type = "transactional", expiresAt = null }) {
  if (!env.DB || !subject) return;
  return env.DB.prepare("INSERT INTO outbox(id,user_id,recipient,subject,payload,status) VALUES(?,?,?,?,?,'pending')")
    .bind(uuid(), userId, recipient, subject, JSON.stringify({ title, message, actionUrl, actionLabel, type, expires_at: expiresAt }))
    .run();
}

export async function adminAlert(env, subject, message, actionUrl = "") {
  if (!env.ADMIN_ALERT_EMAIL) return;
  return queueEmail(env, { recipient: env.ADMIN_ALERT_EMAIL, subject, title: subject, message, actionUrl, type: "admin_alert" });
}

// A DB lease serializes senders across Pages isolates. Resend idempotency handles
// crashes after provider acceptance; the exact wire body is frozen per job.
export async function flushOutbox(env, limit = 4) {
  if (!env.RESEND_API_KEY || !env.DB) return { delivered: 0, skipped: true };
  const now = Math.floor(Date.now()/1000), token = uuid();
  const lock = await env.DB.prepare("INSERT INTO job_locks(name,token,expires) VALUES('email',?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE job_locks.expires<?").bind(token,now+60,now).run();
  if (!lock.meta?.changes) return {delivered:0, busy:true};
  let delivered=0, checked=0;
  try {
    const rows = (await env.DB.prepare("SELECT o.*,u.email user_email,u.active FROM outbox o LEFT JOIN users u ON u.id=o.user_id WHERE o.status='pending' AND o.attempts<5 AND o.next_attempt_at<=? ORDER BY o.created_at LIMIT ?").bind(now,Math.min(4,Math.max(1,limit))).all()).results || [];
    for (const row of rows) {
      checked++;
      const to = row.recipient || row.user_email;
      if (!to || (row.user_id && !row.active) || (row.first_attempt_at && now-row.first_attempt_at>=23*3600)) {
        await env.DB.prepare("UPDATE outbox SET status='failed',last_error=? WHERE id=?").bind(!to?'recipient_missing':row.user_id&&!row.active?'account_inactive':'idempotency_window_expired',row.id).run();
        continue;
      }
      try {
        const data=JSON.parse(row.payload || '{}');
        if (data.type==='password_reset' && data.expires_at<=now) {
          await env.DB.prepare("UPDATE outbox SET status='failed',last_error='reset_link_expired',payload='{}',request_body=NULL WHERE id=?").bind(row.id).run();
          continue;
        }
        const actionUrl=data.actionUrl || (data.record_id ? `${env.APP_ORIGIN}/#w/detail/${encodeURIComponent(data.record_id)}` : `${env.APP_ORIGIN}/#w/notifications`);
        const wire = row.request_body || JSON.stringify({from:env.EMAIL_FROM || FROM_DEFAULT,to:[to],reply_to:env.EMAIL_REPLY_TO || "research@skyfirst.io.vn",subject:row.subject,html:emailHtml({title:data.title || row.subject,message:data.message || row.subject,actionUrl,actionLabel:data.actionLabel || "Mở hệ thống"})});
        await env.DB.prepare("UPDATE outbox SET request_body=?,first_attempt_at=COALESCE(first_attempt_at,?),attempts=attempts+1 WHERE id=?").bind(wire,now,row.id).run();
        const response = await (env.EMAIL_FETCH || fetch)("https://api.resend.com/emails", {method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json','Idempotency-Key':`sfrc-${row.id}`},body:wire,signal:AbortSignal.timeout(5000)});
        if (!response.ok) {
          const error = new Error(`Resend HTTP ${response.status}`);
          error.permanent = response.status>=400 && response.status<500 && ![408,409,429].includes(response.status);
          const retry=response.headers.get('retry-after');
          error.delay=Math.min(3600,Math.max(0,Number(retry) || (Date.parse(retry)-Date.now())/1000 || 0));
          throw error;
        }
        const receipt=await response.json();
        if (!receipt.id) throw new Error('Resend invalid receipt');
        await env.DB.prepare("UPDATE outbox SET status='sent',provider_id=?,sent_at=CURRENT_TIMESTAMP,last_error=NULL,request_body=NULL,payload=CASE WHEN json_extract(payload,'$.type')='password_reset' THEN '{}' ELSE payload END WHERE id=?").bind(receipt.id,row.id).run();
        delivered++;
      } catch (error) {
        const delay=Math.max(error.delay || 0,60*2**row.attempts);
        await env.DB.prepare("UPDATE outbox SET last_error=?,next_attempt_at=?,status=CASE WHEN attempts>=5 OR ? THEN 'failed' ELSE 'pending' END WHERE id=?").bind(String(error.message).slice(0,160),now+Math.ceil(delay),error.permanent?1:0,row.id).run();
      }
      // Respect Resend's default account throughput; bounded batch fits waitUntil.
      if (checked<rows.length && !env.EMAIL_FETCH) await new Promise(r=>setTimeout(r,550));
    }
    return {delivered,checked};
  } finally {
    await env.DB.prepare("DELETE FROM job_locks WHERE name='email' AND token=?").bind(token).run();
  }
}

export async function deliverEmail(message, adapter) {
  if (!adapter || typeof adapter.send !== "function") return { delivered: false, reason: "adapter_not_configured" };
  return adapter.send(message);
}

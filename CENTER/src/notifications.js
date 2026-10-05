// Transactional email adapter boundary. No email is claimed as delivered without a configured sender.
import { uuid } from "./security.js";
export async function queueEmail(env, userId, subject, payload) {
  return env.DB.prepare(
    "INSERT INTO outbox(id,user_id,subject,payload) VALUES(?,?,?,?)",
  )
    .bind(uuid(), userId, subject, JSON.stringify(payload))
    .run();
}
export async function deliverEmail(message, adapter) {
  if (!adapter || typeof adapter.send !== "function")
    return { delivered: false, reason: "adapter_not_configured" };
  return adapter.send(message);
}

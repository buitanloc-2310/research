const enc = new TextEncoder();
export const uuid = () => crypto.randomUUID();
export const hex = (b) =>
  Array.from(new Uint8Array(b), (v) => v.toString(16).padStart(2, "0")).join(
    "",
  );
export const hash = async (value) =>
  hex(
    await crypto.subtle.digest(
      "SHA-256",
      typeof value === "string" ? enc.encode(value) : value,
    ),
  );
export const random = () => hex(crypto.getRandomValues(new Uint8Array(32)));
export const PASSWORD_PBKDF2_ITERATIONS = 100000;
export function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
export async function passwordHash(password, salt = random()) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 200
  )
    fail(400, "Mật khẩu phải dài 12–200 ký tự.");
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const result = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: PASSWORD_PBKDF2_ITERATIONS,
      salt: enc.encode(salt),
    },
    k,
    256,
  );
  return `${salt}:${hex(result)}`;
}
export async function verifyPassword(p, stored) {
  if (typeof p !== "string" || p.length < 12 || p.length > 200) return false;
  return equal(await passwordHash(p, stored.split(":")[0]), stored);
}
export function equal(a, b) {
  a = String(a || "");
  b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
export async function hmac(secret, value) {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return hex(await crypto.subtle.sign("HMAC", k, enc.encode(value)));
}
export const canonical = (r, t, n, digest) =>
  [
    r.method,
    new URL(r.url).pathname + new URL(r.url).search,
    t,
    n,
    digest,
    r.headers.get("cookie") || "",
    r.headers.get("origin") || "",
    r.headers.get("x-requested-with") || "",
    r.headers.get("x-client-ip") || "",
    r.headers.get("content-type") || "",
  ].join("\n");
export async function boundedBody(req, max) {
  if (Number(req.headers.get("content-length") || 0) > max)
    fail(413, "Tệp hoặc yêu cầu quá lớn.");
  if (!req.body) return new Uint8Array();
  let length = 0,
    parts = [];
  const reader = req.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      fail(413, "Tệp hoặc yêu cầu quá lớn.");
    }
    parts.push(value);
  }
  const out = new Uint8Array(length);
  let i = 0;
  for (const p of parts) {
    out.set(p, i);
    i += p.length;
  }
  return out;
}
export const secureHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "content-security-policy":
    "default-src 'self'; script-src 'self' https://static.cloudflareinsights.com; style-src 'self'; img-src 'self' data:; connect-src 'self' https://cloudflareinsights.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
};
export function secure(response) {
  const h = new Headers(response.headers);
  for (const [k, v] of Object.entries(secureHeaders)) h.set(k, v);
  return new Response(response.body, { status: response.status, headers: h });
}

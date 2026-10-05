import { readFileSync, writeFileSync } from "node:fs";
const e = process.env;
const required = ["APP_ORIGIN", "D1_DATABASE_ID", "R2_BUCKET_NAME"];
if (required.some((k) => !e[k]))
  throw Error("Required environment variables: " + required.join(", "));
if (!/^https:\/\/[^/]+$/.test(e.APP_ORIGIN))
  throw Error("APP_ORIGIN must be HTTPS origin without trailing slash.");
for (const name of [
  "wrangler.jsonc",
  "wrangler.data.jsonc",
  "wrangler.app.jsonc",
]) {
  const c = JSON.parse(readFileSync(name));
  if (c.d1_databases) {
    c.d1_databases[0].database_id = e.D1_DATABASE_ID;
    c.d1_databases[0].database_name = e.D1_DATABASE_NAME || "tt";
    c.r2_buckets[0].bucket_name = e.R2_BUCKET_NAME;
    c.vars.APP_ORIGIN = e.APP_ORIGIN;
  }
  if (name === "wrangler.app.jsonc") {
    if (!e.DATA_API_URL?.startsWith("https://"))
      throw Error("DATA_API_URL is required for split deployment.");
    c.vars.DATA_API_URL = e.DATA_API_URL;
  }
  writeFileSync(name, JSON.stringify(c, null, 2) + "\n");
}
console.log(
  "Wrangler placeholders updated. Secrets are NOT written to configs.",
);

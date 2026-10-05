// Production bindings are intentionally pinned to the existing Pages project.
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("wrangler.jsonc"));
if (c.d1_databases[0].database_id !== "ddcc0aa9-cbd3-4a7c-ad9d-dc226456eef1" || c.r2_buckets[0].bucket_name !== "ttrungtam") throw Error("Unexpected production bindings");
console.log("Pages configuration validated. Set secrets through Cloudflare; no config was rewritten.");

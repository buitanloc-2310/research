// Production bindings are intentionally pinned to the existing Pages project.
import { readFileSync } from "node:fs";
const c = JSON.parse(readFileSync("wrangler.jsonc"));
if (c.d1_databases[0].database_id !== "0a75531f-b227-4a8b-bc26-dda1cc9a0004" || c.r2_buckets[0].bucket_name !== "ttrungtam") throw Error("Unexpected production bindings");
console.log("Pages configuration validated. Set secrets through Cloudflare; no config was rewritten.");

import { readdirSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
for (const dir of ["src", "public", "scripts", "functions"])
  for (const f of readdirSync(dir))
    if (/\.(js|mjs)$/.test(f))
      execFileSync(process.execPath, ["--check", dir + "/" + f]);
for (const f of ["wrangler.jsonc", "wrangler.data.jsonc", "wrangler.app.jsonc", "wrangler.pages.jsonc", "wrangler.worker.jsonc"])
  JSON.parse(readFileSync(f, "utf8"));
console.log(
  "Build passed: source syntax and deployment configs. Vanilla modules require no asset bundling.",
);

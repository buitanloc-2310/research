import http from "node:http";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { database, diskStorage } from "./runtime.mjs";
import { fetchHandler } from "../src/worker.js";
mkdirSync(".local", { recursive: true });
const port = Number(process.env.PORT || 8787);
const origin = "http://localhost:" + port;
const env = {
  ...process.env,
  MODE: "single",
  APP_ORIGIN: origin,
  DB: database(".local/data.sqlite").DB,
  STORAGE: diskStorage(".local/storage"),
  ASSETS: {
    async fetch(req) {
      let path = decodeURIComponent(new URL(req.url).pathname);
      let file = resolve("public", "." + path);
      if (
        !file.startsWith(resolve("public") + "/") ||
        !existsSync(file) ||
        !extname(file)
      )
        file = resolve("public/index.html");
      const mime = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".svg": "image/svg+xml",
        ".txt": "text/plain",
        ".xml": "application/xml",
      };
      return new Response(readFileSync(file), {
        headers: {
          "content-type": mime[extname(file)] || "application/octet-stream",
        },
      });
    },
  },
};
http
  .createServer(async (req, res) => {
    try {
      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers))
        if (v) headers.set(k, Array.isArray(v) ? v.join(",") : v);
      const chunks = [];
      let n = 0;
      for await (const b of req) {
        n += b.length;
        if (n > 12 * 1024 * 1024) {
          res.writeHead(413);
          res.end();
          return;
        }
        chunks.push(b);
      }
      const request = new Request(origin + req.url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const r = await fetchHandler(request, env);
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    } catch (e) {
      res.writeHead(500);
      res.end("Local runtime error");
      console.error(e);
    }
  })
  .listen(port, () =>
    console.log("Local server: " + origin + " (local SQLite + disk storage)"),
  );

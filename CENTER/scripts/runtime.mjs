import { DatabaseSync } from "node:sqlite";
import { readFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
export function database(path = ":memory:") {
  const sqlite = new DatabaseSync(path);
  sqlite.exec("PRAGMA foreign_keys=ON;");
  sqlite.exec("CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY)");
  for (const name of readdirSync(new URL("../migrations/", import.meta.url))
    .filter((x) => x.endsWith(".sql"))
    .sort())
    if (!sqlite.prepare("SELECT 1 FROM _migrations WHERE name=?").get(name)) {
      sqlite.exec("BEGIN");
      try {
        sqlite.exec(
          readFileSync(
            new URL("../migrations/" + name, import.meta.url),
            "utf8",
          ),
        );
        sqlite.prepare("INSERT INTO _migrations VALUES(?)").run(name);
        sqlite.exec("COMMIT");
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    }
  const DB = {
    prepare(sql) {
      let args = [];
      return {
        bind(...a) {
          args = a;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...args) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...args) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...args);
          return {
            success: true,
            meta: { changes: Number(result.changes) },
            results: [],
          };
        },
        _run() {
          if (/^\s*(SELECT|WITH)/i.test(sql))
            return {
              results: sqlite.prepare(sql).all(...args),
              meta: { changes: 0 },
            };
          if (/\bRETURNING\b/i.test(sql)) {
            const results = sqlite.prepare(sql).all(...args);
            return { results, meta: { changes: results.length } };
          }
          const r = sqlite.prepare(sql).run(...args);
          return {
            success: true,
            results: [],
            meta: { changes: Number(r.changes) },
          };
        },
      };
    },
    async batch(items) {
      sqlite.exec("BEGIN");
      try {
        const results = items.map((q) => q._run());
        sqlite.exec("COMMIT");
        return results;
      } catch (e) {
        sqlite.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return { DB, sqlite };
}
export function memoryStorage() {
  const files = new Map();
  return {
    async put(k, b, meta) {
      files.set(k, { b: new Uint8Array(b), meta });
    },
    async get(k) {
      const x = files.get(k);
      return x ? { body: x.b } : null;
    },
    async delete(k) {
      files.delete(k);
    },
  };
}
export function diskStorage(root) {
  mkdirSync(root, { recursive: true });
  return {
    async put(key, bytes) {
      const { writeFile } = await import("node:fs/promises");
      const p = join(root, key);
      mkdirSync(join(p, ".."), { recursive: true });
      await writeFile(p, new Uint8Array(bytes));
    },
    async get(key) {
      const p = join(root, key);
      if (!existsSync(p)) return null;
      return { body: readFileSync(p) };
    },
    async delete(key) {
      const { rm } = await import("node:fs/promises");
      await rm(join(root, key), { force: true });
    },
  };
}

import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import assert from "node:assert/strict";
import { database } from "../scripts/runtime.mjs";
import { seed } from "../scripts/seed.mjs";
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const password = process.env.DEMO_PASSWORD || crypto.randomUUID();
mkdirSync(".local", { recursive: true });
const db = database(".local/data.sqlite");
await seed(db.DB, password);
// Seed intentionally preserves existing accounts: use a dedicated test account password in local QA only.
const { passwordHash } = await import("../src/security.js");
await db.DB.prepare("UPDATE users SET password=? WHERE id='demo-admin'")
  .bind(await passwordHash(password))
  .run();
const server = spawn(process.execPath, ["scripts/local.mjs"], {
  env: { ...process.env, PORT: "8877" },
  stdio: "pipe",
});
let browser;
try {
  await new Promise((resolve, reject) => {
    server.stdout.on("data", () => resolve());
    server.on("exit", () => reject(Error("Server failed")));
  });
  browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  page.setDefaultTimeout(12000);
  page.setDefaultNavigationTimeout(12000);
  page.on("dialog", (d) => d.accept());
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://localhost:8877");
  await page.waitForSelector(".hero");
  assert.equal(await page.locator(".hero h1").count(), 1);
  mkdirSync(process.env.SCREENSHOT_DIR || ".local/screenshots", {
    recursive: true,
  });
  const screenshot = async (name) =>
    page.screenshot({
      path:
        (process.env.SCREENSHOT_DIR || ".local/screenshots") +
        "/" +
        name +
        ".png",
      fullPage: true,
    });
  await screenshot("public-desktop");
  await page.goto("http://localhost:8877/#login");
  await page.locator("[name=email]").fill("demo-admin@example.test");
  await page.locator("[name=password]").fill(password);
  await page.locator("#authForm button[type=submit]").click();
  await page.waitForSelector(".stats");
  await screenshot("workspace-desktop");
  const routes = [
    "ideas",
    "projects",
    "teams",
    "tasks",
    "journals",
    "documents",
    "datasets",
    "councils",
    "acceptances",
    "publications",
    "budgets",
    "events",
    "contributions",
    "impacts",
    "profiles",
    "milestones",
    "ethics",
    "forms",
    "partners",
    "collaborations",
    "news",
    "pages",
    "challenges",
    "journey",
    "reviews",
    "notifications",
    "email",
    "security",
    "users",
    "roles",
    "settings",
    "audit",
    "export",
    "notices",
    "finance",
    "storage",
  ];
  for (const route of routes) {
    await page.goto("http://localhost:8877/#w/" + route);
    await page.waitForTimeout(120);
    await page.waitForFunction(() => !document.querySelector("#main .loading"));
    assert.equal(await page.locator(".error-panel").count(), 0, route);
    assert.equal(await page.locator("#main h1").count(), 1, route);
  }
  await page.goto("http://localhost:8877/#w/detail/demo-projects");
  await page.waitForSelector("[data-tab=journey]");
  await page.locator("[data-tab=journey]").click();
  assert.equal(await page.locator(".journey-step").count(), 15);
  await screenshot("journey-desktop");
  await page.locator('[data-step="0"]').click();
  await page.waitForSelector("#journeyForm");
  await page.locator("#journeyForm [name=note]").fill("Browser QA note");
  await page.route("**/api/v1/records/demo-projects", async route => {
    if (route.request().method() === "GET") await new Promise(r=>setTimeout(r,250));
    await route.continue();
  });
  await page.locator("#journeyForm button[type=submit]").click();
  await page.waitForFunction(() => !document.querySelector("dialog").open);
  console.log("Journey updated");
  await page.goto("http://localhost:8877/#w/ideas");
  await page.waitForSelector("#newRecord");
  await page.waitForTimeout(350); // The delayed detail response must not replace the new route.
  await page.locator("#newRecord").click();
  await page.locator("#recordForm [name=title]").fill("Browser QA Idea");
  await page
    .locator("#recordForm [name=summary]")
    .fill("Created through browser");
  await page.locator("#recordForm button[type=submit]").click();
  await page.waitForSelector("#transitionForm");
  assert.equal(await page.locator("h1").innerText(), "Browser QA Idea");
  console.log("Idea created");
  await page.goto("http://localhost:8877/#w/forms");
  await page.waitForSelector("#newRecord");
  await page.locator("#newRecord").click();
  await page.locator("#recordForm [name=title]").fill("Browser QA Form");
  await page.locator("#addField").click();
  await page.locator("[data-key=label]").fill("Feedback");
  await page.locator("#recordForm [name=summary]").click();
  await page.locator("#recordForm button[type=submit]").click();
  await page.waitForSelector("#fillForm");
  console.log("Form created");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("http://localhost:8877/#w/dashboard");
  await page.waitForSelector(".stats");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  );
  await screenshot("workspace-mobile");
  await page.locator("#menu").click();
  assert(
    await page
      .locator("#sidebar")
      .evaluate((el) => el.classList.contains("open")),
  );
  await page.goto("http://localhost:8877");
  await page.waitForSelector(".hero");
  assert(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
  );
  await screenshot("public-mobile");
  await page.goto("http://localhost:8877/#w/settings");
  await page.waitForSelector("#settingsForm");
  await page.locator(".theme").click();
  assert(
    await page.locator("html").evaluate((el) => el.classList.contains("dark")),
  );
  await screenshot("settings-dark-mobile");
  assert.deepEqual(errors, []);
  console.log(
    "Browser QA passed: public, login, 36 workspace/admin routes, Journey update, idea create, Form Builder, mobile overflow, dark mode.",
  );
} finally {
  await browser?.close();
  server.kill();
}

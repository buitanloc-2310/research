import { fetchHandler } from "../src/worker.js";

// Cloudflare Pages single-project adapter.
// Pages serves static files from /public; this Function handles API/SSR routes
// and binds D1/R2 directly from the Pages project's Bindings settings.
export function onRequest(context) {
  return fetchHandler(context.request, {
    ...context.env,
    MODE: "single",
    APP_ORIGIN: context.env.APP_ORIGIN || "https://research.skyfirst.io.vn",
    ASSETS: { fetch: () => context.next() },
    WAIT_UNTIL: (promise) => context.waitUntil(promise),
  });
}

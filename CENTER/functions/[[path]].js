import { fetchHandler } from "../src/worker.js";

// Cloudflare Pages single-project adapter.
// Static assets are always served directly by Pages. API and document routes
// pass through the application worker so D1/R2 and SEO remain available.
export function onRequest(context) {
  const url = new URL(context.request.url);
  const isStatic = /\.(?:css|js|mjs|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|map|txt|xml)$/i.test(url.pathname);
  if (isStatic) return context.next();

  return fetchHandler(context.request, {
    ...context.env,
    MODE: "single",
    APP_ORIGIN: context.env.APP_ORIGIN || "https://research.skyfirst.io.vn",
    ASSETS: { fetch: () => context.next() },
    WAIT_UNTIL: (promise) => context.waitUntil(promise),
  });
}

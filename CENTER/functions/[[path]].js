import { fetchHandler } from "../src/worker.js";

// Use the native Pages ASSETS binding. context.next() continues the ORIGINAL
// route and cannot be substituted for an explicit entry asset request.
export function onRequest(context) {
  return fetchHandler(context.request, {
    ...context.env,
    MODE: "single",
    ASSETS: context.env.ASSETS,
    WAIT_UNTIL: (promise) => context.waitUntil(promise),
  });
}

import { proxy } from "../src/proxy.js";
export function onRequest(context) {
  return proxy(context.request, {
    ...context.env,
    ASSETS: { fetch: () => context.next() },
  });
}

// Worker entry: routes the Square payment API, everything else is a static file.
import { onRequestGet as getConfig } from "./functions/api/config.js";
import { onRequestPost as postPay } from "./functions/api/pay.js";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/config") {
      return request.method === "GET" ? getConfig({ request, env }) : new Response(null, { status: 405 });
    }
    if (pathname === "/api/pay") {
      return request.method === "POST" ? postPay({ request, env }) : new Response(null, { status: 405 });
    }
    if (pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }
    return env.ASSETS.fetch(request);
  },
};

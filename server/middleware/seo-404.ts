/**
 * Unknown documents return 404 before the SPA shell can answer 200.
 * API, assets, and known pages fall through.
 */
import { notFoundHtml, shouldServeApp } from "../../scripts/seo-public.mjs";

interface SeoEvent {
  url: URL;
  req: { method: string };
}

export default function seoNotFoundMiddleware(
  event: SeoEvent,
  next: () => unknown | Promise<unknown>,
): unknown | Promise<unknown> {
  const method = (event.req.method ?? "GET").toUpperCase();
  if (method !== "GET" && method !== "HEAD") return next();
  if (shouldServeApp(event.url.pathname)) return next();
  const body = method === "HEAD" ? null : notFoundHtml();
  return new Response(body, {
    status: 404,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  });
}

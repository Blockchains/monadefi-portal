/** Public HTML documents. API, assets, and hashed bundles must not 404. */
export const PUBLIC_PAGES = ["/", "/how-it-works", "/security", "/faq", "/docs", "/pulse"];

/** @param {string} pathname */
export function shouldServeApp(pathname) {
  let path = String(pathname ?? "/");
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  if (PUBLIC_PAGES.includes(path)) return true;
  if (
    path.startsWith("/api/") ||
    path.startsWith("/_serverFn") ||
    path.startsWith("/__grok/") ||
    path.startsWith("/assets/") ||
    path.startsWith("/@") ||
    path.startsWith("/src/") ||
    path.startsWith("/node_modules")
  ) {
    return true;
  }
  if (/\.[a-z0-9]+$/i.test(path)) return true;
  return false;
}

export function notFoundHtml() {
  const links = [
    ["/", "Home"],
    ["/how-it-works", "How it works"],
    ["/security", "Security"],
    ["/faq", "FAQ"],
    ["/docs", "Docs"],
    ["/pulse", "Pulse"],
  ]
    .map(
      ([href, label]) =>
        `<a href="${href}" style="color:#836ef9;margin-right:0.75rem">${label}</a>`,
    )
    .join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Page not found — MonaDeFi</title><meta name="description" content="That MonaDeFi page does not exist. Go back to the PolicyPilot vault, the guide, security notes, FAQ, or docs."><meta name="robots" content="noindex"><meta name="theme-color" content="#09090b"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="apple-touch-icon" href="/__grok/icon-180.png"><link rel="manifest" href="/__grok/manifest.webmanifest"></head><body style="margin:0;background:#09090b;color:#fafafa;font-family:system-ui,sans-serif"><main style="max-width:40rem;margin:0 auto;padding:3rem 1.25rem"><p style="letter-spacing:0.04em;font-size:0.75rem;color:#a1a1aa">MonaDeFi</p><h1 style="font-size:2rem;margin:0.5rem 0">Page not found</h1><p style="color:#a1a1aa;line-height:1.5">That address is not a MonaDeFi page. PolicyPilot still lives on the home vault, with the guide, security notes, FAQ, and docs linked below.</p><nav aria-label="MonaDeFi" style="margin-top:1.5rem">${links}</nav></main></body></html>`;
}

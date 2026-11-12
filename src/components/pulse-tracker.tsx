import { useEffect } from "react";

const SID_KEY = "pulse-sid";
const OFF_KEY = "pulse-no-track";

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function optedOut(): boolean {
  return readKey(OFF_KEY) === "1";
}

function sid(): string {
  const existing = readKey(SID_KEY);
  if (existing) return existing;
  const next =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  writeKey(SID_KEY, next);
  return next;
}

function payload(kind: "view" | "beat") {
  const url = new URL(window.location.href);
  const utm = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]
    .map((key) => (url.searchParams.get(key) ? `${key}=${url.searchParams.get(key)}` : ""))
    .filter(Boolean)
    .join("&");
  const path = `${url.pathname}${url.hash}`.slice(0, 180) || "/";
  return {
    path,
    ref: document.referrer || "",
    sid: sid(),
    ua: (navigator.userAgent || "").slice(0, 180),
    lang: navigator.language || "",
    tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    vw: window.innerWidth,
    utm,
    kind,
  };
}

function send(kind: "view" | "beat") {
  const body = JSON.stringify(payload(kind));
  try {
    if (typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon("/api/pulse", blob)) return;
    }
  } catch {
    /* fall through */
  }
  fetch("/api/pulse", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
    keepalive: true,
    credentials: "omit",
  }).catch(() => undefined);
}

/** Same-origin traffic beacon. Failures stay silent. Honors pulse-no-track. */
export function PulseTracker() {
  useEffect(() => {
    if (typeof window === "undefined" || optedOut()) return;
    if (window.location.pathname.startsWith("/api")) return;
    let last = "";
    const view = () => {
      const here = `${window.location.pathname}${window.location.hash}`;
      if (here === last) return;
      last = here;
      send("view");
    };
    view();
    const onShow = () => {
      if (document.visibilityState === "visible") send("beat");
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") send("beat");
    }, 20_000);
    window.addEventListener("hashchange", view);
    window.addEventListener("popstate", view);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("hashchange", view);
      window.removeEventListener("popstate", view);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);
  return null;
}

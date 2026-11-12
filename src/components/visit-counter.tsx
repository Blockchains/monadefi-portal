import { useEffect, useState } from "react";

const SESSION_KEY = "vc-counted";

async function loadVisits(method: "GET" | "POST"): Promise<number | null> {
  const response = await fetch("/api/visits", {
    method,
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { total?: unknown };
  return typeof body.total === "number" && Number.isFinite(body.total) ? body.total : null;
}

export function VisitCounter() {
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const show = (next: number | null) => {
      if (alive) setTotal(next);
    };
    const pull = (method: "GET" | "POST") => {
      loadVisits(method)
        .then((next) => {
          if (method === "POST" && next != null) sessionStorage.setItem(SESSION_KEY, "1");
          show(next);
        })
        .catch(() => show(null));
    };
    if (sessionStorage.getItem(SESSION_KEY) === "1") pull("GET");
    else pull("POST");
    const timer = window.setInterval(() => pull("GET"), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (total == null) return null;

  return (
    <footer className="shrink-0 px-4 py-1 text-center font-mono text-[11px] leading-none text-subtle tabular-nums">
      {total.toLocaleString("en-US")} visits
    </footer>
  );
}

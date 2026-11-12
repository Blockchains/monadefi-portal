import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { SiteNav } from "@/components/seo/site-nav";
import { emptyPulse, type PulseCount, type PulseSnapshot } from "@/lib/pulse/shape";
import { SEO_PAGES, breadcrumbJsonLd, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/pulse")({
  head: () => pageHead(SEO_PAGES.pulse, breadcrumbJsonLd(SEO_PAGES.pulse)),
  component: PulsePage,
});

function PulsePage() {
  const [data, setData] = useState<PulseSnapshot>(() => emptyPulse());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let on = true;
    const pull = () => {
      fetch("/api/pulse", { headers: { accept: "application/json" }, cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((json) => {
          if (on && json && typeof json === "object") setData(json as PulseSnapshot);
        })
        .catch(() => undefined)
        .finally(() => {
          if (on) setReady(true);
        });
    };
    pull();
    const timer = window.setInterval(pull, 3_000);
    return () => {
      on = false;
      window.clearInterval(timer);
    };
  }, []);

  const max = Math.max(1, ...data.spark.map((point) => point.n));

  return (
    <main className="min-h-dvh bg-bg text-fg">
      <SiteNav current="/pulse" />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-violet-200">Monad · chain 143</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pulse</h1>
            <p className="mt-1 text-sm text-muted">Public traffic. Visitor ids stay hashed on the server.</p>
          </div>
        </header>
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Live now" value={data.liveNow} />
          <Stat label="Views 1h" value={data.pageviews1h} />
          <Stat label="Views 24h" value={data.pageviews24h} />
          <Stat label="Uniques 24h" value={data.uniques24h} />
        </section>
        <section className="rounded-2xl border border-border bg-bg-elev p-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-medium">Last 24 hours</h2>
            <p className="font-mono text-xs text-subtle">{ready ? "live" : "connecting"}</p>
          </div>
          <div className="mt-4 flex h-24 items-end gap-1">
            {data.spark.map((point) => (
              <div key={point.h} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-sm bg-accent"
                  style={{ height: `${Math.max(4, Math.round((point.n / max) * 100))}%` }}
                  title={`${point.h} · ${point.n}`}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between font-mono text-xs text-subtle">
            <span>{data.spark[0]?.h}</span>
            <span>{data.spark[data.spark.length - 1]?.h}</span>
          </div>
        </section>
        <section className="grid gap-3 sm:grid-cols-2">
          <List title="Paths" rows={data.topPaths} />
          <List title="Referrers" rows={data.topRefs} />
          <List title="Devices" rows={data.devices} />
          <List title="Languages" rows={data.langs} />
        </section>
        <section className="rounded-2xl border border-border bg-bg-elev p-4">
          <h2 className="text-sm font-medium">Latest views</h2>
          {data.feed.length === 0 ? (
            <p className="mt-3 text-sm text-subtle">No views in this window yet.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {data.feed.map((hit, index) => (
                <li key={`${hit.t}-${index}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">
                    {hit.path} <span className="text-subtle">· {hit.device}</span>
                  </span>
                  <span className="shrink-0 font-mono text-xs text-subtle">{hit.tz}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elev px-3 py-3">
      <p className="text-xs text-subtle">{label}</p>
      <p className="mt-1 font-mono text-2xl tabular-nums">{value.toLocaleString("en-US")}</p>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: PulseCount[] }) {
  return (
    <div className="rounded-2xl border border-border bg-bg-elev p-4">
      <h2 className="text-sm font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-subtle">Nothing yet.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.k} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.k}</span>
              <span className="font-mono text-xs text-accent">{row.v}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

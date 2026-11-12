import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ago } from "@/components/policy/bits";
import { usePolicy } from "@/components/policy/state";
import { cn } from "@/lib/cn";
import { explorerTx } from "@/lib/policy/chain";
import { chainActivity, type ChainEvent } from "@/lib/policy/live";
import { formatMon, shortAddr } from "@/lib/policy/model";

const SpendChart = lazy(() => import("@/components/policy/spend-chart").then((mod) => ({ default: mod.SpendChart })));

const FILTERS = ["All", "Allowed", "Blocked", "Owner"] as const;

export function FeedScreen({ onRun, onLaunch }: { onRun: () => void; onLaunch: () => void }) {
  const { ledger, vault, signerFor } = usePolicy();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [chain, setChain] = useState<ChainEvent[] | null>(null);
  const feed = ledger?.feed ?? [];
  const visible = feed.filter((item) => {
    if (filter === "Allowed") return item.status === "pass";
    if (filter === "Blocked") return item.status === "fail";
    if (filter === "Owner") return item.status === "owner";
    return true;
  });
  const chart = useMemo(
    () =>
      (ledger?.series ?? []).map((point, index) => ({
        id: point.id,
        cumulative: Number(point.cumulativeMon),
        label: String(index + 1),
      })),
    [ledger?.series],
  );

  useEffect(() => {
    let on = true;
    chainActivity()
      .then((result) => {
        if (on && result.ok) setChain(result.events);
      })
      .catch(() => {
        if (on) setChain([]);
      });
    return () => {
      on = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs text-subtle">Mainnet log</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Live activity</h1>
        <p className="mt-1 text-sm text-muted">
          Team demo vault plus your own agents, read from chain. Practice calls stay in the ledger below.
        </p>
      </header>

      {vault && vault.source === "chain" && !vault.paused && signerFor(vault.agentAddress) ? (
        <Button onClick={onRun}>Run {vault.name} on Monad</Button>
      ) : (
        <Button variant="secondary" onClick={onLaunch}>
          Let it go into the wild
        </Button>
      )}

      <section className="rounded-3xl border border-border bg-bg-elev p-4">
        <h2 className="text-sm font-medium">Recorded spend</h2>
        {chart.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No spend recorded yet.</p>
        ) : (
          <Suspense fallback={<div className="mt-3 h-36 rounded-lg bg-bg-subtle" />}>
            <div className="mt-2">
              <SpendChart data={chart} />
            </div>
          </Suspense>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium">Showcase on Monad</h2>
        {chain === null ? (
          <p className="mt-2 text-sm text-subtle">Reading recent vault logs…</p>
        ) : chain.length === 0 ? (
          <p className="mt-2 text-sm text-subtle">No recent showcase events in the latest blocks.</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {chain.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-bg-elev px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.label}</p>
                  <span className={cn("font-mono text-xs", item.status === "pass" ? "text-ok" : "text-muted")}>
                    {item.status === "pass" ? "On chain" : "Owner"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtle">{item.reason}</p>
                {item.tx && (
                  <a className="mt-2 inline-block font-mono text-xs underline" href={explorerTx(item.tx)} target="_blank" rel="noreferrer">
                    {item.tx.slice(0, 10)}…{item.tx.slice(-4)}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <h2 className="text-sm font-medium">Practice log</h2>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setFilter(item)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-sm",
              filter === item ? "border-fg/30 bg-bg-subtle text-fg" : "border-border text-muted",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted">Nothing in this filter yet. Simulate a call, or record one that passes.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-bg-elev px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm font-medium">{item.label}</p>
                <span
                  className={cn(
                    "shrink-0 font-mono text-xs",
                    item.status === "pass" && "text-ok",
                    item.status === "fail" && "text-bad",
                    item.status === "owner" && "text-muted",
                  )}
                >
                  {item.status === "pass" ? "Allowed" : item.status === "fail" ? "Blocked" : "Owner"}
                </span>
              </div>
              <p className="mt-1 text-xs text-subtle">{item.reason}</p>
              <p className="mt-2 font-mono text-xs tabular-nums text-subtle">
                {item.vaultName}
                {item.amountWei !== "0" ? ` · ${formatMon(item.amountWei)} MON` : ""}
                {item.recipient ? ` · ${shortAddr(item.recipient)}` : ""}
                {item.code ? ` · ${item.code}` : ""}
                {item.applied ? " · recorded" : ""}
                {item.createdAt ? ` · ${ago(item.createdAt)}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

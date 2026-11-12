import { useEffect, useMemo, useState } from "react";
import { FORK_CARDS, type ForkCard } from "@/lib/policy/forks";
import { forkPulse, type ForkPulse } from "@/lib/policy/forks-live";
import { cn } from "@/lib/cn";

export function liveFigure(card: ForkCard, pulse: ForkPulse | null): string | null {
  if (!card.live || !pulse) return null;
  if (card.id === "unison" && pulse.unison) {
    const { lagBlocks, teamFills, outsideFills } = pulse.unison;
    const parts: string[] = [];
    if (lagBlocks != null) parts.push(`lag ${lagBlocks.toLocaleString("en-US")}`);
    if (teamFills != null) parts.push(`${teamFills.toLocaleString("en-US")} fills`);
    if (outsideFills != null) parts.push(`${outsideFills.toLocaleString("en-US")} outside`);
    return parts.length ? parts.join(" · ") : null;
  }
  if (card.id === "tab" && pulse.tabUsdc != null) return `${pulse.tabUsdc} USDC`;
  if (card.id === "kanmani" && pulse.kanmaniClaims != null) {
    return `${pulse.kanmaniClaims.toLocaleString("en-US")} claims`;
  }
  if (card.id === "corpus" && pulse.corpus) {
    return `${pulse.corpus.count.toLocaleString("en-US")} attestations`;
  }
  return null;
}

function figure(card: ForkCard, pulse: ForkPulse | null, pending: boolean): string {
  return liveFigure(card, pulse) ?? (pending && card.live ? "Reading…" : card.note);
}

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "Live read" },
  { id: "site", label: "Has a site" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function ForksDesk() {
  const [pulse, setPulse] = useState<ForkPulse | null>(null);
  const [pending, setPending] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    let alive = true;
    forkPulse()
      .then((next) => {
        if (alive) setPulse(next);
      })
      .catch(() => {
        if (alive) setPulse(null);
      })
      .finally(() => {
        if (alive) setPending(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return FORK_CARDS.filter((card) => {
      if (filter === "live" && !card.live) return false;
      if (filter === "site" && !card.site) return false;
      if (!needle) return true;
      return `${card.name} ${card.blurb}`.toLowerCase().includes(needle);
    });
  }, [filter, query]);

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="text-lg font-medium tracking-tight">Forks from 11 Nov</h2>
        <p className="mt-1 text-sm text-muted">
          {FORK_CARDS.length} public Monad forks on the lab account, newest first. A number appears only when a public feed
          answers. None of these can move vault funds.
        </p>
      </header>
      <label className="block">
        <span className="sr-only">Search forks</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the 45 forks"
          className="h-11 w-full rounded-xl border border-border bg-bg-elev px-3 text-sm outline-none placeholder:text-subtle"
        />
      </label>
      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={cn(
              "h-9 shrink-0 rounded-full border px-3 text-sm",
              filter === item.id ? "border-fg/30 bg-bg-subtle text-fg" : "border-border text-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-subtle">No fork matches that.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {shown.map((card) => {
            const line = figure(card, pulse, pending);
            const live = card.live && line !== card.note && line !== "Reading…";
            return (
              <li key={card.id} className="rounded-xl border border-border bg-bg-elev px-3 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium">{card.name}</p>
                  <p className="shrink-0 text-xs text-subtle">{card.where}</p>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted">{card.blurb}</p>
                <p className={cn("mt-2 font-mono text-xs leading-snug", live ? "text-fg" : "text-subtle")}>{line}</p>
                <p className="mt-2 flex gap-4 text-xs">
                  {card.site && (
                    <a className="text-accent underline-offset-2 hover:underline" href={card.site} target="_blank" rel="noreferrer">
                      Site
                    </a>
                  )}
                  <a className="text-accent underline-offset-2 hover:underline" href={card.github} target="_blank" rel="noreferrer">
                    GitHub
                  </a>
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

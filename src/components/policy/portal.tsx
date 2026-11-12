import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Bot, Coins, Send } from "lucide-react";
import { liveFigure } from "@/components/policy/forks";
import { forkPulse, type ForkPulse } from "@/lib/policy/forks-live";
import { FORK_CARDS } from "@/lib/policy/forks";
import { SERVICES } from "@/lib/policy/model";
import { cn } from "@/lib/cn";

const LIVE = SERVICES.filter((item) => item.status === "live");
const APPS = FORK_CARDS.filter((card) => card.site);

const ACTIONS = [
  { id: "stake", label: "Stake", icon: Coins },
  { id: "swap", label: "Swap", icon: ArrowLeftRight },
  { id: "pay", label: "Pay", icon: Send },
  { id: "agents", label: "Agents", icon: Bot },
] as const;

export function PortalScreen({
  onStake,
  onSwap,
  onPay,
  onAgents,
  onService,
}: {
  onStake: () => void;
  onSwap: () => void;
  onPay: () => void;
  onAgents: () => void;
  onService: (id: string) => void;
}) {
  const [pulse, setPulse] = useState<ForkPulse | null>(null);
  const [query, setQuery] = useState("");
  const go = { stake: onStake, swap: onSwap, pay: onPay, agents: onAgents };

  useEffect(() => {
    let alive = true;
    forkPulse()
      .then((next) => {
        if (alive) setPulse(next);
      })
      .catch(() => {
        if (alive) setPulse(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const services = useMemo(
    () => LIVE.filter((item) => !needle || `${item.name} ${item.blurb}`.toLowerCase().includes(needle)),
    [needle],
  );
  const apps = useMemo(
    () => APPS.filter((card) => !needle || `${card.name} ${card.blurb}`.toLowerCase().includes(needle)),
    [needle],
  );

  return (
    <div className="flex flex-col gap-5 pb-2">
      <header>
        <h1 className="text-[1.75rem] font-medium leading-none tracking-tight">Monad DeFi</h1>
        <p className="mt-2 text-sm text-muted">Stake, swap, and pay on mainnet.</p>
      </header>

      <div className="grid grid-cols-4 gap-2">
        {ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={go[item.id]}
              className="flex h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-2xl border border-border bg-bg-elev text-xs font-medium"
            >
              <Icon className="size-5 text-accent" strokeWidth={1.75} />
              {item.label}
            </button>
          );
        })}
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Services</h2>
        {services.length === 0 ? (
          <p className="text-sm text-subtle">No service matches.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2">
            {services.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onService(item.id)}
                  className="flex h-full min-h-24 w-full flex-col items-start rounded-2xl border border-border bg-bg-elev px-3 py-3 text-left"
                >
                  <span className="text-base leading-none">{item.icon}</span>
                  <span className="mt-2 text-sm font-medium">{item.name}</span>
                  <span className="mt-1 text-xs leading-snug text-muted">{item.blurb}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Apps</h2>
        <label className="block">
          <span className="sr-only">Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            className="h-11 w-full rounded-xl border border-border bg-bg-elev px-3 text-sm outline-none placeholder:text-subtle"
          />
        </label>
        {apps.length === 0 ? (
          <p className="text-sm text-subtle">No app matches.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {apps.map((card) => {
              const stat = liveFigure(card, pulse);
              return (
                <li key={card.id}>
                  <a
                    href={card.site!}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-bg-elev px-3 py-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{card.name}</span>
                      <span className={cn("mt-0.5 block truncate text-xs", stat ? "font-mono text-fg" : "text-muted")}>
                        {stat ?? card.blurb}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-medium text-accent">Open</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

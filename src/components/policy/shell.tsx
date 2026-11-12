import { useEffect, useState } from "react";
import { Activity, Bot, Compass, Gauge, Rocket } from "lucide-react";
import { PolicyProvider, usePolicy } from "@/components/policy/state";
import { SimulateScreen } from "@/components/policy/simulate";
import { LaunchScreen } from "@/components/policy/launch";
import { FeedScreen } from "@/components/policy/feed";
import { VaultsScreen } from "@/components/policy/vaults";
import { PortalScreen } from "@/components/policy/portal";
import { ConnectSheet } from "@/components/policy/connect";
import { SiteNav } from "@/components/seo/site-nav";
import { VisitCounter } from "@/components/visit-counter";
import { cn } from "@/lib/cn";
import { formatMon, shortAddr } from "@/lib/policy/model";
import type { Ledger } from "@/lib/policy/server";

const TABS = [
  { id: "portal", label: "Portal", icon: Compass },
  { id: "launch", label: "Vault", icon: Rocket },
  { id: "activity", label: "Activity", icon: Activity },
  { id: "agents", label: "Agents", icon: Bot },
  { id: "policy", label: "Policy", icon: Gauge },
] as const;

type TabId = (typeof TABS)[number]["id"];

const HASH_ALIAS: Record<string, TabId> = {
  simulate: "policy",
  run: "policy",
  feed: "activity",
  vaults: "agents",
  services: "portal",
  home: "portal",
};

function isTab(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function tabFromHash(hash: string): TabId {
  if (isTab(hash)) return hash;
  return HASH_ALIAS[hash] ?? "launch";
}

function Mark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        d="M12 2.8 19.5 6.2v5.8c0 4.1-2.9 6.9-7.5 8.7-4.6-1.8-7.5-4.6-7.5-8.7V6.2L12 2.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M8.2 12.2h7.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Desk() {
  const { ledger, vaults, block, chainOk, account, balanceWei } = usePolicy();
  const held = vaults.reduce((sum, vault) => sum + BigInt(vault.balanceWei || "0"), 0n);
  const allowed = ledger?.feed.filter((item) => item.status === "pass").length ?? 0;
  const blocked = ledger?.feed.filter((item) => item.status === "fail").length ?? 0;
  const stats = [
    { label: "Vaults", value: String(vaults.length || "—") },
    { label: "MON held", value: vaults.length ? formatMon(held, 3) : "—" },
    { label: "Allowed", value: String(allowed) },
    { label: "Blocked", value: String(blocked) },
  ];
  return (
    <aside className="hidden min-h-dvh flex-col justify-between px-14 py-12 md:flex">
      <div className="max-w-xl">
        <div className="flex items-center gap-2 text-sm text-muted">
          <Mark />
          MonaDeFi
        </div>
        <h2 className="mt-8 text-5xl font-medium leading-none tracking-tight">
          One portal.
          <span className="mt-2 block text-accent">Monad DeFi.</span>
        </h2>
        <p className="mt-6 max-w-md text-base text-muted">Stake, swap, and pay on Monad. Open a service and sign from your wallet.</p>
      </div>
      <div>
        <dl className="grid max-w-lg grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt className="text-xs text-subtle">{stat.label}</dt>
              <dd className="mt-1 font-mono text-lg tabular-nums">{stat.value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-6 font-mono text-xs text-subtle">
          Monad mainnet · {chainOk && block ? `block ${block.toLocaleString("en-US")}` : "connecting"} · chain 143
          {account ? ` · ${shortAddr(account)}` : ""}
          {balanceWei ? ` · ${formatMon(balanceWei)} MON` : ""}
        </p>
      </div>
    </aside>
  );
}

function Phone() {
  const { error, block, chainOk, busy, ledger, account, setConnectOpen } = usePolicy();
  const [tab, setTab] = useState<TabId>("portal");
  const [intent, setIntent] = useState<{
    id: number;
    panel: "limits" | "services" | "agent" | "spread";
    preset: "custom" | "yield" | "trader" | "payments";
  } | null>(null);

  useEffect(() => {
    const read = () => setTab(tabFromHash(window.location.hash.replace("#", "")));
    read();
    if (!window.location.hash) window.history.replaceState(null, "", "#portal");
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  function go(next: TabId) {
    setTab(next);
    window.history.replaceState(null, "", `#${next}`);
  }

  function openVault(panel: "limits" | "services", preset: "yield" | "trader" | "payments") {
    setIntent({ id: Date.now(), panel, preset });
    go("launch");
  }

  function openService(id: string) {
    if (id === "pay") openVault("limits", "payments");
    else if (id === "kintsu" || id === "apriori" || id === "magma") openVault("limits", "yield");
    else openVault("services", "trader");
  }

  return (
    <section className="relative mx-auto flex h-dvh w-full max-w-[440px] flex-col overflow-hidden border-border md:border-l">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-2">
          <Mark />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-none">MonaDeFi</p>
            <p className="mt-1 truncate font-mono text-xs text-subtle">
              {chainOk && block ? `block ${block.toLocaleString("en-US")}` : "Monad portal"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConnectOpen(true)}
          className={cn(
            "h-9 max-w-[9.5rem] shrink-0 truncate rounded-full px-3 text-xs font-medium",
            account ? "border border-border" : "bg-accent text-accent-fg",
          )}
        >
          {account ? shortAddr(account) : "Connect"}
        </button>
      </header>
      <SiteNav current="/" />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {error && <p className="mx-4 mt-3 shrink-0 rounded-lg border border-bad/40 px-3 py-2 text-sm text-bad">{error}</p>}
        {!ledger && busy ? (
          <p className="px-4 py-4 text-sm text-muted">Reading the ledger…</p>
        ) : tab === "launch" ? (
          <LaunchScreen
            intent={intent}
            onDone={() => go("policy")}
            onWatch={() => go("activity")}
            onManage={() => go("agents")}
          />
        ) : (
          <div className="scroll-plain min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4">
            {tab === "activity" && <FeedScreen onRun={() => go("policy")} onLaunch={() => go("launch")} />}
            {tab === "agents" && <VaultsScreen onRun={() => go("policy")} />}
            {tab === "portal" && (
              <PortalScreen
                onStake={() => openVault("limits", "yield")}
                onSwap={() => openVault("services", "trader")}
                onPay={() => openVault("limits", "payments")}
                onAgents={() => go("agents")}
                onService={openService}
              />
            )}
            {tab === "policy" && <SimulateScreen onLaunch={() => go("launch")} />}
          </div>
        )}
      </main>
      <VisitCounter />
      <nav className="grid shrink-0 grid-cols-5 border-t border-border bg-bg pb-[env(safe-area-inset-bottom)]">
        {TABS.map((item) => {
          const Icon = item.icon;
          const on = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => go(item.id)}
              className={cn("flex h-16 flex-col items-center justify-center gap-1 text-xs", on ? "text-fg" : "text-subtle")}
              aria-current={on ? "page" : undefined}
            >
              <span className={cn("grid h-8 w-12 place-items-center rounded-full", on && "bg-accent/25")}>
                <Icon className={cn("size-5", on && "text-accent")} strokeWidth={1.75} />
              </span>
              {item.label}
            </button>
          );
        })}
      </nav>
      <ConnectSheet />
    </section>
  );
}

export function AppShell({ initial }: { initial: Ledger }) {
  return (
    <PolicyProvider initial={initial}>
      <div className="min-h-dvh bg-bg text-fg md:grid md:grid-cols-[minmax(0,1fr)_440px]">
        <Desk />
        <Phone />
      </div>
    </PolicyProvider>
  );
}

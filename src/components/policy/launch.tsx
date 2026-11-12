import { useEffect, useMemo, useState } from "react";
import { Rocket } from "lucide-react";
import { decodeEventLog, getAddress, isAddress, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Field, Notice, fieldClass } from "@/components/policy/bits";
import { SpreadDesk } from "@/components/policy/spread-desk";
import { usePolicy } from "@/components/policy/state";
import { cn } from "@/lib/cn";
import { FACTORY, encodeCreate, explainError, explorerTx, factoryAbi } from "@/lib/policy/chain";
import { LIVE_IDS, SANDBOX_OWNER, SERVICES, parseMon, serviceName, shortAddr } from "@/lib/policy/model";
import { createVault } from "@/lib/policy/server";
import { mintAgent, reader } from "@/lib/policy/wallet";
import { MonaStake } from "@/components/policy/mona";

type Step = { label: string; state: "run" | "ok" | "err"; hash?: string };
type Panel = "limits" | "services" | "agent" | "spread";
type Preset = "custom" | "yield" | "trader" | "payments";

export function LaunchScreen({
  onDone,
  onWatch,
  onManage,
  intent,
}: {
  onDone: (id: string) => void;
  onWatch: () => void;
  onManage: () => void;
  intent?: { id: number; panel: Panel; preset: Preset } | null;
}) {
  const { busy, run, account, walletName, setConnectOpen, sendOwner, setActiveId, refreshChain, setError } = usePolicy();
  const [mode, setMode] = useState<"monad" | "practice">("monad");
  const [agentMode, setAgentMode] = useState<"wallet" | "new" | "external">("wallet");
  const [ext, setExt] = useState("");
  const [name, setName] = useState("Field agent");
  const [budget, setBudget] = useState("0.200");
  const [cap, setCap] = useState("0.050");
  const [deposit, setDeposit] = useState("0.500");
  const [gas, setGas] = useState("0.200");
  const [services, setServices] = useState<string[]>(LIVE_IDS);
  const [payees, setPayees] = useState("");
  const [steps, setSteps] = useState<Step[]>([]);
  const [localBusy, setLocalBusy] = useState(false);
  const [launched, setLaunched] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>("limits");
  const [preset, setPreset] = useState<Preset>("custom");

  const summary = useMemo(() => {
    if (mode === "monad") {
      return "This vault has no spending limit and no allowlist. The agent can move every MON in it. You stay the owner: pause, withdraw, or pull everything back. It starts live.";
    }
    const names = services.map(serviceName);
    const list = names.length ? names.join(", ") : "nothing yet";
    return `Practice only: at most ${cap || "0"} MON per action and ${budget || "0"} MON in total, only on ${list}. Nothing is signed.`;
  }, [mode, services, cap, budget]);

  function toggle(id: string) {
    setPreset("custom");
    setServices((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  function applyPreset(id: Exclude<Preset, "custom">) {
    setPreset(id);
    setMode("monad");
    setAgentMode("wallet");
    setPanel("limits");
    if (id === "yield") {
      setDeposit("0.500");
      setServices(["kintsu", "apriori", "magma", "wmon"]);
    } else if (id === "trader") {
      setDeposit("0.500");
      setServices(["uniswap", "pancake", "kuru", "wmon"]);
    } else {
      setDeposit("0.100");
      setServices(["pay"]);
    }
  }

  useEffect(() => {
    if (!intent) return;
    if (intent.preset !== "custom") applyPreset(intent.preset);
    setPanel(intent.panel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent]);

  function setBudgetMon(next: number) {
    const budgetNum = clamp(next, 0.001, 1);
    setPreset("custom");
    setBudget(budgetNum.toFixed(3));
    if (monNum(cap) > budgetNum) setCap(budgetNum.toFixed(3));
  }

  async function launch() {
    const result = await run(() =>
      createVault({
        data: {
          name,
          budgetMon: budget,
          capMon: cap,
          depositMon: deposit,
          gasMon: gas,
          services,
          payees,
          startPaused: false,
        },
      }),
    );
    if (result.ok && result.id) onDone(result.id);
  }

  async function deploy() {
    if (!account) {
      setConnectOpen(true);
      return;
    }
    setLocalBusy(true);
    setError(null);
    setSteps([]);
    const push = (label: string) => setSteps((list) => [...list, { label, state: "run" }]);
    const mark = (state: "ok" | "err", hash?: string, label?: string) =>
      setSteps((list) => list.map((item, index) => (index === list.length - 1 ? { ...item, state, hash, label: label ?? item.label } : item)));
    try {
      const owner = getAddress(account);
      let executor: Address;
      if (agentMode === "wallet") executor = owner;
      else if (agentMode === "new") executor = mintAgent().address;
      else {
        if (!isAddress(ext.trim())) throw new Error("Paste the agent's full address.");
        executor = getAddress(ext.trim());
      }
      const depositWei = parseMon(deposit);
      const gasWei = parseMon(gas);
      if (depositWei === null || gasWei === null) throw new Error("Enter amounts in MON.");
      const tx = encodeCreate({ executor, depositWei });
      push(walletName?.toLowerCase().includes("trust") ? "Confirm create in Trust Wallet" : "Confirm create in your wallet");
      const created = await sendOwner(tx);
      mark("ok", created);
      const receipt = await reader().waitForTransactionReceipt({ hash: created });
      let vault = vaultFromReceipt(receipt.logs);
      if (!vault) {
        const list = await reader().readContract({ address: FACTORY, abi: factoryAbi, functionName: "vaultsOf", args: [owner] });
        vault = list.at(-1) ?? null;
      }
      if (!vault) throw new Error("The vault was created, but its address was not in the receipt.");
      if (agentMode === "new" && gasWei > 0n) {
        push(walletName?.toLowerCase().includes("trust") ? "Confirm gas in Trust Wallet" : "Confirm gas in your wallet");
        const funded = await sendOwner({ to: executor, data: "0x", value: gasWei });
        mark("ok", funded);
      }
      await refreshChain(owner);
      setActiveId(`chain:${vault.toLowerCase()}`);
      setLaunched(vault);
    } catch (error) {
      const reason = explainError(error);
      setSteps((list) => {
        if (!list.length) return [{ label: reason, state: "err" }];
        return list.map((item, index) => (index === list.length - 1 && item.state === "run" ? { ...item, state: "err", label: `${item.label}. ${reason}` } : item));
      });
      setError(reason);
    } finally {
      setLocalBusy(false);
    }
  }

  const cta =
    mode === "monad"
      ? localBusy
        ? walletName?.toLowerCase().includes("trust")
          ? "Confirm in Trust Wallet…"
          : "Confirm in your wallet…"
        : account
          ? "Let it go into the wild"
          : "Connect, then let it go"
      : busy
        ? "Creating…"
        : "Create practice vault";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-4 pt-3">
        <p className="text-xs font-medium text-violet-200">Monad mainnet · chain 143</p>
        <h1 className="mt-1 text-xl font-semibold leading-tight tracking-tight">
          Love agents. <span className="text-accent">Love control.</span>
        </h1>
        <div className="mt-3 grid grid-cols-4 gap-1 rounded-xl bg-bg-elev p-1" role="tablist">
          {(
            [
              ["limits", "Stake"],
              ["services", "Services"],
              ["agent", "Agent"],
              ["spread", "Spread"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={panel === id}
              onClick={() => setPanel(id)}
              className={cn("h-10 rounded-lg text-xs font-medium", panel === id ? "bg-accent text-accent-fg" : "text-muted")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="scroll-plain min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain px-4 py-4">
        {panel === "limits" && (
          <div className="flex flex-col gap-5">
            <div className="scroll-plain -mx-4 flex touch-pan-x gap-2 overflow-x-auto px-4">
              {(
                [
                  ["yield", "Yield"],
                  ["trader", "Trader"],
                  ["payments", "Pay"],
                  ["custom", "Custom"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => (id === "custom" ? setPreset("custom") : applyPreset(id))}
                  className={cn(
                    "h-11 shrink-0 rounded-full border px-4 text-sm font-medium",
                    preset === id ? "border-accent bg-accent/15 text-fg" : "border-border bg-bg-elev text-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "monad" && <MonaStake />}
            {mode === "practice" && (
              <>
                <Slider label="Total budget" value={monNum(budget)} min={0.001} max={1} step={0.001} onChange={setBudgetMon} />
                <Slider
                  label="Per-action cap"
                  value={Math.min(monNum(cap), monNum(budget))}
                  min={0.001}
                  max={Math.max(monNum(budget), 0.001)}
                  step={0.001}
                  onChange={(next) => {
                    setPreset("custom");
                    setCap(clamp(next, 0.001, monNum(budget) || 1).toFixed(3));
                  }}
                />
              </>
            )}
            <Slider
              label="Deposit into the agent vault"
              value={monNum(deposit)}
              min={0}
              max={mode === "monad" ? 20 : 1}
              step={0.01}
              onChange={(next) => {
                setPreset("custom");
                setDeposit(clamp(next, 0, mode === "monad" ? 20 : 1).toFixed(3));
              }}
            />
            {mode === "monad" && agentMode === "new" && (
              <Slider
                label="Gas for the agent"
                value={monNum(gas)}
                min={0}
                max={0.5}
                step={0.01}
                onChange={(next) => setGas(clamp(next, 0, 0.5).toFixed(3))}
              />
            )}
            <p className="rounded-2xl bg-accent/10 p-3 text-sm leading-relaxed text-violet-100">{summary}</p>
          </div>
        )}

        {panel === "services" && (
          <div className="flex flex-col gap-2">
            {mode === "monad" && (
              <p className="text-xs leading-relaxed text-subtle">
                New vaults do not use this list. The agent can call any of these. Toggles apply only to a practice vault.
              </p>
            )}
            {SERVICES.filter((item) => item.status === "live").map((item) => {
              const on = services.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-bg-elev px-3 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.name}</span>
                    <span className="block text-xs text-subtle">{item.novice}</span>
                  </span>
                  <span className={`relative h-6 w-11 shrink-0 rounded-full border ${on ? "border-accent bg-accent" : "border-border bg-bg"}`}>
                    <span className={`absolute top-0.5 block size-5 rounded-full ${on ? "translate-x-5 bg-accent-fg" : "translate-x-0.5 bg-fg"}`} />
                  </span>
                </button>
              );
            })}
            <Field
              label="Extra payees"
              hint={
                mode === "monad"
                  ? account
                    ? `You (${shortAddr(account)}) are added when Pay is on.`
                    : "Your address is added when Pay is on."
                  : `You (${shortAddr(SANDBOX_OWNER)}) are added automatically.`
              }
            >
              <input className={fieldClass} placeholder="0x…, 0x…" value={payees} onChange={(event) => setPayees(event.target.value)} spellCheck={false} />
            </Field>
          </div>
        )}

        {panel === "agent" && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-bg-elev p-1">
              {(
                [
                  ["monad", "On Monad"],
                  ["practice", "Practice"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMode(id)}
                  className={cn("h-10 rounded-lg text-sm font-medium", mode === id ? "bg-accent text-accent-fg" : "text-muted")}
                >
                  {label}
                </button>
              ))}
            </div>
            {mode === "monad" &&
              (
                [
                  ["wallet", "This wallet", "Trust signs create and every spend. The vault starts live, with no cap."],
                  ["new", "Separate key", "This browser signs spends. Trust signs create, then a gas transfer."],
                  ["external", "Existing agent", "Paste an address you already control."],
                ] as const
              ).map(([id, title, detail]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAgentMode(id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left",
                    agentMode === id ? "border-accent bg-accent/10" : "border-border bg-bg-elev",
                  )}
                >
                  <span className="block text-sm font-medium">{title}</span>
                  <span className="mt-1 block text-xs text-subtle">{detail}</span>
                </button>
              ))}
            {mode === "monad" && agentMode === "external" && (
              <Field label="Agent address">
                <input className={fieldClass} value={ext} onChange={(event) => setExt(event.target.value)} placeholder="0x…" spellCheck={false} />
              </Field>
            )}
            {mode === "practice" && (
              <Field label="Agent name">
                <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} maxLength={32} />
              </Field>
            )}
            {mode === "monad" && agentMode === "wallet" && (
              <Notice tone="muted">One signature creates a live vault with no cap and no allowlist. This wallet is the agent.</Notice>
            )}
            {mode === "monad" && agentMode === "new" && (
              <Notice tone="muted">The agent key stays in this browser. The vault starts live and does not enforce a spending cap.</Notice>
            )}
          </div>
        )}

        {panel === "spread" && <SpreadDesk />}

        {steps.length > 0 && (
          <ol className="mt-4 flex flex-col gap-2">
            {steps.map((step, index) => (
              <li key={`${step.label}-${index}`} className="text-sm">
                <span className={step.state === "err" ? "text-bad" : step.state === "ok" ? "text-ok" : "text-muted"}>{step.label}</span>
                {step.hash && (
                  <a className="ml-2 underline" href={explorerTx(step.hash)} target="_blank" rel="noreferrer">
                    tx
                  </a>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {panel !== "spread" && (
        <div className="shrink-0 border-t border-border bg-bg px-4 pt-3 pb-3">
          {launched ? (
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-12 rounded-2xl" onClick={onWatch}>
                Watch it live
              </Button>
              <Button className="h-12 rounded-2xl" variant="secondary" onClick={onManage}>
                Manage my agent
              </Button>
            </div>
          ) : mode === "monad" ? (
            <Button className="h-14 w-full rounded-2xl text-base" disabled={localBusy} onClick={deploy}>
              <Rocket className="size-5" />
              {cta}
            </Button>
          ) : (
            <Button className="h-14 w-full rounded-2xl text-base" disabled={busy} onClick={launch}>
              {cta}
            </Button>
          )}
          <p className="mt-2 text-center text-xs text-subtle">
            {mode === "monad"
              ? `${deposit} MON into a v4 vault · no cap · no allowlist · starts live`
              : "Practice ledger. Nothing is signed. Still capped at 1 MON."}
          </p>
        </div>
      )}
    </div>
  );
}

function monNum(value: string) {
  const next = Number(value);
  return Number.isFinite(next) ? next : 0;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (next: number) => void;
}) {
  const span = max - min || 1;
  const pct = clamp(((value - min) / span) * 100, 0, 100);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-mono text-accent tabular-nums">{value.toFixed(3)} MON</span>
      </span>
      <span className="relative mt-1 block h-11">
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-bg-subtle" aria-hidden>
          <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </span>
        <span
          className="pointer-events-none absolute top-1/2 size-7 -translate-y-1/2 rounded-full bg-fg ring-4 ring-accent/30"
          style={{ left: `clamp(0px, calc(${pct}% - 14px), calc(100% - 28px))` }}
          aria-hidden
        />
        <input
          type="range"
          suppressHydrationWarning
          style={{ caretColor: "transparent" }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          min={min}
          max={max}
          step={step}
          value={Number.isFinite(value) ? value : min}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </span>
    </label>
  );
}

function vaultFromReceipt(logs: { data: `0x${string}`; topics: [`0x${string}`, ...`0x${string}`[]] | readonly `0x${string}`[] }[]): Address | null {
  for (const log of logs) {
    try {
      const decoded = decodeEventLog({ abi: factoryAbi, data: log.data, topics: log.topics as [`0x${string}`, ...`0x${string}`[]] });
      if (decoded.eventName === "VaultCreated") return decoded.args.vault;
    } catch {
      /* other log */
    }
  }
  return null;
}

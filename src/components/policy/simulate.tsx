import { useEffect, useState } from "react";
import { Check, Minus, X } from "lucide-react";
import type { Address, Hex } from "viem";
import { Button } from "@/components/ui/button";
import { BudgetMeter, Field, Notice, fieldClass } from "@/components/policy/bits";
import { usePolicy } from "@/components/policy/state";
import { cn } from "@/lib/cn";
import { encodePause, explorerTx, requestId } from "@/lib/policy/chain";
import {
  INTENTS,
  REPLAY_KEY,
  shortAddr,
  suggestion,
  type ActionId,
  type Verdict,
} from "@/lib/policy/model";
import { runChainSuite, simulateOnChain, type PreparedTx } from "@/lib/policy/live";
import { runSuite, simulateCall } from "@/lib/policy/server";

type SuiteResult = {
  paused: boolean;
  blocked: number;
  total: number;
  results: { action: ActionId; title: string; status: "pass" | "fail"; code: string | null; reason: string }[];
};

export function SimulateScreen({ onLaunch }: { onLaunch: () => void }) {
  const { vault, busy, run, vaults, setActiveId, sendAgent, sendOwner, signerFor, account, setConnectOpen } = usePolicy();
  const [lane, setLane] = useState<"allow" | "break">("allow");
  const [action, setAction] = useState<ActionId>("pay");
  const [amount, setAmount] = useState("0.010");
  const [recipient, setRecipient] = useState("");
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [applied, setApplied] = useState(false);
  const [suite, setSuite] = useState<SuiteResult | null>(null);
  const [prepared, setPrepared] = useState<PreparedTx | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!vault) return;
    const next = suggestion(vault, action);
    setAmount(next.amountMon);
    setRecipient(next.recipient);
    setVerdict(null);
    setApplied(false);
    setSuite(null);
    setPrepared(null);
    setTxHash(null);
    setNote(null);
  }, [vault?.id, vault?.capWei, vault?.budgetWei, vault?.ownerAddress, action]);

  if (!vault) {
    return <p className="text-sm text-muted">Reading the ledger…</p>;
  }

  const hinted = suggestion(vault, action);
  const intents = INTENTS.filter((item) => item.lane === lane);
  const onChain = vault.source === "chain";
  const signer = signerFor(vault.agentAddress);
  const isOwner = !!account && account.toLowerCase() === vault.ownerAddress.toLowerCase();
  const attack = action.startsWith("x-");
  const canRun = onChain && !attack && !vault.paused && !!signer;
  const referencePaused = onChain && vault.id === "showcase" && vault.paused && !isOwner;

  async function broadcast(tx: PreparedTx, executor: string) {
    await run(async () => {
      const hash = await sendAgent(executor, {
        to: tx.to as Address,
        data: tx.data as Hex,
        value: BigInt(tx.value || "0"),
      });
      if (!hash) {
        setNote("This passes on Monad. This wallet is not the agent, so nothing was signed. Launch again and choose This wallet.");
        return { ok: true as const };
      }
      setTxHash(hash);
      setApplied(true);
      setNote(null);
      return { ok: true as const };
    });
  }

  async function runWild() {
    setTxHash(null);
    setNote(null);
    const request = requestId(`pp-${crypto.randomUUID()}`);
    const result = await run(() =>
      simulateOnChain({
        data: {
          address: vault!.address,
          action,
          amountMon: amount,
          recipient,
          request,
        },
      }),
    );
    if (!(result.ok && "verdict" in result && result.verdict)) return;
    setVerdict(result.verdict);
    setPrepared(result.prepared ?? null);
    setSuite(null);
    if (result.verdict.status !== "pass" || !result.prepared) {
      setApplied(false);
      return;
    }
    await broadcast(result.prepared, vault!.agentAddress);
  }

  async function liftPause() {
    if (!account) {
      setConnectOpen(true);
      return;
    }
    await run(() => sendOwner(encodePause(vault!.address as Address, false)).then(() => ({ ok: true as const })));
  }

  async function simulate() {
    setTxHash(null);
    setNote(null);
    if (onChain) {
      const request = action === "x-replay" ? undefined : requestId(`pp-${crypto.randomUUID()}`);
      const result = await run(() =>
        simulateOnChain({
          data: {
            address: vault!.address,
            action,
            amountMon: amount,
            recipient,
            request,
          },
        }),
      );
      if (result.ok && "verdict" in result && result.verdict) {
        setVerdict(result.verdict);
        setPrepared(result.prepared ?? null);
        setApplied(false);
        setSuite(null);
      }
      return;
    }
    const requestKey = action === "x-replay" ? REPLAY_KEY : `pp-${crypto.randomUUID()}`;
    const result = await run(() =>
      simulateCall({
        data: {
          vaultId: vault!.id,
          action,
          amountMon: amount,
          recipient,
          requestKey,
          apply: false,
        },
      }),
    );
    if (result.ok && "verdict" in result) {
      setVerdict(result.verdict);
      setApplied(false);
      setPrepared(null);
      setSuite(null);
    }
  }

  async function record() {
    if (onChain) {
      if (prepared) await broadcast(prepared, vault!.agentAddress);
      return;
    }
    const requestKey = action === "x-replay" ? REPLAY_KEY : `pp-${crypto.randomUUID()}`;
    const result = await run(() =>
      simulateCall({
        data: {
          vaultId: vault!.id,
          action,
          amountMon: amount,
          recipient,
          requestKey,
          apply: true,
        },
      }),
    );
    if (result.ok && "verdict" in result) {
      setVerdict(result.verdict);
      setApplied(result.applied);
      setSuite(null);
    }
  }

  async function stress() {
    if (onChain) {
      const result = await run(() => runChainSuite({ data: { address: vault!.address } }));
      if (result.ok && "results" in result) {
        setSuite({
          paused: result.paused,
          blocked: result.blocked,
          total: result.total,
          results: result.results,
        });
        setVerdict(null);
        setPrepared(null);
      }
      return;
    }
    const result = await run(() => runSuite({ data: { vaultId: vault!.id } }));
    if (result.ok && "results" in result) {
      setSuite({
        paused: result.paused,
        blocked: result.blocked,
        total: result.total,
        results: result.results,
      });
      setVerdict(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs text-subtle">{canRun ? "Live agent" : referencePaused ? "Reference vault" : "Monad mainnet"}</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Policy</h1>
        <p className="mt-1 text-sm text-muted">
          {canRun
            ? "One tap. The vault checks the call, then this wallet signs it on Monad."
            : referencePaused
              ? "Showcase is paused by its owner, so it cannot spend. Launch your own agent. It starts live, not paused."
              : onChain
                ? "A real eth_call, then a signature if the rules pass."
                : "Practice ledger. A pass only moves the budget if you record it."}
        </p>
      </header>

      {vaults.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {vaults.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveId(item.id)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-sm",
                item.id === vault.id ? "border-fg/30 bg-bg-subtle text-fg" : "border-border text-muted",
              )}
            >
              {item.name}
              {item.source === "chain" ? "" : " · practice"}
            </button>
          ))}
        </div>
      )}

      <BudgetMeter vault={vault} />
      {vault.paused && isOwner && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warn/40 px-3 py-2">
          <p className="text-sm text-warn">Paused. Lift it and the agent can spend again.</p>
          <Button size="sm" disabled={busy} onClick={liftPause}>
            Lift pause
          </Button>
        </div>
      )}
      {referencePaused && (
        <div className="flex flex-col gap-2">
          <p className="rounded-lg border border-border px-3 py-2 text-sm text-muted">
            This reference vault stays paused. New vaults do not. Yours starts live and can sign real transactions.
          </p>
          <Button onClick={onLaunch}>Let it go into the wild</Button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-bg-elev p-1">
        {(["allow", "break"] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setLane(item)}
            className={cn(
              "h-10 rounded-lg text-sm font-medium",
              lane === item ? "bg-bg-subtle text-fg" : "text-muted",
            )}
          >
            {item === "allow" ? "Allowed calls" : "Break it"}
          </button>
        ))}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {intents.map((item) => {
          const on = item.id === action;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setAction(item.id)}
              className={cn(
                "h-10 shrink-0 rounded-full border px-3 text-sm",
                on ? "border-fg/30 bg-bg-subtle text-fg" : "border-border text-muted",
              )}
            >
              {item.short}
            </button>
          );
        })}
      </div>
      <div>
        <p className="text-sm font-medium">{intents.find((item) => item.id === action)?.title}</p>
        <p className="text-sm text-muted">{intents.find((item) => item.id === action)?.detail}</p>
      </div>

      <Field label="Amount" hint={hinted.hint}>
        <input
          className={fieldClass}
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-label="Amount in MON"
        />
      </Field>
      <Field label="Recipient" hint={hinted.lockRecipient ? "Locked for this call." : "Full address."}>
        <input
          className={fieldClass}
          value={recipient}
          disabled={hinted.lockRecipient}
          onChange={(event) => setRecipient(event.target.value)}
          spellCheck={false}
          aria-label="Recipient address"
        />
      </Field>

      {referencePaused ? (
        <Button variant="secondary" disabled={busy} onClick={() => simulate()}>
          {busy ? "Running…" : "Simulate this vault"}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button disabled={busy} onClick={() => (canRun ? runWild() : simulate())}>
            {busy ? "Running…" : canRun ? "Run on Monad" : attack ? "Attack" : "Simulate"}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={stress}>
            Run the suite
          </Button>
        </div>
      )}

      {verdict && (
        <article className="rounded-3xl border border-border bg-bg-elev p-4">
          <p className={cn("text-xs font-medium", verdict.status === "pass" ? "text-ok" : "text-bad")}>
            {verdict.status === "pass" ? (onChain ? "eth_call passed" : "Precheck agrees with the vault") : onChain ? "eth_call reverted" : "Precheck agrees — blocked"}
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight">
            {verdict.status === "pass" ? "Would pass" : "Blocked"}
          </h2>
          {verdict.code && <p className="mt-1 font-mono text-sm text-fg">{verdict.code}</p>}
          <p className="mt-2 text-sm text-muted">{verdict.reason}</p>
          <p className="mt-2 font-mono text-xs text-subtle">
            {onChain ? "Monad eth_call" : "practice"} · {verdict.recipient ? shortAddr(verdict.recipient) : "no recipient"}
            {applied ? " · recorded" : ""}
          </p>
          <ol className="mt-4 flex flex-col gap-2">
            {verdict.trace.map((step) => (
              <li key={step.label} className="flex items-start gap-2 text-sm">
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                    step.state === "pass" && "border-ok/50 text-ok",
                    step.state === "fail" && "border-bad/50 text-bad",
                    step.state === "skip" && "border-border text-subtle",
                  )}
                  aria-hidden
                >
                  {step.state === "skip" ? <Minus className="size-3" /> : step.state === "fail" ? <X className="size-3" /> : <Check className="size-3" />}
                </span>
                <span className="min-w-0">
                  <span className={cn("block font-medium", step.state === "skip" && "text-subtle")}>{step.label}</span>
                  <span className="block text-xs text-subtle">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>
          {verdict.status === "pass" && !applied && !onChain && (
            <Button className="mt-4 w-full" disabled={busy} onClick={record}>
              Record execution
            </Button>
          )}
          {verdict.status === "pass" && !applied && onChain && signer && prepared && (
            <Button className="mt-4 w-full" disabled={busy} onClick={record}>
              {signer === "key" ? "Broadcast with agent key" : "Broadcast from this wallet"}
            </Button>
          )}
          {verdict.status === "pass" && onChain && !signer && (
            <Notice tone="muted">Would pass. This agent signs somewhere else, so the call stays a simulation.</Notice>
          )}
          {note && <Notice tone="muted">{note}</Notice>}
          {txHash && (
            <a className="mt-3 block text-sm underline" href={explorerTx(txHash)} target="_blank" rel="noreferrer">
              View on MonadVision
            </a>
          )}
          {applied && !onChain && <Notice tone="ok">Recorded. The budget counter and vault balance both moved.</Notice>}
          {applied && onChain && <Notice tone="ok">Broadcast. The vault spent inside the rules you set.</Notice>}
        </article>
      )}

      {suite && (
        <article className="rounded-3xl border border-border bg-bg-elev p-4">
          <p className="text-xs text-subtle">Adversarial suite</p>
          <h2 className="mt-1 text-2xl font-medium tracking-tight tabular-nums">
            {suite.blocked}/{suite.total} blocked
          </h2>
          {suite.paused && (
            <p className="mt-2 text-sm text-muted">The vault is paused, so every call dies on the kill switch before the other rules.</p>
          )}
          <ul className="mt-4 flex flex-col gap-3">
            {suite.results.map((item) => (
              <li key={item.action} className="border-t border-border pt-3 first:border-t-0 first:pt-0">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium">{item.title}</span>
                  <span className={cn("font-mono text-xs", item.status === "fail" ? "text-bad" : "text-ok")}>
                    {item.code ?? "PASS"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtle">{item.reason}</p>
              </li>
            ))}
          </ul>
        </article>
      )}
    </div>
  );
}

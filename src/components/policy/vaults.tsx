import { useEffect, useState } from "react";
import * as Switch from "@radix-ui/react-switch";
import { formatUnits, type Address, type Hex } from "viem";
import { Button } from "@/components/ui/button";
import { BudgetMeter, Field, Notice, fieldClass } from "@/components/policy/bits";
import { usePolicy } from "@/components/policy/state";
import { cn } from "@/lib/cn";
import {
  RECEIPTS,
  encodeDeposit,
  encodeEmergency,
  encodePause,
  encodeWithdrawToken,
  erc20Abi,
  explorerAddr,
  explorerTx,
  requestId,
} from "@/lib/policy/chain";
import { formatMon, parseMon, serviceName, shortAddr, type ActionId } from "@/lib/policy/model";
import { simulateOnChain } from "@/lib/policy/live";
import { pullFunds, resetShowcase, setPaused } from "@/lib/policy/server";
import { reader } from "@/lib/policy/wallet";

const RUNS: { id: ActionId; label: string; amount: string }[] = [
  { id: "pay", label: "Pay", amount: "0.010" },
  { id: "uniswap", label: "Uniswap", amount: "0.020" },
  { id: "pancake", label: "Pancake", amount: "0.020" },
  { id: "kuru", label: "Kuru", amount: "0.020" },
  { id: "kintsu", label: "Kintsu", amount: "0.010" },
  { id: "apriori", label: "aPriori", amount: "0.010" },
  { id: "magma", label: "Magma", amount: "0.010" },
  { id: "wmon", label: "Wrap", amount: "0.010" },
];

export function VaultsScreen({ onRun }: { onRun: () => void }) {
  const { vault, vaults, census, setActiveId, busy, run, account, sendOwner, sendAgent, signerFor, setConnectOpen, setError } = usePolicy();
  const [gas, setGas] = useState("0.050");
  const [depositAmt, setDepositAmt] = useState("0.050");
  const [holdings, setHoldings] = useState<{ sym: string; address: Address; amount: bigint; decimals: number }[]>([]);
  const [runNote, setRunNote] = useState<string | null>(null);
  const [runHash, setRunHash] = useState<string | null>(null);

  useEffect(() => {
    if (!vault || vault.source !== "chain") {
      setHoldings([]);
      return;
    }
    let live = true;
    const address = vault.address as Address;
    Promise.all(
      RECEIPTS.map(async (token) => {
        const amount = await reader()
          .readContract({ address: token.address, abi: erc20Abi, functionName: "balanceOf", args: [address] })
          .catch(() => 0n);
        return { sym: token.sym, address: token.address, decimals: token.decimals, amount };
      }),
    ).then((rows) => {
      if (live) setHoldings(rows.filter((row) => row.amount > 0n));
    });
    return () => {
      live = false;
    };
  }, [vault]);

  if (!vault) return <p className="text-sm text-muted">Reading the ledger…</p>;

  const onChain = vault.source === "chain";
  const isOwner = !!account && account.toLowerCase() === vault.ownerAddress.toLowerCase();
  const signer = signerFor(vault.agentAddress);

  async function pause(paused: boolean) {
    if (!onChain) {
      await run(() => setPaused({ data: { vaultId: vault!.id, paused } }));
      return;
    }
    if (!isOwner) {
      setConnectOpen(true);
      return;
    }
    await run(() => sendOwner(encodePause(vault!.address as `0x${string}`, paused)).then(() => ({ ok: true as const })));
  }

  async function pull() {
    if (!onChain) {
      await run(() => pullFunds({ data: { vaultId: vault!.id } }));
      return;
    }
    if (!account || !isOwner) {
      setConnectOpen(true);
      return;
    }
    await run(() => sendOwner(encodeEmergency(vault!.address as Address)).then(() => ({ ok: true as const })));
  }

  async function deposit() {
    if (!account || !isOwner) {
      setConnectOpen(true);
      return;
    }
    const value = parseMon(depositAmt);
    if (value === null || value <= 0n) {
      setError("Enter a deposit in MON.");
      return;
    }
    await run(() => sendOwner(encodeDeposit(vault!.address as Address, value)).then(() => ({ ok: true as const })));
  }

  async function takeTokens() {
    if (!account || !isOwner) {
      setConnectOpen(true);
      return;
    }
    await run(async () => {
      for (const token of holdings) {
        await sendOwner(encodeWithdrawToken(vault!.address as Address, token.address, account, token.amount));
      }
      return { ok: true as const };
    });
  }

  async function runAction(action: ActionId, amountMon: string) {
    if (!vault || vault.source !== "chain") return;
    setRunNote(null);
    setRunHash(null);
    const recipient = action === "pay" ? vault.ownerAddress : vault.address;
    await run(async () => {
      const result = await simulateOnChain({
        data: {
          address: vault.address,
          action,
          amountMon,
          recipient,
          request: requestId(`pp-${crypto.randomUUID()}`),
        },
      });
      if (!result.ok || !("verdict" in result) || !result.verdict) return result;
      if (result.verdict.status !== "pass" || !result.prepared) {
        setRunNote(result.verdict.reason);
        return { ok: true as const };
      }
      const hash = await sendAgent(vault.agentAddress, {
        to: result.prepared.to as Address,
        data: result.prepared.data as Hex,
        value: BigInt(result.prepared.value || "0"),
      });
      if (!hash) {
        setRunNote("This passes the vault. Trust is not the agent on this vault, so nothing was signed. Launch again and choose This wallet.");
        return { ok: true as const };
      }
      setRunHash(hash);
      setRunNote("Broadcast on Monad.");
      return { ok: true as const };
    });
  }

  async function fundGas() {
    if (!account || !isOwner) {
      setConnectOpen(true);
      return;
    }
    const value = parseMon(gas);
    if (value === null || value <= 0n) {
      setError("Enter a gas amount in MON.");
      return;
    }
    await run(() =>
      sendOwner({ to: vault!.agentAddress as `0x${string}`, data: "0x", value }).then(() => ({ ok: true as const })),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-xs text-subtle">Your harnesses</p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight">Agents</h1>
        <p className="mt-1 text-sm text-muted">You stay the owner. Only an owner signature can pause or pull funds.</p>
        {census && census.v4 > 0 && (
          <p className="mt-2 text-sm leading-snug text-muted">
            {census.v4} unlimited vaults on the new factory. {census.live} still live
            {census.v4 > census.live ? `, ${census.v4 - census.live} paused` : ""}.{" "}
            {BigInt(census.heldWei) >= 10n ** 15n
              ? `${formatMon(census.heldWei)} MON is sitting in them.`
              : "None are holding MON right now."}{" "}
            Older factories: {census.v3} v3, {census.v2} v2, {census.v1} v1.
          </p>
        )}
      </header>

      <div className="flex gap-2 overflow-x-auto">
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

      <section className="rounded-3xl border border-border bg-bg-elev p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-medium tracking-tight">{vault.name}</h2>
            {onChain ? (
              <a className="mt-1 block break-all font-mono text-xs text-subtle underline" href={explorerAddr(vault.address)} target="_blank" rel="noreferrer">
                {vault.address}
              </a>
            ) : (
              <p className="mt-1 break-all font-mono text-xs text-subtle">{vault.address}</p>
            )}
          </div>
          <span className={cn("shrink-0 text-xs font-medium", vault.paused ? "text-warn" : "text-ok")}>
            {vault.paused ? "Paused" : "Live"}
          </span>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-subtle">Balance</dt>
            <dd className="font-mono tabular-nums">{formatMon(vault.balanceWei)} MON</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Agent gas</dt>
            <dd className="font-mono tabular-nums">{formatMon(vault.gasWei)} MON</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Owner</dt>
            <dd className="font-mono text-xs">{shortAddr(vault.ownerAddress)}</dd>
          </div>
          <div>
            <dt className="text-xs text-subtle">Agent</dt>
            <dd className="font-mono text-xs">{shortAddr(vault.agentAddress)}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-subtle">
          {onChain
            ? signer === "wallet"
              ? "This wallet signs every spend."
              : signer === "key"
                ? "The agent key in this browser signs spends."
                : account
                  ? "This wallet is not the agent, so it cannot sign spends. Launch again and choose This wallet."
                  : "Connect the agent wallet to sign spends."
            : "Practice vault. Pause and pull stay on the shared ledger."}
        </p>
      </section>

      {onChain && vault.id !== "showcase" && vault.paused && isOwner && (
        <Button onClick={() => pause(false)}>Lift pause</Button>
      )}
      {onChain && vault.id !== "showcase" && !vault.paused && (
        <div className="flex flex-wrap gap-2">
          {RUNS.filter((item) => vault.services.includes(item.id)).map((item) => (
            <Button key={item.id} variant="secondary" size="sm" disabled={busy || !signer} onClick={() => runAction(item.id, item.amount)}>
              {item.label}
            </Button>
          ))}
          <Button size="sm" disabled={busy || !signer} onClick={onRun}>
            Policy
          </Button>
        </div>
      )}
      {runNote && (
        <p className="text-sm text-muted">
          {runNote}
          {runHash && (
            <a className="ml-2 underline" href={explorerTx(runHash)} target="_blank" rel="noreferrer">
              tx
            </a>
          )}
        </p>
      )}

      <BudgetMeter vault={vault} />

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-elev px-3 py-3">
        <div>
          <p className="text-sm font-medium">Kill switch</p>
          <p className="text-xs text-subtle">
            {onChain && !isOwner ? `Only ${shortAddr(vault.ownerAddress)} can pause this vault.` : "Paused vaults revert every agent call."}
          </p>
        </div>
        <Switch.Root
          checked={vault.paused}
          disabled={busy || (onChain && !isOwner)}
          onCheckedChange={(paused) => pause(paused)}
          className="relative h-7 w-12 shrink-0 rounded-full border border-border bg-bg data-[state=checked]:bg-warn"
          aria-label="Pause vault"
        >
          <Switch.Thumb className="block size-5 translate-x-1 rounded-full bg-fg transition-transform data-[state=checked]:translate-x-6" />
        </Switch.Root>
      </div>

      <section>
        <h2 className="text-sm font-medium">Services on</h2>
        <ul className="mt-2 flex flex-wrap gap-2">
          {vault.services.length === 0 && <li className="text-xs text-subtle">None read from the vault.</li>}
          {vault.services.map((id) => (
            <li key={id} className="rounded-full border border-border px-3 py-1 text-xs text-muted">
              {serviceName(id)}
            </li>
          ))}
        </ul>
      </section>

      <Button variant="secondary" disabled={busy || (onChain && !isOwner)} onClick={pull}>
        {onChain ? "Pull everything back" : "Pull balance to owner"}
      </Button>
      {onChain && isOwner && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Deposit MON" hint="A real mainnet transfer. New vaults have no deposit cap. Older vaults still revert above their on-chain cap.">
              <input className={fieldClass} inputMode="decimal" value={depositAmt} onChange={(event) => setDepositAmt(event.target.value)} />
            </Field>
          </div>
          <Button className="mb-0.5 shrink-0" variant="secondary" disabled={busy} onClick={deposit}>
            Deposit
          </Button>
        </div>
      )}
      {onChain && isOwner && holdings.length > 0 && (
        <Button variant="secondary" disabled={busy} onClick={takeTokens}>
          Withdraw tokens ({holdings.map((token) => `${token.sym} ${formatUnits(token.amount, token.decimals)}`).join(", ")})
        </Button>
      )}
      {onChain && isOwner && (
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1">
            <Field label="Top up agent gas" hint="A normal MON transfer to the agent.">
              <input className={fieldClass} inputMode="decimal" value={gas} onChange={(event) => setGas(event.target.value)} />
            </Field>
          </div>
          <Button className="mb-0.5 shrink-0" variant="secondary" disabled={busy} onClick={fundGas}>
            Send
          </Button>
        </div>
      )}
      {onChain && !isOwner && <Notice tone="muted">Connect the owner wallet to pause, withdraw, or fund gas.</Notice>}
      {!onChain && vault.id === "showcase" && (
        <Button variant="ghost" disabled={busy} onClick={() => run(() => resetShowcase())}>
          Restore showcase counters
        </Button>
      )}
    </div>
  );
}

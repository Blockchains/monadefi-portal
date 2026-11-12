import { useEffect, useState } from "react";
import type { Address } from "viem";
import { Button } from "@/components/ui/button";
import { usePolicy } from "@/components/policy/state";
import { APRMON, aprioriAbi, encodeAprDeposit, encodeAprRequest, explainError } from "@/lib/policy/chain";
import { formatMon, parseMon } from "@/lib/policy/model";
import { reader } from "@/lib/policy/wallet";

const RESERVE = 50_000_000_000_000_000n;

export function MonaStake() {
  const { account, balanceWei, setConnectOpen, sendOwner, refreshChain } = usePolicy();
  const [amount, setAmount] = useState("0.25");
  const [shares, setShares] = useState<bigint | null>(null);
  const [worth, setWorth] = useState<bigint | null>(null);
  const [paused, setPaused] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!account) {
      setShares(null);
      setWorth(null);
      return;
    }
    let on = true;
    const pc = reader();
    Promise.all([
      pc.readContract({ address: APRMON, abi: aprioriAbi, functionName: "balanceOf", args: [account as Address] }),
      pc.readContract({ address: APRMON, abi: aprioriAbi, functionName: "paused" }).catch(() => false),
    ])
      .then(async ([held, isPaused]) => {
        if (!on) return;
        setShares(held);
        setPaused(Boolean(isPaused));
        if (held > 0n) {
          const assets = await pc.readContract({
            address: APRMON,
            abi: aprioriAbi,
            functionName: "convertToAssets",
            args: [held],
          });
          if (on) setWorth(assets);
        } else if (on) setWorth(0n);
      })
      .catch(() => {
        if (on) setNote("Could not read the aprMON position.");
      });
    return () => {
      on = false;
    };
  }, [account, rev]);

  useEffect(() => {
    const wei = parseMon(amount);
    if (!wei || wei <= 0n) {
      setPreview(null);
      return;
    }
    let on = true;
    reader()
      .readContract({ address: APRMON, abi: aprioriAbi, functionName: "previewDeposit", args: [wei] })
      .then((out) => {
        if (on) setPreview(formatMon(out, 4));
      })
      .catch(() => {
        if (on) setPreview(null);
      });
    return () => {
      on = false;
    };
  }, [amount]);

  const wallet = balanceWei ? BigInt(balanceWei) : 0n;
  const available = wallet > RESERVE ? wallet - RESERVE : 0n;

  function chip(pct: number) {
    if (available <= 0n) return;
    const wei = pct >= 100 ? available : (available * BigInt(pct)) / 100n;
    setAmount(formatMon(wei, 4));
  }

  async function deploy() {
    if (!account) {
      setConnectOpen(true);
      return;
    }
    const wei = parseMon(amount);
    if (wei === null || wei <= 0n) {
      setNote("Enter an amount in MON.");
      return;
    }
    if (available > 0n && wei > available) {
      setNote("Leave about 0.05 MON in the wallet for gas.");
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const hash = await sendOwner(encodeAprDeposit(wei, account as Address));
      await reader().waitForTransactionReceipt({ hash });
      setNote("Deposited into aprMON. Withdrawals are queued, then claimed.");
      await refreshChain(account);
      setRev((n) => n + 1);
    } catch (error) {
      setNote(explainError(error));
    } finally {
      setBusy(false);
    }
  }

  async function request(pct: number) {
    if (!account || !shares || shares <= 0n) return;
    const slice = pct >= 100 ? shares : (shares * BigInt(pct)) / 100n;
    if (slice <= 0n) return;
    setBusy(true);
    setNote(null);
    try {
      const hash = await sendOwner(encodeAprRequest(slice, account as Address));
      await reader().waitForTransactionReceipt({ hash });
      setNote("Withdrawal requested. Claim it in aPriori after it unlocks, usually 12–18 hours.");
      setRev((n) => n + 1);
    } catch (error) {
      setNote(explainError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-bg-elev p-3">
      <p className="text-xs font-medium text-violet-200">MonaDeFi · aPriori aprMON</p>
      <p className="mt-1 text-sm leading-snug">
        Stake MON from this wallet. You get aprMON. Return is variable. Withdrawals are requested, then claimed.
      </p>
      {account && worth !== null && shares !== null && shares > 0n && (
        <p className="mt-2 font-mono text-xs text-subtle">Position about {formatMon(worth, 4)} MON</p>
      )}
      <div className="mt-3 grid grid-cols-4 gap-1">
        {[25, 50, 75, 100].map((pct) => (
          <button key={pct} type="button" onClick={() => chip(pct)} className="h-9 rounded-lg border border-border text-xs font-medium">
            {pct === 100 ? "Max" : `${pct}%`}
          </button>
        ))}
      </div>
      <label className="mt-3 block text-sm">
        Amount
        <input
          className="mt-1 h-11 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </label>
      {preview && <p className="mt-2 text-xs text-subtle">About {preview} aprMON before rewards.</p>}
      <Button className="mt-3 h-12 w-full rounded-2xl" disabled={busy || paused} onClick={deploy}>
        {paused ? "aprMON deposits are paused" : busy ? "Confirm in your wallet…" : account ? "Deploy into aprMON" : "Connect, then deploy"}
      </Button>
      {shares !== null && shares > 0n && (
        <div className="mt-2 grid grid-cols-4 gap-1">
          {[25, 50, 75, 100].map((pct) => (
            <button
              key={`out-${pct}`}
              type="button"
              disabled={busy}
              onClick={() => request(pct)}
              className="h-9 rounded-lg bg-bg text-xs font-medium"
            >
              {pct === 100 ? "All" : `${pct}%`}
            </button>
          ))}
        </div>
      )}
      {shares !== null && shares > 0n && <p className="mt-1 text-center text-xs text-subtle">Request a withdrawal. Claiming stays with aPriori.</p>}
      {note && <p className="mt-2 text-xs text-muted">{note}</p>}
    </section>
  );
}

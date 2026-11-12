import { useEffect, useState } from "react";
import { formatUnits, getAddress, isAddress, parseEther, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { usePolicy } from "@/components/policy/state";
import { explainError, explorerTx } from "@/lib/policy/chain";
import {
  ROUGH_GAS_WEI,
  VENUES,
  explainSpread,
  minOuts,
  quoteRoundTrip,
  showMon,
  spreadAbi,
  spreadCaptureData,
  spreadDeployData,
  spreadGate,
  spreadWithdrawData,
  type SpreadQuote,
} from "@/lib/policy/spread";
import { reader } from "@/lib/policy/wallet";
import { fieldClass } from "@/components/policy/bits";

function usdc(value: bigint) {
  return `${Number(formatUnits(value, 6)).toLocaleString("en-US", { maximumFractionDigits: 4 })} USDC`;
}

export function SpreadDesk() {
  const { account, balanceWei, sendOwner, setConnectOpen, setError } = usePolicy();
  const [amount, setAmount] = useState("0.05");
  const [vault, setVault] = useState<Address | null>(null);
  const [snap, setSnap] = useState<{ pool: bigint; shares: bigint; yours: bigint } | null>(null);
  const [quote, setQuote] = useState<SpreadQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<{ ok: boolean; text: string; hash?: string } | null>(null);
  const [paste, setPaste] = useState("");
  const key = account ? `pp.spread.143.${account.toLowerCase()}` : "";

  useEffect(() => {
    if (!key) {
      setVault(null);
      return;
    }
    const saved = localStorage.getItem(key);
    setVault(saved && isAddress(saved) ? getAddress(saved) : null);
  }, [key]);

  useEffect(() => {
    if (!vault) {
      setSnap(null);
      return;
    }
    let on = true;
    const pc = reader();
    const who = account ?? "0x0000000000000000000000000000000000000000";
    Promise.all([
      pc.getBalance({ address: vault }),
      pc.readContract({ address: vault, abi: spreadAbi, functionName: "balanceOf", args: [who] }),
      pc.readContract({ address: vault, abi: spreadAbi, functionName: "assetsOf", args: [who] }),
    ])
      .then(([pool, shares, yours]) => {
        if (on) setSnap({ pool: pool as bigint, shares: shares as bigint, yours: yours as bigint });
      })
      .catch(() => {
        if (on) setSnap(null);
      });
    return () => {
      on = false;
    };
  }, [vault, account]);

  useEffect(() => {
    let wei = 0n;
    try {
      wei = parseEther(amount || "0");
    } catch {
      setQuote(null);
      return;
    }
    if (wei <= 0n) {
      setQuote(null);
      return;
    }
    let on = true;
    setQuoting(true);
    const timer = window.setTimeout(() => {
      quoteRoundTrip(wei)
        .then((next) => {
          if (!on) return;
          setQuote(next);
          setQuoteError(null);
        })
        .catch((error: unknown) => {
          if (!on) return;
          setQuote(null);
          setQuoteError(error instanceof Error ? error.message : "Quote failed");
        })
        .finally(() => {
          if (on) setQuoting(false);
        });
    }, 280);
    return () => {
      on = false;
      window.clearTimeout(timer);
    };
  }, [amount]);

  const walletBal = balanceWei ? BigInt(balanceWei) : null;
  const quoteForAmount = quote && quote.amount === parseSafe(amount) ? quote : null;
  const gate = spreadGate({
    account: !!account,
    vault: !!vault,
    amount,
    pool: snap?.pool ?? 0n,
    walletBal,
    quoting: quoting || (!!vault && !quoteForAmount && !quoteError),
    quoteOk: quoteForAmount ? quoteForAmount.ok : quoteError ? false : null,
  });

  function remember(next: Address) {
    if (key) localStorage.setItem(key, next);
    setVault(next);
  }

  async function go() {
    if (!account) {
      setConnectOpen(true);
      return;
    }
    if (!gate.ok) return;
    setBusy(true);
    setLine(null);
    setError(null);
    try {
      const size = parseEther(amount);
      if (!vault) {
        const hash = await sendOwner({ data: spreadDeployData(account), value: size });
        const receipt = await reader().waitForTransactionReceipt({ hash, timeout: 180_000 });
        if (!receipt.contractAddress) throw new Error("The pool address was missing from the receipt.");
        remember(receipt.contractAddress);
        setLine({ ok: true, text: `Opened ${receipt.contractAddress} with ${amount} MON.`, hash });
      } else {
        const current = quote && quote.amount === size ? quote : null;
        if (!current?.sell || !current.buy || !current.ok) throw new Error("That quote is no longer current.");
        const mins = minOuts(size, current.usdc, current.back);
        const hash = await sendOwner({
          to: vault,
          data: spreadCaptureData(current.sell, current.buy, size, mins.minUsdc, mins.minWmon),
          value: 0n,
        });
        setLine({
          ok: true,
          text: `Round trip submitted via ${VENUES[current.sell].name} then ${VENUES[current.buy].name}.`,
          hash,
        });
      }
    } catch (error) {
      const text = explainSpread(error, explainError(error));
      setLine({ ok: false, text });
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw() {
    if (!vault || !account || !snap || snap.shares === 0n) return;
    setBusy(true);
    setLine(null);
    try {
      const hash = await sendOwner({ to: vault, data: spreadWithdrawData(snap.shares), value: 0n });
      setLine({ ok: true, text: "Withdrew your shares to this wallet.", hash });
    } catch (error) {
      const text = explainSpread(error, explainError(error));
      setLine({ ok: false, text });
      setError(text);
    } finally {
      setBusy(false);
    }
  }

  async function usePaste() {
    if (!account) {
      setConnectOpen(true);
      return;
    }
    if (!isAddress(paste.trim())) {
      setError("Paste the pool address, starting with 0x.");
      return;
    }
    const next = getAddress(paste.trim());
    try {
      await reader().readContract({ address: next, abi: spreadAbi, functionName: "minProfitBps" });
    } catch {
      setError("That contract is not a PolicyPilot spread pool.");
      return;
    }
    remember(next);
    setPaste("");
  }

  const button =
    !account ? "Connect wallet" : gate.code === "open" ? `Open pool · ${amount} MON` : gate.code === "go" ? "Submit round trip" : "Waiting for a spread";

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Uniswap v3 against PancakeSwap v3. A round trip is sent only when the quote clears a 0.05% floor and a rough gas cost. Nothing is promised.
      </p>
      <div className="rounded-2xl border border-border bg-bg-elev p-3 text-xs">
        <Row label="Uniswap" value={quoteForAmount ? usdc(quoteForAmount.uni) : quoting ? "…" : "—"} />
        <Row label="PancakeSwap" value={quoteForAmount ? usdc(quoteForAmount.cake) : quoting ? "…" : "—"} />
        <Row
          label={quoteForAmount?.sell ? `Back via ${VENUES[quoteForAmount.buy!].name}` : "Round trip"}
          value={quoteForAmount?.sell ? showMon(quoteForAmount.back) : "—"}
        />
        <p className="mt-2 text-subtle">
          Profit {quoteForAmount ? showMon(quoteForAmount.profit) : "—"} · caller 10% {quoteForAmount ? showMon(quoteForAmount.bounty) : "—"} · rough gas {showMon(ROUGH_GAS_WEI)}
        </p>
        {quoteError && <p className="mt-2 text-bad">{quoteError}</p>}
      </div>
      <p className="text-xs text-subtle">
        Pool {showMon(snap?.pool ?? 0n)} · yours {showMon(snap?.yours ?? 0n)}
        {vault ? ` · ${vault.slice(0, 6)}…${vault.slice(-4)}` : ""}
      </p>
      <label className="text-xs text-subtle">
        {vault ? "Round trip (MON)" : "Deposit (MON)"}
        <input className={`${fieldClass} mt-1`} inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <p className={gate.ok ? "text-sm text-ok" : "text-sm text-muted"}>
        <span className="font-medium">{gate.label}.</span> {gate.detail}
      </p>
      <Button className="h-14 w-full rounded-3xl text-base" disabled={busy || (!gate.ok && !!account)} onClick={() => void go()}>
        {busy ? "Confirm in your wallet…" : button}
      </Button>
      {snap && snap.shares > 0n && (
        <Button variant="secondary" disabled={busy} onClick={() => void withdraw()}>
          Withdraw {showMon(snap.yours)}
        </Button>
      )}
      {line && (
        <p className={line.ok ? "text-sm text-ok" : "text-sm text-bad"}>
          {line.text}
          {line.hash && (
            <a className="ml-2 underline" href={explorerTx(line.hash)} target="_blank" rel="noreferrer">
              tx
            </a>
          )}
        </p>
      )}
      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void usePaste();
        }}
      >
        <input className={fieldClass} value={paste} onChange={(event) => setPaste(event.target.value)} placeholder="Existing pool 0x…" spellCheck={false} />
        <Button type="submit" variant="secondary" className="shrink-0">
          Use
        </Button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span className="text-muted">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function parseSafe(amount: string): bigint {
  try {
    return parseEther(amount || "0");
  } catch {
    return 0n;
  }
}

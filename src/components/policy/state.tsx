import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAddress, type Address, type Hex, type WalletClient } from "viem";
import type { Ledger } from "@/lib/policy/server";
import { chainHead, loadLedger } from "@/lib/policy/server";
import { syncChain, type FactoryCensus, type LiveVault } from "@/lib/policy/live";
import { SHOWCASE, explainError, type Prepared } from "@/lib/policy/chain";
import { shortAddr, type VaultView } from "@/lib/policy/model";
import {
  agentClient,
  canSignAs,
  discoverWallets,
  ensureChain,
  readAgentKey,
  reader,
  submitTx,
  walletFrom,
  warmFees,
  type Discovered,
  type Eip1193,
} from "@/lib/policy/wallet";

type Session = {
  provider: Eip1193 | null;
  wallet: WalletClient | null;
  account: Address | null;
  rawAccount: string | null;
};

type LiveSnap = { showcase: LiveVault; owned: LiveVault[]; recent: LiveVault[]; census: FactoryCensus };

type Ctx = {
  ledger: Ledger | null;
  vault: VaultView | null;
  vaults: VaultView[];
  census: FactoryCensus | null;
  activeId: string;
  setActiveId: (id: string) => void;
  error: string | null;
  setError: (value: string | null) => void;
  busy: boolean;
  block: number | null;
  chainOk: boolean;
  reload: () => Promise<void>;
  applyLedger: (ledger: Ledger, focusId?: string) => void;
  refreshChain: (owner?: string) => Promise<LiveSnap | null>;
  run: <T extends { ok: boolean; error?: string; ledger?: Ledger; id?: string }>(
    task: () => Promise<T>,
  ) => Promise<T | { ok: false; error: string }>;
  account: Address | null;
  walletName: string | null;
  balanceWei: string | null;
  wallets: Discovered[];
  connectOpen: boolean;
  setConnectOpen: (open: boolean) => void;
  connect: (wallet: Discovered, silent?: boolean) => Promise<void>;
  disconnect: () => void;
  sendOwner: (tx: { to?: Address; data: Hex; value: bigint }) => Promise<Hex>;
  sendAgent: (executor: string, tx: Prepared) => Promise<Hex | null>;
  signerFor: (executor: string) => "key" | "wallet" | null;
};

const PolicyCtx = createContext<Ctx | null>(null);

function chainView(live: LiveVault, id: string, name: string): VaultView {
  return {
    id,
    name,
    address: live.address,
    ownerAddress: live.owner,
    agentAddress: live.executor,
    budgetWei: live.budgetWei,
    capWei: live.capWei,
    spentWei: live.spentWei,
    balanceWei: live.balanceWei,
    gasWei: live.agentBalanceWei,
    paused: live.paused,
    services: live.services,
    payees: [live.owner],
    source: "chain",
  };
}

function mergeVaults(base: Ledger, live: LiveSnap | null): VaultView[] {
  const practice = base.vaults
    .filter((vault) => vault.id !== "showcase")
    .map((vault) => ({ ...vault, source: "sandbox" as const }));
  if (!live) return base.vaults.map((vault) => ({ ...vault, source: vault.source ?? "sandbox" }));
  const showcase = chainView(live.showcase, "showcase", "Showcase");
  const seen = new Set<string>([SHOWCASE.toLowerCase()]);
  const chain: VaultView[] = [];
  for (const vault of [...live.recent, ...live.owned]) {
    const key = vault.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    chain.push(chainView(vault, `chain:${key}`, shortAddr(vault.address)));
  }
  return [showcase, ...chain, ...practice];
}

export function PolicyProvider({ children, initial }: { children: ReactNode; initial: Ledger }) {
  const [ledger, setLedger] = useState<Ledger | null>(initial);
  const [live, setLive] = useState<LiveSnap | null>(null);
  const [activeId, setActiveId] = useState(initial.vaults[0]?.id ?? "showcase");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState<number | null>(null);
  const [chainOk, setChainOk] = useState(false);
  const [account, setAccount] = useState<Address | null>(null);
  const [walletName, setWalletName] = useState<string | null>(null);
  const [balanceWei, setBalanceWei] = useState<string | null>(null);
  const [wallets, setWallets] = useState<Discovered[]>([]);
  const [connectOpen, setConnectOpen] = useState(false);
  const ledgerRef = useRef(ledger);
  ledgerRef.current = ledger;
  const steered = useRef(false);
  const session = useRef<Session>({ provider: null, wallet: null, account: null, rawAccount: null });
  const chainReady = useRef(false);
  const accountRef = useRef<Address | null>(null);

  function applyLedger(next: Ledger, focusId?: string) {
    setLedger(next);
    setActiveId((current) => {
      const preferred = focusId ?? current;
      return preferred;
    });
  }

  async function reload() {
    const next = await loadLedger();
    applyLedger(next);
  }

  async function refreshChain(owner?: string): Promise<LiveSnap | null> {
    const who = owner ?? accountRef.current ?? undefined;
    const snap = await syncChain({ data: { owner: who } });
    if (!snap.ok) return null;
    const next = { showcase: snap.showcase, owned: snap.owned, recent: snap.recent, census: snap.census };
    setLive(next);
    setBlock(snap.block);
    setChainOk(true);
    if (!steered.current && ledgerRef.current) {
      steered.current = true;
      const views = mergeVaults(ledgerRef.current, next);
      const runnable = views.find(
        (vault) => vault.source === "chain" && vault.id !== "showcase" && !vault.paused && canSignAs(vault.agentAddress, accountRef.current),
      );
      if (runnable) {
        setActiveId((current) => {
          const selected = views.find((vault) => vault.id === current);
          if (!selected || selected.id === "showcase" || selected.paused) return runnable.id;
          return current;
        });
      }
    }
    if (accountRef.current) {
      const balance = await reader()
        .getBalance({ address: accountRef.current })
        .catch(() => null);
      if (balance !== null) setBalanceWei(balance.toString());
    }
    return next;
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("pp-vault");
    if (saved) setActiveId(saved);
    let on = true;
    loadLedger()
      .then((next) => {
        if (on) applyLedger(next, saved ?? undefined);
      })
      .catch((err: unknown) => {
        if (on) setError(err instanceof Error ? err.message : "Could not load the ledger.");
      });
    refreshChain().catch(() => {
      if (on) setChainOk(false);
    });
    return () => {
      on = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeId) window.localStorage.setItem("pp-vault", activeId);
  }, [activeId]);

  useEffect(() => {
    warmFees();
    let on = true;
    const pull = () => {
      chainHead()
        .then((head) => {
          if (!on) return;
          setChainOk(head.ok);
          if (head.block) setBlock(head.block);
        })
        .catch(() => {
          if (on) setChainOk(false);
        });
      refreshChain().catch(() => undefined);
    };
    const timer = window.setInterval(pull, 20000);
    return () => {
      on = false;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => discoverWallets(setWallets), []);

  const tried = useRef(false);
  useEffect(() => {
    if (tried.current || wallets.length === 0) return;
    const saved = window.localStorage.getItem("pp.wallet");
    const found = wallets.find((item) => item.info.rdns === saved);
    if (!found) return;
    tried.current = true;
    connect(found, true).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets]);

  async function connect(discovered: Discovered, silent = false) {
    try {
      const method = silent ? "eth_accounts" : "eth_requestAccounts";
      const accounts = (await discovered.provider.request({ method })) as string[];
      if (!accounts?.length) {
        if (!silent) setError("That wallet did not share an account.");
        return;
      }
      await ensureChain(discovered.provider);
      chainReady.current = true;
      const rawAccount = accounts[0];
      const next = getAddress(rawAccount);
      const client = walletFrom(discovered.provider, next);
      session.current = { provider: discovered.provider, wallet: client, account: next, rawAccount };
      accountRef.current = next;
      setAccount(next);
      setWalletName(discovered.info.name);
      window.localStorage.setItem("pp.wallet", discovered.info.rdns);
      setConnectOpen(false);
      const tagged = discovered.provider as Eip1193 & { __pp?: boolean };
      if (!tagged.__pp) {
        tagged.__pp = true;
        tagged.on?.("accountsChanged", (...args: unknown[]) => {
          const list = Array.isArray(args[0]) ? (args[0] as unknown[]) : [];
          const first = typeof list[0] === "string" ? list[0] : "";
          if (!/^0x[a-fA-F0-9]{40}$/.test(first)) {
            disconnect();
            return;
          }
          const address = getAddress(first);
          accountRef.current = address;
          setAccount(address);
          const current = session.current;
          if (current.provider) {
            session.current = { ...current, account: address, rawAccount: first, wallet: walletFrom(current.provider, address) };
          }
        });
      }
      const snap = await refreshChain(next);
      const runnable = snap?.owned.some((vault) => !vault.paused && canSignAs(vault.executor, next));
      if (!runnable && !window.location.hash.replace("#", "").match(/^(launch|activity|agents|services)$/)) {
        window.location.hash = "launch";
      }
    } catch (err) {
      if (!silent) setError(explainError(err));
    }
  }

  function disconnect() {
    window.localStorage.removeItem("pp.wallet");
    chainReady.current = false;
    session.current = { provider: null, wallet: null, account: null, rawAccount: null };
    accountRef.current = null;
    setAccount(null);
    setWalletName(null);
    setBalanceWei(null);
    setConnectOpen(false);
    refreshChain("").catch(() => undefined);
  }

  async function sendOwner(tx: { to?: Address; data: Hex; value: bigint }) {
    const current = session.current;
    if (!current.provider || !current.wallet || !current.account) {
      setConnectOpen(true);
      throw new Error("Connect the owner wallet first.");
    }
    const hash = await submitTx(current.wallet, tx, current.provider, current.rawAccount || current.account);
    refreshChain(current.account).catch(() => undefined);
    return hash;
  }

  async function sendAgent(executor: string, tx: Prepared) {
    const current = session.current;
    if (current.account && current.wallet && current.provider && current.account.toLowerCase() === executor.toLowerCase()) {
      const hash = await submitTx(current.wallet, tx, current.provider, current.rawAccount || current.account);
      refreshChain(current.account).catch(() => undefined);
      return hash;
    }
    const key = readAgentKey(executor);
    if (key) {
      const hash = await submitTx(agentClient(key), tx);
      refreshChain(accountRef.current ?? undefined).catch(() => undefined);
      return hash;
    }
    return null;
  }

  async function run<T extends { ok: boolean; error?: string; ledger?: Ledger; id?: string }>(task: () => Promise<T>) {
    setBusy(true);
    setError(null);
    try {
      const result = await task();
      if (!result.ok) setError(result.error ?? "That did not go through.");
      else if (result.ledger) applyLedger(result.ledger, result.id);
      return result;
    } catch (err: unknown) {
      const message = explainError(err);
      setError(message);
      return { ok: false as const, error: message };
    } finally {
      setBusy(false);
    }
  }

  const vaults = useMemo(() => (ledger ? mergeVaults(ledger, live) : []), [ledger, live]);
  const vault = useMemo(
    () => vaults.find((item) => item.id === activeId) ?? vaults[0] ?? null,
    [vaults, activeId],
  );

  const value: Ctx = {
    ledger,
    vault,
    vaults,
    census: live?.census ?? null,
    activeId: vault?.id ?? activeId,
    setActiveId,
    error,
    setError,
    busy,
    block,
    chainOk,
    reload,
    applyLedger,
    refreshChain,
    run,
    account,
    walletName,
    balanceWei,
    wallets,
    connectOpen,
    setConnectOpen,
    connect,
    disconnect,
    sendOwner,
    sendAgent,
    signerFor: (executor) => canSignAs(executor, account),
  };

  return <PolicyCtx.Provider value={value}>{children}</PolicyCtx.Provider>;
}

export function usePolicy() {
  const ctx = useContext(PolicyCtx);
  if (!ctx) throw new Error("usePolicy must be used inside PolicyProvider");
  return ctx;
}

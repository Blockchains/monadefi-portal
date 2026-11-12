import { useState } from "react";
import { ChevronRight, Wallet, X } from "lucide-react";
import { usePolicy } from "@/components/policy/state";
import { Button } from "@/components/ui/button";
import { formatMon } from "@/lib/policy/model";
import { INSTALL, deepLinks, isMobile } from "@/lib/policy/wallet";

export function ConnectSheet() {
  const { connectOpen, setConnectOpen, wallets, connect, account, disconnect, balanceWei, walletName } = usePolicy();
  const [busy, setBusy] = useState<string | null>(null);
  if (!connectOpen || typeof window === "undefined") return null;
  const links = deepLinks(window.location.href);
  const mobile = isMobile();

  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end bg-bg/80">
      <button type="button" className="absolute inset-0" aria-label="Close wallet" onClick={() => setConnectOpen(false)} />
      <div
        role="dialog"
        aria-labelledby="wallet-title"
        className="relative max-h-[88%] overflow-y-auto rounded-t-3xl border border-border bg-bg-elev px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="wallet-title" className="text-lg font-medium tracking-tight">
              {account ? "Wallet" : "Connect a wallet"}
            </h2>
            <p className="mt-1 text-sm text-muted">Monad mainnet. The app adds the chain if your wallet does not have it.</p>
          </div>
          <button type="button" className="grid size-9 place-items-center rounded-full border border-border" onClick={() => setConnectOpen(false)} aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        {account && (
          <div className="mt-4 rounded-xl border border-border bg-bg px-3 py-3">
            <p className="text-sm font-medium">{walletName ?? "Connected"}</p>
            <p className="mt-1 break-all font-mono text-xs text-subtle">{account}</p>
            {balanceWei !== null && (
              <p className="mt-2 font-mono text-sm tabular-nums">{formatMon(balanceWei)} MON</p>
            )}
            <Button variant="secondary" size="sm" className="mt-3" onClick={disconnect}>
              Disconnect
            </Button>
          </div>
        )}

        <p className="mb-2 mt-4 text-xs text-subtle">In this browser</p>
        <ul className="flex flex-col gap-2">
          {wallets.map((item) => (
            <li key={item.info.uuid}>
              <button
                type="button"
                disabled={busy === item.info.uuid}
                onClick={async () => {
                  setBusy(item.info.uuid);
                  await connect(item);
                  setBusy(null);
                }}
                className="flex h-14 w-full items-center gap-3 rounded-xl border border-border bg-bg px-3 text-left"
              >
                {item.info.icon ? (
                  <img src={item.info.icon} alt="" className="size-8 rounded-lg" />
                ) : (
                  <span className="grid size-8 place-items-center rounded-lg bg-bg-subtle">
                    <Wallet className="size-4" />
                  </span>
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.info.name}</span>
                <span className="text-xs text-subtle">{busy === item.info.uuid ? "Approve in the wallet" : "Connect"}</span>
                <ChevronRight className="size-4 text-subtle" />
              </button>
            </li>
          ))}
          {wallets.length === 0 && (
            <li className="rounded-xl border border-dashed border-border px-3 py-3 text-sm text-muted">
              {mobile
                ? "Trust Wallet is not injected in this view. Open this page inside Trust, then connect there."
                : "No wallet announced itself. Install one, then reload."}
            </li>
          )}
        </ul>

        {mobile && (
          <a
            href={links.find((link) => link.id === "trust")?.href ?? links[0]?.href}
            className="mt-4 flex h-12 items-center justify-center rounded-2xl bg-accent px-3 text-sm font-medium text-accent-fg"
          >
            Open in Trust Wallet
          </a>
        )}

        <p className="mb-2 mt-5 text-xs text-subtle">{mobile ? "Or another wallet app" : "Phone wallets"}</p>
        <ul className="grid grid-cols-2 gap-2">
          {links.map((link) => (
            <li key={link.id}>
              <a
                href={link.href}
                className="flex h-11 items-center justify-center rounded-xl border border-border bg-bg px-2 text-sm"
              >
                {link.name}
              </a>
            </li>
          ))}
        </ul>
        {!mobile && wallets.length === 0 && (
          <p className="mt-3 text-xs text-subtle">
            {INSTALL.map((item) => (
              <a key={item.name} href={item.href} target="_blank" rel="noreferrer" className="mr-3 underline">
                {item.name}
              </a>
            ))}
          </p>
        )}
        <p className="mt-4 text-xs text-subtle">
          Open this page inside Trust Wallet, connect, then tap Let it go into the wild. This wallet is the agent, so Trust signs the spend. New vaults start live.
        </p>
      </div>
    </div>
  );
}

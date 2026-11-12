import {
  createWalletClient,
  custom,
  getAddress,
  http,
  numberToHex,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { FACTORY, MONAD_EXPLORER, MONAD_HEX, MONAD_ID, MONAD_RPCS, monadChain, publicClient, type Prepared } from "@/lib/policy/chain";

export type Eip1193 = {
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>;
  on?: (event: string, fn: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, fn: (...args: unknown[]) => void) => void;
};

export type WalletInfo = { uuid: string; name: string; icon: string; rdns: string };
export type Discovered = { info: WalletInfo; provider: Eip1193 };

type Flagged = Eip1193 & {
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isRabby?: boolean;
  isPhantom?: boolean;
  isCoinbaseWallet?: boolean;
  isOkxWallet?: boolean;
  isMetaMask?: boolean;
  providers?: Flagged[];
};

export function parseChainId(value: unknown): number {
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = String(value ?? "").trim();
  if (!text) return 0;
  if (/^0x/i.test(text)) return Number.parseInt(text, 16);
  return Number.parseInt(text, 10);
}

export function isTrustProvider(provider: Eip1193): boolean {
  const row = provider as Flagged;
  return Boolean(row.isTrust || row.isTrustWallet);
}

function walletName(provider: Flagged, fallback: string): string {
  if (provider.isTrust || provider.isTrustWallet || fallback === "Trust Wallet") return "Trust Wallet";
  if (provider.isRabby) return "Rabby";
  if (provider.isPhantom) return "Phantom";
  if (provider.isCoinbaseWallet) return "Coinbase Wallet";
  if (provider.isOkxWallet) return "OKX Wallet";
  if (provider.isMetaMask) return "MetaMask";
  return fallback;
}

function injectedProviders(): Discovered[] {
  const host = window as unknown as { ethereum?: Flagged; trustwallet?: Flagged & { ethereum?: Flagged } };
  const providers: { provider: Flagged; fallback: string }[] = [];
  if (host.trustwallet) providers.push({ provider: host.trustwallet, fallback: "Trust Wallet" });
  if (host.trustwallet?.ethereum) providers.push({ provider: host.trustwallet.ethereum, fallback: "Trust Wallet" });
  if (host.ethereum?.providers) {
    for (const provider of host.ethereum.providers) {
      if (provider) providers.push({ provider, fallback: "Browser wallet" });
    }
  }
  if (host.ethereum) providers.push({ provider: host.ethereum, fallback: "Browser wallet" });
  return providers.map(({ provider, fallback }) => {
    const name = walletName(provider, fallback);
    const rdns = name === "Trust Wallet" ? "com.trustwallet.app" : `legacy.${name.toLowerCase().replace(/\s+/g, "")}`;
    return { info: { uuid: rdns, name, icon: "", rdns }, provider };
  });
}

export function discoverWallets(onChange: (list: Discovered[]) => void): () => void {
  const map = new Map<string, Discovered>();
  const emit = () => onChange([...map.values()]);
  const remember = (item: Discovered) => {
    const rdns = item.info.rdns || item.info.uuid;
    if ([...map.values()].some((have) => have.provider === item.provider || (rdns && have.info.rdns === rdns))) return;
    map.set(item.info.uuid || rdns, item);
    emit();
  };
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent).detail as Discovered;
    if (!detail?.info?.uuid || !detail.provider?.request) return;
    if (isTrustProvider(detail.provider)) {
      detail.info = { ...detail.info, name: "Trust Wallet", rdns: detail.info.rdns || "com.trustwallet.app" };
    }
    remember(detail);
  };
  window.addEventListener("eip6963:announceProvider", onAnnounce);
  window.dispatchEvent(new Event("eip6963:requestProvider"));
  const scan = () => {
    for (const item of injectedProviders()) remember(item);
  };
  scan();
  const timers = [400, 1200, 2500].map((ms) => window.setTimeout(scan, ms));
  return () => {
    window.removeEventListener("eip6963:announceProvider", onAnnounce);
    for (const timer of timers) window.clearTimeout(timer);
  };
}

export function isMobile(): boolean {
  return typeof navigator !== "undefined" && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

export function deepLinks(url: string) {
  const parsed = new URL(url);
  const bare = parsed.host + parsed.pathname + parsed.search;
  const enc = encodeURIComponent(url);
  const ref = encodeURIComponent(parsed.origin);
  return [
    { id: "trust", name: "Trust Wallet", href: `https://link.trustwallet.com/open_url?coin_id=60&url=${enc}` },
    { id: "metamask", name: "MetaMask", href: `https://link.metamask.io/dapp/${bare}` },
    { id: "phantom", name: "Phantom", href: `https://phantom.com/ul/browse/${enc}?ref=${ref}` },
    { id: "coinbase", name: "Coinbase Wallet", href: `https://go.cb-w.com/dapp?cb_url=${enc}` },
    { id: "okx", name: "OKX Wallet", href: `okx://wallet/dapp/url?dappUrl=${enc}` },
    { id: "backpack", name: "Backpack", href: `https://backpack.app/ul/v1/browse/${enc}?ref=${ref}` },
  ];
}

export const INSTALL = [
  { name: "Trust Wallet", href: "https://trustwallet.com/download" },
  { name: "MetaMask", href: "https://metamask.io/download/" },
  { name: "Rabby", href: "https://rabby.io/" },
  { name: "Phantom", href: "https://phantom.com/download" },
  { name: "Backpack", href: "https://backpack.app/" },
  { name: "OKX Wallet", href: "https://web3.okx.com/download" },
  { name: "Coinbase Wallet", href: "https://www.coinbase.com/wallet/downloads" },
];

function keyName(executor: string) {
  return `pp.agentkey.${executor.toLowerCase()}`;
}

export function readAgentKey(executor: string): Hex | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(keyName(executor));
  return raw && /^0x[a-fA-F0-9]{64}$/.test(raw) ? (raw as Hex) : null;
}

export function storeAgentKey(executor: string, key: Hex) {
  localStorage.setItem(keyName(executor), key);
}

export function mintAgent(): { key: Hex; address: Address } {
  const key = generatePrivateKey();
  const address = privateKeyToAccount(key).address;
  storeAgentKey(address, key);
  return { key, address };
}

export function canSignAs(executor: string, account: string | null): "key" | "wallet" | null {
  if (account && account.toLowerCase() === executor.toLowerCase()) return "wallet";
  if (readAgentKey(executor)) return "key";
  return null;
}

export function userRejected(error: unknown): boolean {
  const row = error as { code?: number | string; message?: string; shortMessage?: string };
  const code = Number(row?.code);
  const message = `${row?.shortMessage ?? ""} ${row?.message ?? ""}`;
  return code === 4001 || /reject|denied|cancel/i.test(message);
}

export async function ensureChain(provider: Eip1193) {
  const current = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (current === MONAD_ID) return;
  const add = () =>
    provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: MONAD_HEX,
          chainName: "Monad",
          nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
          rpcUrls: [MONAD_RPCS[0]],
          blockExplorerUrls: [MONAD_EXPLORER],
        },
      ],
    });
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_HEX }] });
  } catch (error) {
    if (userRejected(error)) throw error;
    await add();
    try {
      await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_HEX }] });
    } catch (again) {
      if (userRejected(again)) throw again;
    }
  }
  const after = parseChainId(await provider.request({ method: "eth_chainId" }));
  if (after !== MONAD_ID) throw new Error("Switch your wallet to Monad mainnet, then tap the button again.");
}

export function walletFrom(provider: Eip1193, account: Address): WalletClient {
  return createWalletClient({ account, chain: monadChain, transport: custom(provider) });
}

export function agentClient(key: Hex): WalletClient {
  return createWalletClient({
    account: privateKeyToAccount(key),
    chain: monadChain,
    transport: http(MONAD_RPCS[0], { timeout: 20_000 }),
  });
}

function gasFor(tx: { data?: Hex }): bigint {
  const data = tx.data ?? "0x";
  if (data === "0x") return 21_000n;
  if (data.length > 8000) return 2_800_000n;
  if (data.length > 1800) return 1_200_000n;
  return 450_000n;
}

/** Latest factory creates use eth_estimateGas + 10%. Fallback 2,600,000 if the RPC cannot estimate. */
async function limitFor(from: string, tx: { to?: Address; data: Hex; value: bigint }): Promise<bigint> {
  try {
    const estimated = await publicClient().estimateGas({
      account: from as Address,
      ...(tx.to ? { to: tx.to } : {}),
      data: tx.data && tx.data !== "0x" ? tx.data : undefined,
      value: tx.value,
    });
    const padded = (estimated * 11n) / 10n;
    return padded > 21_000n ? padded : 21_000n;
  } catch {
    if (tx.to?.toLowerCase() === FACTORY.toLowerCase()) return 2_600_000n;
    return gasFor(tx);
  }
}

const FEE_FALLBACK = 120_000_000_000n;
let feeCache = FEE_FALLBACK;

export function warmFees() {
  publicClient()
    .getGasPrice()
    .then((price) => {
      if (price > 0n) feeCache = (price * 12n) / 10n;
    })
    .catch(() => undefined);
}

function resolveProvider(current: Eip1193): Eip1193 {
  if (typeof window === "undefined" || !isTrustProvider(current)) return current;
  const host = window as unknown as { ethereum?: Flagged; trustwallet?: Flagged & { ethereum?: Flagged } };
  const live = [host.trustwallet, host.trustwallet?.ethereum, host.ethereum].find(
    (item) => item?.request && (item.isTrust || item.isTrustWallet || item === host.trustwallet),
  );
  return live?.request ? live : current;
}

function unwrapHash(hash: unknown): Hex {
  if (typeof hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(hash.trim())) return hash.trim() as Hex;
  if (hash && typeof hash === "object") {
    const row = hash as { result?: unknown; hash?: unknown };
    const inner = typeof row.hash === "string" ? row.hash : row.result;
    if (typeof inner === "string" && /^0x[0-9a-fA-F]{64}$/.test(inner.trim())) return inner.trim() as Hex;
  }
  throw new Error("The wallet closed without a signature. Approve the confirm sheet, then tap again.");
}

function relayable(error: unknown): boolean {
  if (userRejected(error)) return false;
  const row = error as { message?: string; shortMessage?: string; name?: string };
  const message = `${row.name ?? ""} ${row.shortMessage ?? ""} ${row.message ?? ""}`;
  if (/revert|paused|notexecutor|notowner|exceeded|allow|insufficient|rejected|denied/i.test(message)) return false;
  return /fetch|network|cors|timeout|broadcast|http|failed to send|load failed/i.test(message);
}

async function sendRaw(provider: Eip1193, from: string, tx: { to?: Address; data: Hex; value: bigint }, gas?: bigint): Promise<Hex> {
  const live = resolveProvider(provider);
  const gasLimit = gas && gas > 0n ? gas : await limitFor(from, tx);
  const price = feeCache > 0n ? feeCache : FEE_FALLBACK;
  const base: Record<string, string> = {
    from,
    data: tx.data && tx.data !== "0x" ? tx.data : "0x",
    value: numberToHex(tx.value),
    gas: numberToHex(gasLimit),
  };
  if (tx.to) base.to = tx.to;
  try {
    return unwrapHash(
      await live.request({
        method: "eth_sendTransaction",
        params: [{ ...base, gasPrice: numberToHex(price) }],
      }),
    );
  } catch (error) {
    if (userRejected(error)) throw error;
    const row = error as { code?: number; message?: string };
    const message = row.message ?? "";
    const feeRejected = row.code === -32602 || /gasPrice|maxFee|eip-1559|invalid param/i.test(message);
    if (!feeRejected) throw error;
    const tip = price / 10n > 0n ? price / 10n : 1n;
    return unwrapHash(
      await live.request({
        method: "eth_sendTransaction",
        params: [{ ...base, maxFeePerGas: numberToHex(price), maxPriorityFeePerGas: numberToHex(tip) }],
      }),
    );
  }
}

/** Submit to the connected wallet, or sign the agent key in the browser. Does not wait for a receipt. */
export async function submitTx(
  client: WalletClient,
  tx: { to?: Address; data: Hex; value: bigint },
  provider?: Eip1193 | null,
  fromAddress?: string | null,
): Promise<Hex> {
  const account = client.account;
  if (!account) throw new Error("Connect the owner wallet first.");
  const from = fromAddress || account.address;
  if (provider) return sendRaw(provider, from, tx);
  const gas = await limitFor(from, tx);
  try {
    return await client.sendTransaction({
      account,
      chain: monadChain,
      ...(tx.to ? { to: tx.to } : {}),
      data: tx.data === "0x" ? undefined : tx.data,
      value: tx.value,
      gas,
    });
  } catch (error) {
    if (!relayable(error)) throw error;
    const pc = publicClient();
    const [nonce, gasPrice] = await Promise.all([
      pc.getTransactionCount({ address: account.address, blockTag: "pending" }),
      pc.getGasPrice().catch(() => feeCache),
    ]);
    const signed = await client.signTransaction({
      account,
      chain: monadChain,
      ...(tx.to ? { to: tx.to } : {}),
      data: tx.data === "0x" ? undefined : tx.data,
      value: tx.value,
      gas,
      nonce,
      gasPrice,
      type: "legacy",
    });
    const { broadcastRaw } = await import("@/lib/policy/live");
    const sent = await broadcastRaw({ data: { raw: signed } });
    if (!sent.ok || !sent.hash) throw new Error(!sent.ok ? sent.error : "The agent transaction was not broadcast.");
    return sent.hash;
  }
}

export async function sendAndWait(
  client: WalletClient,
  reader: PublicClient,
  tx: Prepared,
  provider?: Eip1193 | null,
  fromAddress?: string | null,
) {
  const hash = await submitTx(client, tx, provider, fromAddress);
  const receipt = await reader.waitForTransactionReceipt({ hash, timeout: 180_000 });
  if (receipt.status !== "success") throw new Error("The transaction reverted on Monad.");
  return { hash, receipt };
}

export function reader() {
  return publicClient();
}

export { getAddress };

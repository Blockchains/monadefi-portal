import {
  createPublicClient,
  decodeErrorResult,
  defineChain,
  encodeFunctionData,
  fallback,
  http,
  keccak256,
  parseAbi,
  parseAbiItem,
  toHex,
  type Address,
  type Hex,
} from "viem";
import type { ActionId } from "@/lib/policy/model";

export const MONAD_ID = 143;
export const MONAD_HEX = "0x8f";
export const MONAD_RPCS = [
  "https://rpc.monad.xyz",
  "https://rpc1.monad.xyz",
  "https://rpc3.monad.xyz",
  "https://rpc-mainnet.monadinfra.com",
] as const;
export const MONAD_EXPLORER = "https://monadvision.com";
export const UNLIMITED = "0x41d6667aA35c3634D19068A39481d4c955f6557D" as Address;
export const V3 = "0x52727226aF0efe2bfe3E5c97e46B704613344a92" as Address;
export const V2 = "0x0342d29055d77ba155c50233f550539E3029BA6a" as Address;
export const V1 = "0x8738B74778502ff3623A8319837A819d8dBdEeB7" as Address;
/** New vaults since 18 Oct 2026: UnlimitedAgentVaultFactory. createVault(executor), no caps. */
export const FACTORY = UNLIMITED;
export const LEGACY = V1;
export const FACTORIES = [UNLIMITED, V3, V2, V1] as const;
export const SHOWCASE = "0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97" as Address;
export const ZERO = "0x0000000000000000000000000000000000000000" as Address;
export const DEAD = "0x000000000000000000000000000000000000dEaD" as Address;

export const WMON = "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A" as Address;
export const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603" as Address;
export const SMON = "0xA3227C5969757783154C60bF0bC1944180ed81B9" as Address;
export const APRMON = "0x0c65A0BC65a5D819235B71F554D210D3F80E0852" as Address;
export const GMON = "0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081" as Address;

export const KURU = {
  router: "0xd651346d7c789536ebf06dc72aE3C8502cd695CC" as Address,
  monUsdc: "0x065C9d28E428A0db40191a54d33d5b7c71a9C394" as Address,
} as const;

export const RECEIPTS = [
  { sym: "WMON", address: WMON, decimals: 18 },
  { sym: "USDC", address: USDC, decimals: 6 },
  { sym: "sMON", address: SMON, decimals: 18 },
  { sym: "aprMON", address: APRMON, decimals: 18 },
  { sym: "gMON", address: GMON, decimals: 18 },
] as const;

export const RULES = [
  { id: "uniswap", address: "0xfE31F71C1b106EAc32F1A19239c9a9A72ddfb900" as Address, selector: "0x04e45aaf" as Hex, word: 3 },
  { id: "pancake", address: "0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C" as Address, selector: "0x04e45aaf" as Hex, word: 3 },
  { id: "kintsu", address: SMON, selector: "0x1c3477dd" as Hex, word: 1 },
  { id: "apriori", address: APRMON, selector: "0x6e553f65" as Hex, word: 1 },
  { id: "magma", address: GMON, selector: "0x5f3896d3" as Hex, word: 0 },
  { id: "wmon", address: WMON, selector: "0xd0e30db0" as Hex, word: 255 },
  { id: "wmon", address: WMON, selector: "0x2e1a7d4d" as Hex, word: 255 },
  { id: "kuru", address: KURU.router, selector: "0xffa5210a" as Hex, word: 255 },
] as const;

export const QUOTERS = {
  uniswap: { address: "0x661e93cca42afacb172121ef892830ca3b70f08d" as Address, fee: 3000 },
  pancake: { address: "0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997" as Address, fee: 500 },
} as const;

export const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11" as Address;

export const monadChain = defineChain({
  id: MONAD_ID,
  name: "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [...MONAD_RPCS] } },
  blockExplorers: { default: { name: "MonadVision", url: MONAD_EXPLORER } },
  contracts: { multicall3: { address: MULTICALL3, blockCreated: 0 } },
});

export function publicClient() {
  return createPublicClient({
    chain: monadChain,
    batch: { multicall: { batchSize: 4096, wait: 20 } },
    transport: fallback(
      MONAD_RPCS.map((url) => http(url, { batch: false, retryCount: 0, timeout: 8_000 })),
      { rank: false },
    ),
  });
}

export const vaultAbi = parseAbi([
  "function owner() view returns (address)",
  "function executor() view returns (address)",
  "function perPaymentCap() view returns (uint256)",
  "function budget() view returns (uint256)",
  "function totalSpent() view returns (uint256)",
  "function remainingBudget() view returns (uint256)",
  "function paused() view returns (bool)",
  "function allowedRecipient(address) view returns (bool)",
  "function callRule(address, bytes4) view returns (bool allowed, uint8 recipientWord)",
  "function executed(bytes32) view returns (bool)",
  "function setPaused(bool p)",
  "function withdraw(address to, uint256 amount)",
  "function deposit() payable",
  "function emergencyWithdrawAll()",
  "function withdrawToken(address token, address to, uint256 amount)",
  "function execute(bytes32 requestId, address recipient, uint256 amount)",
  "function executeCall(bytes32 requestId, address target, uint256 value, bytes data, (address approveToken, uint256 approveAmount, address outToken, uint256 minOut) o) returns (bytes)",
  "event Executed(bytes32 requestId, address recipient, uint256 amount, uint256 totalSpent)",
  "event Withdrawn(address to, uint256 amount, uint256 balance)",
  "event PausedSet(bool paused)",
  "event DappCalled(bytes32 requestId, address target, bytes4 selector, uint256 value, address outToken, uint256 outAmount, uint256 totalSpent)",
  "error Paused()",
  "error NotExecutor()",
  "error NotOwner()",
  "error RequestAlreadyExecuted(bytes32 requestId)",
  "error RecipientNotAllowed(address recipient)",
  "error PerPaymentCapExceeded(uint256 amount, uint256 cap)",
  "error BudgetExceeded(uint256 amount, uint256 remaining)",
  "error CallNotAllowed(address target, bytes4 selector)",
  "error RecipientMustBeVault(address recipient)",
  "error ForbiddenSelector(bytes4 selector)",
  "error InsufficientBalance(uint256 need, uint256 have)",
  "error ZeroAmount()",
  "error MinOutNotMet(uint256 got, uint256 minOut)",
]);

export const factoryAbi = parseAbi([
  "function createVault(address executor, uint256 perPaymentCap, uint256 budget, address[] recipients, (address target, bytes4 selector, uint8 recipientWord)[] rules, (address token, uint256 cap)[] caps) payable returns (address)",
  "function vaultsOf(address owner) view returns (address[])",
  "function globalCap() view returns (uint256)",
  "function totalDeposited() view returns (uint256)",
  "event VaultCreated(address indexed owner, address indexed vault, address indexed executor)",
  "error GlobalCapExceeded(uint256 next, uint256 cap)",
  "error VaultCapExceeded(uint256 next, uint256 cap)",
]);

/** v4 UnlimitedAgentVaultFactory. Same VaultCreated event as the older factories. */
export const unlimitedFactoryAbi = parseAbi([
  "function createVault(address executor) payable returns (address)",
  "function vaultsOf(address owner) view returns (address[])",
  "function unlimited() view returns (bool)",
  "event VaultCreated(address indexed owner, address indexed vault, address indexed executor)",
]);

export const vaultsOfAbi = parseAbi(["function vaultsOf(address owner) view returns (address[])"]);
export const indexAbi = parseAbi([
  "function vaultCount() view returns (uint256)",
  "function allVaults(uint256) view returns (address)",
]);
export const ethBalAbi = parseAbi(["function getEthBalance(address) view returns (uint256)"]);

export const swapAbi = parseAbi([
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) payable returns (uint256)",
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) returns (uint256 amountOut, uint160, uint32, uint256)",
]);

export const wmonAbi = parseAbi(["function deposit() payable", "function withdraw(uint256)"]);
export const kintsuAbi = parseAbi(["function deposit(uint96 minShares, address receiver) payable returns (uint96)"]);
export const aprioriAbi = parseAbi([
  "function deposit(uint256 assets, address receiver) payable returns (uint256)",
  "function requestRedeem(uint256 shares, address controller, address owner) returns (uint256)",
  "function previewDeposit(uint256 assets) view returns (uint256)",
  "function convertToAssets(uint256 shares) view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function paused() view returns (bool)",
]);
export const magmaAbi = parseAbi(["function depositMON(address receiver, uint256 referralId) payable"]);
export const kuruAbi = parseAbi([
  "function anyToAnySwap(address[] markets, bool[] isBuy, bool[] nativeSend, address debitToken, address creditToken, uint256 amount, uint256 minAmountOut) payable returns (uint256)",
]);
export const erc20Abi = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address) view returns (uint256)",
]);

export const executedEvent = parseAbiItem(
  "event Executed(bytes32 requestId, address recipient, uint256 amount, uint256 totalSpent)",
);

export function requestId(seed: string): Hex {
  return keccak256(toHex(seed));
}

export function explorerTx(hash: string): string {
  return `${MONAD_EXPLORER}/tx/${hash}`;
}

export function explorerAddr(address: string): string {
  return `${MONAD_EXPLORER}/address/${address}`;
}

const PLAIN: Record<string, string> = {
  Paused: "The owner paused this agent. Nothing moves until the kill switch is lifted.",
  NotExecutor: "This key is not the vault's agent.",
  NotOwner: "Only the vault owner can do that.",
  RequestAlreadyExecuted: "Replay blocked. That request id already ran.",
  RecipientNotAllowed: "That address is not an approved payee.",
  PerPaymentCapExceeded: "Over the per-action cap.",
  BudgetExceeded: "Over the vault budget.",
  CallNotAllowed: "That contract or function is not an allowed service.",
  RecipientMustBeVault: "The output was aimed at the agent instead of back to the vault.",
  ForbiddenSelector: "approve, transfer, and permit can never be allowlisted.",
  InsufficientBalance: "The vault does not hold enough MON for this call.",
  ZeroAmount: "Amount has to be above zero.",
  MinOutNotMet: "The slippage guard failed.",
  GlobalCapExceeded: "This deposit would pass the alpha cap across all vaults.",
  VaultCapExceeded: "That deposit would pass the 1 MON vault cap.",
  UserRejected: "You cancelled in the wallet.",
};

export function plainError(name: string | null, fallback?: string): string {
  if (name && PLAIN[name]) return PLAIN[name];
  return fallback || name || "The vault reverted.";
}

export function decodeRevert(data: string | undefined, message?: string): { code: string | null; reason: string } {
  if (data && data.startsWith("0x") && data.length >= 10) {
    try {
      const decoded = decodeErrorResult({ abi: [...vaultAbi, ...factoryAbi], data: data as Hex });
      return { code: decoded.errorName, reason: plainError(decoded.errorName) };
    } catch {
      /* unknown selector */
    }
  }
  if (message && /reject|denied|cancel/i.test(message)) return { code: "UserRejected", reason: plainError("UserRejected") };
  const line = (message ?? "Reverted").split("\n")[0]?.slice(0, 180) ?? "Reverted";
  return { code: null, reason: line };
}

export function explainError(error: unknown): string {
  let cursor: unknown = error;
  const seen = new Set<unknown>();
  while (cursor && typeof cursor === "object" && !seen.has(cursor)) {
    seen.add(cursor);
    const row = cursor as { data?: unknown; message?: string; shortMessage?: string; cause?: unknown };
    const blob = row.data;
    const hex =
      typeof blob === "string"
        ? blob
        : blob && typeof blob === "object" && typeof (blob as { data?: string }).data === "string"
          ? (blob as { data: string }).data
          : undefined;
    if (hex?.startsWith("0x") && hex.length >= 10) return decodeRevert(hex, row.shortMessage || row.message).reason;
    cursor = row.cause;
  }
  const message = error instanceof Error ? error.message : String(error);
  return decodeRevert(undefined, message).reason;
}

type CallOpts = { approveToken: Address; approveAmount: bigint; outToken: Address; minOut: bigint };

const NONE: CallOpts = { approveToken: ZERO, approveAmount: 0n, outToken: ZERO, minOut: 0n };

export type Prepared = { to: Address; data: Hex; value: bigint };

export function encodeExecute(vault: Address, request: Hex, recipient: Address, amount: bigint): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: "execute",
      args: [request, recipient, amount],
    }),
    value: 0n,
  };
}

export function encodeExecuteCall(
  vault: Address,
  request: Hex,
  target: Address,
  value: bigint,
  data: Hex,
  opts: Partial<CallOpts> = {},
): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({
      abi: vaultAbi,
      functionName: "executeCall",
      args: [request, target, value, data, { ...NONE, ...opts }],
    }),
    value: 0n,
  };
}

export function encodePause(vault: Address, paused: boolean): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "setPaused", args: [paused] }),
    value: 0n,
  };
}

export function encodeWithdraw(vault: Address, to: Address, amount: bigint): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "withdraw", args: [to, amount] }),
    value: 0n,
  };
}

export function encodeDeposit(vault: Address, value: bigint): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "deposit" }),
    value,
  };
}

export function encodeEmergency(vault: Address): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "emergencyWithdrawAll" }),
    value: 0n,
  };
}

export function encodeWithdrawToken(vault: Address, token: Address, to: Address, amount: bigint): Prepared {
  return {
    to: vault,
    data: encodeFunctionData({ abi: vaultAbi, functionName: "withdrawToken", args: [token, to, amount] }),
    value: 0n,
  };
}

/** v4 createVault(executor). Deposit is msg.value. There is no cap, budget, or allowlist. */
export function encodeCreate(input: { executor: Address; depositWei: bigint }): Prepared {
  return {
    to: FACTORY,
    data: encodeFunctionData({
      abi: unlimitedFactoryAbi,
      functionName: "createVault",
      args: [input.executor],
    }),
    value: input.depositWei,
  };
}

export function encodeAprDeposit(assets: bigint, receiver: Address): Prepared {
  return {
    to: APRMON,
    data: encodeFunctionData({ abi: aprioriAbi, functionName: "deposit", args: [assets, receiver] }),
    value: assets,
  };
}

export function encodeAprRequest(shares: bigint, owner: Address): Prepared {
  return {
    to: APRMON,
    data: encodeFunctionData({ abi: aprioriAbi, functionName: "requestRedeem", args: [shares, owner, owner] }),
    value: 0n,
  };
}

export function serviceTarget(action: ActionId | string): { id: string; address: Address } | null {
  if (action === "uniswap" || action === "x-self") return { id: "uniswap", address: RULES[0].address };
  if (action === "pancake") return { id: "pancake", address: RULES[1].address };
  const rule = RULES.find((item) => item.id === action);
  return rule ? { id: rule.id, address: rule.address } : null;
}

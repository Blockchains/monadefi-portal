import {
  decodeErrorResult,
  decodeFunctionResult,
  encodeDeployData,
  encodeFunctionData,
  formatEther,
  parseAbi,
  parseEther,
  type Abi,
  type Address,
  type Hex,
} from "viem";
import artifact from "@/lib/policy/spread-artifact.json";
import { QUOTERS, USDC, WMON, publicClient } from "@/lib/policy/chain";

export const spreadAbi = artifact.abi as Abi;
export const SPREAD_BYTECODE = artifact.bytecode as Hex;

export const MIN_PROFIT_BPS = 5;
export const KEEPER_BPS = 1_000;
export const PROTOCOL_BPS = 1_000;
export const SPREAD_CAP = parseEther("1");
export const MAX_TRADE_BPS = 10_000;
export const ROUGH_GAS_WEI = 500_000n * 100_000_000_000n;

export type VenueId = "uniswap" | "pancake";

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);

export const VENUES: Record<VenueId, { name: string; router: Address; quoter: Address; fee: number }> = {
  uniswap: { name: "Uniswap", router: "0xfE31F71C1b106EAc32F1A19239c9a9A72ddfb900", quoter: QUOTERS.uniswap.address, fee: QUOTERS.uniswap.fee },
  pancake: { name: "PancakeSwap", router: "0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C", quoter: QUOTERS.pancake.address, fee: QUOTERS.pancake.fee },
};

export const venueIndex = (id: VenueId): 0 | 1 => (id === "uniswap" ? 0 : 1);

export function floorProfit(amount: bigint): bigint {
  return (amount * BigInt(MIN_PROFIT_BPS)) / 10_000n;
}

export function splitProfit(profit: bigint): { bounty: bigint; fee: bigint; pool: bigint } {
  const bounty = (profit * BigInt(KEEPER_BPS)) / 10_000n;
  const fee = (profit * BigInt(PROTOCOL_BPS)) / 10_000n;
  return { bounty, fee, pool: profit - bounty - fee };
}

export function clearsFloor(amount: bigint, wmonBack: bigint) {
  const profit = wmonBack > amount ? wmonBack - amount : 0n;
  const floor = floorProfit(amount);
  const split = splitProfit(profit);
  return { profit, floor, ...split, ok: floor > 0n && profit >= floor && profit > ROUGH_GAS_WEI };
}

export function chooseSell(uniUsdc: bigint, cakeUsdc: bigint): { sell: VenueId; buy: VenueId; usdc: bigint } | null {
  if (uniUsdc <= 0n && cakeUsdc <= 0n) return null;
  if (uniUsdc >= cakeUsdc && uniUsdc > 0n) return { sell: "uniswap", buy: "pancake", usdc: uniUsdc };
  if (cakeUsdc > 0n) return { sell: "pancake", buy: "uniswap", usdc: cakeUsdc };
  return null;
}

export function minOuts(amount: bigint, usdc: bigint, wmonBack: bigint) {
  const floorBack = amount + floorProfit(amount);
  const slipped = (wmonBack * 99n) / 100n;
  return {
    minUsdc: (usdc * 99n) / 100n > 0n ? (usdc * 99n) / 100n : 1n,
    minWmon: slipped > floorBack ? slipped : floorBack,
  };
}

export type SpreadGate = { ok: boolean; code: string; label: string; detail: string };

export function spreadGate(input: {
  account: boolean;
  vault: boolean;
  amount: string;
  pool: bigint;
  walletBal: bigint | null;
  quoting: boolean;
  quoteOk: boolean | null;
}): SpreadGate {
  let wei: bigint;
  try {
    wei = parseEther(input.amount || "0");
  } catch {
    return { ok: false, code: "amount", label: "Enter an amount", detail: "Use a MON amount such as 0.05." };
  }
  if (wei <= 0n) return { ok: false, code: "amount", label: "Enter an amount", detail: "The amount needs to be more than 0 MON." };
  if (!input.vault && wei > SPREAD_CAP) return { ok: false, code: "cap", label: "Exceeds cap", detail: "A spread pool holds at most 1 MON." };
  if (input.vault && wei > input.pool) return { ok: false, code: "bal", label: "Larger than the pool", detail: "A round trip cannot sell more MON than the pool holds." };
  if (!input.account) return { ok: false, code: "connect", label: "Connect wallet", detail: "One wallet connection opens the pool or submits a round trip." };
  if (!input.vault) {
    if (input.walletBal != null && wei > input.walletBal) return { ok: false, code: "wallet", label: "Not enough MON", detail: "Your wallet does not hold this deposit." };
    return { ok: true, code: "open", label: "Ready to open", detail: "One signature opens your pool and deposits this MON. There is no promised rate." };
  }
  if (input.quoting || input.quoteOk == null) return { ok: false, code: "quote", label: "Quoting", detail: "Asking both pools for this size." };
  if (!input.quoteOk) return { ok: false, code: "flat", label: "No spread", detail: "The quote does not clear the 0.05% floor and a rough gas cost. Nothing is sent." };
  return { ok: true, code: "go", label: "Spread covers the floor", detail: "Submit sells on the richer pool and buys back on the other. A loss reverts." };
}

type QuoteCall = { to: Address; data: Hex };

function quoteCall(venue: VenueId, tokenIn: Address, tokenOut: Address, amountIn: bigint): QuoteCall {
  const row = VENUES[venue];
  return {
    to: row.quoter,
    data: encodeFunctionData({
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      args: [{ tokenIn, tokenOut, amountIn, fee: row.fee, sqrtPriceLimitX96: 0n }],
    }),
  };
}

function forwardQuotes(amount: bigint): QuoteCall[] {
  return [quoteCall("uniswap", WMON, USDC, amount), quoteCall("pancake", WMON, USDC, amount)];
}

function backQuote(venue: VenueId, usdcAmount: bigint): QuoteCall {
  return quoteCall(venue, USDC, WMON, usdcAmount);
}

function decodeQuote(data: Hex): bigint {
  const out = decodeFunctionResult({ abi: quoterAbi, functionName: "quoteExactInputSingle", data });
  return out[0];
}

export type SpreadQuote = {
  amount: bigint;
  uni: bigint;
  cake: bigint;
  sell: VenueId | null;
  buy: VenueId | null;
  usdc: bigint;
  back: bigint;
  profit: bigint;
  bounty: bigint;
  fee: bigint;
  poolCut: bigint;
  ok: boolean;
};

export async function quoteRoundTrip(amount: bigint): Promise<SpreadQuote> {
  const pc = publicClient();
  const read = async (call: QuoteCall) => {
    const result = await pc.call({ to: call.to, data: call.data });
    if (!result.data) throw new Error("The quoter returned nothing.");
    return decodeQuote(result.data);
  };
  const [uni, cake] = await Promise.all(forwardQuotes(amount).map(read));
  const choice = chooseSell(uni, cake);
  if (!choice) {
    return { amount, uni, cake, sell: null, buy: null, usdc: 0n, back: 0n, profit: 0n, bounty: 0n, fee: 0n, poolCut: 0n, ok: false };
  }
  const back = await read(backQuote(choice.buy, choice.usdc));
  const cleared = clearsFloor(amount, back);
  return {
    amount,
    uni,
    cake,
    sell: choice.sell,
    buy: choice.buy,
    usdc: choice.usdc,
    back,
    profit: cleared.profit,
    bounty: cleared.bounty,
    fee: cleared.fee,
    poolCut: cleared.pool,
    ok: cleared.ok,
  };
}

export function spreadDeployData(treasury: Address): Hex {
  return encodeDeployData({ abi: spreadAbi, bytecode: SPREAD_BYTECODE, args: [treasury, SPREAD_CAP, MIN_PROFIT_BPS, MAX_TRADE_BPS] });
}

export function spreadCaptureData(sell: VenueId, buy: VenueId, amount: bigint, minUsdc: bigint, minWmon: bigint): Hex {
  return encodeFunctionData({
    abi: spreadAbi,
    functionName: "capture",
    args: [venueIndex(sell), venueIndex(buy), amount, minUsdc, minWmon],
  });
}

export function spreadWithdrawData(shares: bigint): Hex {
  return encodeFunctionData({ abi: spreadAbi, functionName: "withdraw", args: [shares] });
}

const SPREAD_PLAIN: Record<string, string> = {
  Floor: "That round trip does not clear the pool’s profit floor.",
  Unprofitable: "The swap came back short, so the whole round trip reverted.",
  SameVenue: "The two legs have to be different pools.",
  TradeTooLarge: "That size is larger than this pool allows.",
  VaultCapExceeded: "That deposit would pass the 1 MON cap.",
  InsufficientShares: "Those shares are not in this wallet.",
  WrongNetwork: "This pool only runs on Monad mainnet.",
  ZeroAmount: "The amount needs to be more than 0.",
  TransferFailed: "The MON transfer failed.",
  ApproveFailed: "The token approval failed.",
};

export function explainSpread(error: unknown, fallback: string): string {
  let cursor: unknown = error;
  const seen = new Set<unknown>();
  while (cursor && typeof cursor === "object" && !seen.has(cursor)) {
    seen.add(cursor);
    const row = cursor as { data?: unknown; cause?: unknown };
    const inner = row.data && typeof row.data === "object" ? (row.data as { data?: unknown }).data : row.data;
    const data = typeof inner === "string" ? inner : typeof row.data === "string" ? row.data : undefined;
    if (data && data.startsWith("0x") && data.length >= 10) {
      try {
        const name = decodeErrorResult({ abi: spreadAbi, data: data as Hex }).errorName;
        return SPREAD_PLAIN[name] ?? fallback;
      } catch {
        /* next */
      }
    }
    cursor = row.cause;
  }
  return fallback;
}

export function showMon(value: bigint): string {
  return `${Number(formatEther(value)).toLocaleString("en-US", { maximumFractionDigits: 4 })} MON`;
}

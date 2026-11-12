import { createServerFn } from "@tanstack/react-start";
import type { Address } from "viem";
import { USDC, erc20Abi, publicClient } from "@/lib/policy/chain";

const TAB_BOND = "0xbA86C0D053ba88afDECbED8aBa5b2eC3973fb230" as Address;
const UNISON = "https://unison-tape-mainnet-production.up.railway.app";

export type ForkPulse = {
  unison: { lagBlocks: number | null; teamFills: number | null; outsideFills: number | null } | null;
  tabUsdc: string | null;
  kanmaniClaims: number | null;
  corpus: { count: number; day: string; fixings: number } | null;
};

const EMPTY: ForkPulse = { unison: null, tabUsdc: null, kanmaniClaims: null, corpus: null };

let cache: { at: number; pulse: ForkPulse } | null = null;

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatUsdc(raw: bigint): string {
  const whole = raw / 1_000_000n;
  const frac = (raw % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return frac ? `${whole.toString()}.${frac}` : whole.toString();
}

async function readJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function readUnison(): Promise<ForkPulse["unison"]> {
  const [health, stats] = await Promise.all([readJson(`${UNISON}/health`), readJson(`${UNISON}/v1/stats`)]);
  const head = health && typeof health === "object" ? (health as { lagBlocks?: unknown; chainId?: unknown }) : null;
  const fills =
    stats && typeof stats === "object" ? ((stats as { fills?: { team?: unknown; outside?: unknown } }).fills ?? null) : null;
  if (!head && !fills) return null;
  if (head && head.chainId !== 143) return null;
  return {
    lagBlocks: finite(head?.lagBlocks),
    teamFills: finite(fills?.team),
    outsideFills: finite(fills?.outside),
  };
}

async function readTabUsdc(): Promise<string | null> {
  try {
    const raw = await publicClient().readContract({
      address: USDC,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [TAB_BOND],
    });
    return formatUsdc(raw);
  } catch {
    return null;
  }
}

async function readKanmani(): Promise<number | null> {
  const body = await readJson("https://kanmani.xyz/api/claims");
  if (!body || typeof body !== "object") return null;
  const chain = (body as { chain?: { id?: unknown } }).chain;
  if (!chain || chain.id !== 143) return null;
  const total = (body as { data?: { total?: unknown } }).data?.total;
  return finite(total);
}

async function readCorpus(): Promise<ForkPulse["corpus"]> {
  const body = await readJson("https://cloud.trycorpus.ai/v1/attestations");
  if (!body || typeof body !== "object") return null;
  const count = finite((body as { count?: unknown }).count);
  const first = (body as { attestations?: { day?: unknown; count?: unknown }[] }).attestations?.[0];
  const day = typeof first?.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(first.day) ? first.day : null;
  const fixings = finite(first?.count);
  if (count == null || !day || fixings == null) return null;
  return { count, day, fixings };
}

async function loadPulse(): Promise<ForkPulse> {
  const now = Date.now();
  if (cache && now - cache.at < 60_000) return cache.pulse;
  const [unison, tabUsdc, kanmaniClaims, corpus] = await Promise.all([
    readUnison(),
    readTabUsdc(),
    readKanmani(),
    readCorpus(),
  ]);
  const pulse = { unison, tabUsdc, kanmaniClaims, corpus };
  cache = { at: now, pulse };
  return pulse;
}

export const forkPulse = createServerFn({ method: "GET" }).handler(async () => {
  try {
    return await loadPulse();
  } catch {
    return EMPTY;
  }
});

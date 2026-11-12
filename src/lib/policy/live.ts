import { createServerFn } from "@tanstack/react-start";
import { decodeEventLog, encodeFunctionData, type Address, type Hex, type PublicClient } from "viem";
import {
  DEAD,
  FACTORIES,
  KURU,
  MULTICALL3,
  QUOTERS,
  RULES,
  SHOWCASE,
  UNLIMITED,
  USDC,
  WMON,
  ZERO,
  aprioriAbi,
  decodeRevert,
  encodeExecute,
  encodeExecuteCall,
  encodeWithdraw,
  erc20Abi,
  ethBalAbi,
  explainError,
  indexAbi,
  kintsuAbi,
  kuruAbi,
  magmaAbi,
  publicClient,
  requestId,
  swapAbi,
  vaultAbi,
  vaultsOfAbi,
  wmonAbi,
  type Prepared,
} from "@/lib/policy/chain";
import { ACTIONS, LIVE_IDS, formatMon, parseMon, type ActionId, type Verdict } from "@/lib/policy/model";

export type LiveVault = {
  address: string;
  owner: string;
  executor: string;
  budgetWei: string;
  capWei: string;
  spentWei: string;
  balanceWei: string;
  agentBalanceWei: string;
  paused: boolean;
  services: string[];
};

export type ChainEvent = {
  id: string;
  label: string;
  status: "pass" | "fail" | "owner";
  reason: string;
  amountWei: string;
  tx: string;
  kind: string;
};

export type PreparedTx = { to: string; data: string; value: string };

async function readOne(address: Address): Promise<LiveVault> {
  const pc = publicClient();
  const base = { address, abi: vaultAbi } as const;
  const [owner, executor, cap, budget, spent, paused, balance] = await Promise.all([
    pc.readContract({ ...base, functionName: "owner" }),
    pc.readContract({ ...base, functionName: "executor" }),
    pc.readContract({ ...base, functionName: "perPaymentCap" }),
    pc.readContract({ ...base, functionName: "budget" }),
    pc.readContract({ ...base, functionName: "totalSpent" }),
    pc.readContract({ ...base, functionName: "paused" }),
    pc.getBalance({ address }),
  ]);
  const agentBalance = await pc.getBalance({ address: executor });
  if (cap >= 10n ** 30n) {
    return {
      address,
      owner,
      executor,
      budgetWei: budget.toString(),
      capWei: cap.toString(),
      spentWei: spent.toString(),
      balanceWei: balance.toString(),
      agentBalanceWei: agentBalance.toString(),
      paused,
      services: [...LIVE_IDS],
    };
  }
  const services = new Set<string>();
  const payee = await pc.readContract({ ...base, functionName: "allowedRecipient", args: [owner] }).catch(() => false);
  if (payee) services.add("pay");
  await Promise.all(
    RULES.map(async (rule) => {
      const row = await pc
        .readContract({ ...base, functionName: "callRule", args: [rule.address, rule.selector] })
        .catch(() => null);
      if (row && row[0]) services.add(rule.id);
    }),
  );
  return {
    address,
    owner,
    executor,
    budgetWei: budget.toString(),
    capWei: cap.toString(),
    spentWei: spent.toString(),
    balanceWei: balance.toString(),
    agentBalanceWei: agentBalance.toString(),
    paused,
    services: [...services],
  };
}

async function readBrief(pc: PublicClient, address: Address): Promise<LiveVault | null> {
  try {
    const base = { address, abi: vaultAbi } as const;
    const [owner, executor, cap, budget, spent, paused, balance, agentBalance] = await Promise.all([
      pc.readContract({ ...base, functionName: "owner" }),
      pc.readContract({ ...base, functionName: "executor" }),
      pc.readContract({ ...base, functionName: "perPaymentCap" }),
      pc.readContract({ ...base, functionName: "budget" }),
      pc.readContract({ ...base, functionName: "totalSpent" }),
      pc.readContract({ ...base, functionName: "paused" }),
      pc.readContract({ address: MULTICALL3, abi: ethBalAbi, functionName: "getEthBalance", args: [address] }),
      pc.readContract({ ...base, functionName: "executor" }).then((agent) =>
        pc.readContract({ address: MULTICALL3, abi: ethBalAbi, functionName: "getEthBalance", args: [agent] }),
      ),
    ]);
    return {
      address,
      owner,
      executor,
      budgetWei: budget.toString(),
      capWei: cap.toString(),
      spentWei: spent.toString(),
      balanceWei: balance.toString(),
      agentBalanceWei: agentBalance.toString(),
      paused,
      services: cap >= 10n ** 30n ? [...LIVE_IDS] : [],
    };
  } catch {
    return null;
  }
}

async function countOf(pc: PublicClient, factory: Address): Promise<number> {
  try {
    const count = await pc.readContract({ address: factory, abi: indexAbi, functionName: "vaultCount" });
    return Number(count);
  } catch {
    return 0;
  }
}

export type FactoryCensus = { v4: number; v3: number; v2: number; v1: number; live: number; heldWei: string };

export const syncChain = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const owner = (data as { owner?: string } | undefined)?.owner;
    const pc = publicClient();
    const block = await pc.getBlockNumber();
    const showcase = await readOne(SHOWCASE);
    const counts = await Promise.all(FACTORIES.map((factory) => countOf(pc, factory)));
    const [v4, v3, v2, v1] = counts;
    const take = Math.min(v4, 40);
    const start = v4 - take;
    let recent: LiveVault[] = [];
    if (take > 0) {
      const listed = await pc
        .multicall({
          allowFailure: false,
          contracts: Array.from({ length: take }, (_, index) => ({
            address: UNLIMITED,
            abi: indexAbi,
            functionName: "allVaults" as const,
            args: [BigInt(start + index)] as const,
          })),
        })
        .catch(() => [] as Address[]);
      const briefs = await Promise.all(listed.map((item) => readBrief(pc, item)));
      recent = briefs.filter((item): item is LiveVault => item !== null).reverse();
    }
    let owned: LiveVault[] = [];
    if (owner && /^0x[a-fA-F0-9]{40}$/.test(owner)) {
      const known = new Set(recent.map((item) => item.address.toLowerCase()));
      const lists = await Promise.all(
        FACTORIES.map((factory) =>
          pc
            .readContract({ address: factory, abi: vaultsOfAbi, functionName: "vaultsOf", args: [owner as Address] })
            .catch(() => [] as Address[]),
        ),
      );
      const seen = new Set<string>();
      const mine: Address[] = [];
      for (const item of lists.flat()) {
        const key = item.toLowerCase();
        if (key === SHOWCASE.toLowerCase() || known.has(key) || seen.has(key)) continue;
        seen.add(key);
        mine.push(item);
      }
      owned = (await Promise.all(mine.slice(0, 40).map((item) => readBrief(pc, item)))).filter(
        (item): item is LiveVault => item !== null,
      );
    }
    const held = recent.reduce((sum, item) => sum + BigInt(item.balanceWei || "0"), 0n);
    const census: FactoryCensus = {
      v4,
      v3,
      v2,
      v1,
      live: recent.filter((item) => !item.paused).length,
      heldWei: held.toString(),
    };
    return { ok: true as const, block: Number(block), showcase, owned, recent, census };
  });

function walkRevert(error: unknown) {
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
    if (hex?.startsWith("0x") && hex.length >= 10) return decodeRevert(hex, row.shortMessage || row.message);
    cursor = row.cause;
  }
  const message = error instanceof Error ? error.message : String(error);
  return decodeRevert(undefined, message);
}

function ruleAddress(id: string): Address {
  const rule = RULES.find((item) => item.id === id);
  if (!rule) throw new Error(`Missing service rule for ${id}.`);
  return rule.address;
}

async function swapData(id: "uniswap" | "pancake", amount: bigint, recipient: Address) {
  const quote = QUOTERS[id];
  const quoted = await publicClient().simulateContract({
    address: quote.address,
    abi: swapAbi,
    functionName: "quoteExactInputSingle",
    args: [{ tokenIn: WMON, tokenOut: USDC, amountIn: amount, fee: quote.fee, sqrtPriceLimitX96: 0n }],
  });
  const minOut = (quoted.result[0] * 97n) / 100n;
  return {
    data: encodeFunctionData({
      abi: swapAbi,
      functionName: "exactInputSingle",
      args: [
        {
          tokenIn: WMON,
          tokenOut: USDC,
          fee: quote.fee,
          recipient,
          amountIn: amount,
          amountOutMinimum: minOut,
          sqrtPriceLimitX96: 0n,
        },
      ],
    }),
    minOut,
    target: ruleAddress(id),
  };
}

async function buildOnChain(input: {
  vault: LiveVault;
  action: ActionId;
  amount: bigint;
  recipient: Address;
  request: Hex;
}): Promise<Prepared> {
  const vault = input.vault.address as Address;
  const owner = input.vault.owner as Address;
  const executor = input.vault.executor as Address;
  const { action, amount, request } = input;
  if (action === "pay" || action === "x-cap" || action === "x-stranger" || action === "x-budget" || action === "x-replay") {
    return encodeExecute(vault, request, input.recipient, amount);
  }
  if (action === "x-drain") {
    const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [executor, 1n] });
    return encodeExecuteCall(vault, request, USDC, 0n, data);
  }
  if (action === "x-unlisted") {
    const data = encodeFunctionData({ abi: wmonAbi, functionName: "deposit" });
    return encodeExecuteCall(vault, request, DEAD, amount === 0n ? 1n : amount, data);
  }
  if (action === "wmon") {
    const data = encodeFunctionData({ abi: wmonAbi, functionName: "deposit" });
    return encodeExecuteCall(vault, request, WMON, amount, data, { outToken: WMON, minOut: amount });
  }
  if (action === "kintsu") {
    const target = ruleAddress("kintsu");
    const data = encodeFunctionData({ abi: kintsuAbi, functionName: "deposit", args: [1n, vault] });
    return encodeExecuteCall(vault, request, target, amount, data, { outToken: target, minOut: 1n });
  }
  if (action === "apriori") {
    const target = ruleAddress("apriori");
    const data = encodeFunctionData({ abi: aprioriAbi, functionName: "deposit", args: [amount, vault] });
    return encodeExecuteCall(vault, request, target, amount, data, { outToken: target, minOut: 1n });
  }
  if (action === "magma") {
    const target = ruleAddress("magma");
    const data = encodeFunctionData({ abi: magmaAbi, functionName: "depositMON", args: [vault, 0n] });
    return encodeExecuteCall(vault, request, target, amount, data, { outToken: target, minOut: 1n });
  }
  if (action === "kuru") {
    const quoted = await publicClient().simulateContract({
      account: vault,
      address: KURU.router,
      abi: kuruAbi,
      functionName: "anyToAnySwap",
      args: [[KURU.monUsdc], [false], [true], ZERO, USDC, amount, 1n],
      value: amount,
    });
    const minOut = (quoted.result * 97n) / 100n;
    const data = encodeFunctionData({
      abi: kuruAbi,
      functionName: "anyToAnySwap",
      args: [[KURU.monUsdc], [false], [true], ZERO, USDC, amount, minOut],
    });
    return encodeExecuteCall(vault, request, KURU.router, amount, data, { outToken: USDC, minOut });
  }
  if (action === "x-withdraw") return encodeWithdraw(vault, executor, amount > 0n ? amount : 1n);
  if (action === "uniswap" || action === "pancake" || action === "x-self") {
    const id = action === "pancake" ? "pancake" : "uniswap";
    const who = action === "x-self" ? executor : vault;
    const spend = amount > 0n ? amount : 10n ** 15n;
    const built = await swapData(id, spend, who);
    return encodeExecuteCall(vault, request, built.target, spend, built.data, {
      outToken: USDC,
      minOut: action === "x-self" ? 0n : built.minOut,
    });
  }
  return encodeExecute(vault, request, owner, amount);
}

function toVerdict(status: "pass" | "fail", code: string | null, reason: string, amount: bigint, recipient: string): Verdict {
  const kill: Verdict["trace"][number]["state"] = code === "Paused" ? "fail" : "pass";
  const request: Verdict["trace"][number]["state"] = code === "RequestAlreadyExecuted" ? "fail" : "pass";
  const rules: Verdict["trace"][number]["state"] =
    status === "pass" ? "pass" : code && code !== "Paused" && code !== "RequestAlreadyExecuted" ? "fail" : "skip";
  return {
    status,
    code,
    reason,
    trace: [
      { label: "Kill switch", state: kill, detail: code === "Paused" ? reason : "The vault is not paused." },
      { label: "Request id", state: request, detail: code === "RequestAlreadyExecuted" ? reason : "This request id is fresh." },
      {
        label: "Vault rules",
        state: rules,
        detail:
          status === "pass"
            ? "eth_call from the agent did not revert."
            : code && code !== "Paused" && code !== "RequestAlreadyExecuted"
              ? reason
              : "Stopped earlier.",
      },
    ],
    amountWei: amount.toString(),
    recipient,
  };
}

async function callVault(vault: LiveVault, tx: Prepared) {
  if (!tx.to) throw new Error("The call is missing a target.");
  const pc = publicClient();
  try {
    await pc.call({ account: vault.executor as Address, to: tx.to, data: tx.data });
    return {
      status: "pass" as const,
      code: null,
      reason: "The vault would execute this call. eth_call from the agent did not revert.",
    };
  } catch (error) {
    const decoded = walkRevert(error);
    return { status: "fail" as const, code: decoded.code, reason: decoded.reason };
  }
}

async function recentRequest(vault: Address): Promise<Hex | null> {
  const pc = publicClient();
  const latest = await pc.getBlockNumber();
  for (const span of [4_000n, 20_000n, 80_000n]) {
    try {
      const fromBlock = latest > span ? latest - span : 0n;
      const logs = await pc.getLogs({ address: vault, fromBlock, toBlock: latest });
      for (let i = logs.length - 1; i >= 0; i -= 1) {
        try {
          const decoded = decodeEventLog({ abi: vaultAbi, data: logs[i].data, topics: logs[i].topics });
          if (decoded.eventName === "Executed" || decoded.eventName === "DappCalled") return decoded.args.requestId;
        } catch {
          /* other log */
        }
      }
      if (logs.length > 0) return null;
    } catch {
      /* narrower range */
    }
  }
  return null;
}

function isAction(value: string): value is ActionId {
  return (ACTIONS as readonly string[]).includes(value);
}

export const simulateOnChain = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const body = (data ?? {}) as {
      address?: string;
      action?: string;
      amountMon?: string;
      recipient?: string;
      request?: string;
    };
    if (!body.address || !body.action || !isAction(body.action)) return { ok: false as const, error: "Pick a vault and a call." };
    const amount = parseMon(body.amountMon ?? "");
    if (amount === null) return { ok: false as const, error: "Enter an amount in MON." };
    const recipient = (body.recipient || "").trim();
    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) return { ok: false as const, error: "Recipient must be a full address." };
    try {
      const vault = await readOne(body.address as Address);
      const supplied = body.request && /^0x[a-fA-F0-9]{64}$/.test(body.request) ? (body.request as Hex) : null;
      const replay = body.action === "x-replay" ? await recentRequest(vault.address as Address) : null;
      if (body.action === "x-replay" && !replay && !supplied) {
        return {
          ok: true as const,
          verdict: toVerdict("fail", null, "No recent spent request was found on this vault, so a replay could not be proven.", amount, recipient),
          prepared: null,
          executor: vault.executor,
        };
      }
      const request =
        body.action === "x-replay" ? (replay ?? supplied)! : (supplied ?? requestId(`${body.action}:${Date.now()}:${Math.random()}`));
      const tx = await buildOnChain({ vault, action: body.action, amount, recipient: recipient as Address, request });
      const result = await callVault(vault, tx);
      return {
        ok: true as const,
        verdict: toVerdict(result.status, result.code, result.reason, amount, recipient),
        prepared: result.status === "pass" ? { to: tx.to, data: tx.data, value: tx.value.toString() } : null,
        executor: vault.executor,
      };
    } catch (error) {
      return { ok: false as const, error: explainError(error) };
    }
  });

export const runChainSuite = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const address = (data as { address?: string } | undefined)?.address;
    if (!address) return { ok: false as const, error: "Pick a vault." };
    try {
      const vault = await readOne(address as Address);
      const cap = BigInt(vault.capWei);
      const left = BigInt(vault.budgetWei) > BigInt(vault.spentWei) ? BigInt(vault.budgetWei) - BigInt(vault.spentWei) : 0n;
      const replayId = await recentRequest(vault.address as Address);
      const attacks: { action: ActionId; title: string; amount: bigint; recipient: string; request?: Hex }[] = [
        { action: "x-cap", title: "Spend twice the cap", amount: cap > 0n ? cap * 2n : 10n ** 17n, recipient: vault.owner },
        { action: "x-stranger", title: "Pay a stranger", amount: 10n ** 16n, recipient: DEAD },
        { action: "x-budget", title: "Blow the remaining budget", amount: left + 10n ** 15n, recipient: vault.owner },
        { action: "x-drain", title: "Move USDC with transfer()", amount: 0n, recipient: DEAD },
        { action: "x-self", title: "Send swap output to the agent", amount: 10n ** 16n, recipient: vault.executor },
        { action: "x-withdraw", title: "Withdraw the vault", amount: 1n, recipient: vault.executor },
        { action: "x-unlisted", title: "Call an unlisted service", amount: 10n ** 15n, recipient: vault.address },
        { action: "x-replay", title: "Replay a used request", amount: 10n ** 16n, recipient: vault.owner, request: replayId ?? undefined },
      ];
      const results = [];
      for (const attack of attacks) {
        if (attack.action === "x-replay" && !attack.request) {
          results.push({
            action: attack.action,
            title: attack.title,
            status: "fail" as const,
            code: null,
            reason: "No recent spent request was found, so this replay could not be sent.",
          });
          continue;
        }
        try {
          const result = await callVault(
            vault,
            await buildOnChain({
              vault,
              action: attack.action,
              amount: attack.amount,
              recipient: attack.recipient as Address,
              request: attack.request ?? requestId(`suite:${attack.action}:${vault.address}`),
            }),
          );
          results.push({ action: attack.action, title: attack.title, status: result.status, code: result.code, reason: result.reason });
        } catch (error) {
          results.push({ action: attack.action, title: attack.title, status: "fail" as const, code: null, reason: explainError(error) });
        }
      }
      return {
        ok: true as const,
        paused: vault.paused,
        blocked: results.filter((item) => item.status === "fail").length,
        total: results.length,
        results,
      };
    } catch (error) {
      return { ok: false as const, error: explainError(error) };
    }
  });

async function showcaseLogs() {
  const pc = publicClient();
  const latest = await pc.getBlockNumber();
  for (const span of [2_000n, 8_000n, 30_000n]) {
    try {
      const fromBlock = latest > span ? latest - span : 0n;
      return await pc.getLogs({ address: SHOWCASE, fromBlock, toBlock: latest });
    } catch {
      /* try a shorter range */
    }
  }
  return [];
}

export const chainActivity = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const logs = await showcaseLogs();
    const events: ChainEvent[] = [];
    for (const log of logs.slice(-24).reverse()) {
      try {
        const decoded = decodeEventLog({ abi: vaultAbi, data: log.data, topics: log.topics });
        const tx = log.transactionHash ?? "";
        if (decoded.eventName === "Executed") {
          const amount = decoded.args.amount;
          events.push({
            id: `${tx}:exec`,
            label: "Agent payment",
            status: "pass",
            reason: `${formatMon(amount)} MON paid on Monad.`,
            amountWei: amount.toString(),
            tx,
            kind: "pay",
          });
        } else if (decoded.eventName === "DappCalled") {
          events.push({
            id: `${tx}:dapp`,
            label: "Service call",
            status: "pass",
            reason: "The vault allowed a service call.",
            amountWei: decoded.args.value.toString(),
            tx,
            kind: "call",
          });
        } else if (decoded.eventName === "Withdrawn") {
          events.push({
            id: `${tx}:wd`,
            label: "Owner pulled funds",
            status: "owner",
            reason: `${formatMon(decoded.args.amount)} MON returned to the owner.`,
            amountWei: decoded.args.amount.toString(),
            tx,
            kind: "withdraw",
          });
        } else if (decoded.eventName === "PausedSet") {
          events.push({
            id: `${tx}:pause`,
            label: decoded.args.paused ? "Kill switch on" : "Kill switch off",
            status: "owner",
            reason: decoded.args.paused ? "Owner paused the vault." : "Owner lifted the pause.",
            amountWei: "0",
            tx,
            kind: "pause",
          });
        }
      } catch {
        /* unrelated log */
      }
    }
    return { ok: true as const, events: events.slice(0, 16) };
  } catch (error) {
    return { ok: false as const, error: explainError(error), events: [] as ChainEvent[] };
  }
});

export const broadcastRaw = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const raw = (data as { raw?: string } | undefined)?.raw ?? "";
    if (!/^0x[0-9a-fA-F]+$/.test(raw) || raw.length < 20) {
      return { ok: false as const, error: "That is not a signed transaction." };
    }
    try {
      const hash = await publicClient().sendRawTransaction({ serializedTransaction: raw as Hex });
      return { ok: true as const, hash };
    } catch (error) {
      return { ok: false as const, error: explainError(error) };
    }
  });

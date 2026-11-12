import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import {
  ACTIONS,
  FACTORY,
  LIVE_IDS,
  ONE,
  REPLAY_KEY,
  SANDBOX_OWNER,
  evaluate,
  formatMon,
  intentById,
  isAddress,
  parseMon,
  suggestion,
  type ActionId,
  type FeedItem,
  type VaultView,
  type Verdict,
} from "@/lib/policy/model";

type VaultRow = {
  id: string;
  name: string;
  address: string;
  owner_address: string;
  agent_address: string;
  budget_wei: string;
  cap_wei: string;
  spent_wei: string;
  balance_wei: string;
  gas_wei: string;
  paused: boolean | number | string;
  services: string;
  payees: string;
};

type FeedRow = {
  id: number;
  vault_id: string;
  vault_name: string;
  action: string;
  label: string;
  recipient: string;
  amount_wei: string;
  status: string;
  code: string | null;
  reason: string;
  applied: boolean | number | string;
  created_at: string;
};

function flag(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === "t" || value === "true";
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toVault(row: VaultRow): VaultView {
  const payees = splitList(row.payees).filter(isAddress);
  if (!payees.some((item) => item.toLowerCase() === row.owner_address.toLowerCase())) {
    payees.unshift(row.owner_address);
  }
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    ownerAddress: row.owner_address,
    agentAddress: row.agent_address,
    budgetWei: row.budget_wei,
    capWei: row.cap_wei,
    spentWei: row.spent_wei,
    balanceWei: row.balance_wei,
    gasWei: row.gas_wei,
    paused: flag(row.paused),
    services: splitList(row.services),
    payees,
  };
}

function toFeed(row: FeedRow): FeedItem {
  const status = row.status === "pass" || row.status === "fail" || row.status === "owner" ? row.status : "fail";
  return {
    id: Number(row.id),
    vaultId: row.vault_id,
    vaultName: row.vault_name,
    action: row.action,
    label: row.label,
    recipient: row.recipient,
    amountWei: row.amount_wei,
    status,
    code: row.code,
    reason: row.reason,
    applied: flag(row.applied),
    createdAt: row.created_at,
  };
}

async function readVault(id: string): Promise<VaultView | null> {
  const sql = await getSql();
  const rows = await sql<VaultRow>`select id, name, address, owner_address, agent_address, budget_wei, cap_wei, spent_wei, balance_wei, gas_wei, paused, services, payees from vaults where id = ${id}`;
  return rows[0] ? toVault(rows[0]) : null;
}

async function usedKeys(id: string): Promise<string[]> {
  const sql = await getSql();
  const rows = await sql<{ req_key: string }>`select req_key from used_requests where vault_id = ${id}`;
  return rows.map((row) => row.req_key);
}

export type Ledger = {
  vaults: VaultView[];
  feed: FeedItem[];
  series: { id: number; amountMon: string; cumulativeMon: string }[];
};

async function readLedger(): Promise<Ledger> {
  const sql = await getSql();
  const vaultRows = await sql<VaultRow>`
    select id, name, address, owner_address, agent_address, budget_wei, cap_wei, spent_wei, balance_wei, gas_wei, paused, services, payees
    from vaults
    order by case when id = 'showcase' then 0 else 1 end, created_at desc
  `;
  const feedRows = await sql<FeedRow>`
    select s.id, s.vault_id, v.name as vault_name, s.action, s.label, s.recipient, s.amount_wei, s.status, s.code, s.reason, s.applied,
           to_char(s.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at
    from simulations s
    join vaults v on v.id = s.vault_id
    order by s.id desc
    limit 60
  `;
  const seriesRows = await sql<{ id: number; amount_wei: string }>`
    select id, amount_wei from simulations
    where status = 'pass' and applied = true
    order by id asc
    limit 48
  `;
  let running = 0n;
  const series = seriesRows.map((row) => {
    running += BigInt(row.amount_wei);
    return {
      id: Number(row.id),
      amountMon: formatMon(row.amount_wei),
      cumulativeMon: formatMon(running),
    };
  });
  return {
    vaults: vaultRows.map(toVault),
    feed: feedRows.map(toFeed),
    series,
  };
}

function randAddr(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const loadLedger = createServerFn({ method: "GET" }).handler(async () => readLedger());

export const chainHead = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const res = await fetch("https://rpc.monad.xyz", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(2500),
    });
    const json = (await res.json()) as { result?: string };
    if (!json.result) return { ok: false as const, chainId: 143, block: null, factory: FACTORY };
    return { ok: true as const, chainId: 143, block: Number.parseInt(json.result, 16), factory: FACTORY };
  } catch {
    return { ok: false as const, chainId: 143, block: null, factory: FACTORY };
  }
});

export const createVault = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const body = data as {
      name?: string;
      budgetMon?: string;
      capMon?: string;
      depositMon?: string;
      gasMon?: string;
      services?: string[];
      payees?: string;
      startPaused?: boolean;
    };
    const name = (body.name ?? "").trim().slice(0, 32);
    if (name.length < 2) return { ok: false as const, error: "Name the agent in at least two characters." };
    const budget = parseMon(body.budgetMon ?? "");
    const cap = parseMon(body.capMon ?? "");
    const deposit = parseMon(body.depositMon ?? "");
    const gas = parseMon(body.gasMon ?? "");
    if (budget === null || cap === null || deposit === null || gas === null) {
      return { ok: false as const, error: "Budget, cap, deposit, and gas need to be MON amounts." };
    }
    if (budget <= 0n || budget > ONE) return { ok: false as const, error: "Budget must be above 0 and at most 1 MON." };
    if (cap <= 0n || cap > budget) return { ok: false as const, error: "Per-action cap has to sit inside the budget." };
    if (deposit < 0n || deposit > ONE) return { ok: false as const, error: "Deposit can be at most 1 MON." };
    if (gas < 0n || gas > ONE) return { ok: false as const, error: "Agent gas can be at most 1 MON." };
    const services = (body.services ?? []).filter((id) => LIVE_IDS.includes(id));
    if (services.length === 0) return { ok: false as const, error: "Switch on at least one live service." };
    const extras = (body.payees ?? "")
      .split(/[\s,]+/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (extras.some((item) => !isAddress(item))) {
      return { ok: false as const, error: "Each extra payee must be a full 0x address." };
    }
    const sql = await getSql();
    const countRows = await sql<{ n: number }>`select count(*)::int as n from vaults`;
    if (Number(countRows[0]?.n ?? 0) >= 40) {
      return { ok: false as const, error: "The shared sandbox is full. Use a vault that is already here." };
    }
    const id = `v_${crypto.randomUUID().slice(0, 8)}`;
    const address = randAddr();
    const agent = randAddr();
    await sql`
      insert into vaults (
        id, name, address, owner_address, agent_address,
        budget_wei, cap_wei, spent_wei, balance_wei, gas_wei,
        paused, services, payees
      ) values (
        ${id}, ${name}, ${address}, ${SANDBOX_OWNER}, ${agent},
        ${budget.toString()}, ${cap.toString()}, ${"0"}, ${deposit.toString()}, ${gas.toString()},
        ${Boolean(body.startPaused)}, ${services.join(",")}, ${extras.join(",")}
      )
    `;
    await sql`insert into used_requests (vault_id, req_key) values (${id}, ${REPLAY_KEY})`;
    await sql`
      insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied)
      values (
        ${id}, ${"create"}, ${"Vault created"}, ${address}, ${deposit.toString()}, ${"owner"},
        ${null}, ${"Rules were baked in. Nothing was broadcast."}, ${false}
      )
    `;
    const ledger = await readLedger();
    return { ok: true as const, id, ledger };
  });

async function runOne(vault: VaultView, action: ActionId, amountMon: string, recipient: string, requestKey: string, apply: boolean) {
  const amountWei = parseMon(amountMon);
  if (amountWei === null) {
    const verdict: Verdict = {
      status: "fail",
      code: "BadAmount",
      reason: "Enter an amount in MON, up to 6 decimal places.",
      trace: [],
      amountWei: "0",
      recipient,
    };
    return { verdict, applied: false };
  }
  const keys = await usedKeys(vault.id);
  const verdict = evaluate({
    vault,
    usedKeys: keys,
    action,
    amountWei,
    recipient,
    requestKey: requestKey || `pp-${crypto.randomUUID()}`,
  });
  const intent = intentById(action);
  const shouldApply = apply && verdict.status === "pass";
  const sql = await getSql();
  await sql`
    insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied)
    values (
      ${vault.id}, ${action}, ${intent?.title ?? action}, ${verdict.recipient}, ${verdict.amountWei},
      ${verdict.status}, ${verdict.code}, ${verdict.reason}, ${shouldApply}
    )
  `;
  if (shouldApply) {
    const nextSpent = (BigInt(vault.spentWei) + amountWei).toString();
    const nextBal = (BigInt(vault.balanceWei) - amountWei).toString();
    await sql`update vaults set spent_wei = ${nextSpent}, balance_wei = ${nextBal} where id = ${vault.id}`;
    await sql`
      insert into used_requests (vault_id, req_key) values (${vault.id}, ${requestKey})
      on conflict do nothing
    `;
  }
  return { verdict, applied: shouldApply };
}

export const simulateCall = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const body = data as {
      vaultId?: string;
      action?: string;
      amountMon?: string;
      recipient?: string;
      requestKey?: string;
      apply?: boolean;
    };
    if (!body.vaultId || !body.action || !ACTIONS.includes(body.action as ActionId)) {
      return { ok: false as const, error: "Pick a vault and a call." };
    }
    const vault = await readVault(body.vaultId);
    if (!vault) return { ok: false as const, error: "That vault is gone." };
    const action = body.action as ActionId;
    const hinted = suggestion(vault, action);
    const recipient = (body.recipient || hinted.recipient).trim();
    const amountMon = body.amountMon ?? hinted.amountMon;
    const requestKey = action === "x-replay" ? REPLAY_KEY : body.requestKey || `pp-${crypto.randomUUID()}`;
    const { verdict, applied } = await runOne(vault, action, amountMon, recipient, requestKey, Boolean(body.apply));
    const ledger = await readLedger();
    return { ok: true as const, verdict, applied, ledger };
  });

export const runSuite = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const vaultId = (data as { vaultId?: string }).vaultId;
    if (!vaultId) return { ok: false as const, error: "Pick a vault." };
    const vault = await readVault(vaultId);
    if (!vault) return { ok: false as const, error: "That vault is gone." };
    const attacks = ACTIONS.filter((id) => id.startsWith("x-"));
    const results: { action: ActionId; title: string; status: "pass" | "fail"; code: string | null; reason: string }[] = [];
    for (const action of attacks) {
      const hinted = suggestion(vault, action);
      const fresh = await readVault(vaultId);
      if (!fresh) break;
      const { verdict } = await runOne(
        fresh,
        action,
        hinted.amountMon,
        hinted.recipient,
        action === "x-replay" ? REPLAY_KEY : `suite-${action}-${crypto.randomUUID()}`,
        false,
      );
      results.push({
        action,
        title: intentById(action)?.title ?? action,
        status: verdict.status,
        code: verdict.code,
        reason: verdict.reason,
      });
    }
    const blocked = results.filter((item) => item.status === "fail").length;
    const ledger = await readLedger();
    return {
      ok: true as const,
      paused: vault.paused,
      blocked,
      total: results.length,
      results,
      ledger,
    };
  });

export const setPaused = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const body = data as { vaultId?: string; paused?: boolean };
    if (!body.vaultId) return { ok: false as const, error: "Pick a vault." };
    const vault = await readVault(body.vaultId);
    if (!vault) return { ok: false as const, error: "That vault is gone." };
    const paused = Boolean(body.paused);
    const sql = await getSql();
    await sql`update vaults set paused = ${paused} where id = ${vault.id}`;
    await sql`
      insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied)
      values (
        ${vault.id}, ${paused ? "pause" : "resume"}, ${paused ? "Kill switch on" : "Kill switch off"},
        ${vault.ownerAddress}, ${"0"}, ${"owner"}, ${null},
        ${paused ? "Owner paused the vault. Agent calls will revert." : "Owner lifted the pause."},
        ${false}
      )
    `;
    return { ok: true as const, ledger: await readLedger() };
  });

export const pullFunds = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const vaultId = (data as { vaultId?: string }).vaultId;
    if (!vaultId) return { ok: false as const, error: "Pick a vault." };
    const vault = await readVault(vaultId);
    if (!vault) return { ok: false as const, error: "That vault is gone." };
    if (BigInt(vault.balanceWei) <= 0n) return { ok: false as const, error: "The vault is already empty." };
    const sql = await getSql();
    await sql`
      insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied)
      values (
        ${vault.id}, ${"pull"}, ${"Owner pulled funds"}, ${vault.ownerAddress}, ${vault.balanceWei},
        ${"owner"}, ${null}, ${`Owner withdrew ${formatMon(vault.balanceWei)} MON. The agent cannot.`}, ${false}
      )
    `;
    await sql`update vaults set balance_wei = ${"0"} where id = ${vault.id}`;
    return { ok: true as const, ledger: await readLedger() };
  });

export const resetShowcase = createServerFn({ method: "POST" }).handler(async () => {
  const sql = await getSql();
  await sql`
    update vaults set
      budget_wei = ${"200000000000000000"},
      cap_wei = ${"50000000000000000"},
      spent_wei = ${"162000000000000000"},
      balance_wei = ${"250000000000000000"},
      gas_wei = ${"120000000000000000"},
      paused = ${false},
      services = ${"pay,uniswap,pancake,kintsu,apriori,magma,wmon"},
      payees = ${""}
    where id = ${"showcase"}
  `;
  await sql`
    insert into simulations (vault_id, action, label, recipient, amount_wei, status, code, reason, applied)
    values (
      ${"showcase"}, ${"reset"}, ${"Showcase restored"}, ${"0xc0c4E411e41bECAD6DA860F67063C2D6363a6113"},
      ${"0"}, ${"owner"}, ${null}, ${"Counters restored to the public showcase. History stays."}, ${false}
    )
  `;
  return { ok: true as const, ledger: await readLedger() };
});


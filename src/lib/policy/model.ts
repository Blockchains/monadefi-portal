export const CHAIN_ID = 143;
export const FACTORY = "0x41d6667aA35c3634D19068A39481d4c955f6557D";
export const SANDBOX_OWNER = "0x1111111111111111111111111111111111111111";
export const DEAD = "0x000000000000000000000000000000000000dEaD";
export const REPLAY_KEY = "pp-replay";
export const ONE = 10n ** 18n;

export const ACTIONS = [
  "pay",
  "uniswap",
  "pancake",
  "kuru",
  "kintsu",
  "apriori",
  "magma",
  "wmon",
  "x-cap",
  "x-stranger",
  "x-budget",
  "x-drain",
  "x-self",
  "x-withdraw",
  "x-unlisted",
  "x-replay",
] as const;

export type ActionId = (typeof ACTIONS)[number];

export type ServiceStatus = "live" | "soon";

export type ServiceDef = {
  id: string;
  name: string;
  verb: string;
  icon: string;
  blurb: string;
  novice: string;
  status: ServiceStatus;
  address: string | null;
  why?: string;
};

export const SERVICES: ServiceDef[] = [
  {
    id: "pay",
    name: "Pay people",
    verb: "Pay",
    icon: "💸",
    blurb: "Send MON to payees you approve.",
    novice: "Your agent can pay invoices, but only to addresses you approve.",
    status: "live",
    address: null,
  },
  {
    id: "uniswap",
    name: "Uniswap v3",
    verb: "Swap",
    icon: "🦄",
    blurb: "Swap MON ⇄ USDC on the biggest DEX.",
    novice: "Turn MON into USDC (a dollar stablecoin), with a slippage guard.",
    status: "live",
    address: "0xfE31F71C1b106EAc32F1A19239c9a9A72ddfb900",
  },
  {
    id: "pancake",
    name: "PancakeSwap v3",
    verb: "Swap",
    icon: "🥞",
    blurb: "Swap MON ⇄ USDC on PancakeSwap.",
    novice: "A second DEX, so your agent can find a better price.",
    status: "live",
    address: "0x21114915Ac6d5A2e156931e20B20b038dEd0Be7C",
  },
  {
    id: "kintsu",
    name: "Kintsu",
    verb: "Stake",
    icon: "🥩",
    blurb: "Liquid-stake MON → sMON.",
    novice: "Earn staking yield while staying liquid.",
    status: "live",
    address: "0xA3227C5969757783154C60bF0bC1944180ed81B9",
  },
  {
    id: "apriori",
    name: "aPriori",
    verb: "Stake",
    icon: "⚡",
    blurb: "MEV-boosted liquid staking → aprMON.",
    novice: "Staking yield with MEV rewards on top.",
    status: "live",
    address: "0x0c65A0BC65a5D819235B71F554D210D3F80E0852",
  },
  {
    id: "magma",
    name: "Magma",
    verb: "Stake",
    icon: "🌋",
    blurb: "DAO-owned liquid staking → gMON.",
    novice: "Community-owned staking; gMON grows in value.",
    status: "live",
    address: "0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081",
  },
  {
    id: "wmon",
    name: "Wrapped MON",
    verb: "Wrap",
    icon: "🎁",
    blurb: "Wrap / unwrap MON 1:1.",
    novice: "The ERC-20 version of MON that many apps need.",
    status: "live",
    address: "0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A",
  },
  {
    id: "lend",
    name: "Lending (Morpho)",
    verb: "Lend",
    icon: "🏦",
    blurb: "Earn interest on USDC / MON.",
    novice: "Lend idle funds for interest.",
    status: "soon",
    address: null,
    why: "Morpho is deployed on Monad, but none of its Monad vaults are marked listed yet. Lending waits on a listed vault and a fork test.",
  },
  {
    id: "usdcpay",
    name: "USDC payouts",
    verb: "Pay",
    icon: "💵",
    blurb: "Pay invoices in dollars.",
    novice: "Pay people in a stablecoin.",
    status: "soon",
    address: null,
    why: "The vault blocks ERC-20 transfer() by design so an agent can never move tokens out. Allowlisted USDC payouts need a new vault version.",
  },
  {
    id: "kuru",
    name: "Kuru",
    verb: "Swap",
    icon: "📗",
    blurb: "Swap MON → USDC on Kuru’s on-chain order book.",
    novice: "A Monad-native order-book exchange, as a third place to get a price.",
    status: "live",
    address: "0xd651346d7c789536ebf06dc72aE3C8502cd695CC",
  },
  {
    id: "perps",
    name: "Perps",
    verb: "Trade",
    icon: "📈",
    blurb: "Leveraged trading.",
    novice: "Advanced trading with strict limits.",
    status: "soon",
    address: null,
    why: "Kuru is spot. Perpl apps were forked on 11 Nov, but this vault has not fork-tested a perps call, so it stays off.",
  },
  {
    id: "bridge",
    name: "Bridge",
    verb: "Bridge",
    icon: "🌉",
    blurb: "Move funds to other chains.",
    novice: "Move funds between chains.",
    status: "soon",
    address: null,
    why: "A bridge sends funds to another chain, so the vault can’t force the output back to itself.",
  },
  {
    id: "nft",
    name: "NFTs (Magic Eden)",
    verb: "Mint",
    icon: "🖼️",
    blurb: "Mint or buy NFTs.",
    novice: "Let your agent collect for you.",
    status: "soon",
    address: null,
    why: "The marketplace contracts are not verified from official docs yet, and NFT outputs need ERC-721 receipt checks.",
  },
];

export const LIVE_IDS = SERVICES.filter((s) => s.status === "live").map((s) => s.id);

export type Intent = {
  id: ActionId;
  lane: "allow" | "break";
  short: string;
  title: string;
  detail: string;
};

export const INTENTS: Intent[] = [
  { id: "pay", lane: "allow", short: "Pay", title: "Pay an approved address", detail: "MON only moves to a payee on your list." },
  { id: "uniswap", lane: "allow", short: "Uniswap", title: "Swap on Uniswap v3", detail: "MON to USDC. Output is forced back to the vault." },
  { id: "pancake", lane: "allow", short: "Pancake", title: "Swap on PancakeSwap v3", detail: "Same guard on a second exchange." },
  { id: "kuru", lane: "allow", short: "Kuru", title: "Swap on Kuru", detail: "MON to USDC on the order book. Output comes back to the vault." },
  { id: "kintsu", lane: "allow", short: "Kintsu", title: "Stake with Kintsu", detail: "Liquid stake. The receipt comes back to the vault." },
  { id: "apriori", lane: "allow", short: "aPriori", title: "Stake with aPriori", detail: "MEV-boosted stake, still inside the cap." },
  { id: "magma", lane: "allow", short: "Magma", title: "Stake with Magma", detail: "Community staking. Output stays in the vault." },
  { id: "wmon", lane: "allow", short: "Wrap", title: "Wrap MON", detail: "One-for-one wrap. No foreign recipient." },
  { id: "x-cap", lane: "break", short: "2× cap", title: "Spend twice the cap", detail: "One action, double the per-action limit." },
  { id: "x-stranger", lane: "break", short: "Stranger", title: "Pay a stranger", detail: "Send MON to an address you never approved." },
  { id: "x-budget", lane: "break", short: "Over budget", title: "Blow the remaining budget", detail: "Stay under the cap, but past what is left to spend." },
  { id: "x-drain", lane: "break", short: "transfer()", title: "Move USDC with transfer()", detail: "The selector the vault forbids on purpose." },
  { id: "x-self", lane: "break", short: "To agent", title: "Send swap output to the agent", detail: "A swap that tries to pay the agent key, not the vault." },
  { id: "x-withdraw", lane: "break", short: "Withdraw", title: "Withdraw the vault", detail: "The agent tries an owner-only withdraw. It must revert." },
  { id: "x-unlisted", lane: "break", short: "Unlisted", title: "Call an unlisted service", detail: "Lending router. It was never switched on." },
  { id: "x-replay", lane: "break", short: "Replay", title: "Replay a used request", detail: "Same request id as a call that already ran." },
];

export type VaultView = {
  id: string;
  name: string;
  address: string;
  ownerAddress: string;
  agentAddress: string;
  budgetWei: string;
  capWei: string;
  spentWei: string;
  balanceWei: string;
  gasWei: string;
  paused: boolean;
  services: string[];
  payees: string[];
  source?: "chain" | "sandbox";
};

export type FeedItem = {
  id: number;
  vaultId: string;
  vaultName: string;
  action: string;
  label: string;
  recipient: string;
  amountWei: string;
  status: "pass" | "fail" | "owner";
  code: string | null;
  reason: string;
  applied: boolean;
  createdAt: string;
};

export type TraceStep = {
  label: string;
  state: "pass" | "fail" | "skip";
  detail: string;
};

export type Verdict = {
  status: "pass" | "fail";
  code: string | null;
  reason: string;
  trace: TraceStep[];
  amountWei: string;
  recipient: string;
};

const REASONS: Record<string, string> = {
  Paused: "The vault is paused. The kill switch blocks every agent call until you lift it.",
  RequestAlreadyExecuted: "This request id was already used. A leaked signature cannot spend twice.",
  ServiceNotAllowed: "That contract is not in the allowlist. The agent can only call services you switched on.",
  ForbiddenSelector: "approve, transfer, and permit are forbidden. An agent cannot move tokens out of the vault.",
  RecipientMustBeVault: "Swap and stake output must come back to the vault, not the agent key.",
  RecipientNotAllowed: "That address is not an approved payee. Payments only go to people you listed.",
  PerActionCapExceeded: "This action is above the per-action cap. One call cannot quietly exceed the limit you set.",
  BudgetExceeded: "This would push total spend past the vault budget.",
  InsufficientBalance: "The policy allows it, but the vault does not hold enough MON to fund the call.",
  NotOwner: "Only the vault owner can withdraw. The agent cannot pull the funds.",
  BadAmount: "Enter an amount in MON, up to 6 decimal places.",
  BadAddress: "Recipient must be a 20-byte address.",
};

export function reasonFor(code: string | null, fallback: string): string {
  if (!code) return fallback;
  return REASONS[code] ?? fallback;
}

export function parseMon(input: string): bigint | null {
  const s = input.trim();
  if (!/^\d{1,7}(\.\d{0,6})?$/.test(s)) return null;
  const [w, f = ""] = s.split(".");
  const frac = (f + "000000000000000000").slice(0, 18);
  return BigInt(w) * ONE + BigInt(frac);
}

export function isUnlimitedWei(wei: string | bigint): boolean {
  const value = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  return value >= ONE * 1_000_000n;
}

export function formatMon(wei: string | bigint, digits = 3): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / ONE;
  const frac = (abs % ONE).toString().padStart(18, "0").slice(0, digits);
  const body = digits > 0 ? `${whole.toString()}.${frac}` : whole.toString();
  return neg ? `-${body}` : body;
}

export function remainingWei(vault: { budgetWei: string; spentWei: string }): bigint {
  const left = BigInt(vault.budgetWei) - BigInt(vault.spentWei);
  return left > 0n ? left : 0n;
}

export function shortAddr(addr: string): string {
  if (!addr || addr.length < 12) return addr || "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function serviceName(id: string): string {
  return SERVICES.find((s) => s.id === id)?.name ?? id;
}

export function intentById(id: string): Intent | undefined {
  return INTENTS.find((item) => item.id === id);
}

export type Suggestion = {
  amountMon: string;
  recipient: string;
  lockRecipient: boolean;
  requestKey?: string;
  hint: string;
};

export function suggestion(vault: VaultView, action: ActionId): Suggestion {
  const owner = vault.ownerAddress;
  const cap = BigInt(vault.capWei);
  const left = remainingWei(vault);
  switch (action) {
    case "pay":
      return {
        amountMon: "0.010",
        recipient: owner,
        lockRecipient: false,
        hint: "Pays the owner, who is always on the list.",
      };
    case "uniswap":
    case "pancake":
    case "kuru":
    case "kintsu":
    case "apriori":
    case "magma":
      return {
        amountMon: "0.020",
        recipient: vault.address,
        lockRecipient: true,
        hint: "Output recipient is the vault. That is not editable.",
      };
    case "wmon":
      return {
        amountMon: "0.020",
        recipient: vault.address,
        lockRecipient: true,
        hint: "Wrap has no external recipient.",
      };
    case "x-cap":
      return {
        amountMon: formatMon(cap * 2n, 3),
        recipient: owner,
        lockRecipient: false,
        hint: "Suggested at twice the cap. Lower it and the rule may pass.",
      };
    case "x-stranger":
      return {
        amountMon: "0.010",
        recipient: DEAD,
        lockRecipient: true,
        hint: "Burn address. It is not on the payee list.",
      };
    case "x-budget": {
      const bump = left + ONE / 1000n;
      const amount = left === 0n ? cap > 0n ? cap / 2n || ONE / 100n : ONE / 100n : bump;
      return {
        amountMon: formatMon(amount, 3),
        recipient: owner,
        lockRecipient: false,
        hint: "Just over what the budget still allows.",
      };
    }
    case "x-drain":
      return {
        amountMon: "0",
        recipient: DEAD,
        lockRecipient: true,
        hint: "Selector is transfer(). Amount does not matter.",
      };
    case "x-self":
      return {
        amountMon: "0.020",
        recipient: vault.agentAddress,
        lockRecipient: true,
        hint: "The agent key is the swap recipient. The vault rejects that.",
      };
    case "x-withdraw":
      return {
        amountMon: "0.001",
        recipient: vault.agentAddress,
        lockRecipient: true,
        hint: "An agent calling withdraw. Only the owner can.",
      };
    case "x-unlisted":
      return {
        amountMon: "0.010",
        recipient: vault.address,
        lockRecipient: true,
        hint: "Target is the lending router, which is not allowlisted.",
      };
    case "x-replay":
      return {
        amountMon: "0.010",
        recipient: owner,
        lockRecipient: false,
        requestKey: REPLAY_KEY,
        hint: "Uses the burned request id pp-replay.",
      };
  }
}

type Rule = { label: string; code: string | null; detail: string };

function fail(rules: Rule[], index: number): Verdict["trace"] {
  return rules.map((rule, i) => ({
    label: rule.label,
    detail: rule.detail,
    state: i < index ? "pass" : i === index ? "fail" : "skip",
  }));
}

export function evaluate(input: {
  vault: VaultView;
  usedKeys: string[];
  action: ActionId;
  amountWei: bigint;
  recipient: string;
  requestKey: string;
}): Verdict {
  const { vault, action, amountWei } = input;
  const recipient = input.recipient.trim();
  if (action === "x-withdraw") {
    const rules: Rule[] = [
      {
        label: "Owner only",
        code: "NotOwner",
        detail: "Withdraw is an owner call. The agent cannot pull the vault.",
      },
    ];
    return {
      status: "fail",
      code: "NotOwner",
      reason: reasonFor("NotOwner", "Only the owner can withdraw."),
      trace: fail(rules, 0),
      amountWei: amountWei.toString(),
      recipient,
    };
  }
  const services = new Set(vault.services);
  const payees = new Set(vault.payees.map((p) => p.toLowerCase()));
  payees.add(vault.ownerAddress.toLowerCase());

  const kind =
    action === "x-cap" || action === "x-stranger" || action === "x-budget" || action === "x-replay"
      ? "pay"
      : action === "x-self"
        ? "uniswap"
        : action === "x-drain"
          ? "drain"
          : action === "x-unlisted"
            ? "unlisted"
            : action;

  const needsVaultRecipient = kind === "uniswap" || kind === "pancake" || kind === "kuru" || kind === "kintsu" || kind === "apriori" || kind === "magma";
  const isPay = kind === "pay";
  const spends = kind !== "drain";

  const rules: Rule[] = [
    {
      label: "Kill switch",
      code: vault.paused ? "Paused" : null,
      detail: vault.paused ? "Vault is paused." : "Vault is live.",
    },
    {
      label: "Fresh request",
      code: input.usedKeys.includes(input.requestKey) ? "RequestAlreadyExecuted" : null,
      detail: input.usedKeys.includes(input.requestKey)
        ? `Request ${input.requestKey} was already used.`
        : "Request id has not been used.",
    },
    {
      label: "Forbidden selectors",
      code: kind === "drain" ? "ForbiddenSelector" : null,
      detail: kind === "drain" ? "transfer() is blocked by design." : "Call is not approve, transfer, or permit.",
    },
    {
      label: "Service allowlist",
      code:
        kind === "unlisted"
          ? "ServiceNotAllowed"
          : kind === "drain"
            ? null
            : services.has(kind)
              ? null
              : "ServiceNotAllowed",
      detail:
        kind === "unlisted"
          ? "Lending is not switched on."
          : kind === "drain"
            ? "Not reached as a service call."
            : services.has(kind)
              ? `${serviceName(kind)} is switched on.`
              : `${serviceName(kind)} is switched off.`,
    },
    {
      label: "Output returns to vault",
      code:
        needsVaultRecipient && recipient.toLowerCase() !== vault.address.toLowerCase()
          ? "RecipientMustBeVault"
          : null,
      detail: needsVaultRecipient
        ? recipient.toLowerCase() === vault.address.toLowerCase()
          ? "Recipient is the vault."
          : "Recipient is not the vault."
        : "This call has no external output recipient.",
    },
    {
      label: "Payee allowlist",
      code: isPay ? (isAddress(recipient) && payees.has(recipient.toLowerCase()) ? null : isAddress(recipient) ? "RecipientNotAllowed" : "BadAddress") : null,
      detail: isPay
        ? !isAddress(recipient)
          ? "Recipient is not an address."
          : payees.has(recipient.toLowerCase())
            ? "Payee is approved."
            : "Payee is not approved."
        : "Not a payment.",
    },
    {
      label: "Per-action cap",
      code: spends && amountWei > BigInt(vault.capWei) ? "PerActionCapExceeded" : null,
      detail: spends
        ? `${formatMon(amountWei)} MON vs cap ${formatMon(vault.capWei)} MON.`
        : "No value leaves on this call.",
    },
    {
      label: "Total budget",
      code: spends && BigInt(vault.spentWei) + amountWei > BigInt(vault.budgetWei) ? "BudgetExceeded" : null,
      detail: spends
        ? `Spent ${formatMon(vault.spentWei)} + ${formatMon(amountWei)} vs budget ${formatMon(vault.budgetWei)}.`
        : "Budget counter is unchanged.",
    },
    {
      label: "Vault balance",
      code: spends && amountWei > BigInt(vault.balanceWei) ? "InsufficientBalance" : null,
      detail: spends
        ? `Call needs ${formatMon(amountWei)} MON. Vault holds ${formatMon(vault.balanceWei)}.`
        : "No MON is debited.",
    },
  ];

  const index = rules.findIndex((rule) => rule.code);
  if (index === -1) {
    return {
      status: "pass",
      code: null,
      reason: "Every rule holds. The vault would execute this call.",
      trace: rules.map((rule) => ({ label: rule.label, detail: rule.detail, state: "pass" as const })),
      amountWei: amountWei.toString(),
      recipient,
    };
  }
  const code = rules[index]!.code!;
  return {
    status: "fail",
    code,
    reason: reasonFor(code, "The vault would revert."),
    trace: fail(rules, index),
    amountWei: amountWei.toString(),
    recipient,
  };
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMon, isUnlimitedWei, type VaultView } from "@/lib/policy/model";

export function BudgetMeter({ vault }: { vault: VaultView }) {
  if (isUnlimitedWei(vault.budgetWei) || isUnlimitedWei(vault.capWei)) {
    return (
      <section className="rounded-3xl border border-border bg-bg-elev p-4">
        <p className="text-sm text-muted">No spending limit</p>
        <p className="mt-1 text-sm leading-relaxed">
          This vault has no budget and no per-action cap. The agent can move the balance. Spent so far{" "}
          <span className="font-mono tabular-nums">{formatMon(vault.spentWei)} MON</span>.
        </p>
      </section>
    );
  }
  const budget = BigInt(vault.budgetWei);
  const spent = BigInt(vault.spentWei);
  const left = budget > spent ? budget - spent : 0n;
  const pct = budget === 0n ? 0 : Math.min(100, Number((spent * 1000n) / budget) / 10);
  const low = budget > 0n && left * 5n < budget;
  return (
    <section className="rounded-3xl border border-border bg-bg-elev p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted">Remaining budget</p>
        <p className={cn("font-mono text-lg tabular-nums", low ? "text-warn" : "text-fg")}>{formatMon(left)} MON</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-subtle" aria-hidden>
        <div className={cn("h-full rounded-full", low ? "bg-warn" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-3 font-mono text-xs tabular-nums text-subtle">
        {formatMon(spent)} spent · {formatMon(vault.budgetWei)} budget · cap {formatMon(vault.capWei)}
      </p>
      {low && <p className="mt-2 text-xs text-warn">Under 20% of the budget is left.</p>}
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-fg">{label}</span>
      {hint && <span className="mt-0.5 block text-xs text-subtle">{hint}</span>}
      <div className="mt-2">{children}</div>
    </label>
  );
}

export const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-bg px-3 font-mono text-sm tabular-nums text-fg outline-none placeholder:text-subtle";

export function Notice({ tone, children }: { tone: "bad" | "ok" | "muted"; children: ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm",
        tone === "bad" && "border-bad/40 text-bad",
        tone === "ok" && "border-ok/40 text-ok",
        tone === "muted" && "border-border text-muted",
      )}
    >
      {children}
    </p>
  );
}

export function ago(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 36) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

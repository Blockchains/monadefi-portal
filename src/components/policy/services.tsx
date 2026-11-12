import { useState } from "react";
import { FACTORY, SERVICES, shortAddr } from "@/lib/policy/model";
import { cn } from "@/lib/cn";

export function ServicesScreen() {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-medium tracking-tight">What a vault can call</h2>
        <p className="mt-1 text-sm text-muted">
          Live means the address comes from the protocol's own docs and passes a mainnet fork test. The directory
          above is not on this list, and cannot spend the vault.
        </p>
      </header>
      <ul className="flex flex-col gap-2">
        {SERVICES.map((item) => {
          const expanded = open === item.id;
          return (
            <li key={item.id} className="rounded-xl border border-border bg-bg-elev">
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                onClick={() => setOpen(expanded ? null : item.id)}
                aria-expanded={expanded}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium">
                    {item.icon} {item.name}
                  </span>
                  <span className="mt-0.5 block text-xs text-subtle">{item.blurb}</span>
                </span>
                <span className={cn("shrink-0 text-xs", item.status === "live" ? "text-ok" : "text-subtle")}>
                  {item.status === "live" ? "Live" : "Soon"}
                </span>
              </button>
              {expanded && (
                <div className="border-t border-border px-3 py-3 text-sm text-muted">
                  <p>{item.novice}</p>
                  {item.address && <p className="mt-2 break-all font-mono text-xs text-subtle">{item.address}</p>}
                  {item.why && <p className="mt-2 text-sm text-muted">{item.why}</p>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <p className="font-mono text-xs text-subtle">Factory {shortAddr(FACTORY)}</p>
      <p className="text-xs text-subtle">
        Alpha reference. The contract is unaudited. A Monad deploy sends real MON. New vaults have no deposit cap.
      </p>
    </div>
  );
}

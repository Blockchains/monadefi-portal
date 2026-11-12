import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/seo/doc-page";
import { SEO_PAGES, breadcrumbJsonLd, pageHead } from "@/lib/seo";

const page = SEO_PAGES.how;

export const Route = createFileRoute("/how-it-works")({
  head: () => pageHead(page, breadcrumbJsonLd(page)),
  component: HowPage,
});

function HowPage() {
  return (
    <DocPage page={page}>
      <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed">
        <li>Connect a wallet on Monad mainnet, chain id 143. The vault owner is that wallet.</li>
        <li>Choose a deposit. New vaults do not take a budget, a cap, or an allowlist.</li>
        <li>Create the vault. A new vault starts unpaused. The reference showcase vault stays paused and empty.</li>
        <li>The agent can move the balance. You can pause the vault or withdraw whenever you want.</li>
        <li>Stake spare MON into aPriori aprMON from the Stake tab. That withdrawal is queued, then claimed.</li>
        <li>The home portal lists the 11 Nov Monad forks. Those links do not spend a vault. Only a transaction you sign from the vault tab does.</li>
      </ol>
      <p className="text-sm leading-relaxed text-muted">
        New vaults have no deposit cap. Practice mode uses a local ledger, still capped at 1 MON, and does not move mainnet funds. Read the{" "}
        <a className="text-accent" href="/security">
          security notes
        </a>{" "}
        or the{" "}
        <a className="text-accent" href="/docs">
          docs
        </a>{" "}
        before you fund a vault.
      </p>
    </DocPage>
  );
}

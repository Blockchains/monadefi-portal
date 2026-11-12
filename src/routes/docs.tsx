import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/seo/doc-page";
import { SEO_PAGES, breadcrumbJsonLd, pageHead } from "@/lib/seo";

const page = SEO_PAGES.docs;

export const Route = createFileRoute("/docs")({
  head: () => pageHead(page, breadcrumbJsonLd(page)),
  component: DocsPage,
});

function DocsPage() {
  return (
    <DocPage page={page}>
      <section className="flex flex-col gap-2 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Factory and vault</h2>
        <p>
          PolicyPilot vaults are created from the unlimited factory{" "}
          <span className="font-mono">0x41d6667aA35c3634D19068A39481d4c955f6557D</span> on Monad mainnet (chain 143).
          A new vault has no budget, no per-action cap, and no allowlist. The agent can move the balance.
        </p>
        <p>
          The showcase vault <span className="font-mono">0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97</span> is paused and
          empty. Vaults you create start unpaused. Older factories remain readable and keep the caps they were deployed with.
        </p>
        <p>
          The home page is the portal for the 11 Nov Monad forks. A listing is a link and, for Unison, Tab, Kanmani, and Corpus, a public read. It is not an allowlist entry. Those apps cannot spend a vault.
        </p>
      </section>
      <section className="flex flex-col gap-2 text-sm leading-relaxed">
        <h2 className="text-lg font-medium">Live spend versus practice</h2>
        <p>
          A live spend is a wallet signature and a Monad transaction. Practice mode writes a local ledger only. It does
          not move MON and it is not the same as an allowlisted mainnet call.
        </p>
        <p>
          The default executor is the connected wallet. Pause and withdraw stay with the owner. Details are on{" "}
          <a className="text-accent" href="/security">
            security
          </a>{" "}
          and{" "}
          <a className="text-accent" href="/how-it-works">
            how it works
          </a>
          .
        </p>
      </section>
    </DocPage>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/seo/doc-page";
import { SEO_PAGES, breadcrumbJsonLd, pageHead } from "@/lib/seo";

const page = SEO_PAGES.security;

export const Route = createFileRoute("/security")({
  head: () => pageHead(page, breadcrumbJsonLd(page)),
  component: SecurityPage,
});

function SecurityPage() {
  return (
    <DocPage page={page}>
      <ul className="flex list-disc flex-col gap-3 pl-5 text-sm leading-relaxed">
        <li>The owner key stays in your wallet. MonaDeFi does not hold a server-side key for your vault.</li>
        <li>New vaults have no on-chain cap or allowlist. The agent can move the whole balance. Older vaults still enforce their own rules.</li>
        <li>Pause, withdraw, and pull-everything-back stay with the owner. A paused vault cannot spend until you unpause it.</li>
        <li>New vaults start unpaused. The public showcase vault is paused and holds no funds.</li>
        <li>The contract is unaudited alpha. Deposit only MON you can lose. There is no 1 MON cap on new vaults.</li>
        <li>Forks listed on the portal cannot spend a vault. A link opens their site or repo. Only a transaction you sign can move MON.</li>
      </ul>
      <p className="text-sm leading-relaxed text-muted">
        Factory <span className="font-mono text-fg">0x41d6667aA35c3634D19068A39481d4c955f6557D</span>. Showcase{" "}
        <span className="font-mono text-fg">0x379e0C3Ecba46d62dAdCf26dBecd0F26A2cdCA97</span>. See{" "}
        <a className="text-accent" href="/how-it-works">
          how a vault is created
        </a>{" "}
        and the{" "}
        <a className="text-accent" href="/faq">
          FAQ
        </a>
        .
      </p>
    </DocPage>
  );
}

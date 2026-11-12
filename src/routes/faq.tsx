import { createFileRoute } from "@tanstack/react-router";
import { DocPage } from "@/components/seo/doc-page";
import { FAQ_ITEMS, SEO_PAGES, faqJsonLd, pageHead } from "@/lib/seo";

const page = SEO_PAGES.faq;

export const Route = createFileRoute("/faq")({
  head: () => pageHead(page, faqJsonLd()),
  component: FaqPage,
});

function FaqPage() {
  return (
    <DocPage page={page}>
      <div className="flex flex-col gap-5">
        {FAQ_ITEMS.map((item) => (
          <section key={item.q}>
            <h2 className="text-lg font-medium">{item.q}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted">{item.a}</p>
          </section>
        ))}
      </div>
      <p className="text-sm leading-relaxed text-muted">
        The live product is on the{" "}
        <a className="text-accent" href="/">
          home portal
        </a>
        . Rules are spelled out in the{" "}
        <a className="text-accent" href="/docs">
          docs
        </a>
        .
      </p>
    </DocPage>
  );
}

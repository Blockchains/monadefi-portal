import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/policy/shell";
import { loadLedger } from "@/lib/policy/server";
import { SEO_PAGES, homeJsonLd, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/")({
  head: () => pageHead(SEO_PAGES.home, homeJsonLd()),
  loader: () => loadLedger(),
  component: Home,
});

function Home() {
  const initial = Route.useLoaderData();
  return <AppShell initial={initial} />;
}

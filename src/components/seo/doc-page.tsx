import type { ReactNode } from "react";
import { SiteNav } from "@/components/seo/site-nav";
import type { SeoPage } from "@/lib/seo";

export function DocPage({ page, children }: { page: SeoPage; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <SiteNav current={page.path} />
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <p className="text-xs text-muted">
          <a href="/" className="text-accent">
            MonaDeFi
          </a>
          <span aria-hidden="true"> / </span>
          {page.crumb}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">{page.crumb}</h1>
        <p className="text-base leading-relaxed text-muted">{page.description}</p>
        {children}
      </article>
    </div>
  );
}
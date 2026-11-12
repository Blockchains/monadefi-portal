import { PUBLIC_PAGES } from "@/lib/seo";
import { cn } from "@/lib/cn";

export function SiteNav({ current }: { current?: string }) {
  return (
    <nav aria-label="MonaDeFi" className="flex shrink-0 gap-3 overflow-x-auto border-b border-border px-4 py-2 text-xs">
      {PUBLIC_PAGES.map((page) => {
        const on = current === page.path;
        return (
          <a
            key={page.path}
            href={page.path}
            className={cn("shrink-0 whitespace-nowrap font-medium", on ? "text-fg" : "text-muted")}
            aria-current={on ? "page" : undefined}
          >
            {page.crumb}
          </a>
        );
      })}
    </nav>
  );
}
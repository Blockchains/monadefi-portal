export const APEX_ORIGIN = "https://monadefi.com";

export type SeoPage = {
  path: "/" | "/how-it-works" | "/security" | "/faq" | "/docs" | "/pulse";
  title: string;
  description: string;
  crumb: string;
};

export const SEO_PAGES = {
  home: {
    path: "/",
    crumb: "Home",
    title: "MonaDeFi — the Monad DeFi portal",
    description:
      "MonaDeFi is one portal for the lab's Monad forks and for PolicyPilot vaults. New vaults have no cap. You can pause or pull every MON back. A listed fork cannot spend a vault.",
  },
  how: {
    path: "/how-it-works",
    crumb: "How it works",
    title: "How MonaDeFi works — vaults and the Monad portal",
    description:
      "How MonaDeFi works: the portal lists the lab's Monad forks, and a separate vault is created on Monad. New vaults have no cap. A fork cannot spend the vault.",
  },
  security: {
    path: "/security",
    crumb: "Security",
    title: "MonaDeFi security — vaults stay separate from forks",
    description:
      "MonaDeFi security: new vaults have no on-chain cap. The owner can pause or pull every MON back. Forks listed on the portal cannot spend a vault. Unaudited alpha.",
  },
  faq: {
    path: "/faq",
    crumb: "FAQ",
    title: "MonaDeFi FAQ — Monad portal and agent vaults",
    description:
      "Answers about the MonaDeFi portal, which forks can spend a vault, how pause works, and which Monad network is live.",
  },
  docs: {
    path: "/docs",
    crumb: "Docs",
    title: "MonaDeFi docs — PolicyPilot rules for Monad agents",
    description:
      "PolicyPilot rules on MonaDeFi: the factory, the vault, live services, and the difference between a signed Monad spend and a practice ledger.",
  },
  pulse: {
    path: "/pulse",
    crumb: "Pulse",
    title: "MonaDeFi Pulse — live traffic for PolicyPilot",
    description:
      "MonaDeFi Pulse shows live PolicyPilot traffic on Monad: people here now, pageviews, uniques, top paths, and the latest views. Visitor ids stay hashed.",
  },
} as const satisfies Record<string, SeoPage>;

export const PUBLIC_PAGES: SeoPage[] = [
  SEO_PAGES.home,
  SEO_PAGES.how,
  SEO_PAGES.security,
  SEO_PAGES.faq,
  SEO_PAGES.docs,
  SEO_PAGES.pulse,
];

export function pageUrl(path: string): string {
  return path === "/" ? `${APEX_ORIGIN}/` : `${APEX_ORIGIN}${path}`;
}

export function pageHead(page: SeoPage, jsonLd?: string) {
  const url = pageUrl(page.path);
  const image = `${APEX_ORIGIN}/og.jpg`;
  return {
    meta: [
      { title: page.title },
      { name: "description", content: page.description },
      { name: "application-name", content: "MonaDeFi" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" },
      { name: "googlebot", content: "index, follow" },
      { name: "keywords", content: "MonaDeFi, Monad, DeFi, stake, swap, pay, Uniswap, Kuru, aPriori, Monad mainnet" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MonaDeFi" },
      { property: "og:locale", content: "en_GB" },
      { property: "og:title", content: page.title },
      { property: "og:description", content: page.description },
      { property: "og:url", content: url },
      { property: "og:image", content: image },
      { property: "og:image:secure_url", content: image },
      { property: "og:image:type", content: "image/jpeg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "MonaDeFi, the Monad DeFi portal" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: page.title },
      { name: "twitter:description", content: page.description },
      { name: "twitter:image", content: image },
      { name: "twitter:image:alt", content: "MonaDeFi, the Monad DeFi portal" },
    ],
    links: [
      { rel: "canonical", href: url },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
    scripts: jsonLd ? [{ type: "application/ld+json", children: jsonLd }] : [],
  };
}

const FAQ = [
  {
    q: "What is MonaDeFi?",
    a: "MonaDeFi is a single portal for the lab's Monad forks and for PolicyPilot vaults. New vaults on Monad mainnet have no spending cap and no allowlist. You remain the owner.",
  },
  {
    q: "Can a listed fork spend my vault?",
    a: "No. The portal only links to the fork and, where a public feed exists, shows a live figure. Spending MON is a separate transaction you sign from the vault tab.",
  },
  {
    q: "What can an agent spend?",
    a: "On a new vault, the agent can move the whole balance to any address or contract. Older vaults still enforce their own cap, budget, and allowlist.",
  },
  {
    q: "Can I stop a vault?",
    a: "Yes. The owner can pause the vault or withdraw the MON in one transaction. A paused vault cannot spend.",
  },
  {
    q: "Which network is live?",
    a: "Monad mainnet, chain id 143. New vaults are unlimited and start unpaused. The showcase vault stays paused and empty. Older factories stay readable.",
  },
] as const;

export function homeJsonLd(): string {
  const origin = `${APEX_ORIGIN}/`;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${origin}#organization`,
        name: "MonaDeFi",
        alternateName: "PolicyPilot",
        url: origin,
        logo: `${APEX_ORIGIN}/icon-512.png`,
        description: SEO_PAGES.home.description,
      },
      {
        "@type": "WebSite",
        "@id": `${origin}#website`,
        name: "MonaDeFi",
        url: origin,
        description: SEO_PAGES.home.description,
        inLanguage: "en",
        publisher: { "@id": `${origin}#organization` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${origin}#app`,
        name: "MonaDeFi",
        alternateName: "PolicyPilot",
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web",
        url: origin,
        description: SEO_PAGES.home.description,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        publisher: { "@id": `${origin}#organization` },
      },
      {
        "@type": "FAQPage",
        "@id": `${APEX_ORIGIN}/faq#faq`,
        url: `${APEX_ORIGIN}/faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
    ],
  });
}

export function breadcrumbJsonLd(page: SeoPage): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl(page.path)}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "MonaDeFi", item: `${APEX_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: page.crumb, item: pageUrl(page.path) },
        ],
      },
    ],
  });
}

export function faqJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${APEX_ORIGIN}/faq#faq`,
        url: `${APEX_ORIGIN}/faq`,
        mainEntity: FAQ.map((item) => ({
          "@type": "Question",
          name: item.q,
          acceptedAnswer: { "@type": "Answer", text: item.a },
        })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${pageUrl(SEO_PAGES.faq.path)}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "MonaDeFi", item: `${APEX_ORIGIN}/` },
          { "@type": "ListItem", position: 2, name: SEO_PAGES.faq.crumb, item: pageUrl(SEO_PAGES.faq.path) },
        ],
      },
    ],
  });
}

export const FAQ_ITEMS = FAQ;

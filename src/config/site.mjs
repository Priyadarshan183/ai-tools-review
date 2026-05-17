// Central site configuration — edit this file before deploying.
// SITE_URL env var overrides the hardcoded url (used by CI to set the canonical
// origin without committing it). BASE_PATH env var sets the subpath if any.
const ENV_URL = (typeof process !== 'undefined' && process.env && process.env.SITE_URL) || '';
const ENV_BASE = (typeof process !== 'undefined' && process.env && process.env.BASE_PATH) || '';
const _base = ENV_BASE && !ENV_BASE.startsWith('/') ? '/' + ENV_BASE : ENV_BASE;

export const SITE = {
  name: 'AI Tools Review',
  shortName: 'AITR',
  url: ENV_URL || 'https://example.com',
  base: _base, // '' for root-hosted, '/ai-tools-review' for project-pages
  description:
    'Hands-on reviews and head-to-head comparisons of the best AI tools. Independent testing, clear pricing, real verdicts.',
  defaultLocale: 'en',
  defaultOgImage: '/og/default.png',
  twitterHandle: '@aitoolsreview',
  organization: {
    name: 'AI Tools Review',
    legalName: 'AI Tools Review',
    logoUrl: '/logo.svg',
    sameAs: [
      'https://twitter.com/aitoolsreview',
      'https://www.linkedin.com/company/aitoolsreview',
    ],
  },
  author: {
    name: 'Editor',
    url: 'https://example.com/about',
  },
  analytics: {
    // Set ONE of these. Leave blank to disable.
    plausibleDomain: '', // e.g. "aitoolsreview.com"
    umamiWebsiteId: '',
    umamiSrc: '',
  },
  verification: {
    google: '', // <meta name="google-site-verification" content="..." />
    bing: '', // <meta name="msvalidate.01" content="..." />
  },
  newsletter: {
    provider: 'buttondown', // 'buttondown' | 'convertkit' | 'none'
    actionUrl: 'https://buttondown.email/api/emails/embed-subscribe/CHANGE_ME',
  },
  comments: {
    // Giscus config — fill in if you want comments on blog/reviews
    giscus: {
      repo: '',
      repoId: '',
      category: 'General',
      categoryId: '',
    },
  },
  publishedYear: 2026,
};

export const NAV = [
  { label: 'Leaderboard', href: '/leaderboard' },
  { label: 'Models', href: '/tools' },
  { label: 'Compare', href: '/compare' },
  { label: 'Best Lists', href: '/best' },
  { label: 'Blog', href: '/blog' },
  { label: 'About', href: '/about' },
];

export const FOOTER_LINKS = {
  Site: [
    { label: 'About', href: '/about' },
    { label: 'Methodology', href: '/methodology' },
    { label: 'Contact', href: '/contact' },
    { label: 'Disclosure', href: '/disclosure' },
  ],
  Browse: [
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'All models', href: '/tools' },
    { label: 'Comparisons', href: '/compare' },
    { label: 'Categories', href: '/categories' },
    { label: 'Best lists', href: '/best' },
    { label: 'Blog', href: '/blog' },
  ],
  Feeds: [
    { label: 'RSS', href: '/rss.xml' },
    { label: 'Sitemap', href: '/sitemap-index.xml' },
  ],
};

import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import { SITE } from './src/config/site.mjs';

// BASE_PATH lets us deploy under a subpath (e.g. /ai-tools-review on GitHub Pages
// project sites). Empty / unset in dev so npm run dev stays at http://localhost:4321/.
const rawBase = process.env.BASE_PATH ?? '';
const base = rawBase && !rawBase.startsWith('/') ? `/${rawBase}` : rawBase;

export default defineConfig({
  site: SITE.url,
  base: base || undefined,
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
    inlineStylesheets: 'auto',
  },
  prefetch: {
    prefetchAll: false,
    defaultStrategy: 'hover',
  },
  integrations: [
    mdx(),
    tailwind({ applyBaseStyles: false }),
    sitemap({
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === SITE.url + '/') item.priority = 1.0;
        if (item.url.includes('/tools/')) item.priority = 0.9;
        if (item.url.includes('/compare/')) item.priority = 0.8;
        if (item.url.includes('/categories/')) item.priority = 0.8;
        if (item.url.includes('/best/')) item.priority = 0.8;
        if (item.url.includes('/blog/')) item.priority = 0.6;
        return item;
      },
    }),
  ],
  image: {
    domains: [],
    remotePatterns: [{ protocol: 'https' }],
  },
  markdown: {
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
});

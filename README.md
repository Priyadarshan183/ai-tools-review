# AI Tools Review

A production-ready, SEO-first review and comparison site for AI tools. Built on Astro 5 + Tailwind + MDX with type-safe content collections, deploy targets for both Cloudflare Pages and Vercel, and a small fleet of automation scripts so the operating workload is editing words, not wrangling infrastructure.

## What's in the box

- **7 page types**: homepage, `/tools/[slug]`, `/compare/[a]-vs-[b]` (auto-generated from tool data, overridable with MDX), `/categories/[slug]`, `/best/[use-case]`, `/blog/[slug]`, plus trust pages (`/about`, `/methodology`, `/contact`, `/disclosure`).
- **Type-safe content** via Astro Content Collections + Zod (`src/content/config.ts`).
- **SEO baked in**: per-page `<title>`, meta description, canonical, Open Graph, Twitter Card, JSON-LD (Organization, WebSite, Article, Review, AggregateRating, FAQPage, BreadcrumbList, ItemList), auto sitemap with priority/changefreq, RSS for the blog, semantic HTML, proper H1 hierarchy, breadcrumbs everywhere, image lazy-loading.
- **Pagefind static search** built into `npm run build`.
- **Dark mode** with a no-flash inline theme-loader.
- **Privacy-friendly analytics** placeholders (Plausible / Umami).
- **Newsletter + Giscus comments** placeholders.
- **5 automation scripts** (see below).
- **GitHub Actions** for weekly link-checking + auto-rebuild and a CI build/audit on PRs.

## Quick start

```bash
npm install
npm run dev          # http://localhost:4321
npm run build        # → ./dist + ./dist/pagefind
npm run preview
```

## Configure before deploying

Edit [`src/config/site.mjs`](src/config/site.mjs) — the central config file:

- `SITE.url` — your real domain (used for canonical URLs, sitemap, JSON-LD)
- `SITE.analytics` — fill in `plausibleDomain` or Umami settings
- `SITE.verification` — Google Search Console & Bing Webmaster meta tags
- `SITE.newsletter.actionUrl` — your Buttondown / ConvertKit form endpoint
- `SITE.comments.giscus` — repo/category IDs from <https://giscus.app>
- `SITE.organization.sameAs` — your real social URLs

Also update [`public/robots.txt`](public/robots.txt) with the production domain.

## Data pipeline (the part that runs forever)

The site is wired around live model data from free, unauthenticated public APIs — **no API keys, no paid endpoints, no inference calls**. Hand-curated benchmark scores live in [`src/data/benchmarks.json`](src/data/benchmarks.json) and are the only source of truth for benchmark numbers.

### Sources

| Source | URL | Used for | Frequency |
| --- | --- | --- | --- |
| OpenRouter | `https://openrouter.ai/api/v1/models` | Model catalog, pricing, context, modality, tool-calling support, free-tier flag | Once per build (daily via GitHub Action) |
| Hugging Face | `https://huggingface.co/api/models/{id}` | Community signals (downloads, likes, license) for open-weight models only | Cached 24 hours; capped at ~55 req/min |
| `src/data/benchmarks.json` | local | All benchmark scores + their sources | Manual; update on new model launches |

### Outputs

- `src/data/openrouter-models.raw.json` — raw OpenRouter response cache (used as fallback if the live fetch fails)
- `src/data/hf-enrichment.raw.json` — HF response cache (24h TTL)
- `src/data/models.json` — normalized merged catalog consumed by every page
- `src/data/top-by-category.json` — top-3 model slugs per category, used by the homepage

### Run it locally

```bash
npm run fetch-model-data           # writes models.json + top-by-category.json
npm run build                      # prebuild auto-runs the fetch script
```

### Behaviour & guarantees

- **No keys.** Every fetch uses only the public, unauthenticated endpoints above. The script fails loudly if an endpoint starts requiring a key.
- **Retry with backoff** — 3 tries, 1s/2s/4s, 20s timeout per request.
- **Cache fallback.** If OpenRouter is down at build time, the script reads the last successful cache and emits a warning rather than failing the build.
- **Zod validation everywhere.** Every API response and every output row is validated. Rows that fail are dropped with a logged reason — never invented or estimated.
- **Benchmark scores are sacred.** Only what's in `benchmarks.json` ever appears on the site. Missing benchmarks render as `—`, not estimates.

### Updating benchmarks.json when a new model launches

1. Add or update a model entry in `src/data/benchmarks.json`. Fields like `slug`, `name`, `provider`, `website`, `api_docs`, `openrouter_id`, `release_date`, `is_open_weight`, `license`, `context_window`, `max_output_tokens`, `modality`, `pricing`, and `benchmarks` are all schema-validated.
2. For benchmark scores: cite the **vendor model card** for first-party numbers; cite **independent evaluators** (Vellum, Artificial Analysis, etc.) when available. Use the more conservative number when sources conflict. Use `null` rather than estimating.
3. Bump `_meta.last_full_review` and the model's `last_verified` date.
4. Run `npm run fetch-model-data` locally to verify the model appears in the merged output with the expected categories.
5. Commit. The daily GitHub Action will pick it up; or trigger it manually from the Actions tab.

### GitHub Actions

- **`.github/workflows/refresh-model-data.yml`** — runs daily at 03:00 UTC. Fetches OpenRouter + HF, regenerates `models.json` and `top-by-category.json`, commits any changes. Uses only the default `GITHUB_TOKEN`; no other secrets are required.
- **`.github/workflows/weekly-check.yml`** — pings every tool's website weekly, updates `last_verified` / `verified_status` in tool JSON, opens a GitHub issue if anything is broken.
- **`.github/workflows/ci.yml`** — runs build + SEO audit on every push/PR.

## Content workflow

```bash
# Add a new tool (creates JSON + MDX stub)
npm run new-tool -- "NewTool Name" ai-writing-tools

# After adding tools, generate stub comparison pages for new pairs
npm run generate-comparisons

# Plan your next reviews from a keyword CSV
npm run keyword-report -- ./keywords.example.csv --out keyword-report.md

# Audit the built site for SEO issues
npm run build && npm run audit-seo

# Manually trigger the weekly link check
npm run check-links
```

For the editorial workflow and template usage, see [CONTENT_GUIDE.md](CONTENT_GUIDE.md).
For the per-review publishing checklist, see [CHECKLIST.md](CHECKLIST.md).

## Deploy

### GitHub Pages (recommended, zero infrastructure)

The repo includes a GitHub Action that builds the site and publishes it to GitHub Pages on every push to `main`. To go live:

1. **Push the project to a GitHub repo named `ai-tools-review`** (any visibility — but free Pages requires public).
   - In GitHub Desktop: File → Add Local Repository → choose this folder → Publish Repository → name `ai-tools-review` → uncheck "Keep this code private" if you want free Pages → Publish.
2. **Enable Pages**: in the GitHub repo, go to **Settings → Pages → Build and deployment** → set **Source** to **"GitHub Actions"**. (Just selecting it is enough; you don't have to pick a workflow.)
3. **Push any commit** (or trigger `Deploy to GitHub Pages` manually from the Actions tab). The workflow will:
   - Install deps
   - Run `npm run build` (which runs `fetch-model-data` → `astro build` → `rewrite-base.mjs` → `pagefind`)
   - Upload `dist/` to Pages
4. Site is live at **`https://<your-github-username>.github.io/ai-tools-review/`** about 1–2 minutes later.

The deploy workflow ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)) auto-derives the canonical URL from `github.repository_owner` and the base path from the repo name, so nothing needs to be hardcoded.

**How base-path handling works.** Because the site lives at `<user>.github.io/ai-tools-review/` (not the root), every internal link needs to start with `/ai-tools-review/`. Two pieces handle this automatically:

- The build script reads `BASE_PATH=/ai-tools-review` and configures Astro accordingly (asset URLs auto-prefix).
- After Astro builds, [`scripts/rewrite-base.mjs`](scripts/rewrite-base.mjs) walks every HTML file in `dist/` and prefixes any unprefixed absolute internal URL (hand-written `<a href="/tools/foo">`, etc).
- Client-side JS uses `window.SITE_BASE`, injected into every page from `Layout.astro`.

Dev mode (`npm run dev`) and any host that serves from the root (Vercel, Cloudflare Pages, a custom domain) just don't set `BASE_PATH`, and everything stays unprefixed.

### Cloudflare Pages

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=ai-tools-review
```

Or connect the repo via the Cloudflare dashboard — `wrangler.toml` is already configured (`pages_build_output_dir = "./dist"`). Set build command to `npm run build`.

### Vercel

```bash
npm install -g vercel
vercel
```

`vercel.json` is already configured (framework: astro, output: `dist`, immutable cache headers on static assets).

### GitHub Actions

- **`.github/workflows/ci.yml`** — runs build + SEO audit on every push/PR.
- **`.github/workflows/weekly-check.yml`** — runs every Monday 06:00 UTC: pings every tool's website, updates `last_verified` and `verified_status` in each tool JSON, opens a GitHub issue if any are broken, then triggers a redeploy via the `DEPLOY_HOOK` secret (set this to your Cloudflare/Vercel deploy hook URL).

## Project structure

```
ai-tools-review/
├── astro.config.mjs          # Astro config + sitemap integration
├── tailwind.config.mjs       # Tailwind + typography plugin
├── wrangler.toml             # Cloudflare Pages deploy config
├── vercel.json               # Vercel deploy config + cache headers
├── public/
│   ├── _headers              # Cloudflare Pages headers (CSP, cache, etc.)
│   ├── robots.txt
│   ├── favicon.svg, logo.svg
│   └── logos/                # Tool logos
├── src/
│   ├── config/site.mjs       # ⭐ Central site config — edit before deploy
│   ├── content/
│   │   ├── config.ts         # ⭐ Zod schemas for every collection
│   │   ├── tools/            # .json — structured tool data
│   │   ├── reviews/          # .mdx — full review bodies
│   │   ├── comparisons/      # .mdx — manual head-to-heads (auto-generated otherwise)
│   │   ├── categories/       # .json
│   │   ├── best/             # .mdx — best-of listicles
│   │   └── blog/             # .mdx — long-form guides
│   ├── components/           # Astro components (Header, Footer, ToolCard, ...)
│   ├── layouts/              # Layout.astro, ProseLayout.astro
│   ├── lib/
│   │   ├── jsonld.ts         # Every JSON-LD builder
│   │   └── format.ts         # Date, slug, comparison-pair helpers
│   ├── pages/                # Astro routes (see "7 page types" above)
│   └── styles/global.css
├── scripts/
│   ├── new-tool.mjs          # Scaffold a new tool + review
│   ├── generate-comparisons.mjs
│   ├── keyword-report.mjs
│   ├── audit-seo.mjs
│   └── check-links.mjs
├── templates/                # ⭐ Copy these when writing new content
│   ├── review.template.mdx
│   ├── comparison.template.mdx
│   └── listicle.template.mdx
└── .github/workflows/
    ├── ci.yml
    └── weekly-check.yml
```

## Editing checklist (TL;DR)

1. Update `src/config/site.mjs`.
2. Update `public/robots.txt` with the production domain.
3. Drop tool logos in `public/logos/<slug>.svg`.
4. Run `npm run new-tool -- "Name" category-slug` and fill in the stub.
5. Run `npm run generate-comparisons` to scaffold pair pages.
6. `npm run build && npm run audit-seo` — fix any reported issues.
7. Deploy.

## License

UNLICENSED — adapt freely for your own review site.

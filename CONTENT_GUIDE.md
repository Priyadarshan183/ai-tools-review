# Content guide

The SEO strategy in one sentence: **build a small number of trustworthy pages around buyer-intent keywords, link them tightly together, and update them on a schedule.** Everything below is in service of that.

## Page types and what they're for

| Type | URL | Target keyword shape | Word count | Primary CTA |
| --- | --- | --- | --- | --- |
| Tool review | `/tools/[slug]` | "X review" | 1,500–2,500 | Visit tool (affiliate) |
| Comparison | `/compare/[a]-vs-[b]` | "X vs Y" | 2,000+ | Read the winning review |
| Best-of listicle | `/best/[use-case]` | "best X for Y" | 3,000+ | Click through to top picks |
| Category | `/categories/[slug]` | "best X tools" | 800+ intro | Browse category |
| Blog guide | `/blog/[slug]` | "how to X", "what is Y" | 1,200+ | Newsletter signup |

Trust pages (`/about`, `/methodology`, `/disclosure`, `/contact`) are not for SEO — they're for E-E-A-T, which Google reads as a multiplier on everything else.

## Choosing what to write next

Use `npm run keyword-report -- keywords.csv` to rank opportunities by `(volume / difficulty) × intent`. The report excludes keywords already targeted by an existing piece of content (it reads frontmatter `target_keyword` fields).

Order of preference when picking what's next:

1. **Comparisons** for tools you've already reviewed (cheap to write, high commercial intent)
2. **"Best for [niche use case]" listicles** that draw from existing reviews
3. **New tool reviews** — only after you can write a confident verdict
4. **Blog guides** — slowest to rank, but compound the most over 12+ months

Avoid: writing a category landing page before you have at least 4–5 tools in that category.

## Templates

Three MDX templates live in [`templates/`](templates/):

- [`review.template.mdx`](templates/review.template.mdx)
- [`comparison.template.mdx`](templates/comparison.template.mdx)
- [`listicle.template.mdx`](templates/listicle.template.mdx)

Each template has HTML-comment guidance for **where the target keyword must appear** and **the H2/H3 structure Google rewards** for that intent.

## Internal linking rules

Every page must link out to:

- Its category landing page (breadcrumb does this automatically — that counts)
- At least one comparison involving it
- At least 3 related tools or pages (handled in the `/tools/[slug]` route automatically, but manual prose links inside reviews matter more)

Every review's body must link to:

- The affiliate or vendor site (in the sidebar CTA — handled by the layout)
- One direct competitor's review
- One comparison page involving this tool

## Voice and editorial defaults

- **One reviewer perspective.** First-person plural ("we tested"); never the editorial royal "we have determined".
- **Verdict-first.** State buy/skip in the intro and the verdict. Don't hedge.
- **Numbers over adjectives.** "40-second latency" beats "slow". "Hallucinated 1 in 5 citations" beats "unreliable".
- **No marketing speak.** No "revolutionary", no "game-changing", no "powerful".
- **Disclose conflicts in every review with an affiliate link.** The sidebar mini-disclosure handles this for tool pages; other pages should link to `/disclosure` when relevant.

## Updating schedule

| What | Cadence |
| --- | --- |
| Tool re-test (every tool) | 90 days, or sooner on pricing/major-release events |
| Best-of lists | Re-rank quarterly; verify each pick is still our recommendation |
| Comparisons | Re-check the data table quarterly; rewrite the verdict if either side has materially changed |
| Blog guides | 12 months unless evergreen content goes stale |

When you re-test, **update the `last_tested_date` in the tool JSON** (and the review's `updated_date`). Both feed into JSON-LD and the "Last tested / Updated" line on every page.

## Affiliate links

- Add `affiliate_link` to the tool JSON.
- Layout automatically applies `rel="sponsored noopener"`.
- Sidebar shows mini-disclosure with link to `/disclosure`.

If you add a new affiliate program, document it in `/disclosure`.

## Images

- Use `/public/logos/<slug>.svg` for tool logos (SVG preferred — tiny and crisp).
- For in-content screenshots, drop them in `/public/screenshots/<slug>/<short-name>.webp` and reference with `<img>` — Astro's image pipeline handles lazy loading.
- Every `<img>` MUST have a descriptive `alt`. The SEO audit script will fail if you forget.

## What the build does for you

- Generates `sitemap-index.xml` + `sitemap-0.xml` from every routable page
- Generates `/rss.xml` from `src/content/blog/`
- Generates an `ItemList` JSON-LD for category and `/best` pages
- Generates `Review` + `AggregateRating` + `Article` + `BreadcrumbList` JSON-LD on every tool page
- Generates `FAQPage` JSON-LD from the `faq` array in tool JSON
- Builds the Pagefind static search index into `dist/pagefind/`

## What's NOT generated and you have to write

- The actual review prose (templates help but the words are yours)
- The verdicts in auto-generated comparisons (they ship as `draft: true` — change to `false` to publish)
- Best-of listicle bodies (template gives the structure)

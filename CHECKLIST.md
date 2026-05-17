# Publishing checklist

Use this every time you publish a review, comparison, or listicle.

## Keyword & intent

- [ ] Target keyword chosen and noted in `target_keyword` frontmatter
- [ ] Keyword appears in: H1, intro paragraph, URL slug, at least one H2
- [ ] Intent matches the page type (review = "X review", comparison = "X vs Y", listicle = "best X for Y")
- [ ] Keyword not already targeted by another page on the site (`npm run keyword-report` will surface duplicates)

## Schema & frontmatter

- [ ] All required Zod fields filled (build will fail if not)
- [ ] `last_tested_date` is the date you actually tested it, not the publish date
- [ ] `rating` matches the `score_breakdown` average within ±0.2
- [ ] `pros` and `cons` are each at least 3 items
- [ ] `faq` has at least 2 honest buyer questions
- [ ] `affiliate_link` set (or website used as fallback)
- [ ] `draft: false` (or absent — defaults to false)

## Internal links

- [ ] Links to its category landing page
- [ ] Links to at least one comparison page involving this tool
- [ ] Links to at least 1 related tool review by name
- [ ] If it's a listicle: every pick links to its full review

## Images

- [ ] Logo dropped at `public/logos/<slug>.svg`
- [ ] All in-body `<img>` tags have descriptive `alt` text
- [ ] OG image set if the default isn't appropriate (`og_image` in frontmatter)

## Structure & E-E-A-T

- [ ] Exactly one `<h1>` (the route handles this; don't add another in MDX)
- [ ] H2s describe sections; H3s nest under H2s; no skipping levels
- [ ] Verdict appears in the intro AND in the closing section
- [ ] Editorial process is verifiable: tasks tested, hours of use, real workload — be specific
- [ ] Affiliate disclosure present if there's an affiliate link

## Build & audit

- [ ] `npm run build` succeeds
- [ ] `npm run audit-seo` reports zero issues for this URL
- [ ] Local preview looks correct in light and dark mode
- [ ] Mobile view checked (DevTools or real phone)

## Post-publish

- [ ] Submit URL to Google Search Console (Inspect → Request indexing)
- [ ] Add to internal linking from at least 2 existing high-traffic pages
- [ ] If it's a re-test of an existing review: update `updated_date` and note the change in the "What changed since last review" section

#!/usr/bin/env node
// Usage: npm run new-tool -- "Tool Name" [category-slug]
import { writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: npm run new-tool -- "Tool Name" [category-slug]');
  process.exit(1);
}

const name = args[0];
const category = args[1] ?? 'ai-writing-tools';
const slug = name
  .toLowerCase()
  .trim()
  .replace(/[^a-z0-9\s-]/g, '')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-');

const today = new Date().toISOString().slice(0, 10);

const toolJson = {
  name,
  slug,
  logo: `/logos/${slug}.svg`,
  website: `https://example.com/${slug}`,
  category,
  pricing_model: 'freemium',
  starting_price: '$0/mo',
  free_tier: true,
  pros: ['TODO: pro 1', 'TODO: pro 2', 'TODO: pro 3'],
  cons: ['TODO: con 1', 'TODO: con 2'],
  features: ['TODO: feature 1', 'TODO: feature 2', 'TODO: feature 3'],
  use_cases: ['TODO: use case 1', 'TODO: use case 2'],
  rating: 4.0,
  last_tested_date: today,
  our_take:
    'TODO: 1–2 sentence editorial take, written before pros/cons so we commit to a position.',
  alternatives: [],
  faq: [
    { question: 'TODO: question?', answer: 'TODO: answer.' },
  ],
  verified_status: 'unchecked',
  featured: false,
};

const reviewMdx = `---
tool_slug: ${slug}
headline: "${name} Review: TODO compelling subhead"
intro: "TODO: 2–3 sentence intro that includes the target keyword and signals what makes this review trustworthy."
verdict: "TODO: Buy / skip / buy with caveats — one sentence."
score_breakdown:
  ease_of_use: 4.0
  features: 4.0
  value: 4.0
  support: 4.0
author: Editor
publish_date: ${today}
updated_date: ${today}
target_keyword: "${slug.replace(/-/g, ' ')} review"
draft: true
---

{/* TARGET KEYWORD: "${slug.replace(/-/g, ' ')} review" — must appear in H1, intro paragraph, and URL slug */}

## What is ${name}?

TODO: One paragraph. Who it's for, what category it competes in, what makes it distinctive.

## How we tested it

TODO: Specifics. Number of hours used, what tasks, what comparisons.

## What's great

### TODO: H3 with a concrete claim

TODO: Evidence. Real examples beat adjectives.

## What's not great

TODO: Be specific. "Slow" is useless; "40-second latency on 500-word generations during US peak" is useful.

## Pricing

TODO: Plans, what's included, what isn't.

## Verdict

TODO: Restate the buy/skip recommendation and link to one alternative.
`;

const toolPath = path.resolve(`src/content/tools/${slug}.json`);
const reviewPath = path.resolve(`src/content/reviews/${slug}.mdx`);

if (existsSync(toolPath)) {
  console.error(`Tool already exists: ${toolPath}`);
  process.exit(1);
}

await mkdir(path.dirname(toolPath), { recursive: true });
await mkdir(path.dirname(reviewPath), { recursive: true });
await writeFile(toolPath, JSON.stringify(toolJson, null, 2) + '\n', 'utf8');
await writeFile(reviewPath, reviewMdx, 'utf8');

console.log(`✓ Created ${toolPath}`);
console.log(`✓ Created ${reviewPath}`);
console.log('');
console.log('Next steps:');
console.log(`  1. Drop a logo at public/logos/${slug}.svg`);
console.log(`  2. Fill in the TODOs in both files`);
console.log(`  3. Set draft: false in the review frontmatter when ready to publish`);

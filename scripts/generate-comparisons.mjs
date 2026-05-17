#!/usr/bin/env node
// Generates a stub comparison MDX file for every pair of tools in the same category
// that doesn't already have a manually-authored comparison.
// Usage: npm run generate-comparisons
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const TOOLS_DIR = path.resolve('src/content/tools');
const COMP_DIR = path.resolve('src/content/comparisons');
await mkdir(COMP_DIR, { recursive: true });

const compSlug = (a, b) => [a, b].sort().join('-vs-');

const toolFiles = (await readdir(TOOLS_DIR)).filter((f) => f.endsWith('.json'));
const tools = await Promise.all(
  toolFiles.map(async (f) => JSON.parse(await readFile(path.join(TOOLS_DIR, f), 'utf8')))
);

const existing = new Set();
if (existsSync(COMP_DIR)) {
  const compFiles = (await readdir(COMP_DIR)).filter((f) => f.endsWith('.mdx'));
  for (const cf of compFiles) {
    const { data } = matter(await readFile(path.join(COMP_DIR, cf), 'utf8'));
    if (data.tool_a && data.tool_b) existing.add(compSlug(data.tool_a, data.tool_b));
  }
}

const byCat = {};
for (const t of tools) (byCat[t.category] ||= []).push(t);

const today = new Date().toISOString().slice(0, 10);
let created = 0, skipped = 0;

for (const list of Object.values(byCat)) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const slug = compSlug(a.slug, b.slug);
      if (existing.has(slug)) { skipped++; continue; }
      const filepath = path.join(COMP_DIR, `${slug}.mdx`);
      if (existsSync(filepath)) { skipped++; continue; }

      const body = `---
tool_a: ${a.slug}
tool_b: ${b.slug}
headline: "${a.name} vs ${b.name}: Which AI Tool Wins?"
intro: "A head-to-head comparison of ${a.name} and ${b.name}, based on our hands-on testing."
verdict_a: "Pick ${a.name} if ${a.use_cases[0]?.toLowerCase() ?? 'it matches your use case'}."
verdict_b: "Pick ${b.name} if ${b.use_cases[0]?.toLowerCase() ?? 'it matches your use case'}."
winner: tie
target_keyword: "${a.slug.replace(/-/g, ' ')} vs ${b.slug.replace(/-/g, ' ')}"
publish_date: ${today}
updated_date: ${today}
auto_generated: true
draft: true
---

## TL;DR

- Pick **${a.name}** for: ${a.use_cases.slice(0, 2).join(', ')}.
- Pick **${b.name}** for: ${b.use_cases.slice(0, 2).join(', ')}.

## Where ${a.name} wins

${a.pros.slice(0, 3).map((p) => `- ${p}`).join('\n')}

## Where ${b.name} wins

${b.pros.slice(0, 3).map((p) => `- ${p}`).join('\n')}

## Verdict

TODO: Replace this auto-generated stub with a real verdict and set \`draft: false\` to publish.
`;
      await writeFile(filepath, body, 'utf8');
      console.log(`✓ Created ${filepath}`);
      created++;
    }
  }
}

console.log('');
console.log(`Done. Created ${created} comparison stubs, skipped ${skipped} existing.`);

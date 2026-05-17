#!/usr/bin/env node
// Reads a CSV of seed keywords and outputs a prioritized opportunity report.
// CSV columns: keyword,volume,difficulty,intent
// Usage: npm run keyword-report -- ./keywords.csv [--out report.md]
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import process from 'node:process';

const args = process.argv.slice(2);
const csvPath = args[0];
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : 'keyword-report.md';

if (!csvPath || !existsSync(csvPath)) {
  console.error('Usage: npm run keyword-report -- ./keywords.csv [--out report.md]');
  console.error('CSV columns: keyword,volume,difficulty,intent');
  process.exit(1);
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines.shift().split(',').map((h) => h.trim().toLowerCase());
  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? '']));
  });
}

async function existingKeywords() {
  const out = new Set();
  for (const dir of ['src/content/reviews', 'src/content/comparisons', 'src/content/best', 'src/content/blog']) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.mdx')) continue;
      const { data } = matter(await readFile(path.join(dir, f), 'utf8'));
      if (data.target_keyword) out.add(data.target_keyword.toLowerCase());
    }
  }
  return out;
}

const rows = parseCSV(await readFile(csvPath, 'utf8'));
const covered = await existingKeywords();

function score({ volume, difficulty, intent }) {
  const v = Number(volume) || 0;
  const d = Number(difficulty) || 100;
  const intentMul = { transactional: 1.5, commercial: 1.3, informational: 1.0, navigational: 0.5 }[
    (intent || '').toLowerCase()
  ] ?? 1.0;
  if (d === 0) return 0;
  return Math.round((v / d) * intentMul * 10) / 10;
}

const opportunities = rows
  .map((r) => ({ ...r, score: score(r), covered: covered.has(r.keyword.toLowerCase()) }))
  .sort((a, b) => b.score - a.score);

const md = [
  `# Keyword opportunity report`,
  ``,
  `Generated ${new Date().toISOString()}`,
  ``,
  `Source: \`${csvPath}\``,
  ``,
  `## Top opportunities (not yet covered)`,
  ``,
  `| Score | Keyword | Volume | Difficulty | Intent | Suggested page |`,
  `| --- | --- | --- | --- | --- | --- |`,
  ...opportunities
    .filter((r) => !r.covered)
    .slice(0, 40)
    .map(
      (r) =>
        `| ${r.score} | ${r.keyword} | ${r.volume} | ${r.difficulty} | ${r.intent || '?'} | ${suggestPage(r.keyword)} |`
    ),
  ``,
  `## Already covered`,
  ``,
  opportunities.filter((r) => r.covered).map((r) => `- ${r.keyword}`).join('\n') || '_(none)_',
  ``,
].join('\n');

function suggestPage(kw) {
  const k = kw.toLowerCase();
  if (k.startsWith('best ')) return 'best-list';
  if (k.includes(' vs ')) return 'comparison';
  if (k.endsWith(' review') || k.endsWith(' reviews')) return 'tool-review';
  if (k.startsWith('how to') || k.startsWith('what is')) return 'blog-guide';
  return 'blog or category page';
}

await writeFile(outPath, md, 'utf8');
console.log(`✓ Wrote ${outPath}`);
console.log(`  Top 3 untouched keywords:`);
for (const r of opportunities.filter((r) => !r.covered).slice(0, 3)) {
  console.log(`   - ${r.keyword} (score ${r.score}, ${suggestPage(r.keyword)})`);
}

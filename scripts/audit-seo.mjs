#!/usr/bin/env node
// Crawls the built `dist/` directory and reports SEO issues:
//   - missing meta descriptions
//   - duplicate titles
//   - missing or duplicate H1s
//   - missing alt text on images
//   - pages without structured data (JSON-LD)
//   - internal links pointing to nonexistent pages
//
// Usage: npm run build && npm run audit-seo
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { globby } from 'globby';
import * as cheerio from 'cheerio';

const DIST = path.resolve('dist');
const RAW_BASE = process.env.BASE_PATH || '';
const BASE = (RAW_BASE && !RAW_BASE.startsWith('/') ? '/' + RAW_BASE : RAW_BASE).replace(/\/$/, '');
if (!existsSync(DIST)) {
  console.error('No dist/ directory found. Run `npm run build` first.');
  process.exit(1);
}

const files = await globby(['**/*.html'], { cwd: DIST });
const titles = new Map();
const issues = [];

const pathOfFile = (f) => {
  const p = '/' + f.replace(/index\.html$/, '').replace(/\\/g, '/');
  return p.endsWith('/') && p !== '/' ? p.slice(0, -1) : p;
};

const known = new Set(files.map(pathOfFile));

for (const f of files) {
  const html = await readFile(path.join(DIST, f), 'utf8');
  const $ = cheerio.load(html);
  const route = pathOfFile(f);

  const title = $('head > title').text().trim();
  const desc = $('head meta[name="description"]').attr('content')?.trim();
  const canonical = $('head link[rel="canonical"]').attr('href');
  const ldCount = $('script[type="application/ld+json"]').length;
  const h1s = $('h1');

  if (!title) issues.push({ route, kind: 'missing-title' });
  if (!desc) issues.push({ route, kind: 'missing-meta-description' });
  if (!canonical) issues.push({ route, kind: 'missing-canonical' });
  if (ldCount === 0) issues.push({ route, kind: 'no-structured-data' });
  if (h1s.length === 0) issues.push({ route, kind: 'missing-h1' });
  if (h1s.length > 1) issues.push({ route, kind: 'multiple-h1s', detail: `count=${h1s.length}` });

  if (title) {
    const arr = titles.get(title) ?? [];
    arr.push(route);
    titles.set(title, arr);
  }

  $('img').each((_, el) => {
    const alt = $(el).attr('alt');
    if (alt === undefined || alt.trim() === '') {
      issues.push({ route, kind: 'image-missing-alt', detail: $(el).attr('src') });
    }
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (/^https?:\/\//i.test(href)) return;
    // Strip the configured BASE_PATH so we can check against the dist file layout
    // (which doesn't include the base prefix in its directory structure).
    let url = href.split('#')[0].split('?')[0].replace(/\/$/, '') || '/';
    if (BASE && (url === BASE || url.startsWith(BASE + '/'))) {
      url = url.slice(BASE.length) || '/';
    }
    if (!known.has(url) && !existsSync(path.join(DIST, url.replace(/^\//, '')))) {
      issues.push({ route, kind: 'broken-internal-link', detail: href });
    }
  });
}

for (const [t, routes] of titles) {
  if (routes.length > 1) {
    issues.push({ route: routes.join(', '), kind: 'duplicate-title', detail: t });
  }
}

const grouped = {};
for (const i of issues) (grouped[i.kind] ||= []).push(i);

console.log(`SEO audit — ${files.length} pages scanned`);
console.log('================================================');
const order = [
  'missing-title',
  'duplicate-title',
  'missing-meta-description',
  'missing-canonical',
  'missing-h1',
  'multiple-h1s',
  'no-structured-data',
  'image-missing-alt',
  'broken-internal-link',
];
let total = 0;
for (const kind of order) {
  const list = grouped[kind];
  if (!list || list.length === 0) continue;
  total += list.length;
  console.log(`\n[${kind}] (${list.length})`);
  for (const i of list.slice(0, 25)) {
    console.log(`  - ${i.route}${i.detail ? '  → ' + i.detail : ''}`);
  }
  if (list.length > 25) console.log(`  ... and ${list.length - 25} more`);
}
console.log('\n================================================');
console.log(total === 0 ? 'No SEO issues found.' : `Total issues: ${total}`);
process.exit(total === 0 ? 0 : 1);

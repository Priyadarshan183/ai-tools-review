#!/usr/bin/env node
/**
 * Post-build URL rewriter for sub-path deploys (e.g. GitHub Pages project sites).
 *
 * Reads BASE_PATH env var. If empty or "/", does nothing. Otherwise walks every
 * HTML file in dist/ and prefixes the base path to any absolute internal URL that
 * isn't already prefixed.
 *
 * Astro auto-prefixes its own asset URLs (/_astro/*) when `base` is configured,
 * but hand-written links like <a href="/tools/foo"> in templates do not get
 * auto-prefixed. This script fixes that.
 *
 * Skips:
 *   - External URLs (http://, https://, //)
 *   - mailto:, tel:, data:, javascript:
 *   - URLs already starting with the base path
 *   - URLs starting with /_astro/ or /pagefind/ (Astro/Pagefind handle these)
 *   - Bare fragments (#foo) and query-only (?foo)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { globby } from 'globby';
import * as cheerio from 'cheerio';
import process from 'node:process';

const raw = process.env.BASE_PATH || '';
const base = raw && !raw.startsWith('/') ? '/' + raw : raw;
const baseStripped = base.replace(/\/$/, '');

if (!baseStripped) {
  console.log('rewrite-base: no BASE_PATH set, nothing to do.');
  process.exit(0);
}

// Only skip URLs that are already correctly prefixed with the base. Everything
// else under "/" gets the base prepended — including /_astro/* (which Astro
// already auto-prefixes; the "starts with base" check below short-circuits
// double-prefixing) and /pagefind/* (which lives at <base>/pagefind/ on disk
// and must be prefixed for the browser to find it).
const SKIP_PREFIXES = [
  baseStripped + '/',
  baseStripped + '?',
  baseStripped + '#',
];

function rewriteHref(href) {
  if (!href) return href;
  if (href === baseStripped) return href;
  // External, protocol-relative, special-scheme, anchor, query-only
  if (/^([a-z][a-z0-9+.-]*:|\/\/|#|\?)/i.test(href)) return href;
  if (!href.startsWith('/')) return href; // relative — leave alone
  for (const p of SKIP_PREFIXES) if (href.startsWith(p)) return href;
  return baseStripped + href;
}

const targets = [
  ['a', 'href'],
  ['link', 'href'],
  ['area', 'href'],
  ['script', 'src'],
  ['img', 'src'],
  ['source', 'src'],
  ['video', 'src'],
  ['audio', 'src'],
  ['iframe', 'src'],
  ['form', 'action'],
];

const files = await globby(['dist/**/*.html']);
let changed = 0;
let rewrites = 0;
for (const file of files) {
  const html = await readFile(file, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  let touched = false;
  for (const [tag, attr] of targets) {
    $(tag).each((_, el) => {
      const cur = $(el).attr(attr);
      const next = rewriteHref(cur);
      if (next !== cur) {
        $(el).attr(attr, next);
        rewrites++;
        touched = true;
      }
    });
  }
  // <meta property="og:image" content="/..."> / og:url etc are full URLs from SITE.url, already correct
  // Inline scripts that build URLs should use window.SITE_BASE (handled separately)

  if (touched) {
    await writeFile(file, $.html(), 'utf8');
    changed++;
  }
}

console.log(`rewrite-base: rewrote ${rewrites} attribute(s) across ${changed}/${files.length} HTML files (base=${baseStripped})`);

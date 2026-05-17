#!/usr/bin/env node
// Pings every tool's website. Updates each tool's `last_verified` and
// `verified_status` field. Designed to run in GitHub Actions weekly.
// Usage: npm run check-links
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const TOOLS_DIR = path.resolve('src/content/tools');
const today = new Date().toISOString().slice(0, 10);

const files = (await readdir(TOOLS_DIR)).filter((f) => f.endsWith('.json'));
let ok = 0, broken = 0, redirect = 0;
const flagged = [];

async function ping(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      signal: ctrl.signal,
      headers: { 'User-Agent': 'AITR-LinkChecker/1.0 (+https://example.com)' },
    });
    clearTimeout(t);
    if (res.status >= 200 && res.status < 300) return 'ok';
    if (res.status >= 300 && res.status < 400) return 'redirect';
    // Some sites reject HEAD — try GET
    if (res.status === 405 || res.status === 403) {
      const r2 = await fetch(url, { method: 'GET', signal: ctrl.signal });
      if (r2.status >= 200 && r2.status < 300) return 'ok';
      if (r2.status >= 300 && r2.status < 400) return 'redirect';
      return 'broken';
    }
    return 'broken';
  } catch {
    return 'broken';
  }
}

for (const f of files) {
  const filepath = path.join(TOOLS_DIR, f);
  const tool = JSON.parse(await readFile(filepath, 'utf8'));
  const status = await ping(tool.website);
  tool.verified_status = status;
  tool.last_verified = today;
  await writeFile(filepath, JSON.stringify(tool, null, 2) + '\n', 'utf8');
  if (status === 'ok') ok++;
  else if (status === 'redirect') { redirect++; flagged.push(`${tool.name} → ${tool.website} (redirect)`); }
  else { broken++; flagged.push(`${tool.name} → ${tool.website} (BROKEN)`); }
  console.log(`  ${status === 'ok' ? '✓' : status === 'redirect' ? '↪' : '✗'} ${tool.name}`);
}

console.log('');
console.log(`Checked ${files.length} tools: ${ok} ok, ${redirect} redirects, ${broken} broken`);
if (flagged.length) {
  console.log('\nFlagged for manual review:');
  for (const line of flagged) console.log(`  - ${line}`);
}
process.exit(broken > 0 ? 1 : 0);

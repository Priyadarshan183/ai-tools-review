import { SITE } from '../config/site.mjs';

/** Build a fully-qualified URL from a site-relative path, including the base prefix. */
export function absUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (SITE.base || '').replace(/\/$/, '');
  const origin = SITE.url.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : '/' + path;
  // Don't double-prefix if path already starts with the base
  const finalPath = base && p.startsWith(base + '/') ? p : (base ? base + p : p);
  return origin + finalPath;
}

/** Build a site-relative URL (path only) with the base prefix applied. */
export function relUrl(path: string): string {
  const base = (SITE.base || '').replace(/\/$/, '');
  const p = path.startsWith('/') ? path : '/' + path;
  if (base && p.startsWith(base + '/')) return p;
  return base ? base + p : p;
}

export function formatDate(d: Date | string, locale = 'en-US'): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function isoDate(d: Date | string): string {
  return new Date(d).toISOString();
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function pricingLabel(model: string): string {
  return (
    { freemium: 'Freemium', subscription: 'Subscription', 'one-time': 'One-time', 'usage-based': 'Usage-based', enterprise: 'Enterprise', free: 'Free' }[
      model
    ] ?? model
  );
}

export function comparisonSlug(a: string, b: string): string {
  const [first, second] = [a, b].sort();
  return `${first}-vs-${second}`;
}

export function parseComparisonSlug(
  slug: string
): { a: string; b: string } | null {
  const match = slug.match(/^(.+)-vs-(.+)$/);
  if (!match) return null;
  return { a: match[1], b: match[2] };
}

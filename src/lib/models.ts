import modelsFile from '../data/models.json';
import topByCategoryFile from '../data/top-by-category.json';

export interface ModelBenchmarkScore {
  score: number | null;
  source: string | null;
  note?: string;
}

export interface Model {
  slug: string;
  name: string;
  provider: string;
  description: string | null;
  website: string | null;
  api_docs: string | null;
  openrouter_id: string | null;
  release_date: string | null;
  is_open_weight: boolean;
  license: string | null;
  context_window: number | null;
  max_output_tokens: number | null;
  modality: string[];
  supported_features: string[];
  pricing: {
    input_per_million: number | null;
    output_per_million: number | null;
    currency: string;
    has_free_tier: boolean;
    source: string | null;
  };
  benchmarks: Record<string, ModelBenchmarkScore>;
  hf_downloads: number | null;
  hf_likes: number | null;
  last_updated: string;
  last_verified: string | null;
  categories: CategoryId[];
}

export type CategoryId =
  | 'coding'
  | 'reasoning'
  | 'writing'
  | 'vision'
  | 'multimodal'
  | 'long_context'
  | 'budget'
  | 'free'
  | 'open_weight'
  | 'fast';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  longLabel: string;
  oneLiner: string;
  metricKey: string | null;
  metricLabel: string;
  emoji: string;
}

export const CATEGORIES: CategoryMeta[] = [
  { id: 'coding', label: 'Coding', longLabel: 'Best AI for coding', oneLiner: 'Top performers on SWE-Bench and real engineering tasks.', metricKey: 'swe_bench_pro', metricLabel: 'SWE-Bench Pro', emoji: '💻' },
  { id: 'reasoning', label: 'Reasoning', longLabel: 'Best AI for reasoning', oneLiner: 'Graduate-level science, math, and multi-step logic.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '🧠' },
  { id: 'writing', label: 'Writing', longLabel: 'Best AI for writing', oneLiner: 'Instruction-following and voice control for long-form work.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '✍️' },
  { id: 'vision', label: 'Vision', longLabel: 'Best AI for vision tasks', oneLiner: 'Multimodal models that take images as input.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '🖼️' },
  { id: 'multimodal', label: 'Multimodal', longLabel: 'Best multimodal AI', oneLiner: 'Models that accept audio or video, not just images.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '🎞️' },
  { id: 'long_context', label: 'Long context', longLabel: 'Best AI for long context', oneLiner: '500K+ token context windows for big documents.', metricKey: null, metricLabel: 'Context', emoji: '📜' },
  { id: 'budget', label: 'Budget', longLabel: 'Best cheap AI models', oneLiner: 'Under $1 per million input tokens, with a real quality signal.', metricKey: null, metricLabel: 'Input $/M', emoji: '💵' },
  { id: 'free', label: 'Free', longLabel: 'Best free AI models', oneLiner: 'Have a free tier you can use without paying.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '🎁' },
  { id: 'open_weight', label: 'Open weight', longLabel: 'Best open-weight AI models', oneLiner: 'Weights are public — self-host or fine-tune.', metricKey: 'gpqa_diamond', metricLabel: 'GPQA Diamond', emoji: '🔓' },
  { id: 'fast', label: 'Fast', longLabel: 'Fastest AI models', oneLiner: 'High output throughput for low-latency apps.', metricKey: 'output_throughput_tps', metricLabel: 'tokens/sec', emoji: '⚡' },
];

export function getCategory(id: CategoryId): CategoryMeta {
  const c = CATEGORIES.find((x) => x.id === id);
  if (!c) throw new Error(`Unknown category: ${id}`);
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// Data accessors — single source of truth for the rest of the site
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelsFile {
  generated_at: string;
  openrouter_source: 'fresh' | 'cache';
  count: number;
  models: Model[];
}

export interface TopByCategoryFile {
  generated_at: string;
  top: Record<CategoryId, string[]>;
}

export const MODELS: Model[] = (modelsFile as unknown as ModelsFile).models;
export const MODELS_GENERATED_AT: string = (modelsFile as unknown as ModelsFile).generated_at;
export const MODELS_BY_SLUG = new Map<string, Model>(MODELS.map((m) => [m.slug, m]));
export const TOP_BY_CATEGORY: Record<CategoryId, string[]> = (
  topByCategoryFile as unknown as TopByCategoryFile
).top;

export function getModel(slug: string): Model | undefined {
  return MODELS_BY_SLUG.get(slug);
}

export function getModelsByCategory(cat: CategoryId): Model[] {
  return MODELS.filter((m) => m.categories.includes(cat));
}

export function topModelsForCategory(cat: CategoryId): Model[] {
  return (TOP_BY_CATEGORY[cat] ?? [])
    .map((s) => MODELS_BY_SLUG.get(s))
    .filter((m): m is Model => !!m);
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatting + ranking helpers
// ─────────────────────────────────────────────────────────────────────────────

export function formatPrice(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n === 0) return 'Free';
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function formatTokens(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function formatScore(s: number | null | undefined): string {
  if (s == null) return '—';
  if (s >= 100) return s.toFixed(0);
  if (s < 10) return s.toFixed(2);
  return s.toFixed(1);
}

/** Percentile rank of a score within all non-null scores for that benchmark. 0..100 */
export function percentileFor(benchmark: string, score: number): number {
  const all = MODELS.map((m) => m.benchmarks[benchmark]?.score).filter(
    (x): x is number => typeof x === 'number'
  );
  if (all.length === 0) return 0;
  const below = all.filter((x) => x <= score).length;
  return Math.round((below / all.length) * 100);
}

export interface PricePoles {
  cheapestFrontier: Model | null;
  cheapestOpenWeight: Model | null;
  mostExpensive: Model | null;
}

/** "Pricing at a glance" trio for the homepage. */
export function pricingPoles(): PricePoles {
  const frontierMetric = (m: Model) =>
    m.benchmarks['gpqa_diamond']?.score ?? m.benchmarks['humanitys_last_exam']?.score;
  const isFrontier = (m: Model) => (frontierMetric(m) ?? 0) >= 80;

  const priced = MODELS.filter((m) => typeof m.pricing.input_per_million === 'number');
  const cheapestFrontier =
    priced
      .filter(isFrontier)
      .sort((a, b) => a.pricing.input_per_million! - b.pricing.input_per_million!)[0] ?? null;
  const cheapestOpenWeight =
    priced
      .filter((m) => m.is_open_weight)
      .sort((a, b) => a.pricing.input_per_million! - b.pricing.input_per_million!)[0] ?? null;
  const mostExpensive =
    [...priced].sort((a, b) => b.pricing.input_per_million! - a.pricing.input_per_million!)[0] ??
    null;

  return { cheapestFrontier, cheapestOpenWeight, mostExpensive };
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider logo — single SVG file with an organization initial
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDER_COLORS: Record<string, string> = {
  Anthropic: '#c96442',
  OpenAI: '#10a37f',
  Google: '#4285f4',
  xAI: '#000000',
  DeepSeek: '#4d6bfe',
  'Moonshot AI': '#0b1220',
  Alibaba: '#ff6a00',
  Meta: '#0866ff',
  'Mistral AI': '#ff7000',
  'Z.ai': '#7c3aed',
  Cohere: '#39594d',
  'NousResearch': '#5b5cf6',
};

export function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider] ?? '#71717a';
}

export function providerInitials(provider: string): string {
  return provider
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

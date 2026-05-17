/**
 * Fetches model metadata from free, unauthenticated public APIs and merges it
 * with the hand-curated benchmarks.json into a normalized models.json.
 *
 * Free APIs only — no keys, no inference, no paid endpoints:
 *   - https://openrouter.ai/api/v1/models       (model catalog, pricing, context)
 *   - https://huggingface.co/api/models/{id}    (open-weight community signals)
 *
 * Inputs:  src/data/benchmarks.json (hand-curated, source of truth for scores)
 * Outputs: src/data/openrouter-models.raw.json  (cache of upstream)
 *          src/data/hf-enrichment.raw.json      (cache of upstream)
 *          src/data/models.json                 (normalized merged data)
 *          src/data/top-by-category.json        (top-3 model slugs per category)
 *
 * On total API failure, falls back to the existing cache and logs a warning.
 * Never invents benchmark scores. Drops rows that fail validation.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DATA_DIR = path.resolve('src/data');
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/models';
const HF_API = 'https://huggingface.co/api/models';
const USER_AGENT = 'ai-tools-review/0.1 (+https://example.com)';

// Hugging Face politeness — cap at 60 req/min
const HF_MIN_INTERVAL_MS = 1100; // ~55 req/min

// Curated allowlist of model-id substrings considered "strong writing" providers.
// Used only when benchmark signals aren't enough on their own.
const WRITING_ALLOWLIST = [
  'anthropic/claude',
  'openai/gpt',
  'openai/o',
  'google/gemini',
  'mistralai/mistral-large',
  'cohere/command',
];

// Curated allowlist for "fast" when output_throughput_tps is absent.
const FAST_ALLOWLIST = [
  'google/gemini-3-flash',
  'openai/gpt-5-mini',
  'meta-llama/llama-4-scout',
  'mistralai/mistral-nemo',
  'mistralai/mistral-small',
  'qwen/qwen-3.5-0.8b',
];

// ─────────────────────────────────────────────────────────────────────────────
// Zod schemas
// ─────────────────────────────────────────────────────────────────────────────

// OpenRouter /api/v1/models response — tolerant: only fields we use are required.
const OpenRouterModelSchema = z
  .object({
    id: z.string(),
    canonical_slug: z.string().nullish(),
    name: z.string().nullish(),
    description: z.string().nullish(),
    context_length: z.number().nullish(),
    created: z.number().nullish(),
    architecture: z
      .object({
        modality: z.string().nullish(),
        input_modalities: z.array(z.string()).nullish(),
        output_modalities: z.array(z.string()).nullish(),
        tokenizer: z.string().nullish(),
      })
      .partial()
      .nullish(),
    top_provider: z
      .object({
        context_length: z.number().nullish(),
        max_completion_tokens: z.number().nullish(),
        is_moderated: z.boolean().nullish(),
      })
      .partial()
      .nullish(),
    pricing: z
      .object({
        prompt: z.string().nullish(),
        completion: z.string().nullish(),
        request: z.string().nullish(),
        image: z.string().nullish(),
        web_search: z.string().nullish(),
        internal_reasoning: z.string().nullish(),
      })
      .partial()
      .nullish(),
    supported_parameters: z.array(z.string()).nullish(),
    hugging_face_id: z.string().nullish(),
  })
  .passthrough();

const OpenRouterListSchema = z.object({
  data: z.array(OpenRouterModelSchema),
});

// Hugging Face model API
const HFModelSchema = z
  .object({
    id: z.string(),
    downloads: z.number().nullish(),
    likes: z.number().nullish(),
    lastModified: z.string().nullish(),
    license: z.string().nullish(),
    tags: z.array(z.string()).nullish(),
    pipeline_tag: z.string().nullish(),
  })
  .passthrough();

// Curated benchmarks.json
const BenchmarkScoreSchema = z.object({
  score: z.number().nullable(),
  source: z.string().nullable(),
  note: z.string().optional(),
});

const BenchmarkModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  website: z.string().url().optional(),
  api_docs: z.string().url().optional(),
  openrouter_id: z.string().nullable().optional(),
  release_date: z.string().optional(),
  is_open_weight: z.boolean().optional(),
  license: z.string().optional(),
  context_window: z.number().optional(),
  max_output_tokens: z.number().optional(),
  modality: z.array(z.string()).optional(),
  supported_features: z.array(z.string()).optional(),
  pricing: z
    .object({
      input_per_million: z.number().nullable().optional(),
      output_per_million: z.number().nullable().optional(),
      currency: z.string().optional(),
      has_free_tier: z.boolean().optional(),
      source: z.string().nullable().optional(),
      note: z.string().optional(),
    })
    .optional(),
  benchmarks: z.record(BenchmarkScoreSchema).optional(),
  last_verified: z.string().optional(),
});

const BenchmarksFileSchema = z.object({
  models: z.array(BenchmarkModelSchema),
  _meta: z.unknown().optional(),
  $schema: z.string().optional(),
});

// Final merged output schema — every models.json row must satisfy this.
const CATEGORY_VALUES = [
  'coding',
  'reasoning',
  'writing',
  'vision',
  'multimodal',
  'long_context',
  'budget',
  'free',
  'open_weight',
  'fast',
] as const;
const CategorySchema = z.enum(CATEGORY_VALUES);

const MergedModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  provider: z.string(),
  description: z.string().nullable(),
  website: z.string().nullable(),
  api_docs: z.string().nullable(),
  openrouter_id: z.string().nullable(),
  release_date: z.string().nullable(),
  is_open_weight: z.boolean(),
  license: z.string().nullable(),
  context_window: z.number().int().positive().nullable(),
  max_output_tokens: z.number().int().positive().nullable(),
  modality: z.array(z.string()),
  supported_features: z.array(z.string()),
  pricing: z.object({
    input_per_million: z.number().nullable(),
    output_per_million: z.number().nullable(),
    currency: z.string(),
    has_free_tier: z.boolean(),
    source: z.string().nullable(),
  }),
  benchmarks: z.record(BenchmarkScoreSchema),
  hf_downloads: z.number().nullable(),
  hf_likes: z.number().nullable(),
  last_updated: z.string(),
  last_verified: z.string().nullable(),
  categories: z.array(CategorySchema),
});

type MergedModel = z.infer<typeof MergedModelSchema>;
type BenchmarkModel = z.infer<typeof BenchmarkModelSchema>;
type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;
type HFModel = z.infer<typeof HFModelSchema>;
type Category = (typeof CATEGORY_VALUES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// HTTP with retry + cache fallback
// ─────────────────────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  { tries = 3, baseDelayMs = 1000, timeoutMs = 20000 } = {}
): Promise<unknown> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < tries; attempt++) {
    if (attempt > 0) {
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} for ${url}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(
        `  ⚠ fetch attempt ${attempt + 1}/${tries} failed: ${(err as Error).message}`
      );
    }
  }
  throw lastErr ?? new Error(`Fetch failed: ${url}`);
}

async function loadCacheOr<T>(
  filePath: string,
  fresh: () => Promise<T>,
  schema: z.ZodType<T>
): Promise<{ data: T; from: 'fresh' | 'cache' }> {
  try {
    const data = await fresh();
    return { data, from: 'fresh' };
  } catch (err) {
    if (existsSync(filePath)) {
      console.warn(
        `  ⚠ upstream fetch failed (${(err as Error).message}); falling back to cache: ${filePath}`
      );
      const cached = JSON.parse(await readFile(filePath, 'utf8'));
      return { data: schema.parse(cached), from: 'cache' };
    }
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Source fetchers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOpenRouter(): Promise<{
  models: OpenRouterModel[];
  source: 'fresh' | 'cache';
}> {
  const cachePath = path.join(DATA_DIR, 'openrouter-models.raw.json');
  const { data, from } = await loadCacheOr(
    cachePath,
    async () => {
      console.log(`→ Fetching ${OPENROUTER_URL}`);
      const raw = await fetchWithRetry(OPENROUTER_URL);
      const parsed = OpenRouterListSchema.parse(raw);
      await writeFile(cachePath, JSON.stringify(parsed, null, 2) + '\n', 'utf8');
      console.log(`  ✓ ${parsed.data.length} models from OpenRouter; cached`);
      return parsed;
    },
    OpenRouterListSchema
  );
  return { models: data.data, source: from };
}

async function fetchHuggingFaceFor(
  openRouterModels: OpenRouterModel[]
): Promise<Record<string, HFModel>> {
  const cachePath = path.join(DATA_DIR, 'hf-enrichment.raw.json');
  const cacheTtlMs = 24 * 60 * 60 * 1000;

  // Cache hit within TTL?
  if (existsSync(cachePath)) {
    const stats = await readFile(cachePath, 'utf8').then(
      (s) => JSON.parse(s) as { fetched_at: string; data: Record<string, HFModel> }
    );
    const age = Date.now() - new Date(stats.fetched_at).getTime();
    if (age < cacheTtlMs) {
      console.log(`  ✓ HF cache fresh (${Math.round(age / 60000)}m old); ${Object.keys(stats.data).length} entries`);
      return stats.data;
    }
  }

  // Decide which IDs to enrich: only OpenRouter rows that look open-weight.
  // We approximate "open-weight" from id prefix until we cross-reference benchmarks.
  const openWeightPrefixes = ['meta-llama/', 'qwen/', 'mistralai/', 'deepseek/', 'moonshotai/', 'z-ai/', 'nousresearch/', 'cohere/', 'google/gemma'];
  const candidates = openRouterModels.filter((m) =>
    openWeightPrefixes.some((p) => m.id.startsWith(p))
  );

  console.log(`→ Enriching ${candidates.length} open-weight candidates from Hugging Face`);
  const result: Record<string, HFModel> = {};
  let ok = 0, fail = 0;
  for (const m of candidates) {
    const hfId = m.hugging_face_id ?? deriveHfId(m.id);
    if (!hfId) continue;
    try {
      // HF expects raw "/" in path — do not URL-encode the slash.
      const url = `${HF_API}/${hfId.split('/').map(encodeURIComponent).join('/')}`;
      const raw = await fetchWithRetry(url, { tries: 2, timeoutMs: 10000 });
      const parsed = HFModelSchema.parse(raw);
      result[m.id] = parsed;
      ok++;
    } catch {
      fail++;
    }
    await new Promise((r) => setTimeout(r, HF_MIN_INTERVAL_MS));
  }
  await writeFile(
    cachePath,
    JSON.stringify({ fetched_at: new Date().toISOString(), data: result }, null, 2) + '\n',
    'utf8'
  );
  console.log(`  ✓ HF: ${ok} enriched, ${fail} skipped; cached`);
  return result;
}

function deriveHfId(openRouterId: string): string | null {
  // OpenRouter ids are usually "org/name" matching the HF id directly.
  if (openRouterId.includes('/')) return openRouterId;
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge & categorize
// ─────────────────────────────────────────────────────────────────────────────

function priceStrToPerMillion(s: string | null | undefined): number | null {
  if (s == null) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  // OpenRouter quotes prices per-token; convert to $/M tokens.
  return Math.round(n * 1_000_000 * 1_000_000) / 1_000_000;
}

function modalityFrom(or: OpenRouterModel | null): string[] {
  const out = new Set<string>();
  const arch = or?.architecture ?? {};
  const m = arch.modality;
  if (m) {
    for (const part of m.split(/[+,>\->]+/).map((x) => x.trim()).filter(Boolean)) {
      out.add(part);
    }
  }
  for (const x of arch.input_modalities ?? []) out.add(x);
  for (const x of arch.output_modalities ?? []) out.add(x);
  // Normalize: "image" -> "vision"
  if (out.has('image')) {
    out.delete('image');
    out.add('vision');
  }
  return [...out];
}

function supportedFeaturesFrom(or: OpenRouterModel | null): string[] {
  return [...new Set(or?.supported_parameters ?? [])];
}

function deriveSlug(b: BenchmarkModel | undefined, or: OpenRouterModel): string {
  if (b?.slug) return b.slug;
  // From "anthropic/claude-opus-4-7" → "claude-opus-4-7"
  const tail = or.id.split('/').pop() ?? or.id;
  return tail
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isOpenWeight(b: BenchmarkModel | undefined, or: OpenRouterModel | null, hf: HFModel | null): boolean {
  if (b?.is_open_weight !== undefined) return b.is_open_weight;
  if (hf) return true; // we only enriched candidates that looked open-weight
  // Fallback by license tag from HF
  const license = (hf as HFModel | null)?.license;
  if (license && !/proprietary/i.test(license)) return true;
  return false;
}

function pickProvider(b: BenchmarkModel | undefined, or: OpenRouterModel): string {
  if (b?.provider) return b.provider;
  const org = or.id.split('/')[0];
  return org.charAt(0).toUpperCase() + org.slice(1);
}

function categorize(m: Omit<MergedModel, 'categories'>, allInputPrices: number[]): Category[] {
  const cats = new Set<Category>();
  const bench = m.benchmarks;
  const b = (k: string) => bench[k]?.score ?? null;

  if (m.is_open_weight) cats.add('open_weight');
  if (m.pricing.has_free_tier) cats.add('free');
  if (typeof m.pricing.input_per_million === 'number' && m.pricing.input_per_million <= 1.0) {
    cats.add('budget');
  }
  if (typeof m.context_window === 'number' && m.context_window >= 500_000) cats.add('long_context');
  if (m.modality.includes('vision')) cats.add('vision');
  if (m.modality.includes('audio') || m.modality.includes('video')) cats.add('multimodal');

  // Threshold-based — only add the category if the model has a strong score.
  // "Top model" is defined relative to the catalog elsewhere (top-by-category
  // ranking); here we add the category if the score exists and is non-trivial.
  if ((b('swe_bench_verified') ?? 0) > 0 || (b('swe_bench_pro') ?? 0) > 0) cats.add('coding');
  if ((b('gpqa_diamond') ?? 0) > 0 || (b('humanitys_last_exam') ?? 0) > 0) cats.add('reasoning');

  // Writing: curated allowlist + decent benchmarks
  const isWriting = WRITING_ALLOWLIST.some((p) => (m.openrouter_id ?? '').startsWith(p));
  if (isWriting) cats.add('writing');

  // Fast: throughput benchmark or curated allowlist
  const tps = (bench['output_throughput_tps']?.score ?? 0) as number;
  if (tps >= 1000) cats.add('fast');
  else if (FAST_ALLOWLIST.includes(m.openrouter_id ?? '')) cats.add('fast');

  return [...cats];
}

// ─────────────────────────────────────────────────────────────────────────────
// Top-by-category ranking
// ─────────────────────────────────────────────────────────────────────────────

// Each ranker returns a number (higher = better). null means "exclude entirely".
// For sparse categories, we require at least one quality signal — a model is
// only eligible if it has a non-null benchmark score or appears on a curated
// allowlist. This prevents obscure router/fine-tune models from winning the
// budget/free buckets just because they're cheap.
const QUALITY_SIGNAL = (m: MergedModel): number | null => {
  return (
    m.benchmarks['gpqa_diamond']?.score ??
    m.benchmarks['humanitys_last_exam']?.score ??
    m.benchmarks['arena_elo']?.score ??
    (m.hf_likes != null ? m.hf_likes / 100 : null)
  );
};

const PRIMARY_METRIC_BY_CATEGORY: Record<Category, (m: MergedModel) => number | null> = {
  coding: (m) =>
    m.benchmarks['swe_bench_pro']?.score ?? m.benchmarks['swe_bench_verified']?.score ?? null,
  reasoning: (m) =>
    m.benchmarks['humanitys_last_exam']?.score ?? m.benchmarks['gpqa_diamond']?.score ?? null,
  writing: (m) =>
    m.benchmarks['arena_elo']?.score ?? m.benchmarks['gpqa_diamond']?.score ?? null,
  vision: (m) => m.benchmarks['gpqa_diamond']?.score ?? null,
  multimodal: (m) => m.benchmarks['gpqa_diamond']?.score ?? null,
  long_context: (m) => {
    // Require a real benchmark or curated entry; an "auto" router with 2M context isn't a real pick.
    if (QUALITY_SIGNAL(m) == null) return null;
    return m.context_window ?? null;
  },
  budget: (m) => {
    // Eligible only if it has a quality signal AND a price.
    if (QUALITY_SIGNAL(m) == null) return null;
    if (m.pricing.input_per_million == null) return null;
    // Lower price = better, but break ties with quality.
    return -m.pricing.input_per_million + (QUALITY_SIGNAL(m)! / 1000);
  },
  free: (m) => {
    if (QUALITY_SIGNAL(m) == null) return null;
    return QUALITY_SIGNAL(m)!;
  },
  open_weight: (m) =>
    m.benchmarks['gpqa_diamond']?.score ??
    m.benchmarks['arena_elo']?.score ??
    (m.hf_likes != null ? m.hf_likes / 1000 : null),
  fast: (m) => {
    // Real throughput benchmark wins. Allowlist members fall back to their
    // quality signal so the bucket fills out predictably.
    const tps = m.benchmarks['output_throughput_tps']?.score;
    if (typeof tps === 'number') return tps;
    if (FAST_ALLOWLIST.includes(m.openrouter_id ?? '')) {
      return QUALITY_SIGNAL(m) ?? 0;
    }
    return null;
  },
};

function topByCategory(models: MergedModel[]): Record<Category, string[]> {
  const out = {} as Record<Category, string[]>;
  for (const cat of CATEGORY_VALUES) {
    const metric = PRIMARY_METRIC_BY_CATEGORY[cat];
    const ranked = models
      .filter((m) => m.categories.includes(cat))
      .map((m) => ({ m, score: metric(m) }))
      .filter((x) => x.score != null)
      .sort((a, b) => b.score! - a.score!);
    out[cat] = ranked.slice(0, 3).map((x) => x.m.slug);
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  await mkdir(DATA_DIR, { recursive: true });

  // 1. Load benchmarks.json — hard fail on schema error.
  const benchmarksPath = path.join(DATA_DIR, 'benchmarks.json');
  if (!existsSync(benchmarksPath)) {
    console.error(`✗ Missing ${benchmarksPath}`);
    process.exit(1);
  }
  const benchmarksRaw = JSON.parse(await readFile(benchmarksPath, 'utf8'));
  const benchmarksFile = BenchmarksFileSchema.parse(benchmarksRaw);
  console.log(`✓ benchmarks.json: ${benchmarksFile.models.length} hand-curated models`);

  const benchBySlug = new Map<string, BenchmarkModel>();
  const benchByOpenRouterId = new Map<string, BenchmarkModel>();
  for (const b of benchmarksFile.models) {
    benchBySlug.set(b.slug, b);
    if (b.openrouter_id) benchByOpenRouterId.set(b.openrouter_id, b);
  }

  // 2. Fetch OpenRouter catalog (with cache fallback on failure).
  const { models: orModels, source: orSource } = await fetchOpenRouter();

  // 3. Enrich open-weight candidates from HF.
  const hfBy = await fetchHuggingFaceFor(orModels);

  // 4. Merge.
  const merged: MergedModel[] = [];
  const dropped: { id: string; reason: string }[] = [];
  const now = new Date().toISOString();

  // First pass: every OpenRouter model that has a matching benchmark by openrouter_id
  //   OR is in the OpenRouter catalog at all (we expose them on the leaderboard
  //   even if they have no benchmark scores; benchmarks.json is sparse by design).
  for (const or of orModels) {
    // Try openrouter_id match first; fall back to slug match. OR uses dots
    // ("claude-opus-4.7") while benchmarks.json sometimes uses hyphens
    // ("claude-opus-4-7"). deriveSlug normalizes both to the same form.
    const slug = deriveSlug(undefined, or);
    const b = benchByOpenRouterId.get(or.id) ?? benchBySlug.get(slug);
    const hf = hfBy[or.id] ?? null;
    const pricing = or.pricing ?? {};
    const input_per_million = priceStrToPerMillion(pricing.prompt);
    const output_per_million = priceStrToPerMillion(pricing.completion);
    const has_free_tier =
      b?.pricing?.has_free_tier === true ||
      pricing.prompt === '0' ||
      pricing.completion === '0';

    const draft: Omit<MergedModel, 'categories'> = {
      slug,
      name: b?.name ?? or.name ?? or.id,
      provider: pickProvider(b, or),
      description: or.description ?? null,
      website: b?.website ?? null,
      api_docs: b?.api_docs ?? null,
      openrouter_id: or.id,
      release_date: b?.release_date ?? (or.created ? new Date(or.created * 1000).toISOString().slice(0, 10) : null),
      is_open_weight: isOpenWeight(b, or, hf),
      license: b?.license ?? hf?.license ?? null,
      context_window: b?.context_window ?? or.context_length ?? or.top_provider?.context_length ?? null,
      max_output_tokens: b?.max_output_tokens ?? or.top_provider?.max_completion_tokens ?? null,
      modality: b?.modality && b.modality.length ? b.modality : modalityFrom(or),
      supported_features:
        b?.supported_features && b.supported_features.length
          ? b.supported_features
          : supportedFeaturesFrom(or),
      pricing: {
        input_per_million:
          b?.pricing?.input_per_million ?? input_per_million ?? null,
        output_per_million:
          b?.pricing?.output_per_million ?? output_per_million ?? null,
        currency: b?.pricing?.currency ?? 'USD',
        has_free_tier,
        source: b?.pricing?.source ?? null,
      },
      benchmarks: b?.benchmarks ?? {},
      hf_downloads: hf?.downloads ?? null,
      hf_likes: hf?.likes ?? null,
      last_updated: now,
      last_verified: b?.last_verified ?? null,
    };

    const allInputs = orModels
      .map((x) => priceStrToPerMillion(x.pricing?.prompt))
      .filter((x): x is number => x != null);
    const categories = categorize(draft, allInputs);

    const final = { ...draft, categories };
    const parsed = MergedModelSchema.safeParse(final);
    if (!parsed.success) {
      dropped.push({ id: or.id, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      continue;
    }
    merged.push(parsed.data);
  }

  // Add benchmark-only rows (models in benchmarks.json but missing from OpenRouter
  // — e.g. previews like Claude Mythos Preview that don't have an openrouter_id yet).
  const seenSlugs = new Set(merged.map((m) => m.slug));
  for (const b of benchmarksFile.models) {
    if (seenSlugs.has(b.slug)) continue;
    const draft: Omit<MergedModel, 'categories'> = {
      slug: b.slug,
      name: b.name,
      provider: b.provider,
      description: null,
      website: b.website ?? null,
      api_docs: b.api_docs ?? null,
      openrouter_id: b.openrouter_id ?? null,
      release_date: b.release_date ?? null,
      is_open_weight: b.is_open_weight ?? false,
      license: b.license ?? null,
      context_window: b.context_window ?? null,
      max_output_tokens: b.max_output_tokens ?? null,
      modality: b.modality ?? [],
      supported_features: b.supported_features ?? [],
      pricing: {
        input_per_million: b.pricing?.input_per_million ?? null,
        output_per_million: b.pricing?.output_per_million ?? null,
        currency: b.pricing?.currency ?? 'USD',
        has_free_tier: b.pricing?.has_free_tier ?? false,
        source: b.pricing?.source ?? null,
      },
      benchmarks: b.benchmarks ?? {},
      hf_downloads: null,
      hf_likes: null,
      last_updated: now,
      last_verified: b.last_verified ?? null,
    };
    const categories = categorize(draft, []);
    const parsed = MergedModelSchema.safeParse({ ...draft, categories });
    if (!parsed.success) {
      dropped.push({ id: b.slug, reason: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') });
      continue;
    }
    merged.push(parsed.data);
  }

  // Stable sort: benchmarked rows first (by GPQA desc as a coarse signal), then others.
  merged.sort((a, b) => {
    const sa = a.benchmarks['gpqa_diamond']?.score ?? -1;
    const sb = b.benchmarks['gpqa_diamond']?.score ?? -1;
    if (sb !== sa) return sb - sa;
    return a.slug.localeCompare(b.slug);
  });

  // 5. Top-by-category derivation.
  const top = topByCategory(merged);

  // 6. Write outputs.
  const modelsPath = path.join(DATA_DIR, 'models.json');
  const topPath = path.join(DATA_DIR, 'top-by-category.json');
  await writeFile(
    modelsPath,
    JSON.stringify(
      {
        generated_at: now,
        openrouter_source: orSource,
        count: merged.length,
        models: merged,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
  await writeFile(topPath, JSON.stringify({ generated_at: now, top }, null, 2) + '\n', 'utf8');

  // 7. Summary.
  console.log('');
  console.log('────────────────────────────────────────');
  console.log(`✓ Wrote ${path.relative(process.cwd(), modelsPath)} (${merged.length} models)`);
  console.log(`✓ Wrote ${path.relative(process.cwd(), topPath)}`);
  if (dropped.length) {
    console.warn(`⚠ Dropped ${dropped.length} rows that failed validation:`);
    for (const d of dropped.slice(0, 10)) console.warn(`  - ${d.id}: ${d.reason}`);
    if (dropped.length > 10) console.warn(`  … and ${dropped.length - 10} more`);
  }
  console.log('────────────────────────────────────────');
  console.log('Top by category:');
  for (const cat of CATEGORY_VALUES) {
    console.log(`  ${cat.padEnd(13)} → ${top[cat].join(', ') || '(none)'}`);
  }
}

main().catch((err) => {
  console.error('✗ Fatal:', err);
  process.exit(1);
});

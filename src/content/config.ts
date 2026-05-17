import { defineCollection, reference, z } from 'astro:content';

const pricingModel = z.enum([
  'free',
  'freemium',
  'subscription',
  'one-time',
  'usage-based',
  'enterprise',
]);

const faqItem = z.object({
  question: z.string().min(5),
  answer: z.string().min(10),
});

const tools = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    logo: z.string(),
    website: z.string().url(),
    category: reference('categories'),
    pricing_model: pricingModel,
    starting_price: z.string(),
    free_tier: z.boolean(),
    pros: z.array(z.string()).min(1),
    cons: z.array(z.string()).min(1),
    features: z.array(z.string()),
    use_cases: z.array(z.string()),
    rating: z.number().min(0).max(5),
    last_tested_date: z.coerce.date(),
    our_take: z.string().min(20),
    alternatives: z.array(z.string()).default([]),
    faq: z.array(faqItem).default([]),
    affiliate_link: z.string().url().optional(),
    last_verified: z.coerce.date().optional(),
    verified_status: z
      .enum(['ok', 'broken', 'redirect', 'unchecked'])
      .default('unchecked'),
    featured: z.boolean().default(false),
  }),
});

const reviews = defineCollection({
  type: 'content',
  schema: z.object({
    tool_slug: z.string(),
    headline: z.string(),
    intro: z.string(),
    verdict: z.string(),
    score_breakdown: z.object({
      ease_of_use: z.number().min(0).max(5),
      features: z.number().min(0).max(5),
      value: z.number().min(0).max(5),
      support: z.number().min(0).max(5),
    }),
    author: z.string(),
    publish_date: z.coerce.date(),
    updated_date: z.coerce.date(),
    target_keyword: z.string().optional(),
    og_image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

const comparisons = defineCollection({
  type: 'content',
  schema: z.object({
    tool_a: z.string(),
    tool_b: z.string(),
    headline: z.string(),
    intro: z.string(),
    verdict_a: z.string(),
    verdict_b: z.string(),
    winner: z.enum(['a', 'b', 'tie']).default('tie'),
    target_keyword: z.string().optional(),
    publish_date: z.coerce.date(),
    updated_date: z.coerce.date(),
    auto_generated: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

const categories = defineCollection({
  type: 'data',
  schema: z.object({
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    h1: z.string(),
    intro: z.string(),
    icon: z.string().optional(),
    order: z.number().default(100),
    featured: z.boolean().default(false),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
      })
      .optional(),
  }),
});

const best = defineCollection({
  type: 'content',
  schema: z.object({
    headline: z.string(),
    use_case: z.string(),
    intro: z.string(),
    picks: z
      .array(
        z.object({
          tool_slug: z.string(),
          rank: z.number(),
          best_for: z.string(),
          one_liner: z.string(),
        })
      )
      .min(3),
    target_keyword: z.string().optional(),
    publish_date: z.coerce.date(),
    updated_date: z.coerce.date(),
    author: z.string(),
    draft: z.boolean().default(false),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    author: z.string(),
    publish_date: z.coerce.date(),
    updated_date: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    cover_image: z.string().optional(),
    target_keyword: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  tools,
  reviews,
  comparisons,
  categories,
  best,
  blog,
};

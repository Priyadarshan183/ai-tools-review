import { SITE } from '../config/site.mjs';
import { absUrl } from './format';

type Json = Record<string, unknown>;

export function organizationJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.organization.name,
    legalName: SITE.organization.legalName,
    url: absUrl('/'),
    logo: absUrl(SITE.organization.logoUrl),
    sameAs: SITE.organization.sameAs,
  };
}

export function websiteJsonLd(): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: `${absUrl('/search')}?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function breadcrumbJsonLd(
  items: { name: string; href: string }[]
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absUrl(item.href),
    })),
  };
}

export function articleJsonLd(args: {
  headline: string;
  description: string;
  url: string;
  image?: string;
  datePublished: Date | string;
  dateModified: Date | string;
  authorName: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.headline,
    description: args.description,
    image: args.image ? [args.image] : undefined,
    datePublished: new Date(args.datePublished).toISOString(),
    dateModified: new Date(args.dateModified).toISOString(),
    author: { '@type': 'Person', name: args.authorName },
    publisher: {
      '@type': 'Organization',
      name: SITE.organization.name,
      logo: {
        '@type': 'ImageObject',
        url: absUrl(SITE.organization.logoUrl),
      },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': args.url },
  };
}

export function reviewJsonLd(args: {
  toolName: string;
  toolUrl: string;
  rating: number;
  bestRating?: number;
  reviewBody: string;
  authorName: string;
  datePublished: Date | string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': 'SoftwareApplication',
      name: args.toolName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      url: args.toolUrl,
    },
    reviewRating: {
      '@type': 'Rating',
      ratingValue: args.rating,
      bestRating: args.bestRating ?? 5,
      worstRating: 0,
    },
    author: { '@type': 'Person', name: args.authorName },
    reviewBody: args.reviewBody,
    datePublished: new Date(args.datePublished).toISOString(),
  };
}

export function aggregateRatingJsonLd(args: {
  rating: number;
  count: number;
  toolName: string;
  toolUrl: string;
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: args.toolName,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    url: args.toolUrl,
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: args.rating,
      reviewCount: args.count,
      bestRating: 5,
      worstRating: 0,
    },
  };
}

export function faqJsonLd(
  items: { question: string; answer: string }[]
): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
}

export function itemListJsonLd(args: {
  name: string;
  description: string;
  items: { name: string; url: string }[];
}): Json {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: args.name,
    description: args.description,
    itemListElement: args.items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      url: absUrl(it.url),
    })),
  };
}

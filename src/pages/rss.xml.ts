import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../config/site.mjs';

export async function GET(context: { site?: URL }) {
  const blog = await getCollection('blog', ({ data }) => !data.draft);
  const items = blog
    .sort((a, b) => +b.data.publish_date - +a.data.publish_date)
    .map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.publish_date,
      link: `/blog/${post.slug}/`,
      author: post.data.author,
    }));
  return rss({
    title: `${SITE.name} — Blog`,
    description: SITE.description,
    site: context.site ?? SITE.url,
    items,
    customData: `<language>en-us</language>`,
  });
}

import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import type { APIContext } from 'astro';

export async function GET(context: APIContext) {
  const essays = await getCollection(
    'essays',
    ({ data }) => !data.draft && !data.unlisted
  );

  essays.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'Alfred Birkelund',
    description:
      'Essays on economics, finance, technology, and philosophy — by Alfred Birkelund.',
    site: context.site!,
    items: essays.map((essay) => ({
      title: essay.data.title,
      description: essay.data.subtitle ?? '',
      pubDate: essay.data.date,
      link: `/essays/${essay.slug}/`,
      categories: [essay.data.category],
    })),
    customData: [
      `<language>en</language>`,
      `<managingEditor>alfredbirkelund@gmail.com (Alfred Birkelund)</managingEditor>`,
    ].join(''),
  });
}

import { defineCollection, z } from 'astro:content';

const essays = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    category: z.enum(['economics', 'finance', 'technology', 'philosophy', 'misc']),
    draft: z.boolean().default(false),
    favorite: z.boolean().default(false),
  }),
});

export const collections = { essays };

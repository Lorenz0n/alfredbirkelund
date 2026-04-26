import { defineCollection, z } from 'astro:content';

const essays = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    date: z.coerce.date(),
    category: z.enum(['economics', 'finance', 'technology', 'philosophy', 'history', 'misc']),
    draft: z.boolean().default(false),
    favorite: z.boolean().default(false),

    // Series — group several essays together with a left sidebar.
    // Set the same `series` slug on every part; `part` orders them.
    series: z.string().optional(),
    seriesTitle: z.string().optional(),
    part: z.number().optional(),
    partTitle: z.string().optional(),

    // Single-essay table of contents — auto-generated from H2/H3 headings.
    toc: z.boolean().default(false),

    // Hide from archive + home listings, but keep the URL reachable.
    // Used for inner parts of a series whose entry-point should be the only
    // thing the reader sees in the archive.
    unlisted: z.boolean().default(false),
  }),
});

export const collections = { essays };

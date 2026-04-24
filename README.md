# alfredbirkelund.com

Personal site and essay archive for Alfred Birkelund. Static, text-forward,
Joe-Carlsmith-inspired.

## What this site is for

This is the canonical place about me on the internet. It's intentionally
low-key and slow-updating — essays when I have something to say, CV when
something actually changes. It's deliberately not a LinkedIn clone or a
marketing site; simplicity is a feature, not a bug.

- **Essays** — long-form writing I'd stand behind.
- **CV** — the always-current version of what I'm doing and where I've been.
  Printable to PDF from the page itself.
- **About** — a short bio anchor on the homepage.

LinkedIn (if used) is a thin profile pointing back here.

Fonts are self-hosted (EB Garamond + Inter via `@fontsource`) rather than loaded
from Google Fonts, so visiting the site doesn't send visitor IPs to Google. The
`/colophon` page spells this out publicly — that's where the privacy
disclosure lives. No cookies, no analytics, no tracking means no cookie banner
is required under GDPR.

## Stack

- **[Astro 4](https://astro.build)** — static output, zero JS by default
- **[MDX](https://mdxjs.com)** via `@astrojs/mdx` — prose with component escape hatches
- **Astro content collections** — typed frontmatter via a Zod schema
- **[`astro check`](https://docs.astro.build/en/guides/integrations-guide/check/)** — typecheck step wired into `npm run build`
- **Vanilla CSS** — custom properties for design tokens, no framework
- **EB Garamond** (body/headings) and **Inter** (UI/meta), self-hosted via [`@fontsource`](https://fontsource.org) (no third-party font requests)
- Deployed to **[GitHub Pages](https://pages.github.com)** (static) — see [`HOSTING.md`](HOSTING.md) for the full setup

## Dev commands

```bash
npm install        # install dependencies
npm run dev        # local dev server at http://localhost:4321
npm run build      # astro check + static build to ./dist
npm run preview    # serve the built site locally
npm run check      # just the type/content check
```

## Writing a new essay

Essays live in `src/content/essays/` as `.mdx` files. The filename (minus
`.mdx`) becomes the URL slug — so `src/content/essays/rate-cuts.mdx` is served
at `/essays/rate-cuts/`.

Every essay starts with typed frontmatter. Minimal example:

```mdx
---
title: "The case against predicting rate cuts"
subtitle: "Forecasters keep doing this, and keep being wrong."
date: 2026-06-14
category: economics
favorite: false
draft: false
---

Your prose starts here. MDX lets you mix **Markdown** and components.
```

Frontmatter fields:

| field      | type                                                                      | default | notes                                                     |
| ---------- | ------------------------------------------------------------------------- | ------- | --------------------------------------------------------- |
| `title`    | string                                                                    | —       | required                                                  |
| `subtitle` | string                                                                    | —       | optional, shown in italics                                |
| `date`     | date (ISO `YYYY-MM-DD` or any string Zod can coerce)                      | —       | required                                                  |
| `category` | `economics` \| `finance` \| `technology` \| `philosophy` \| `misc`         | —       | required; see "Adding a category" below                   |
| `draft`    | boolean                                                                   | `false` | `true` hides the essay from all builds and list pages     |
| `favorite` | boolean                                                                   | `false` | `true` surfaces the essay in the home "Favorites" section |

Validation runs during `astro check` and `astro build` — a bad frontmatter field
fails the build loudly.

## Updating the CV

All CV content — bio line, education, work, and appearances — lives in a single
typed file: `src/data/cv.ts`. Edit that file, save, and the `/cv` page
re-renders. No layout to touch, no prose to rewrite.

### Profile (the top of the CV)

```ts
export const profile: Profile = {
  name: 'Alfred Birkelund',
  tagline: 'Economics student and founder of Conviction.',
  location: 'Nakskov & Odense, Denmark',
  email: 'alfred@alfredbirkelund.com',
  site: 'alfredbirkelund.com',
  connections: [
    { label: 'LinkedIn', url: 'https://www.linkedin.com/in/alfredbirkelund' },
    { label: 'GitHub', url: 'https://github.com/alfredbirkelund' },
  ],
};
```

`connections` is a free-form list of `{ label, url }` pairs. It's rendered in
two places: the CV contact line and the site footer — so adding, removing, or
reordering here updates both. Add Twitter / Bluesky / Scholar / ORCID / etc.
the same way. Set `connections: []` to hide them entirely.

### Adding a work / project entry

Append to the `work` array in `src/data/cv.ts`. Order is shown as-written —
put the newest on top.

```ts
{
  role: 'Founder',
  organization: 'Conviction',
  url: 'https://convictioninvestor.com',      // optional; turns the name into a link
  location: 'Remote',                          // optional
  dates: '2024–present',                       // free-text, e.g. "2024", "2024–2025"
  description:
    'Investment research platform synthesizing insider transactions, institutional filings, ...',
}
```

### Adding an education entry

Same pattern, `education` array. `dates` is free-text so you can write
`"2023–2026 (expected)"`, `"Applying for 2027 intake"`, etc. without fighting
date types.

```ts
{
  degree: 'BSc in Economics',
  institution: 'University of Southern Denmark (SDU)',
  location: 'Odense, Denmark',
  dates: '2023–2026 (expected)',
  note: 'Focus on econometrics, financial economics, and quantitative methods.',
}
```

### Printing the CV to PDF

The "Download as PDF" button on `/cv` calls the browser's print dialog. There's
a dedicated `@media print` block in `global.css` that:

- hides the site header, footer, and the download button itself;
- drops to 10.5pt body / 20pt title, with page-break rules on sections and
  entries so things don't split awkwardly;
- flattens links to black (readable on paper).

To produce the PDF: open `/cv`, hit the button (or ⌘/Ctrl-P), choose **Save as
PDF** as the destination, default margins, background graphics **off**. The
file `alfredbirkelund-cv.pdf` is a reasonable name. Do this whenever the CV
changes materially — otherwise don't bother.

## Adding a new category

Categories are a closed set — adding one is a two-file change:

1. **`src/content/config.ts`** — add the new string to the `z.enum([...])` list
   on `category`.
2. **`src/pages/index.astro`** — add the new category to the `categories`
   array (key + display label). The homepage section renders only if that
   category has at least one non-draft essay, so no further gating is needed.

The archive page and essay layout read `category` directly from frontmatter, so
they pick up the new value automatically.

## Design tokens

All colors, sizes, and layout widths live as CSS custom properties at the top
of `src/styles/global.css`. If you're tweaking the look, start there.

```css
/* color */
--color-bg: #f3ebda;              /* warm ivory / bone, slightly brown */
--color-surface: #e8dfc8;         /* deeper than bg — code blocks, button hover */
--color-ink: #1a1a1a;             /* near-black body ink */
--color-accent: #5b4a2c;          /* warm brown — internal links */
--color-accent-hover: #3f3319;
--color-external: #3d5a3a;        /* dark forest green — external links */
--color-external-hover: #253a24;
--color-muted: #7a7266;            /* meta, dates, captions */
--color-rule: #d6cdb6;             /* hairline dividers */

/* typography */
--font-serif: 'EB Garamond', ...;
--font-sans:  'Inter', ...;

/* type scale */
--size-meta: 13px;   /* dates, category tags */
--size-nav:  15px;   /* nav, section links */
--size-body: 19px;   /* body copy */
--size-lead: 22px;   /* lead paragraph, essay subtitle */
--size-section: 28px;/* section headings */
--size-title: 36px;  /* essay h1 */

/* layout */
--width-reading: 680px;  /* default reading column */
--width-wide:    920px;  /* wider shell (header/archive) */
```

Body copy drops to 18px and page padding tightens to 1.25rem under 640px — see
the `@media (max-width: 640px)` block at the bottom of `global.css`.

### Link conventions

Internal vs. external links are color-coded automatically by URL shape — you
never hand-label a link.

| Link kind                              | Color                          | Selector               |
| -------------------------------------- | ------------------------------ | ---------------------- |
| Internal (`/…`, `#anchor`)             | warm brown (`--color-accent`)  | default `a`            |
| `mailto:…`                             | warm brown (treated as internal) | default `a`          |
| External (`http://…`, `https://…`)     | dark green (`--color-external`) | `a[href^="http"]`     |

Two rules of thumb when writing essays or editing data:

- Prefer **root-relative** URLs for anything on this site (`/archive`,
  `/essays/hello-world/`). This keeps them colored as internal and avoids
  hard-coding the domain.
- Full `https://…` URLs are assumed to leave the site and will render green.
  This is intentional — it signals "this will open something elsewhere."

If you ever need to *force* a link into one bucket (e.g. an internal redirect
that starts with `https://` for some reason), add `color: var(--color-accent)`
inline. Don't expect to need this.

## Deployment

The site is deployed to **GitHub Pages** via the workflow in
`.github/workflows/deploy.yml`. Every push to `main` rebuilds and publishes.

For the full operator's manual — DNS wiring in Cloudflare, enabling Pages on
a private repo, rolling back, debugging failed deploys — see
[`HOSTING.md`](HOSTING.md).

> **Note:** `@astrojs/sitemap` is intentionally not installed — it has a
> current compatibility issue with this build. Add it back once that's
> resolved upstream.

## Project layout

```
src/
├── components/         Header, Footer, EssayCard
├── content/
│   ├── config.ts       essay collection schema (Zod)
│   └── essays/         *.mdx — one file per essay
├── data/
│   ├── cv.ts           profile + education + work (typed)
│   └── appearances.ts  typed talks/podcasts/interviews/bylines (scaffolding; not rendered yet)
├── layouts/
│   ├── BaseLayout      site shell (head, header, footer)
│   └── EssayLayout     single-essay reading template
├── pages/
│   ├── index.astro     homepage
│   ├── archive.astro   full archive by year
│   ├── cv.astro        CV (renders from src/data/cv.ts; print-to-PDF enabled)
│   ├── colophon.astro  colophon / privacy page linked from the footer
│   └── essays/[slug].astro   dynamic essay route
└── styles/
    └── global.css      tokens + all styles (incl. @media print)
public/
└── favicon.svg
```

## Not in v1 (deliberately)

Category index pages, RSS, email subscribe, dark mode, search, and OG image
generation are all explicitly out of scope for v1. They'll get added as real
demand for them appears.

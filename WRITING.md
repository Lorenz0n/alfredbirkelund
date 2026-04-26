# Writing essays — formatting reference

The single source of truth for how to write `.mdx` files in this repo. If you
forget how something works, look here. Two living examples sit alongside this
doc:

- `src/content/essays/test-headings.mdx` — every formatting feature in one
  single-page essay.
- `src/content/essays/test-series/` — a multi-part series, **listed style**:
  every part has its own archive entry.
- `src/content/essays/test-series-2/` — a multi-part series, **single-entry
  style** (Leopold's pattern): only the overview shows up in the archive;
  inner parts are reached by clicking through.

You can copy patterns from those files directly. They are kept published so
that pasting from raw markdown is never necessary.

---

## 1. Frontmatter

Every essay starts with a YAML frontmatter block. Required fields are marked.

```mdx
---
title: "The case against predicting rate cuts"     # required
subtitle: "Forecasters keep doing this."           # optional, italic under title
date: 2026-06-14                                   # required, YYYY-MM-DD
category: economics                                # required: economics | finance | technology | philosophy | history | misc
draft: false                                       # default false; true hides from site entirely
unlisted: false                                    # default false; true keeps the URL but hides from archive + home
favorite: false                                    # default false; true → home "Favorites"

# Optional features
toc: true                                          # auto table-of-contents from H2/H3
series: "ai-deflation"                             # group with other parts (slug, must match)
seriesTitle: "AI & Deflation"                      # shown above sidebar list
part: 1                                            # ordering within series
partTitle: "I. The Mechanism"                      # short label in sidebar
---
```

Schema is enforced in `src/content/config.ts`. `npm run build` will fail
loudly if a field is missing or wrong.

---

## 2. Prose basics

| What you want | Markdown |
| ------------- | -------- |
| Bold | `**bold**` |
| Italic | `*italic*` |
| Bold italic | `***both***` |
| Inline code | `` `code` `` |
| Inline link | `[text](https://example.com)` |
| Heading (chapter) | `## Heading` |
| Sub-heading | `### Sub-heading` |
| Sub-sub-heading (rare) | `#### Sub-sub-heading` |
| Block quote | `> A quoted passage.` |
| Horizontal rule | `---` on its own line |
| Ordered list | `1. item` |
| Unordered list | `- item` |

### Emphasis — house style

- **Bold** for emphasis on a *word or short phrase*. Use sparingly. If half
  the page is bold, none of it is emphatic.
- *Italic* for titles of works (books, papers, films), foreign words, and
  technical terms on first introduction.
- Avoid underline; on the web underline reads as a link.

### Drop cap

The first paragraph of an essay can open with a drop cap. Wrap the first
letter in a `span` with class `dropcap`:

```mdx
<span class="dropcap">T</span>his is the first paragraph...
```

Don't use it on every section — once per essay, at the very top.

---

## 3. Links

Links are coloured automatically based on whether they leave the site:

- **Internal** (`/archive`, `#anchor`, `mailto:...`) → warm brown.
- **External** (`http://`, `https://`) → dark forest green.

You don't add classes for this — the rule lives in `src/styles/global.css`
and applies everywhere. Just write `[text](url)` and it picks the right colour.

---

## 4. Footnotes (the way to cite sources)

Use markdown footnotes. They render as a numbered list at the bottom of the
essay with back-arrows to the call site.

In the prose:

```mdx
The claim is contested[^1] but several researchers have made it.[^warsh]
```

At the bottom of the file (any order, any labels):

```mdx
[^1]: Smith, J. (2024). *The Title of the Paper*. Journal of Economics 12(3).

[^warsh]: Kevin Warsh, [Forbes interview](https://www.forbes.com/...), 2026.
```

Labels can be numeric (`[^1]`) or named (`[^warsh]`); the rendered output is
always renumbered sequentially in the order they appear in the prose.

**Use footnotes, not a "Sources" list at the bottom.** They keep the source
attached to the claim, which is the whole point of citing.

---

## 5. Images and figures

### Where to put image files

Each essay gets its own folder under `public/essays/<slug>/`:

```
public/
└── essays/
    ├── test-headings/
    │   └── figure-1.svg
    └── test-series/
        └── timeline.svg
```

Anything in `public/` is copied verbatim into the build at the same path. So
`public/essays/foo/bar.png` is reachable at `/essays/foo/bar.png`.

Acceptable formats: `.svg` (preferred for diagrams — sharp at every zoom),
`.png`, `.jpg`, `.webp`. Keep raster images under ~400 KB; resize before
committing.

### How to embed an image

Import `Figure` once at the top of the `.mdx` file (after frontmatter):

```mdx
import Figure from '~/components/Figure.astro';
```

Then in the prose:

```mdx
<Figure
  src="/essays/my-essay/figure-1.svg"
  alt="A short description for screen readers"
  caption="Figure 1. Caption appears in sans-serif under the image."
/>
```

For a wider image that breaks out of the text column, add `wide`:

```mdx
<Figure src="..." alt="..." caption="..." wide />
```

`alt` is required and read aloud by screen readers — it should describe the
image. `caption` is optional and shown to everyone.

### Plain inline image (no caption, rare)

```mdx
![alt text](/essays/my-essay/foo.png)
```

Prefer `<Figure>` — it gives you a caption and consistent styling.

---

## 6. Pullquotes

For a sentence that deserves to breathe:

```mdx
import Pullquote from '~/components/Pullquote.astro';

<Pullquote cite="Optional attribution">
The most important sentence in the paragraph.
</Pullquote>
```

Drop the `cite` attribute if there is no attribution. Use sparingly —
ideally once per essay. A page studded with pullquotes is just a page that
hasn't decided what its emphasis is.

---

## 7. Collapsible explainers (the Leopold-style drop-down)

When a passage is a digression — context the engaged reader wants and the
casual reader will skip — wrap it in `<Detail>`. It renders as a click-to-
expand box with a `+` / `−` toggle.

```mdx
import Detail from '~/components/Detail.astro';

<Detail summary="Why is this called Baumol's cost disease?">
The economist William Baumol observed in 1966 that...

You can have multiple paragraphs inside.
</Detail>
```

`summary` is the line shown when collapsed. It should be a question or a
short label, not a full sentence — readers scan it quickly.

Inside the body you can use any markdown: bold, italic, links, even other
components. Avoid nesting one `<Detail>` inside another.

---

## 8. Headings as chapters (single-page essay)

For an essay long enough to benefit from internal navigation but short
enough to stay on one page, use `##` to mark chapter breaks and turn on the
TOC sidebar:

```yaml
toc: true
```

The sidebar is generated from H2 and H3 headings automatically. Anchors are
slugged from the heading text; clicking a TOC entry jumps to it.

Use H2 (`##`) for top-level sections, H3 (`###`) for subsections, and H4
(`####`) only for the rare case where a subsection itself has internal
divisions. **H4 headings do not appear in the TOC** — by design. The
sidebar would otherwise become noise. If you find yourself reaching for H4
often, the section probably wants to become its own essay or its own series
part.

Don't skip levels (`##` → `####` is bad — no `###` in between).

---

## 9. Series (multi-page essay)

For an essay long enough that splitting it into several pages helps the
reader, use a series. Each part is its own `.mdx` file in a shared folder.

### Folder layout

```
src/content/essays/
└── ai-deflation/                     # the folder name = the series slug
    ├── 00-overview.mdx               # part: 0 — the landing page
    ├── 01-the-mechanism.mdx          # part: 1
    ├── 02-implications.mdx           # part: 2
    └── 03-conclusion.mdx             # part: 3
```

URLs follow the folder: `/essays/ai-deflation/01-the-mechanism/`.

### Frontmatter on every part

```yaml
series: "ai-deflation"          # same string on every part — must match
seriesTitle: "AI & Deflation"   # human label shown above the sidebar
part: 1                         # integer; orders the sidebar
partTitle: "I. The Mechanism"   # short label shown in the sidebar
```

`series`, `part`, and `partTitle` are required on every part. `seriesTitle`
only needs to be set on one part — usually the overview — but setting it
on all of them is harmless and clearer.

### What the layout adds automatically

- **Left sidebar** with every part listed in `part` order, current page
  highlighted.
- **Pager at the bottom** with previous/next links to adjacent parts.
- **Sequential URLs** — a reader can bookmark or share any part directly.

### Adding a new part later

Drop a new `.mdx` file in the same folder, set `part: <next number>`, and
both the sidebar and pager pick it up on the next build.

### Two series styles: listed vs. single-entry

There are two ways a series can show up in the archive. Pick based on how
the parts read.

**Listed (default).** Every part has its own archive entry. Use when each
part stands alone enough that a reader might link directly to one — e.g.
"Part III on inflation" makes sense as a standalone read. See
`src/content/essays/test-series/`.

**Single-entry (Leopold's pattern).** Only the overview shows up in the
archive; inner parts are reached by clicking through. Use when the parts
are chapters of one continuous argument and reading them out of order would
be jarring. See `src/content/essays/test-series-2/`.

To make a series single-entry, add `unlisted: true` to the frontmatter of
every inner part. The overview stays listed (no `unlisted` flag).

```yaml
# 00-overview.mdx — appears in archive
series: "ai-deflation"
seriesTitle: "AI & Deflation"
part: 0
partTitle: "Overview"

# 01-the-mechanism.mdx — does NOT appear in archive
series: "ai-deflation"
seriesTitle: "AI & Deflation"
part: 1
partTitle: "I. The Mechanism"
unlisted: true                  # ← the only difference
```

The unlisted parts still get URLs, still appear in the series sidebar and
pager, and can be linked to or bookmarked directly. They're just not
discoverable from the archive listing.

> `draft: true` and `unlisted: true` are different. `draft` excludes the file
> from the build entirely (no URL). `unlisted` builds the URL but hides the
> entry from listing pages.

---

## 10. When to choose what

| Situation | Choose |
| --------- | ------ |
| < 1500 words, single argument | Plain essay (no `toc`, no `series`) |
| 1500–4000 words, several sections | Single page + `toc: true` |
| > 4000 words, parts that stand alone | Series, listed style |
| > 4000 words, parts that read in sequence | Series, single-entry style (`unlisted: true` on inner parts) |
| One side-point you want optional | `<Detail>` |
| One sentence that should breathe | `<Pullquote>` |
| A chart or photo | `<Figure>` |
| A source citation | Footnote `[^1]` |

When in doubt, write it as a plain essay first. Add structure only when the
unstructured version is harder to read.

---

## 11. Open Graph share image

The site ships with `public/og-image.png` (1200×630), generated from
`public/og-image.svg`. Every page references the PNG in
`<meta property="og:image">` and `<meta name="twitter:image">` so links
shared on Twitter, Facebook, LinkedIn, Slack, Discord, etc. all show the
card. PNG is used because Facebook and LinkedIn do not accept SVG.

### Editing the share image

1. Edit `public/og-image.svg` (the source).
2. Re-render the PNG: `npm run build:og`. This runs
   `scripts/build-og-image.mjs` and writes a fresh `public/og-image.png`.
3. Commit both files.

The render uses `@resvg/resvg-js` (a small, fast, native SVG rasterizer —
no Chrome download). Installed as a devDependency, only used at edit time.

### Per-page override

To give a specific page a custom share image (e.g. a high-traffic essay
deserving its own card), pass `ogImage` as a layout prop:

```astro
<BaseLayout title="..." ogImage="/essays/my-essay/og.png">
```

---

## 12. Previewing

Always preview before pushing:

```bash
npm run dev
```

Visit `http://localhost:4321/essays/<slug>/`. Live reload picks up every
save. To run the full build (catches schema errors, broken imports, type
mistakes):

```bash
npm run build
```

If the build passes locally, it'll pass in CI.

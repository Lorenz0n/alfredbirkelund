// Build the HTML body for a per-essay newsletter email.
//
// Reads the source MDX, strips frontmatter + imports, inlines our MDX
// components (Figure, Detail, Pullquote, dropcap span) as email-safe HTML,
// runs the markdown through `marked`, and post-processes the output so
// every tag that matters has inline styles. Email clients ignore external
// CSS, so style-by-attribute is the only reliable way.
//
// Used by both scripts/send-new-broadcasts.mjs (real broadcasts) and
// scripts/preview-broadcast.mjs (single-recipient previews).

import fs from 'node:fs';
import path from 'node:path';
import { marked } from 'marked';

// Site palette — must match src/styles/global.css design tokens.
const C = {
  bg: '#f3ebda',
  surface: '#e8dfc8',
  ink: '#1a1a1a',
  accent: '#5b4a2c',
  external: '#3d5a3a',
  muted: '#7a7266',
  rule: '#d6cdb6',
};

// Same fonts the site uses, loaded from Google Fonts via <style> @import.
// Modern email clients (Apple Mail, Gmail web/mobile, Outlook 365 web/mobile)
// render the webfonts; Outlook desktop on Windows falls back to Georgia /
// Helvetica via the rest of the stack.
const FONT_SERIF = `'EB Garamond',Georgia,'Iowan Old Style','Palatino Linotype',serif`;
const FONT_SANS = `'Inter',Helvetica,Arial,sans-serif`;
const FONT_IMPORT_URL = `https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Inter:wght@400;500&display=swap`;

const STYLES_BY_TAG = {
  h1: `font-family:${FONT_SERIF};font-size:32px;font-weight:500;line-height:1.2;margin:1em 0 0.4em;color:${C.ink};`,
  h2: `font-family:${FONT_SERIF};font-size:24px;font-weight:500;line-height:1.25;margin:1.6em 0 0.5em;color:${C.ink};`,
  h3: `font-family:${FONT_SERIF};font-size:20px;font-weight:500;line-height:1.3;margin:1.4em 0 0.4em;color:${C.ink};`,
  h4: `font-family:${FONT_SERIF};font-size:17px;font-weight:500;font-style:italic;line-height:1.3;margin:1.2em 0 0.3em;color:${C.ink};`,
  p: `margin:0 0 1.2em;line-height:1.65;`,
  ul: `padding-left:1.4em;margin:0 0 1.2em;line-height:1.65;`,
  ol: `padding-left:1.4em;margin:0 0 1.2em;line-height:1.65;`,
  li: `margin-bottom:0.3em;`,
  hr: `border:0;border-top:1px solid ${C.rule};margin:2.5em 0;`,
  blockquote: `border-left:2px solid ${C.accent};margin:1.5em 0;padding:0.5em 0 0.5em 1.25em;font-style:italic;color:${C.ink};`,
  pre: `background:${C.surface};padding:1rem 1.25rem;border-radius:4px;font-family:'SF Mono',Menlo,monospace;font-size:13px;line-height:1.5;margin:1.5em 0;overflow-x:auto;`,
  code: `font-family:'SF Mono',Menlo,monospace;font-size:0.9em;background:${C.surface};padding:0.1em 0.35em;border-radius:3px;`,
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function absUrl(href, siteUrl) {
  if (!href) return href;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith('mailto:') || href.startsWith('#')) return href;
  if (href.startsWith('/')) return siteUrl + href;
  return href;
}

function extractAttrs(s) {
  const attrs = {};
  for (const m of s.matchAll(/(\w+)\s*=\s*"([^"]*)"/g)) {
    attrs[m[1]] = m[2];
  }
  // Boolean (no =) attributes like `wide`
  const boolMatches = s.replace(/\w+\s*=\s*"[^"]*"/g, '').matchAll(/(?:^|\s)(\w+)/g);
  for (const m of boolMatches) {
    if (!(m[1] in attrs)) attrs[m[1]] = true;
  }
  return attrs;
}

// Replace our MDX components with email-safe HTML BEFORE running through
// marked. Keep markdown structure intact so marked still parses paragraphs,
// headings, etc. around the inlined HTML.
function transformMdxComponents(mdx, siteUrl) {
  // Strip top-of-file imports.
  mdx = mdx.replace(/^import\s+.+$/gm, '');

  // <Figure src="..." alt="..." caption="..." [wide] />
  mdx = mdx.replace(/<Figure\b([^>]*?)\/>/g, (_, attrs) => {
    const a = extractAttrs(attrs);
    const src = absUrl(a.src || '', siteUrl);
    const alt = escapeHtml(a.alt || '');
    const caption = a.caption ? escapeHtml(a.caption) : '';
    return `\n\n<figure style="margin:2em 0;text-align:center;">
<img src="${src}" alt="${alt}" style="max-width:100%;height:auto;border:1px solid ${C.rule};border-radius:3px;display:block;margin:0 auto;" />
${caption ? `<figcaption style="margin-top:0.6em;font-family:${FONT_SANS};font-size:13px;line-height:1.5;color:${C.muted};">${caption}</figcaption>` : ''}
</figure>\n\n`;
  });

  // <Detail summary="X">...</Detail> — flatten (no collapsibles in email)
  mdx = mdx.replace(/<Detail\s+([^>]*?)>([\s\S]*?)<\/Detail>/g, (_, attrs, body) => {
    const a = extractAttrs(attrs);
    const summary = escapeHtml(a.summary || '');
    return `\n\n<aside style="border:1px solid ${C.rule};border-radius:4px;padding:1em 1.25em;margin:1.5em 0;background:${C.surface};">
${summary ? `<p style="font-family:${FONT_SANS};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};font-weight:500;margin:0 0 0.6em;">${summary}</p>` : ''}
${body.trim()}
</aside>\n\n`;
  });

  // <Pullquote [cite="X"]>...</Pullquote>
  mdx = mdx.replace(/<Pullquote(?:\s+([^>]*?))?>([\s\S]*?)<\/Pullquote>/g, (_, attrs, body) => {
    const a = attrs ? extractAttrs(attrs) : {};
    const cite = a.cite ? escapeHtml(a.cite) : '';
    return `\n\n<blockquote style="border-left:3px solid ${C.accent};margin:2em 0;padding:0.5em 0 0.5em 1.25em;font-style:italic;font-size:20px;line-height:1.4;color:${C.ink};">
${body.trim()}
${cite ? `<cite style="display:block;margin-top:0.6em;font-style:normal;font-family:${FONT_SANS};font-size:13px;color:${C.muted};">— ${cite}</cite>` : ''}
</blockquote>\n\n`;
  });

  // <span class="dropcap">X</span> — subtle bigger first letter (no float;
  // float is unreliable across Outlook/Gmail clients).
  mdx = mdx.replace(/<span\s+class="dropcap">([^<]+)<\/span>/g,
    (_, letter) => `<span style="font-size:1.6em;line-height:1;font-weight:500;">${escapeHtml(letter)}</span>`,
  );

  return mdx;
}

// Add inline styles to common tags. Skips tags that already carry a `style=`
// (i.e. ones our component transforms produced — they're already styled).
function inlineStyles(html, siteUrl) {
  // Generic tags from STYLES_BY_TAG.
  for (const [tag, style] of Object.entries(STYLES_BY_TAG)) {
    const re = new RegExp(`<${tag}\\b([^>]*?)>`, 'gi');
    html = html.replace(re, (m, attrs) => {
      if (/\sstyle\s*=/.test(attrs)) return m;
      return `<${tag}${attrs} style="${style}">`;
    });
  }

  // Links: pick colour by internal/external; rewrite paths to absolute.
  html = html.replace(/<a\b([^>]*?)href="([^"]*)"([^>]*?)>/g, (m, before, href, after) => {
    if (/\sstyle\s*=/.test(before + after)) return m;
    const abs = absUrl(href, siteUrl);
    const isExternal = /^https?:\/\//.test(abs) && !abs.startsWith(siteUrl);
    const color = isExternal ? C.external : C.accent;
    return `<a${before}href="${abs}"${after} style="color:${color};text-decoration:underline;">`;
  });

  // Images: rewrite src to absolute, add inline display + sizing.
  html = html.replace(/<img\b([^>]*?)src="([^"]*)"([^>]*?)>/g, (m, before, src, after) => {
    if (/\sstyle\s*=/.test(before + after)) return m;
    const abs = absUrl(src, siteUrl);
    return `<img${before}src="${abs}"${after} style="max-width:100%;height:auto;display:block;margin:1.5em auto;border:1px solid ${C.rule};border-radius:3px;">`;
  });

  // <strong>, <em> — leave alone (browsers + email clients render these
  // sensibly; styling them would just add noise).

  return html;
}

export function buildEssayEmail({ slug, title, subtitle, link, date, category, siteUrl }) {
  const mdxPath = path.resolve(`src/content/essays/${slug}.mdx`);
  if (!fs.existsSync(mdxPath)) {
    throw new Error(`Source MDX not found at ${mdxPath} (slug: ${slug})`);
  }
  const raw = fs.readFileSync(mdxPath, 'utf8');

  // Strip leading frontmatter block.
  const fm = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  let body = fm ? raw.slice(fm[0].length) : raw;

  body = transformMdxComponents(body, siteUrl);

  // Render markdown → HTML.
  const rendered = marked.parse(body, { gfm: true, breaks: false });

  // Add inline styles to the rendered HTML.
  const styled = inlineStyles(rendered, siteUrl);

  // Format date.
  const formatted = new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const titleH = escapeHtml(title);
  const subtitleH = subtitle ? escapeHtml(subtitle) : '';
  const categoryH = category ? escapeHtml(category) : '';
  const siteHost = siteUrl.replace(/^https?:\/\//, '');
  const linkAbs = link.startsWith('http') ? link : siteUrl + link;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${titleH}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    @import url('${FONT_IMPORT_URL}');
  </style>
</head>
<body style="margin:0;padding:32px 16px;background:${C.bg};font-family:${FONT_SERIF};color:${C.ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;">
          <tr>
            <td>
              <p style="font-family:${FONT_SANS};font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:${C.muted};font-weight:500;margin:0 0 12px;">
                ${categoryH ? categoryH + ' · ' : ''}${formatted}
              </p>
              <h1 style="font-family:${FONT_SERIF};font-size:32px;font-weight:500;line-height:1.15;margin:0 0 12px;color:${C.ink};">
                <a href="${linkAbs}" style="color:${C.ink};text-decoration:none;">${titleH}</a>
              </h1>
              ${subtitleH ? `<p style="font-style:italic;font-size:18px;color:${C.muted};line-height:1.4;margin:0 0 24px;">${subtitleH}</p>` : ''}
              <p style="font-family:${FONT_SERIF};font-size:15px;margin:0 0 32px;">
                <a href="${linkAbs}" style="color:${C.accent};text-decoration:underline;">Read this on the site →</a>
                <span style="color:${C.muted};font-style:italic;"> for a better reading experience.</span>
              </p>
              <hr style="border:0;border-top:1px solid ${C.rule};margin:0 0 32px;" />
              <div style="font-size:17px;line-height:1.65;color:${C.ink};">
${styled}
              </div>
              <hr style="border:0;border-top:1px solid ${C.rule};margin:48px 0 24px;" />
              <p style="font-family:${FONT_SANS};font-size:13px;color:${C.muted};margin:0;line-height:1.5;">
                You're getting this because you subscribed at
                <a href="${siteUrl}" style="color:${C.muted};">${siteHost}</a>.
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${C.muted};">Unsubscribe</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

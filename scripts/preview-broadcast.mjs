// Send a one-off preview of what the broadcast for an essay would look like,
// to a single email address you specify. Doesn't touch the Resend audience
// and doesn't update scripts/last-broadcast.json — pure preview.
//
// Reads the essay's frontmatter directly from src/content/essays/<slug>.mdx,
// so it works for unlisted essays too (which aren't in the RSS feed).
//
// Required env:
//   RESEND_API_KEY  — server-side API key
//   RESEND_FROM     — e.g. 'Alfred Birkelund <newsletter@alfredbirkelund.com>'
//   SITE_URL        — optional; defaults to https://alfredbirkelund.com
//
// Usage:
//   npm run build
//   RESEND_API_KEY=re_xxx RESEND_FROM='Alfred <newsletter@alfredbirkelund.com>' \
//     node scripts/preview-broadcast.mjs <slug> <to-email>
//
// Examples:
//   ... preview-broadcast.mjs hello-world you@example.com
//   ... preview-broadcast.mjs test-headings you@example.com
//   ... preview-broadcast.mjs test-series/00-overview you@example.com

import fs from 'node:fs';
import path from 'node:path';
import { buildEssayEmail } from './lib/build-essay-email.mjs';

const [, , slug, toEmail] = process.argv;
if (!slug || !toEmail) {
  console.error('Usage: node scripts/preview-broadcast.mjs <slug> <to-email>');
  console.error('Example: node scripts/preview-broadcast.mjs test-headings you@example.com');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;
const siteUrl = process.env.SITE_URL ?? 'https://alfredbirkelund.com';
if (!apiKey || !from) {
  console.error('Set RESEND_API_KEY and RESEND_FROM in env.');
  process.exit(1);
}

const mdxPath = path.resolve(`src/content/essays/${slug}.mdx`);
if (!fs.existsSync(mdxPath)) {
  console.error(`Essay not found: ${mdxPath}`);
  process.exit(1);
}

function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const km = line.match(/^(\w+):\s*(.*)$/);
    if (!km) continue;
    let val = km[2].trim();
    val = val.replace(/^["'](.*)["']$/, '$1');
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    fm[km[1]] = val;
  }
  return fm;
}

const raw = fs.readFileSync(mdxPath, 'utf8');
const fm = parseFrontmatter(raw);
if (!fm.title || !fm.date) {
  console.error(`Frontmatter missing required fields (title, date) in ${mdxPath}`);
  process.exit(1);
}

const html = buildEssayEmail({
  slug,
  title: fm.title,
  subtitle: fm.subtitle ?? '',
  link: `${siteUrl}/essays/${slug}/`,
  date: fm.date,
  category: fm.category ?? '',
  siteUrl,
});

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to: [toEmail],
    subject: `[PREVIEW] ${fm.title}`,
    html,
  }),
});

if (!res.ok) {
  console.error(`Send failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}

const result = await res.json();
console.log(`Preview sent to ${toEmail}.`);
console.log(`Resend message ID: ${result.id}`);
console.log('Check your inbox (and spam folder if it doesn’t arrive in a minute).');

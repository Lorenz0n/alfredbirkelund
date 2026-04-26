// Send a one-off preview of what the broadcast for an essay would look like,
// to a single email address you specify. Doesn't touch the Resend audience
// and doesn't update scripts/last-broadcast.json — pure preview.
//
// Required env:
//   RESEND_API_KEY  — server-side API key (use a fresh one if you don't have
//                     one saved locally; revoke when done if you want)
//   RESEND_FROM     — e.g. 'Alfred Birkelund <newsletter@alfredbirkelund.com>'
//   SITE_URL        — optional; defaults to https://alfredbirkelund.com
//
// Usage:
//   npm run build         # makes sure dist/rss.xml is up to date
//   RESEND_API_KEY=re_xxx RESEND_FROM='Alfred <newsletter@alfredbirkelund.com>' \
//     node scripts/preview-broadcast.mjs hello-world you@example.com

import fs from 'node:fs';
import path from 'node:path';
import { buildEssayEmail } from './lib/build-essay-email.mjs';

const [, , slug, toEmail] = process.argv;
if (!slug || !toEmail) {
  console.error('Usage: node scripts/preview-broadcast.mjs <slug> <to-email>');
  console.error('Example: node scripts/preview-broadcast.mjs hello-world you@example.com');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM;
const siteUrl = process.env.SITE_URL ?? 'https://alfredbirkelund.com';
if (!apiKey || !from) {
  console.error('Set RESEND_API_KEY and RESEND_FROM in env.');
  process.exit(1);
}

const RSS_PATH = path.resolve('dist/rss.xml');
if (!fs.existsSync(RSS_PATH)) {
  console.error(`RSS feed not found at ${RSS_PATH}. Run \`npm run build\` first.`);
  process.exit(1);
}

const rss = fs.readFileSync(RSS_PATH, 'utf8');

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function extractTag(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`));
  if (!m) return '';
  return decodeEntities(
    m[1].trim().replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, ''),
  );
}

function slugFromLink(link) {
  const m = link.match(/\/essays\/(.+?)\/?$/);
  return m ? m[1] : null;
}

const blocks = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const matched = blocks.find(
  (b) => slugFromLink(extractTag(b, 'link')) === slug,
);

if (!matched) {
  console.error(`No RSS item with slug "${slug}". Available essays:`);
  for (const b of blocks) {
    const s = slugFromLink(extractTag(b, 'link'));
    if (s) console.error(`  - ${s}`);
  }
  process.exit(1);
}

const item = {
  slug,
  title: extractTag(matched, 'title'),
  subtitle: extractTag(matched, 'description'),
  link: extractTag(matched, 'link'),
  date: extractTag(matched, 'pubDate'),
  category: extractTag(matched, 'category'),
};

const html = buildEssayEmail({ ...item, siteUrl });

const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    from,
    to: [toEmail],
    subject: `[PREVIEW] ${item.title}`,
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

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

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const blocks = [...rss.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
const matched = blocks.find(
  (b) =>
    extractTag(b, 'link').endsWith(`/${slug}/`) ||
    extractTag(b, 'guid').endsWith(`/${slug}/`),
);

if (!matched) {
  console.error(`No RSS item with slug "${slug}". Available essays:`);
  for (const b of blocks) {
    const link = extractTag(b, 'link');
    const m = link.match(/\/essays\/([^/]+)\/?$/);
    if (m) console.error(`  - ${m[1]}`);
  }
  process.exit(1);
}

const item = {
  title: extractTag(matched, 'title'),
  description: extractTag(matched, 'description'),
  link: extractTag(matched, 'link'),
};

const title = escapeHtml(item.title);
const description = item.description ? escapeHtml(item.description) : '';
const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>${title}</title></head>
<body style="margin:0;padding:32px 16px;background:#f3ebda;font-family:Georgia,'EB Garamond',serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;line-height:1.6;font-size:17px;">
    <h2 style="font-size:26px;font-weight:500;margin:0 0 8px;line-height:1.2;">
      <a href="${item.link}" style="color:#1a1a1a;text-decoration:none;">${title}</a>
    </h2>
    ${description ? `<p style="font-style:italic;color:#7a7266;margin:0 0 28px;">${description}</p>` : ''}
    <p style="margin:0 0 32px;">
      <a href="${item.link}" style="color:#5b4a2c;text-decoration:underline;">Read on the site →</a>
    </p>
    <hr style="border:0;border-top:1px solid #d6cdb6;margin:36px 0 20px;" />
    <p style="font-size:13px;color:#7a7266;margin:0;">
      You're getting this because you subscribed at
      <a href="${siteUrl}" style="color:#7a7266;">${siteUrl.replace(/^https?:\/\//, '')}</a>.
      Unsubscribe link is added by Resend on real broadcasts.
    </p>
  </div>
</body>
</html>`;

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

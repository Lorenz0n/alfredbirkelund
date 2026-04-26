// Diff dist/rss.xml against scripts/last-broadcast.json. For each item we
// haven't sent yet, build an email containing the full essay content (via
// scripts/lib/build-essay-email.mjs), create a Resend Broadcast, and send
// it to the audience. Then record the GUID so the next run skips it.
//
// Required env:
//   RESEND_API_KEY        — server-side API key
//   RESEND_AUDIENCE_ID    — audience UUID
//   RESEND_FROM           — e.g. 'Alfred Birkelund <newsletter@alfredbirkelund.com>'
//                           (the domain in the email must be verified in Resend)
//   SITE_URL              — e.g. 'https://alfredbirkelund.com'

import fs from 'node:fs';
import path from 'node:path';
import { buildEssayEmail } from './lib/build-essay-email.mjs';

const RSS_PATH = path.resolve('dist/rss.xml');
const LOG_PATH = path.resolve('scripts/last-broadcast.json');

const apiKey = process.env.RESEND_API_KEY;
const audienceId = process.env.RESEND_AUDIENCE_ID;
const from = process.env.RESEND_FROM;
const siteUrl = process.env.SITE_URL ?? 'https://alfredbirkelund.com';

if (!apiKey || !audienceId || !from) {
  console.error('Missing required env: RESEND_API_KEY, RESEND_AUDIENCE_ID, RESEND_FROM');
  process.exit(1);
}

if (!fs.existsSync(RSS_PATH)) {
  console.error(`RSS feed not found at ${RSS_PATH}. Did you run \`npm run build\`?`);
  process.exit(1);
}

let log = { sent: [] };
if (fs.existsSync(LOG_PATH)) {
  log = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8'));
  if (!Array.isArray(log.sent)) log.sent = [];
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
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = block.match(re);
  if (!m) return '';
  let val = m[1].trim();
  val = val.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
  return decodeEntities(val);
}

function slugFromLink(link) {
  const m = link.match(/\/essays\/(.+?)\/?$/);
  return m ? m[1] : null;
}

const items = [];
const itemRegex = /<item>([\s\S]*?)<\/item>/g;
let match;
while ((match = itemRegex.exec(rss)) !== null) {
  const block = match[1];
  const link = extractTag(block, 'link');
  items.push({
    guid: extractTag(block, 'guid'),
    title: extractTag(block, 'title'),
    description: extractTag(block, 'description'),
    link,
    pubDate: extractTag(block, 'pubDate'),
    category: extractTag(block, 'category'),
    slug: slugFromLink(link),
  });
}

const newItems = items.filter((item) => item.guid && item.slug && !log.sent.includes(item.guid));

if (newItems.length === 0) {
  console.log('No new items to broadcast.');
  process.exit(0);
}

console.log(`${newItems.length} new item(s) to broadcast.`);

async function createAndSendBroadcast(item) {
  const html = buildEssayEmail({
    slug: item.slug,
    title: item.title,
    subtitle: item.description,
    link: item.link,
    date: item.pubDate,
    category: item.category,
    siteUrl,
  });

  const createRes = await fetch('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      audience_id: audienceId,
      from,
      subject: item.title,
      html,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Create broadcast failed (${createRes.status}): ${await createRes.text()}`);
  }
  const broadcast = await createRes.json();
  const broadcastId = broadcast.id;

  const sendRes = await fetch(`https://api.resend.com/broadcasts/${broadcastId}/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  if (!sendRes.ok) {
    throw new Error(`Send broadcast failed (${sendRes.status}): ${await sendRes.text()}`);
  }

  return broadcastId;
}

let failures = 0;
for (const item of newItems) {
  try {
    const id = await createAndSendBroadcast(item);
    console.log(`Sent broadcast ${id} for "${item.title}"`);
    log.sent.push(item.guid);
  } catch (err) {
    failures += 1;
    console.error(`Failed to broadcast "${item.title}":`, err.message);
  }
}

fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2) + '\n');
console.log(`Updated ${LOG_PATH}`);

if (failures > 0) {
  process.exit(1);
}

// Subscribe + double-opt-in for alfredbirkelund.com.
//
// Flow:
//   1. Form on alfredbirkelund.com POSTs { email, cf-turnstile-response } here.
//   2. Worker verifies the Turnstile token with Cloudflare's siteverify
//      endpoint, then validates the email + honeypot, generates an HMAC-
//      signed token containing the email and a timestamp, and sends a
//      confirmation email via Resend's transactional /emails endpoint. The
//      HMAC token is the only state — nothing is written to the Resend
//      audience yet.
//   3. The user clicks the confirmation link, which lands on GET /confirm.
//      Worker verifies the HMAC + that the token is younger than 7 days,
//      then adds the contact to the Resend audience.
//
// Secrets (set via `wrangler secret put`):
//   RESEND_API_KEY      — server-side API key from resend.com/api-keys
//   RESEND_AUDIENCE_ID  — UUID of the audience created in resend.com/audiences
//   RESEND_FROM         — e.g. 'Alfred Birkelund <newsletter@alfredbirkelund.com>'
//   CONFIRM_SECRET      — any random 32+ char string used to sign tokens
//   TURNSTILE_SECRET    — Cloudflare Turnstile secret key (bot protection)

const ALLOWED_ORIGINS = new Set([
  'https://alfredbirkelund.com',
  'https://www.alfredbirkelund.com',
]);

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://alfredbirkelund.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(body, init = {}, headers = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });
}

function html(body, init = {}) {
  return new Response(body, {
    ...init,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ---------- HMAC token (self-validating, no storage needed) ----------

function base64urlEncode(bytes) {
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

async function makeToken(email, secret) {
  const payload = new TextEncoder().encode(JSON.stringify({ email, ts: Date.now() }));
  const key = await getHmacKey(secret);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, payload));
  return `${base64urlEncode(payload)}.${base64urlEncode(sig)}`;
}

async function verifyToken(token, secret) {
  const parts = String(token ?? '').split('.');
  if (parts.length !== 2) return null;
  let payloadBytes, sigBytes;
  try {
    payloadBytes = base64urlDecode(parts[0]);
    sigBytes = base64urlDecode(parts[1]);
  } catch {
    return null;
  }
  const key = await getHmacKey(secret);
  const ok = await crypto.subtle.verify('HMAC', key, sigBytes, payloadBytes);
  if (!ok) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    return null;
  }
  if (typeof payload.email !== 'string' || typeof payload.ts !== 'number') return null;
  if (Date.now() - payload.ts > TOKEN_MAX_AGE_MS) return null;
  return payload.email;
}

// ---------- Resend calls ----------

async function sendConfirmEmail(env, email, confirmUrl) {
  const subject = 'Confirm your subscription to Alfred Birkelund';
  const body = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8" /><title>${subject}</title></head>
<body style="margin:0;padding:32px 16px;background:#f3ebda;font-family:Georgia,'EB Garamond',serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:0 auto;line-height:1.6;font-size:17px;">
    <p style="margin:0 0 18px;">One more step. Click below to confirm your subscription to Alfred Birkelund's essays:</p>
    <p style="margin:0 0 28px;">
      <a href="${confirmUrl}" style="color:#5b4a2c;text-decoration:underline;">Confirm subscription →</a>
    </p>
    <p style="margin:0 0 0;font-size:15px;color:#7a7266;">If you didn't sign up, just ignore this email and you won't be added.</p>
    <hr style="border:0;border-top:1px solid #d6cdb6;margin:36px 0 20px;" />
    <p style="font-size:13px;color:#7a7266;margin:0;">This link expires in 7 days.</p>
  </div>
</body>
</html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.RESEND_FROM,
      to: [email],
      subject,
      html: body,
    }),
  });
  if (!res.ok) {
    console.error('Resend /emails failed:', res.status, await res.text());
    return false;
  }
  return true;
}

async function addToAudience(env, email) {
  const res = await fetch(
    `https://api.resend.com/audiences/${env.RESEND_AUDIENCE_ID}/contacts`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, unsubscribed: false }),
    },
  );
  // Treat 2xx as success. 409 = already exists, also success (idempotent).
  if (res.ok || res.status === 409) return true;
  console.error('Resend audience add failed:', res.status, await res.text());
  return false;
}

// ---------- Confirmation success/error pages ----------

function pageShell(title, headline, copy) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="https://alfredbirkelund.com/favicon.svg" />
</head>
<body style="margin:0;padding:32px 16px;background:#f3ebda;font-family:Georgia,'EB Garamond',serif;color:#1a1a1a;">
  <div style="max-width:560px;margin:80px auto;line-height:1.6;font-size:19px;text-align:center;">
    <h1 style="font-size:36px;font-weight:500;margin:0 0 24px;line-height:1.15;">${headline}</h1>
    <p style="font-style:italic;color:#7a7266;margin:0;">${copy}</p>
    <p style="margin:64px 0 0;">
      <a href="https://alfredbirkelund.com" style="color:#5b4a2c;text-decoration:underline;">← Return to alfredbirkelund.com</a>
    </p>
  </div>
</body>
</html>`;
}

// ---------- Router ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID || !env.RESEND_FROM || !env.CONFIRM_SECRET || !env.TURNSTILE_SECRET) {
      console.error('Missing required Worker secret(s)');
      return json({ error: 'Server misconfigured' }, { status: 500 }, cors);
    }

    // ----- GET /confirm — verify token, add to audience -----
    if (request.method === 'GET' && url.pathname === '/confirm') {
      const token = url.searchParams.get('token');
      const email = await verifyToken(token, env.CONFIRM_SECRET);
      if (!email) {
        return html(
          pageShell(
            'Link expired or invalid — Alfred Birkelund',
            'Link expired or invalid',
            'This confirmation link is no longer valid. You can subscribe again on the home page.',
          ),
          { status: 400 },
        );
      }
      const ok = await addToAudience(env, email);
      if (!ok) {
        return html(
          pageShell(
            'Something went wrong — Alfred Birkelund',
            'Something went wrong',
            "We couldn't add you to the list just now. Please try again in a minute.",
          ),
          { status: 502 },
        );
      }
      return html(
        pageShell(
          'Confirmed — Alfred Birkelund',
          'Confirmed',
          "You're on the list. New essays will land in your inbox when they go live.",
        ),
        { status: 200 },
      );
    }

    // ----- POST / — accept subscribe, send confirmation email -----
    if (request.method === 'POST') {
      let email = '';
      let honeypot = '';
      let turnstileToken = '';
      try {
        const ct = request.headers.get('Content-Type') ?? '';
        if (ct.includes('application/json')) {
          const body = await request.json();
          email = body.email ?? '';
          honeypot = body.website ?? '';
          turnstileToken = body['cf-turnstile-response'] ?? '';
        } else {
          const fd = await request.formData();
          email = (fd.get('email') ?? '').toString();
          honeypot = (fd.get('website') ?? '').toString();
          turnstileToken = (fd.get('cf-turnstile-response') ?? '').toString();
        }
      } catch (_) {
        return json({ error: 'Invalid request body' }, { status: 400 }, cors);
      }

      // Honeypot: silently accept so the bot doesn't learn it was caught.
      if (honeypot.trim() !== '') {
        return json({ ok: true }, {}, cors);
      }

      // Turnstile: verify the bot-check token with Cloudflare. Blocks
      // direct POSTs from curl/scripts that bypass the form.
      if (!turnstileToken) {
        return json({ error: 'Bot check missing' }, { status: 400 }, cors);
      }
      const ip = request.headers.get('CF-Connecting-IP') ?? '';
      const verifyRes = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            secret: env.TURNSTILE_SECRET,
            response: turnstileToken,
            remoteip: ip,
          }),
        },
      );
      const verifyData = await verifyRes.json().catch(() => ({}));
      if (!verifyData.success) {
        console.error('Turnstile verify failed:', verifyData['error-codes']);
        return json({ error: 'Bot check failed' }, { status: 400 }, cors);
      }

      if (!isValidEmail(email)) {
        return json({ error: 'Invalid email' }, { status: 400 }, cors);
      }

      const token = await makeToken(email, env.CONFIRM_SECRET);
      const confirmUrl = `${url.origin}/confirm?token=${encodeURIComponent(token)}`;
      const sent = await sendConfirmEmail(env, email, confirmUrl);
      if (!sent) {
        return json({ error: 'Could not send confirmation email' }, { status: 502 }, cors);
      }
      return json({ ok: true }, {}, cors);
    }

    return json({ error: 'Not found' }, { status: 404 }, cors);
  },
};

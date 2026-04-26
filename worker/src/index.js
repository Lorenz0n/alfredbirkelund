// Subscribe endpoint: receives the form POST from alfredbirkelund.com,
// validates the email, and creates a contact in a Resend Audience.
//
// Secrets (set via `wrangler secret put`):
//   RESEND_API_KEY      — server-side API key from resend.com/api-keys
//   RESEND_AUDIENCE_ID  — UUID of the audience created in resend.com/audiences
//
// The form is on https://alfredbirkelund.com — that's the only origin allowed
// to call this endpoint. CORS is set accordingly.

const ALLOWED_ORIGINS = new Set([
  'https://alfredbirkelund.com',
  'https://www.alfredbirkelund.com',
]);

function corsHeaders(origin) {
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://alfredbirkelund.com';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

function json(body, init = {}, headers = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const cors = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }
    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, { status: 405 }, cors);
    }

    let email = '';
    let honeypot = '';
    try {
      const ct = request.headers.get('Content-Type') ?? '';
      if (ct.includes('application/json')) {
        const body = await request.json();
        email = body.email ?? '';
        honeypot = body.website ?? '';
      } else {
        const fd = await request.formData();
        email = (fd.get('email') ?? '').toString();
        honeypot = (fd.get('website') ?? '').toString();
      }
    } catch (_) {
      return json({ error: 'Invalid request body' }, { status: 400 }, cors);
    }

    // Honeypot: real users never fill the hidden "website" field; bots usually do.
    // Silently accept (return 200) so the bot doesn't learn it was caught.
    if (honeypot.trim() !== '') {
      return json({ ok: true }, {}, cors);
    }

    if (!isValidEmail(email)) {
      return json({ error: 'Invalid email' }, { status: 400 }, cors);
    }

    if (!env.RESEND_API_KEY || !env.RESEND_AUDIENCE_ID) {
      console.error('Missing RESEND_API_KEY or RESEND_AUDIENCE_ID');
      return json({ error: 'Server misconfigured' }, { status: 500 }, cors);
    }

    const resendRes = await fetch(
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

    // 2xx = success. Resend returns 200 even when the contact already exists,
    // but if a future change makes it return 409, treat that as success too.
    if (resendRes.ok || resendRes.status === 409) {
      return json({ ok: true }, {}, cors);
    }

    const errorText = await resendRes.text();
    console.error('Resend error', resendRes.status, errorText);
    return json({ error: 'Subscription failed' }, { status: 502 }, cors);
  },
};

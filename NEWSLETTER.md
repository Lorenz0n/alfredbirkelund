# Newsletter setup — Resend + Cloudflare Worker + GitHub Action

How the email-on-new-essay pipeline works, and how to wire it up the first time.
After this is set up, you do nothing per essay — push a new `.mdx` to `main`,
GitHub Actions deploys the site, and once the deploy is live a small email goes
out to your subscribers with the title, subtitle, and a link.

## Architecture

```
  Reader fills form on alfredbirkelund.com
        │
        ▼ POST /
  Cloudflare Worker — sends a confirmation email via Resend's
                      transactional /emails endpoint with an HMAC-signed
                      token in the link. NO audience write yet.
        │
        ▼ user clicks link in email
  Cloudflare Worker — GET /confirm?token=...
                      verifies HMAC + token age (max 7 days)
                      THEN adds contact to Resend Audience
        │
        ▼
  Resend Audience  ◄────── confirmed subscribers only
        ▲
        │
  Broadcast send ◄── GitHub Action (.github/workflows/notify-subscribers.yml)
        ▲                  │
        │                  ▼
        │           reads dist/rss.xml, diffs against
        │           scripts/last-broadcast.json
        │
  Triggered by:  push → Deploy to GitHub Pages → Notify subscribers
```

Three pieces:

1. **Cloudflare Worker** (`worker/`) — handles POST `/` (subscribe → email
   confirmation link) and GET `/confirm` (verify token → add to audience).
   Tokens are HMAC-SHA256 signed and self-validating — no state stored.
   Free tier: 100k requests/day.
2. **Resend Audience** — your subscriber list, managed in your Resend dashboard.
   Only confirmed (double-opt-in) emails make it here.
3. **GitHub Action** (`.github/workflows/notify-subscribers.yml`) — runs after
   each successful Pages deploy, reads `dist/rss.xml`, finds GUIDs not yet in
   `scripts/last-broadcast.json`, sends one Resend Broadcast per new item, and
   commits the updated log back to the repo.

**Why double opt-in?** Without it, anyone can sign up anyone's email address —
that's a spam vector and a GDPR problem. The confirmation step proves the
address-owner actually wanted in.

---

## First-time setup (~30–45 min)

You only do these steps once. After that, publishing is `git push`.

### Step 1 — Resend: domain, audience, API key

1. **Verify your sending domain** at https://resend.com/domains. Add
   `alfredbirkelund.com`, follow the DNS setup (3 records — SPF, DKIM, return-path).
   You can't send from an unverified domain.
2. **Create an audience** at https://resend.com/audiences → New audience → call
   it `Essays`. Copy the audience UUID from the URL bar.
3. **Generate a server API key** at https://resend.com/api-keys → "Create API
   key" → name it `alfredbirkelund-newsletter` → permission `Full access`. Copy
   the key. (You'll only see it once.)
4. **Pick a from address.** I'd suggest `Alfred Birkelund <newsletter@alfredbirkelund.com>`
   — pretty, makes the unsubscribe path obvious. Make sure DNS is set so this
   address can send (the domain verification handles this for any address @
   the verified domain).

### Step 2 — Cloudflare Worker

You need a free Cloudflare account (https://dash.cloudflare.com/sign-up).

The Worker needs **four** secrets:

| Secret | What it is |
|---|---|
| `RESEND_API_KEY` | Server-side key from step 1.3 |
| `RESEND_AUDIENCE_ID` | Audience UUID from step 1.2 |
| `RESEND_FROM` | Same as the GitHub Actions secret, e.g. `Alfred Birkelund <newsletter@alfredbirkelund.com>` — used as the sender for confirmation emails |
| `CONFIRM_SECRET` | Random 32+ character string. Used to HMAC-sign confirmation tokens so they can't be forged. Generate with `openssl rand -hex 32` (or any password manager). Keep it somewhere safe — if it ever leaks, rotate by setting a new value via `wrangler secret put`; previously-issued tokens then stop working. |

```bash
cd worker
npm install
npx wrangler login            # opens browser to authenticate
npx wrangler secret put RESEND_API_KEY        # paste the key from step 1.3
npx wrangler secret put RESEND_AUDIENCE_ID    # paste the UUID from step 1.2
npx wrangler secret put RESEND_FROM           # paste the same from address as in step 3
npx wrangler secret put CONFIRM_SECRET        # paste a random 32+ char string
npx wrangler deploy
```

The deploy output prints the public URL, e.g.
`https://alfredbirkelund-subscribe.YOUR-SUBDOMAIN.workers.dev`. Copy it.

#### Wire it into the form

Open `src/pages/index.astro`, find the subscribe form's `action` attribute,
and replace `YOUR_CLOUDFLARE_SUBDOMAIN` with your actual Cloudflare subdomain:

```astro
action="https://alfredbirkelund-subscribe.YOUR_CLOUDFLARE_SUBDOMAIN.workers.dev/"
```

Commit, push, deploy.

#### (Optional) Custom subdomain

If you'd like the form to POST to `https://subscribe.alfredbirkelund.com/`
instead of the workers.dev URL: in Cloudflare's dashboard → your Worker →
Settings → Triggers → "Add custom domain" → enter `subscribe.alfredbirkelund.com`.
Cloudflare adds the DNS record automatically (assuming the domain is on
Cloudflare). Then update the form's `action` to use that domain.

This is purely cosmetic — workers.dev URLs are equally functional, just less
pretty.

### Step 3 — GitHub repository secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository
secret. Add three:

| Name | Value |
|---|---|
| `RESEND_API_KEY` | The same API key from step 1.3 |
| `RESEND_AUDIENCE_ID` | The audience UUID from step 1.2 |
| `RESEND_FROM` | `Alfred Birkelund <newsletter@alfredbirkelund.com>` |

The notify workflow reads these at run time. They're not committed anywhere.

### Step 4 — First trial

1. Subscribe yourself via the form on `alfredbirkelund.com`. The form
   should replace itself with **"Almost there — check your inbox to confirm."**
   Open the confirmation email, click the link — you should land on a
   styled "Confirmed" page. Now verify the contact appears in the Resend
   audience dashboard.
2. Push a small change to any file under `src/content/essays/` to trigger the
   pipeline. (Or, faster: on GitHub → Actions → "Notify subscribers of new
   essays" → Run workflow manually.) Since `scripts/last-broadcast.json` is
   pre-seeded with current GUIDs, the first run should report "No new items
   to broadcast" — that's the correct behavior.
3. When you publish a real new essay (a new `.mdx` with `draft: false`),
   watch Actions. After Deploy succeeds, "Notify subscribers" runs, sends
   one broadcast per new RSS item, then commits an updated `last-broadcast.json`.

---

## How publishing works after setup

```bash
# 1. Write the essay
edit src/content/essays/my-new-essay.mdx

# 2. Ship it
git add src/content/essays/my-new-essay.mdx
git commit -m "Add essay: My New Essay"
git push
```

That's the whole loop. GitHub Actions does the rest:

- Builds and deploys the site
- After deploy succeeds, the notify workflow kicks in
- Diff detects the new RSS item → creates and sends a Resend broadcast
- Updates `scripts/last-broadcast.json` with a `[skip ci]` commit
- Subscribers get a small email with the title, subtitle, and a "Read on
  the site →" link

---

## Files involved

| Path | What it does |
|---|---|
| `worker/src/index.js` | The subscribe Worker (form → Resend audience) |
| `worker/wrangler.toml` | Worker config |
| `worker/package.json` | Wrangler dev dep + helpful scripts |
| `scripts/send-new-broadcasts.mjs` | RSS diff + Resend Broadcast send |
| `scripts/last-broadcast.json` | Tracks GUIDs already broadcast (auto-updated) |
| `.github/workflows/notify-subscribers.yml` | Runs the script after Deploy |
| `src/pages/index.astro` | The inline subscribe form on home |

---

## Troubleshooting

### Form submits but no confirmation email arrives

- Check the Worker's logs: `cd worker && npx wrangler tail`. Submit the form
  and watch the live log. Errors print there.
- Most common cause: `RESEND_FROM` uses an unverified domain, or the API key
  doesn't have permission to send transactional email. Verify the domain at
  https://resend.com/domains.
- The form's success message ("check your inbox") only means the Worker
  accepted the request. The confirmation email is a separate Resend call —
  if it fails, the form shows an error message instead.

### Confirmation link says "expired or invalid"

- Tokens are valid for 7 days. Past that, the user has to subscribe again.
- If a valid-looking link is rejected, the most likely cause is that the
  `CONFIRM_SECRET` was rotated since the token was issued. Old tokens become
  invalid the moment the secret changes — that's by design, but tell
  affected users to subscribe again.

### Form submits but no contact appears in Resend after confirmation

- Check the Worker's logs (`npx wrangler tail`) while clicking the confirm
  link. Errors print there.
- Most common cause: wrong `RESEND_API_KEY` or `RESEND_AUDIENCE_ID` in the
  Worker's secrets. Re-run `npx wrangler secret put RESEND_API_KEY`.

### GitHub Action fails at "Send Resend broadcasts"

- Look at the failing step's log. The script writes the HTTP status and body
  text from Resend on failure, which usually says exactly what's wrong
  (unverified domain, invalid from address, etc.).
- Verify the three repo secrets (`RESEND_API_KEY`, `RESEND_AUDIENCE_ID`,
  `RESEND_FROM`) exist and aren't empty.

### "No new items to broadcast" forever

- Open `scripts/last-broadcast.json` and check whether your new essay's GUID
  is somehow already in the `sent` list. If yes, remove it and push.
- Confirm `dist/rss.xml` includes the new essay's `<item>` block (i.e. the
  essay's frontmatter has `draft: false` and `unlisted: false`).

### A broadcast got sent twice

- Cause: the action ran twice for the same deploy (e.g. you re-ran the
  Deploy workflow manually after it had already succeeded once).
- Fix: nothing, going forward. Each broadcast is a separate Resend record;
  Resend won't deliver to the same address twice in the same minute due to
  their idempotency.

### I want to send a one-off (non-RSS) email to subscribers

- Resend dashboard → Broadcasts → New broadcast. Pick the audience, write the
  email, send. The pipeline above only handles automatic RSS-driven sends —
  manual broadcasts coexist fine.

---

## Costs

- **Resend free tier**: 3,000 emails/month, 100/day. At ~1 essay/week and
  ~100 subscribers, you'd send ~400 emails/month. Plenty of headroom.
- **Cloudflare Workers free tier**: 100,000 requests/day. The form gets used
  a few times a day at most. You'll never hit the cap.
- **GitHub Actions**: free for public repos.

If you ever cross 3,000 emails/month, Resend's first paid tier is $20/mo for
50,000 emails. That'd cover up to ~12,000 subscribers if you publish weekly.

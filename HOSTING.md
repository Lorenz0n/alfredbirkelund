# Hosting

The site is deployed as a static build to **GitHub Pages** from the
[`Lorenz0n/alfredbirkelund`](https://github.com/Lorenz0n/alfredbirkelund) repo,
with DNS fronted by **Cloudflare** for `alfredbirkelund.com`.

This document is the operator's manual — how deploys happen, how DNS is
wired, and what to do when something breaks.

---

## How a deploy happens

1. You push commits to `main` on `Lorenz0n/alfredbirkelund`.
2. The workflow at [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs:
   - `npm ci`
   - `npm run build` (which is `astro check && astro build`)
   - uploads `./dist` as a Pages artifact
   - publishes via `actions/deploy-pages`
3. GitHub Pages serves `dist/` at `https://alfredbirkelund.com`.

That's it. No Vercel, no separate build server. If `astro check` fails (bad
frontmatter, broken link in a content collection, TS error), the deploy fails
loudly in the Actions tab and the live site keeps serving the previous build.

To trigger a deploy without a push: **Actions → Deploy to GitHub Pages → Run workflow**.

---

## One-time setup (done once, documented for recovery)

### 1. Account-level caveat — private repo + Pages

**GitHub Pages on a private user-account repo requires GitHub Pro.** On a free
account, the `actions/deploy-pages` step will fail with a 403 "Get Pages site
failed" / "Pages is not enabled" error.

Options:

- **Upgrade to GitHub Pro** (~$4/month) — keeps the repo private, Pages works.
- **Make the repo public** — `gh repo edit Lorenz0n/alfredbirkelund --visibility public`. Content is public on disk but was already going to be public on the web anyway.

Pick one before expecting the live site to work.

### 2. Enable Pages with "GitHub Actions" as the source

GitHub → repo → **Settings → Pages**:

- **Source**: GitHub Actions (not "Deploy from a branch")
- **Custom domain**: `alfredbirkelund.com`
- **Enforce HTTPS**: checked (appears once the cert is issued, usually within a few minutes of DNS propagating)

The `public/CNAME` file in this repo ends up in `dist/CNAME` at build time and
tells Pages which domain it's serving. Don't delete it.

### 3. DNS in Cloudflare

In the Cloudflare dashboard for `alfredbirkelund.com` → **DNS → Records**, add:

| Type  | Name   | Value                    | Proxy status   |
| ----- | ------ | ------------------------ | -------------- |
| A     | `@`    | `185.199.108.153`        | DNS only (gray) |
| A     | `@`    | `185.199.109.153`        | DNS only (gray) |
| A     | `@`    | `185.199.110.153`        | DNS only (gray) |
| A     | `@`    | `185.199.111.153`        | DNS only (gray) |
| AAAA  | `@`    | `2606:50c0:8000::153`    | DNS only (gray) |
| AAAA  | `@`    | `2606:50c0:8001::153`    | DNS only (gray) |
| AAAA  | `@`    | `2606:50c0:8002::153`    | DNS only (gray) |
| AAAA  | `@`    | `2606:50c0:8003::153`    | DNS only (gray) |
| CNAME | `www`  | `lorenz0n.github.io`     | DNS only (gray) |

**Important — keep proxy OFF (gray cloud) initially.** GitHub needs to reach
the origin directly to verify the domain and issue a Let's Encrypt cert. If
the orange cloud is on, verification silently stalls.

Once the site is live and "Enforce HTTPS" is enabled in GitHub, you *can* flip
the proxy back on — but then set Cloudflare **SSL/TLS mode to "Full (strict)"**
(not "Flexible", which causes redirect loops with Pages). Most people leave it
on DNS-only; the latency difference is negligible for a static site.

### 4. Verify

- `dig alfredbirkelund.com +short` should return the four GitHub IPs.
- `https://alfredbirkelund.com` should load the site with a valid cert.
- GitHub → Settings → Pages should show a green "Your site is live at ..." banner.

Propagation can take anywhere from a minute to a few hours. If it's been more
than a day, re-check the CNAME file, DNS records, and Pages settings in that
order.

---

## Day-to-day operations

### Publishing a new essay

1. Create `src/content/essays/<slug>.mdx` with the required frontmatter (see README).
2. `npm run dev` to preview locally.
3. `git add`, commit, push to `main`.
4. Watch the **Actions** tab — green check = live within ~1 minute.

Drafts (`draft: true` in frontmatter) are excluded from the build, so you can
push half-finished essays without them appearing publicly.

### Rolling back

GitHub Pages serves whatever the last successful workflow run produced. To roll
back: either revert the offending commit (`git revert <sha>` → push), or go to
**Actions → Deploy to GitHub Pages**, find the last good run, and click "Re-run
all jobs". The older artifact redeploys.

### When a deploy fails

- **Red X on Actions**: click through to the failed step. 90% of the time it's
  `astro check` complaining about frontmatter.
- **"Get Pages site failed"**: see the Pro-account caveat above.
- **Cert errors in browser after DNS changes**: wait 10 minutes, then toggle
  "Enforce HTTPS" off and on in Settings → Pages to re-request the cert.
- **Wrong domain served / 404**: confirm `public/CNAME` still contains
  `alfredbirkelund.com` and that Settings → Pages shows it as the custom domain.

### Changing the domain later

1. Update `site:` in `astro.config.mjs`.
2. Update `public/CNAME`.
3. Update DNS in Cloudflare.
4. Update the custom domain field in Settings → Pages.

All four have to match or Pages refuses to serve.

---

## Why GitHub Pages (vs Vercel)

The README previously mentioned Vercel; we switched because:

- **Cheaper**: free even on custom domains, no meter to worry about.
- **Fewer moving parts**: one repo, one workflow, no separate provider account.
- **Boring**: Pages has been stable for a decade; good fit for a slow-updating essay site.

Tradeoffs we accepted:

- No per-PR preview URLs (you can still preview locally with `npm run preview`).
- No serverless functions — fine, the site is pure static.
- Build times are slightly slower than Vercel's cached builds; not noticeable at this scale.

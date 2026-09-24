# 01 — Free static hosting for the game + Admin Console

- **Question:** Which service is best for hosting the static Vite build of Pixel Horde plus a separate
  Admin Console, free forever (0 THB)?
- **Candidates:** Cloudflare Pages, GitHub Pages, Netlify, Vercel, itch.io (embed).
- **Date checked:** 2026-09-24 (all sources below read on this date).
- **Method:** official limits, pricing, docs, and terms pages only. Where a primary page did not
  state something, that is marked *not stated* instead of filled in from memory or third-party posts.

## TL;DR / recommendation

**Use Cloudflare Pages for both sites** (two projects from the same repo: `pixel-horde` and
`pixel-horde-admin`). Its free plan has **no bandwidth or request cap for static assets**, 500 builds
a month, unlimited preview deployments, free `*.pages.dev` subdomains, and 100 custom domains per
project. The admin site can be put behind **Cloudflare Access** (Zero Trust free plan, up to 50
users). Nothing found on Cloudflare's pages bans commercial use on the free plan.

**Also publish the game on itch.io** as a second channel so people can find it. itch.io is free,
creators pick their own revenue share (0% is allowed), and it supports pay-what-you-want, which fits
later donations. It can only host the game, though. It has no custom domain and no place for the
Admin Console.

Avoid **Netlify Free**: the new credit model pauses a site once 300 credits are used, and each
production deploy costs 15 credits. **Vercel Hobby** works (donations are explicitly *not*
commercial), but it caps data transfer at 100 GB, bans ads and sales if the project ever grows that
way, and cannot connect repos owned by a GitHub organization. **GitHub Pages** is a fine fallback
for the game only: 100 GB soft bandwidth, public repo required on Free, no access control, and no
preview deploys.

> Whatever host you choose, the Admin Console is a static JS bundle, so hiding the URL or putting
> login in front of it is only defense-in-depth. The real protection has to live in the backend
> (for example, Supabase Row Level Security plus an admin role check). Never ship a service-role
> key in the admin bundle.

## Comparison table

| | **Cloudflare Pages** | **GitHub Pages** | **Netlify (Free, credit-based)** | **Vercel (Hobby)** | **itch.io (HTML5 embed)** |
|---|---|---|---|---|---|
| Price | Free | Free (public repos) | Free, "$0 forever" | Free | Free to upload and host |
| Bandwidth / month | **Unlimited** ("unlimited sites, seats, requests, and bandwidth") [CF1] | **100 GB soft** limit [GH1] | Metered: **20 credits per GB** out of 300 credits/mo [NL1] | **100 GB** Fast Data Transfer [VC2] | Not stated (itch.io covers it) |
| Requests | Static asset requests are free and unlimited [CF2]. Functions: 100k/day [CF2] | Rate limits possible, returns HTTP 429 [GH1] | 2 credits per 10k requests [NL1] | 1M function invocations; static not separately capped [VC2] | Not stated |
| Builds | **500/month**, 1 concurrent, 20 min timeout [CF3] | 10/hour soft (does not apply with a custom Actions workflow), 10 min deploy timeout [GH1] | **15 credits per production deploy**; previews and branch deploys are free [NL1] | 100 deployments/day, 1 concurrent, 45 min build [VC1] | Manual zip upload (or the `butler` CLI); no git build |
| What happens at the limit | Functions get 429 once the daily quota is used; static stays up [CF2][CF5] | GitHub may contact you or rate-limit [GH1] | **Site is paused** until next month; no top-up on Free [NL1] | Must upgrade to Pro; account or deployment can be paused [VC1][VC2] | n/a |
| Site size / files | 20,000 files, 25 MiB per file [CF3] | 1 GB site [GH1] | Not stated on pricing page | 100 MB CLI upload; 15,000 source files (CLI) [VC1] | 1,000 files, 500 MB total, 200 MB per file [IT1] |
| Free subdomain | `*.pages.dev` [CF4] | `<user>.github.io/<repo>` [GH2] | `*.netlify.app` | `*.vercel.app` | `<user>.itch.io/<game>` (game runs in an iframe) [IT1] |
| Custom domain later | Yes, 100 per project [CF3] | Yes [GH2] | Yes, with SSL [NL2] | Yes, 50 per project [VC1] | **No** |
| Auto deploy from git | GitHub and GitLab built in; others through Wrangler in CI [CF6] | Branch or GitHub Actions | Yes | Yes, but **Hobby cannot connect repos owned by a Git organization** [VC1] | No |
| Preview deploys | **Unlimited**, per PR/branch, with alias URLs [CF3][CF4] | **None** built in | Unlimited, and they do not use credits [NL1][NL2] | Yes, for every push | No |
| Separate admin site | Yes: up to 5 projects per repo using root directory + build watch paths [CF7]; 100 projects per account [CF3] | Only by a separate repo (one site per repo) [GH2] | Yes (a second site) | Yes (200 projects; 25 per repo) [VC1] | No |
| Protect admin for free | **Yes: Cloudflare Access**, Zero Trust Free up to 50 users [CF8]; preview deploys can be locked with one toggle [CF4]. Protecting a hostname needs the domain on Cloudflare, or an Access app for the `pages.dev` host [CF9] | **No.** Private Pages need GitHub Enterprise Cloud [GH3] | Partly: "Private" project visibility, but on Free **only the Team Owner** can view it. Password and Basic-Auth are Pro only [NL3][NL4] | **Yes: Vercel Authentication** with "All Deployments" scope is free (Vercel login only). Password protection is **not available on Hobby** [VC3] | n/a |
| Terms for a free game with donations | No non-commercial clause on the pricing or limits pages read (full self-serve agreement not reviewed) | Prohibits sites "primarily directed at … facilitating commercial transactions" [GH1]. A donation link is not the primary purpose | No non-commercial clause on the pricing page (Self-Serve agreement not reviewed) | Hobby is **"non-commercial personal use only"**, but "**Asking for Donations does not fall under commercial usage**". Ads (e.g. AdSense) and payment processing **are** commercial [VC2] | Open revenue share (you pick the %, 0 allowed); minimum price can be 0 (pay-what-you-want) [IT2] |

## Notes per service

### Cloudflare Pages (recommended)
- Free plan: "unlimited sites, seats, requests, and bandwidth", 500 builds/month, 1 concurrent build [CF1][CF3].
- Static asset requests are "free and unlimited" on both free and paid plans. Only Pages Functions
  count toward the Workers Free quota of 100,000 requests/day, which resets at midnight UTC [CF2].
  A pure Vite static build uses no Functions.
- Preview deployments: a unique URL for each PR, plus branch aliases such as
  `development.<project>.pages.dev`. You can turn on an Access policy for previews in
  Settings > General [CF4].
- Monorepo: up to 5 Pages projects per repository, each with its own root directory, build command,
  and include/exclude watch paths [CF7]. This fits `apps/game` + `apps/admin` well.
- Admin protection: Cloudflare Zero Trust Free covers up to 50 users of Access [CF8]. Access can log
  in with GitHub or a one-time PIN by email. To protect a public hostname the domain has to be an
  active Cloudflare zone [CF9]. Until a custom domain exists, the `*.pages.dev` admin can be covered
  by an Access application for that hostname (the Pages project setting flow).
- Direction of travel: Cloudflare's Pages-to-Workers migration guide says Workers has "a distinctly
  broader set of features" [CF5]. Pages is **not** described as deprecated, and Workers static
  assets are also "free and unlimited" [CF10], so moving later would be cheap.
- Caveats: 20,000 files and 25 MiB per file per site [CF3]. Neither matters for this game.

### GitHub Pages (fallback for the game only)
- 1 GB site, **100 GB/month soft bandwidth**, 10 builds/hour soft (not with a custom Actions
  workflow), 10 min deploy timeout, and possible 429 rate limiting [GH1].
- GitHub Free allows Pages only from **public** repos. Private or access-controlled Pages require an
  organization on GitHub Enterprise Cloud [GH3][GH4]. There is no way to protect an admin site.
- One site per repo, so the admin would need its own repo [GH2]. There are no preview deploys.
- Prohibited: running an online business or a site "primarily directed at either facilitating
  commercial transactions or providing commercial software as a service" [GH1]. A small donation
  link on a free game should be fine; a store or checkout should not be hosted there.
- Visitor IPs are logged by GitHub for security [GH2]. Worth one line in a privacy note.

### Netlify Free (not recommended)
- Credit-based Free plan: **300 credits/month hard limit** with no auto-recharge [NL1].
  - Production deploy = 15 credits, 1 GB bandwidth = 20 credits, 10k requests = 2 credits [NL1].
  - Deploy previews, branch deploys, and failed deploys are **not** metered [NL1].
  - When credits run out the **site is paused** [NL1].
  - Example: 10 production deploys (150 credits) leaves 150 credits, about 7.5 GB of traffic,
    for the whole month. A game that goes viral would go offline.
- On Free, Password Protection and Basic-Auth headers are unavailable (Pro only) [NL3][NL4].
  "Private" visibility exists, but on Free "private projects can only be seen by the Team Owner" [NL3].

### Vercel Hobby (acceptable, but second choice)
- Monthly Hobby allotment: 100 GB Fast Data Transfer, 10 GB Fast Origin Transfer, 1M function
  invocations [VC2]. 200 projects, 100 deployments/day, 50 domains/project, 1 concurrent build [VC1].
- **Terms:** "Hobby teams are restricted to non-commercial personal use only." Commercial use covers
  any way of taking payment from visitors, advertising a product for sale, or ads such as AdSense.
  But the page states explicitly: "**Asking for Donations does not fall under commercial usage.**" [VC2]
  So a donation link is OK. Adding ads or selling items (skins, etc.) later would require Pro.
- Hobby **cannot connect a project to a Git repository owned by a Git organization** [VC1].
- Admin protection: Vercel Authentication with "All Deployments" scope needs no paid add-on, but only
  Vercel users with access can get in. Password Protection is not available on Hobby [VC3].

### itch.io (distribution channel, not the main host)
- "itch.io costs nothing to use" [IT2]. Open revenue sharing: the creator chooses the percentage,
  and 0% is allowed. The minimum price can be 0, which gives pay-what-you-want and donations for free [IT2].
- HTML5 upload: zip only, at most 1,000 files, 500 MB extracted, 200 MB per file [IT1].
- The game runs in an **iframe** on the itch.io page. A "Mobile Friendly" option makes mobile use
  "Click to launch in fullscreen" [IT1]. The co-op room-code link would have to point to the itch
  page, or to the Cloudflare URL.
- No custom domain, no git deploys, no previews, nowhere for the Admin Console.

## Suggested setup (0 THB)
1. Monorepo with `apps/game` and `apps/admin` (Vite + TS).
2. Cloudflare Pages project `pixel-horde` builds `apps/game` with watch path `apps/game/**`, then
   `pixel-horde.pages.dev`.
3. Cloudflare Pages project `pixel-horde-admin` builds `apps/admin` with watch path `apps/admin/**`,
   then `pixel-horde-admin.pages.dev`. Put an Access policy on it (GitHub login, allow only the
   owner's email). Also set `X-Robots-Tag: noindex` in `_headers`.
4. Real admin authorization happens in the backend (e.g. Supabase RLS / admin role), not in the static host.
5. Optional: a GitHub Actions step uploads the same game build to itch.io with `butler` on release tags.
6. Later: buy a domain, add it to Cloudflare DNS (free), and attach `play.<domain>` and `admin.<domain>`.

## Open questions / not verified
- The full Cloudflare and Netlify self-serve agreements were not read line by line. The pricing and
  limits pages have no non-commercial clause for free plans.
- itch.io policy on external donation links is not stated in the FAQ that was read.
  Pay-what-you-want on itch itself is the safe route.
- Cloudflare Workers Builds free build-minute limits were not checked (only relevant if we migrate
  from Pages to Workers).

## Sources (all checked 2026-09-24)
- [CF1] Cloudflare Pages product page: https://www.cloudflare.com/en-gb/developer-platform/products/pages/
- [CF2] Cloudflare Pages Functions pricing: https://developers.cloudflare.com/pages/functions/pricing/
- [CF3] Cloudflare Pages limits: https://developers.cloudflare.com/pages/platform/limits/
- [CF4] Cloudflare Pages preview deployments: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- [CF5] Migrate from Pages to Workers: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/
- [CF6] Cloudflare Pages Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- [CF7] Cloudflare Pages monorepos: https://developers.cloudflare.com/pages/configuration/monorepos/
- [CF8] Cloudflare Zero Trust plans (Free, up to 50 users): https://www.cloudflare.com/plans/zero-trust-services/ and https://blog.cloudflare.com/teams-plans/
- [CF9] Cloudflare Access, self-hosted public application: https://developers.cloudflare.com/cloudflare-one/applications/configure-apps/self-hosted-public-app/
- [CF10] Workers static assets billing: https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- [GH1] GitHub Pages limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- [GH2] About GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages
- [GH3] Changing the visibility of a GitHub Pages site: https://docs.github.com/en/pages/getting-started-with-github-pages/changing-the-visibility-of-your-github-pages-site
- [GH4] GitHub's plans: https://docs.github.com/en/get-started/learning-about-github/githubs-plans
- [NL1] Netlify credit-based pricing plans: https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
- [NL2] Netlify pricing: https://www.netlify.com/pricing/
- [NL3] Netlify project visibility / password protection: https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility/ and https://docs.netlify.com/manage/security/secure-access-to-sites/password-protection/
- [NL4] Netlify Basic auth with custom headers: https://docs.netlify.com/manage/security/secure-access-to-sites/basic-authentication-with-custom-http-headers/
- [VC1] Vercel limits: https://vercel.com/docs/limits
- [VC2] Vercel fair use guidelines (Hobby allotments + commercial usage definition): https://vercel.com/docs/limits/fair-use-guidelines
- [VC3] Vercel deployment protection: https://vercel.com/docs/deployment-protection
- [IT1] itch.io HTML5 docs: https://itch.io/docs/creators/html5
- [IT2] itch.io creator FAQ: https://itch.io/docs/creators/faq

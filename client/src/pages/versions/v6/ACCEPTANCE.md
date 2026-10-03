# Version 6 acceptance

Version 6 is every section of the live homepage, redrawn on the Version 5 system.
It is accepted by the same script as Version 5, `scripts/qa/homepage-v5-acceptance.mjs`,
with the limits that belong to a page of eighteen sections instead of ten. The checks
and the mistakes they guard against are the ones listed in `../v5/ACCEPTANCE.md`; the
differences are below.

## What changes for Version 6

- **Scope.** The page is scoped under `.v6` and its primary action carries
  `data-v6-cta="primary"`, so the script runs with `--scope v6`.
- **Section order.** Read from the eyebrow labels, in the live homepage's order:
  Why we exist · Why it matters · Problems we solve · How to work with us · What we protect ·
  Client proof · Why Arizona businesses work with us · The people behind your technology ·
  Who we work with · Pricing · Security updates · Cyber Risk Assessment · Questions · Contact.
- **Length.** At most 2,000 words and 16 desktop viewports (26 tablet, 42 phone). The live
  homepage is 23 desktop viewports; Version 5 is 7. The length follows from the section
  count Joe asked for; trimming sections is his call, not the script's.
- **Figures.** Besides the pricing, SLA, contact and guarantee sources, a figure may come
  from `client/src/data/cyberAwarenessFacts.ts` (the four sourced statistics), the live
  contact section (office hours) and the live threats section (the 45-day window).
- **Live feeds.** Reviews and security updates render only what `/api/public/reviews` and
  `/api/public/threats` return; when a feed is empty the page says so. The local run has no
  Google key and no feed cache, so the frames show the empty states.
- **Forms.** The assessment, contact and newsletter forms post to the same endpoints the
  live homepage uses (`/api/assessment`, `/api/contact`, `/api/newsletter`). The script does
  not submit them.

## How to run it

```bash
npm run build
NODE_ENV=production DE_SMOKE_ALLOW_MEMORY_ONLY=1 JWT_SECRET=$(openssl rand -hex 32) \
  MFA_ENCRYPTION_KEY=$(openssl rand -hex 32) SESSION_SECRET=$(openssl rand -hex 32) \
  PORT=4173 node dist/index.js &
node scripts/qa/homepage-v5-acceptance.mjs --url http://localhost:4173/version-6 \
  --out artifacts/visual-qa/homepage-v6 --scope v6 --max-words 2000 --max-viewports 42,26,16 \
  --sections "Why we exist,Why it matters,Problems we solve,How to work with us,What we protect,Client proof,Why Arizona,The people,Who we work with,Pricing,Security updates,Cyber Risk Assessment,Questions,Contact" \
  --facts client/src/data/cyberAwarenessFacts.ts,client/src/pages/sections/DigeratiContactSection.tsx,client/src/pages/sections/DigeratiThreatsInsightsSection.tsx
```

Exit code 1 on any failure. Frames and `REPORT.md` land in `--out`.

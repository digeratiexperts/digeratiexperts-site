# Version 6 acceptance

Version 6 is the live homepage, cleaned in the **current DE theme** (graphite
`#050312`, paper `#F7F5F2`, magenta `#D3126A`). It is not Version 5's paper
system. Version 7 is a separate reviewed-mockups build; ChatGPT's other-theme
board is not in this page.

Version 5 stays frozen at `/version-5`. Production `/` is untouched.

It is checked by `scripts/qa/homepage-v5-acceptance.mjs` with `--scope v6`.

## What changes for Version 6

- **Scope.** The page is scoped under `.v6` and its primary action carries
  `data-v6-cta="primary"`.
- **CTA.** Canonical `Get My Cyber Risk Assessment` from `client/src/lib/ctaCopy.ts`.
- **Section order.** Read from the eyebrow labels, in the live homepage's order:
  Why we exist · Why it matters · Problems we solve · How to work with us · What we protect ·
  Client proof · Why Arizona businesses work with us · The people behind your technology ·
  Who we work with · Pricing · Security updates · Cyber Risk Assessment · Questions · Contact.
- **Length.** At most 2,000 words and 16 desktop viewports (26 tablet, 42 phone).
- **Figures.** Prices, SLA, contact, guarantee sources, plus
  `client/src/data/cyberAwarenessFacts.ts`, office hours, and the 45-day threat window.
  Do not use ChatGPT mock figures (73%, $4.88M, B+ scores, $20,000 pen-test offer).
- **Live feeds.** Reviews and security updates render only what the public APIs return.
- **Forms.** `/api/assessment`, `/api/contact`, `/api/newsletter`.
- **Hero.** Live-better DashboardMockup and compact pronunciation stay; founder photo
  remains in the people section only.

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

# Version 5: how we know it is done

Joe, 2026-09-30: "start over, make something better. dont make these mistakes.
make a way to know you will be successful and not fail."

The three mistakes, and the check that catches each one before Joe sees the page.
`scripts/qa/homepage-v5-acceptance.mjs` runs every check against a served
production build at three screen sizes, with and without reduced motion, and
fails the build on any one of them. It also writes the frames a human reviews.

## 1. Novelty over use

A prospect comparing three MSPs wants what, for whom, what it costs and who to
call, in about ten seconds.

- Above the fold on a 390px phone and a 1440px desktop: the H1 (one sentence,
  twelve words or fewer), the words "managed IT" or "cybersecurity", the word
  "Arizona", the one primary action, and a phone number you can tap.
- One primary action on the whole page: every primary button goes to the same
  place with the same words.
- Conventional order: what we do, who we work with, how it works, pricing,
  response times, questions, contact.
- At most 1,200 words; at most 9 viewports tall on desktop, 14 on a phone.
- No video, no iframe, no animation of any kind (checked with `getAnimations()`),
  native scrolling (an 800px wheel moves the page 800px).

## 2. Abstraction instead of the real material

- Every figure on the page (a price, a percentage, a duration, "24/7/365")
  must appear verbatim in one of the files the rest of the site already trusts:
  `client/src/data/pricing.ts`, `client/src/pages/legal/SLA.tsx`,
  `shared/companyContact.ts`, `client/src/pages/about/Guarantee.tsx`.
  Anything else fails the run. The page also imports its prices and contact
  details from those files, so it cannot drift from them.
- Every internal link answers 200 on the served build. Every external link is
  https.
- Every image is the founder's approved photograph or a brand mark, loads, and
  has a description. No generated imagery, no stock photography.

## 3. Reports instead of the page

- The run writes frames at the top, 25%, 50%, 75% and the end of the page at
  390, 768 and 1440, plus a full-page frame, to `artifacts/visual-qa/homepage-v5/`.
  The person building the page looks at every frame before showing it.
- What Joe receives is the frames and one line, not a document about the page.

## Also, because it has to be nice

- No horizontal scroll at any width.
- Body copy at least 15px; buttons, chips and menu items at least 44px tall.
- Every piece of text meets WCAG AA contrast on the background it actually sits
  on (computed from the rendered page, not from the palette).
- Same-origin transfer under 1.5 MB. No console errors.
- The server answers `/version-5` with `X-Robots-Tag: noindex, nofollow`, so the
  preview never competes with `/` in search.

## What the script cannot check

Whether the page reads well, whether the photograph is cropped kindly, whether
the copy sounds like DE. That is the human review of the frames, and Joe's.

## How to run it

```bash
npm run build
NODE_ENV=production DE_SMOKE_ALLOW_MEMORY_ONLY=1 \
  JWT_SECRET=$(openssl rand -hex 32) MFA_ENCRYPTION_KEY=$(openssl rand -hex 32) SESSION_SECRET=$(openssl rand -hex 32) \
  PORT=4173 node dist/index.js &
node scripts/qa/homepage-v5-acceptance.mjs --url http://localhost:4173/version-5 --out artifacts/visual-qa/homepage-v5
```

The server must run in production mode: in development mode Vite serves
unminified modules from `/@fs/` paths, which fails the image, transfer-size and
console checks for reasons that have nothing to do with the page. The three
secrets are throwaway values for the local run; the memory-only flag is the
same one CI's smoke test uses. Google Fonts do not load inside the build
sandbox, so the frames there show the fallback face; the checks do not depend
on the webfont.

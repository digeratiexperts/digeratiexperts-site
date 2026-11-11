# Reviews and referrals playbook (2026-11-11)

Why: every top MSP site we compared puts a star rating, named reviews or a featured client story
near the first button. digeratiexperts.com has none yet. The website side is now ready
(homepage rating chip + reviews section that appear only when real reviews exist); what is
missing is the reviews themselves. Nothing here is automated or sent by an agent: every
outbound message goes out from DE, by a person, after Joe approves the wording.

## 1. Make the review path work (Joe, one time)

- [ ] Google Business Profile: confirm reviews are turned on for the listing
  (docs/GOOGLE-REVIEWS.md notes Maps showed "Posting is currently turned off").
- [ ] Review link: `https://g.page/r/Ceszh2zJLr4XEBM/review` (already on the site, with a QR at
  `/images/reviews/google-review-qr.svg`). Test it from a phone that is not signed in as DE.
- [ ] Live rating on the site: either set a Places-valid `GOOGLE_PLACE_ID` (`ChIJ…`) in the
  production env, or paste verbatim reviews into `client/src/data/reviewsCatalog.ts`. The current
  production Place ID is the one the docs call invalid, so the API returns no rating today.
- [ ] Social profiles: only x.com/DigeratiExperts is live. The LinkedIn company URL 404s and the
  Instagram handle has no account. Create or fix them first, then add them back to
  `PUBLIC_SOCIAL_LINKS` in `shared/companyContact.ts` (footer + schema `sameAs`).

## 2. Ask at the right moments

| Moment | Who asks | How |
|--------|----------|-----|
| A ticket closes with a happy reply | The tech who fixed it | Reply with the review link (template A) |
| 30 days into a new ProActive client | Joe | Personal email (template B) |
| Quarterly business review | Account owner | Ask in person, show the QR code |
| A client thanks you unprompted | Whoever got the thanks | Same day, template A |

Ask everyone, not only the happiest clients, and never offer anything in exchange for a
review (Google's policy, and the FTC rule on consumer reviews).

## 3. Referrals

- Ask existing clients one question at the QBR: "Who else do you know who's fed up with their IT?"
- Make the hand-off easy: the 15-minute fit call link and the Switching IT providers page
  (`/solutions/switching-it-providers`).
- Any referral reward needs Joe's decision first and must be published accurately before use.

## 4. Case studies

- One or two clients willing to be named, with written approval of the final text.
- Paste approved stories into `publishedCaseStudies` in `client/src/data/caseStudies.ts`; the
  public page shows nothing until then.

## Templates (drafts for Joe to approve)

**A. After a fixed ticket**

> Glad that's sorted. If we earned it, a quick Google review helps other Arizona businesses find
> us: https://g.page/r/Ceszh2zJLr4XEBM/review. Thanks either way.

**B. 30 days in**

> Subject: How are we doing?
>
> Hi {first name}, it's been a month since we took over your IT. I'd value your honest take,
> good or bad: just reply to this email. And if we've been worth it, a short Google review goes a
> long way: https://g.page/r/Ceszh2zJLr4XEBM/review
>
> Joe

# Client reviews (Google + Yelp + Thumbtack feed)

The homepage **Client Proof** section loads a single carousel feed from:

1. **Live Google Places** — when `GOOGLE_PLACE_ID` is a Place Details–valid `ChIJ…`
2. **Live Yelp Fusion** — when `YELP_API_KEY` + `YELP_BUSINESS_ID` are set (optional)
3. **Curated catalog** — verbatim pastes in `reviewsCatalog.ts` plus source files:
   - `client/src/data/yelpReviewsManual.ts`
   - `client/src/data/thumbtackReviewsManual.ts`
   - Google pastes in `reviewsCatalog.ts` (`googleManualReviews`)

Thumbtack has no public reviews API — catalog paste only. Failed APIs are omitted; the UI never shows raw errors.

APIs:

| Endpoint | Purpose |
|----------|---------|
| `GET /api/public/reviews` | Aggregated multi-source feed (preferred for UI) |
| `GET /api/google-reviews` | Legacy Google-only Places payload (still maintained) |

Reviews are **never invented**. Empty catalog + no live Places data → honest empty state (no fake 5-star row).

---

## Service-area reality check (Digerati Experts)

Digerati Experts is a **verified service-area** Google Business Profile (no public storefront pin). For this listing:

| Approach | Result |
|----------|--------|
| Place ID Finder / Places Text Search / Autocomplete | **Fails** — often zero results or wrong “Digerati*” storefronts |
| Maps feature ID / CID alone | Confirms the listing in Maps; **cannot** fetch reviews via Places API |
| Maps-derived `ChIJ…` tried previously | Place Details **`NOT_FOUND`** / no longer valid |
| Maps UI | “Posting is currently turned off” / contributions not permitted for this place type |

**Practical paths that work today:**

1. **Manual paste (interim)** — copy real reviews into `reviewsCatalog.ts` (see below).
2. **GBP Business Profile API** — OAuth + account/location resource (separate project; not Places Place Details).
3. **Storefront address on GBP** — if/when Google exposes a Places-valid `placeid=ChIJ…`, set `GOOGLE_PLACE_ID`.

Do **not** set an invalid `GOOGLE_PLACE_ID` just to silence `unconfigured`.

---

## Zoho One — what helps (and what does not)

| Product | Website review display? | Use it for |
|---------|-------------------------|------------|
| **SalesIQ** | **No** | Live chat / visitor tracking (DE Desk already uses advisor path) |
| **Zoho Social** | **No** public embed API | Reply to Google reviews / post to GBP from Social |
| **Zoho Publish** | **No** reliable public site feed | Monitor/respond to Google (+ other platforms); Desk ticket conversion |
| **Zoho Desk / CRM** | **No** | Tickets / CRM only |

**Do not** expect SalesIQ or Publish to populate the homepage. Site truth = Places live (when valid) + `reviewsCatalog.ts`. Use Publish/Social only for *responding* to reviews in Google Business Profile.

---

## Paste reviews into the catalog

File: [`client/src/data/reviewsCatalog.ts`](../client/src/data/reviewsCatalog.ts)

```ts
export const reviewsCatalog: CatalogReview[] = [
  {
    source: "google", // or "yelp" | "thumbtack" | "facebook" | "clutch" | "other"
    authorName: "Exact name from the platform",
    rating: 5,
    text: "Exact review body — verbatim",
    relativeTime: "3 months ago",
    url: "https://maps.google.com/?cid=1710856351091471339", // optional
  },
];
```

Yelp / Thumbtack: paste into the source-specific files (same shape). Leave arrays empty until verbatim copy is approved — do not invent quotes. Optional listing URLs: `YELP_LISTING_URL`, `THUMBTACK_LISTING_URL` in `reviewsCatalog.ts`.

**How to paste Google reviews:**

1. Open GBP → **Read reviews** (or Maps CID URL below).
2. Copy author name, star rating, and review body exactly.
3. Add objects to `reviewsCatalog`; commit/deploy.
4. Never invent or paraphrase into fake quotes.

[`googleReviewsManual.ts`](../client/src/data/googleReviewsManual.ts) re-exports the merged catalog for older imports. Paste Yelp/Thumbtack into their manual files; Google pastes stay in `reviewsCatalog.ts`.

Maps CTA (CID): `https://maps.google.com/?cid=1710856351091471339`

---

## Live Places path (when available)

| Variable | Where | Purpose |
|----------|--------|---------|
| `GOOGLE_PLACES_API_KEY` | `/home/digeratiexperts.com/shared/.env` (prod) or local `.env` | Google Cloud API key with **Places API** enabled |
| `GOOGLE_PLACE_ID` | same | Place Details–valid `ChIJ…` only |
| `GOOGLE_MAPS_CID` | same | Optional decimal CID for maps links. **Not** a substitute for Place ID |
| `YELP_API_KEY` | same | Optional Yelp Fusion key (`YELP_FUSION_API_KEY` alias) |
| `YELP_BUSINESS_ID` | same | Yelp business id for `/v3/businesses/{id}/reviews` |

Aliases: `GOOGLE_MAPS_API_KEY` / `GBP_API_KEY` / `PLACES_API_KEY` and `GBP_PLACE_ID` / `PLACES_PLACE_ID`.

### Finding Place ID (service-area)

Place ID Finder usually **fails** for this listing type.

**Do not** use:

- GBP Manager **store code** as `GOOGLE_PLACE_ID`
- Phone-only Find Place matches
- Hex feature IDs / CID as `GOOGLE_PLACE_ID`
- Previously rejected Maps-derived `ChIJu8WOnBIsw28R6zOHbMkuvhc`

**If Google later exposes a valid `ChIJ…`:**

1. Business Profile Manager → **See your profile** / **Ask for reviews**
2. Copy `placeid=ChIJ…` / `query_place_id=ChIJ…` from the URL
3. Set `GOOGLE_PLACE_ID` in shared `.env` and restart/redeploy
4. Verify with curl below

### Investigation note (2026-08-11)

| Token | Value | Result |
|-------|--------|--------|
| Feature id | `0x0:0x17be2ec96c8733eb` | Confirms listing in Maps |
| Decimal CID | `1710856351091471339` | `GOOGLE_MAPS_CID` / Client Proof CTA |
| Maps-derived ChIJ | `ChIJu8WOnBIsw28R6zOHbMkuvhc` | **Rejected** by Place Details — do not set |

There is **no supported CID→reviews** path on the official Places API. Scraping Maps HTML is not implemented.

### API key

1. Google Cloud Console → enable **Places API**
2. Create key; restrict by **IP** `192.227.158.46` (server-side — not HTTP referrer)
3. Set `GOOGLE_PLACES_API_KEY` in shared `.env`; restart site service

---

## Verify

```bash
curl -fsS https://digeratiexperts.com/api/public/reviews | jq .
curl -fsS https://digeratiexperts.com/api/google-reviews | jq .
```

| ` /api/public/reviews` status | Meaning |
|-------------------------------|---------|
| `empty` | No live Google reviews and empty catalog |
| `ok` | Live Google and/or catalog entries present |
| `partial` | Both live Google and catalog entries merged |

| ` /api/google-reviews` status | Meaning |
|-------------------------------|---------|
| `unconfigured` | Missing key and/or Place ID |
| `ok` | Live Google reviews |
| `empty` | Credentials work; Google returned no review text |
| `error` | Places API / key / Place ID problem |

---

## UI behavior

1. **With reviews** — one carousel feed (auto-advance, pause on hover, no autoplay when `prefers-reduced-motion`), source pills, optional All / Google / Yelp / Thumbtack chips, Maps CTA.
2. **Empty** — no filled decorative 5-star row; “Read us on Google” + honest copy. Empty Yelp/Thumbtack sources are omitted until data exists.
3. Live Google (then live Yelp) merge first; catalog fills other sources / interim pastes.
4. API failure → client falls back to the local catalog. Never render “API unavailable.”

## Follow-up (out of scope here)

- GBP Business Profile API OAuth for automated pull without Place ID
- Third-party review widgets (Elfsight, etc.) — only if DE chooses a vendor

---

## Asking for reviews (QR + link)

`GOOGLE_REVIEW_URL` in `reviewsCatalog.ts` is the GBP "Ask for reviews" link (`https://g.page/r/Ceszh2zJLr4XEBM/review`). `client/public/images/reviews/google-review-qr.svg` encodes it (generated with the repo's `qrcode` package, decode-verified 2026-10-07). Both appear in the homepage Client Proof reviews panel and the portal dashboard ("Review DE on Google"). If the GBP review link ever changes, regenerate the SVG and update the constant together.

2026-10-07 re-check: GBP is verified with 0 reviews; Places Place Details still returns `NOT_FOUND` for the listing's `ChIJu8WOnBIsw28R6zOHbMkuvhc` (the same ID GBP's own review link resolves to), and Places API (New) is blocked on the server key. The service-area guidance above still holds.

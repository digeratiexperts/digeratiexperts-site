# SEO growth, discoverability & email warmup (Website · Store · Portal)

Scope: **digeratiexperts.com**, **store**, **portal.digeratiexperts.com** only. Not TechSales Hub.

## What the codebase now does

| Area | Status |
|------|--------|
| Sitemap includes public store product URLs; **excludes portal** | Automated via `npm run sitemap` |
| Portal / checkout noindex (meta + `X-Robots-Tag`) | Server + client |
| GA4 + Clarity + Meta Pixel + LinkedIn + **Bing UET** | Consent-gated; IDs via `VITE_*` |
| Google / Bing site verification meta | Via `VITE_GOOGLE_SITE_VERIFICATION` / `VITE_BING_SITE_VERIFICATION` |
| CSP allows Facebook / LinkedIn / Bing / GA | `server/middleware/security.ts` |
| SPA `page_view` on route change | `App.tsx` |
| ZeptoMail `List-Unsubscribe` on marketing/newsletter mail | `notificationService.ts` |
| `llms.txt` + press page for AI/media discovery | Public assets |

**Honest limit:** Code cannot create “enormous” traffic or real backlinks by itself. Google/Bing/Facebook need console verification, pixels IDs, citations, and content you publish. Buying spam backlinks will hurt you—do not.

---

## Env vars to set (VPS `shared/.env` + rebuild)

Frontend values are **build-time** (`VITE_*`). After changing them, redeploy so Vite bakes them in.

```bash
VITE_CLARITY_ID=fwts8lj42i          # already in example
VITE_META_PIXEL_ID=                 # Meta Events Manager → Pixel ID
VITE_BING_UET_TAG_ID=               # Bing Ads → UET tag
VITE_LINKEDIN_PARTNER_ID=           # LinkedIn Campaign Manager Insight Tag
VITE_GOOGLE_SITE_VERIFICATION=      # Search Console HTML tag content=
VITE_BING_SITE_VERIFICATION=        # Bing Webmaster msvalidate.01 content=
ZEPTOMAIL_API_TOKEN=                # transactional + confirmations (already used)
ADMIN_EMAIL=admin@digeratiexperts.com
```

---

## Search consoles (you click these once)

1. **Google Search Console** → add `https://digeratiexperts.com` → HTML tag → paste into `VITE_GOOGLE_SITE_VERIFICATION` → deploy → verify → Submit sitemap `https://digeratiexperts.com/sitemap.xml`
2. **Bing Webmaster Tools** → Import from Google or HTML meta → `VITE_BING_SITE_VERIFICATION` → deploy → submit same sitemap
3. Confirm **portal** host is **not** submitted as a property to rank (or add it only to monitor and leave noindex)

---

## Traffic we want vs don’t want

**Want:** Arizona SMB owners/managers searching managed IT, HIPAA IT, ransomware recovery, co-managed IT, cyber insurance readiness, Chandler/Phoenix MSP.

**Don’t want:** Portal login ranking, cart/checkout indexed, affiliate spam, overseas “cheap IT” tire-kickers, bot scrapers on `/api/`.

Controls: `robots.txt` Disallow for `/portal/`, `/api/`, checkout/cart; sitemap excludes those; `X-Robots-Tag: noindex` on portal + transactional store paths.

---

## Email provider & warmup (spam filters)

**Provider in app code: ZeptoMail** (`ZEPTOMAIL_API_TOKEN`), from `noreply@digeratiexperts.com`. Zoho is used for CRM/Desk/SSO—not the Node transactional sender.

### DNS you must confirm at digeratexperts.com (and Zoho/Zepto dashboards)

| Record | Purpose |
|--------|---------|
| SPF | Include ZeptoMail **and** Zoho Mail senders you actually use |
| DKIM | ZeptoMail domain key + Zoho if sending from Zoho |
| DMARC | Start `p=none` with rua reports → move to `quarantine` then `reject` when clean |
| BIMI (optional) | After DMARC enforcement |

Check: [MXToolbox](https://mxtoolbox.com/SuperTool.aspx) SPF/DKIM/DMARC for `digeratiexperts.com`.

### Warmup (cannot be faked in git)

1. Send only transactional + double-opt-in / confirmation first (assessment, ticket, quote, verify email).
2. Keep daily volume low and **ramp** over 2–4 weeks; no sudden blasts.
3. Prefer engaged recipients (booked assessment, clients). Never buy lists.
4. Monitor ZeptoMail bounce/complaint rates; pause if spikes.
5. Keep From/Reply-To on authenticated domain; avoid URL shorteners in first weeks.
6. Marketing newsletters only after SPF/DKIM/DMARC pass and List-Unsubscribe works (now in code).

---

## Legitimate backlinks & citations (manual, high quality)

Do these yourself or with a real PR partner—**no PBN / paid spam links**.

1. **Google Business Profile** — claim Chandler NAP exactly as on site (street in JsonLd).
2. **Bing Places** — same NAP.
3. **Apple Business Connect** if eligible.
4. **Industry directories:** Clutch, G2 (if ready), MSP associations, Arizona Chamber / local biz directories with consistent NAP.
5. **Partner / vendor listings:** Microsoft Partner directory (if enrolled), security vendor partner pages.
6. **Local sponsorships / chamber / nonprofit tech help** → real mentions.
7. **Guest expertise:** Arizona biz journals, healthcare association newsletters—one strong article beats 100 garbage links.
8. **Press page:** `https://digeratiexperts.com/about/press` — give journalists a single canonical source.
9. **Unlinked mentions** → polite ask for a link to the relevant solution page (not homepage always).

Track referrals in GA4; ignore vanity “DA” sellers.

---

## Facebook / Bing / Google “finding us”

| Platform | Action |
|----------|--------|
| Google | GSC + sitemap + GA4 (live) |
| Bing | Webmaster + UET ID in env |
| Meta | Pixel ID in env + Events Manager domain verification |
| LinkedIn | Partner ID in env |
| Clarity | Session heatmaps when `VITE_CLARITY_ID` set at build |

Without the IDs in production build env, scripts stay off—by design.

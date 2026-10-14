# Contact details audit: business phone and address

Status: **inventory only, no value changed.** DE will supply the address and
phone values; this file says where each one lives so the change can be made in
one pass. Taken on `main` 7b1b4197, 2026-10-10 (DE backlog T7, item 66).

## Current values

| Value | Form | Where it is defined |
|---|---|---|
| Phone | `325-480-9870` (display) | `shared/companyContact.ts` `PRIMARY_PHONE.display` |
| Phone | `tel:+13254809870` (link) | `PRIMARY_PHONE.telHref` |
| Phone | `+13254809870` (E.164) | `PRIMARY_PHONE.e164` |
| Phone | `+1-325-480-9870` (schema.org) | `PRIMARY_PHONE.schemaTelephone`; also typed in `client/index.html` and `public/llms.txt` |
| Address | Chandler, AZ, US (city only) | `COMPANY.addressLocality` / `addressRegion` / `addressCountry`; `formatAddressOneLine()` returns "Chandler, AZ" |
| Map | `https://maps.google.com/?cid=1710856351091471339` | `COMPANY.mapsUrl` |
| Geo | 33.3062, -111.8413 | **not** in `companyContact.ts`: typed in `JsonLd.tsx` and `LocationServicePage.tsx` |

`shared/companyContact.ts` records the rule: "Public NAP is city only (Joe,
2026-10-07): no street or ZIP anywhere on the site." `client/src/data/companyContact.ts`
re-exports it for the client.

## Where they appear

### 1. Change the constant, and these follow

Everything below reads `PRIMARY_PHONE`, `COMPANY` or `formatAddressOneLine()`,
directly or through a derived constant. Changing `shared/companyContact.ts`
updates them all.

- **Header and chrome:** `MegaMenu.tsx` (desktop utility row and mobile drawer), `HomepageSectionNav.tsx`, `SiteBottomBar.tsx`, `StickyCTABar.tsx`, `ConversionPathBar.tsx`, `ExitIntentPopup.tsx`, `PremiumCTASection.tsx`, `ZohoASAPWidget.tsx` (Ask DE), `ZohoBookingWidget.tsx`, `BookingModal`/`BookingPage`.
- **Footer:** `sections/DigeratiFooterSection.tsx` (phone). The live footer, `DigeratiEnhancedFooterSection.tsx`, shows no phone; see section 2 for its city text.
- **Pages:** Contact (including its SEO description), ThankYouSuccess (with the map link), about/Guarantee, MissionValues, Team, TwentyOneQuestions, Press, every industry page with a call line, campaign landings, location pages (`LocationServicePage.tsx`), solutions (`BusinessNeedsIndex`, `OfficePage`), support (KnowledgeBase, PayInvoice, RemoteSupport, SubmitTicket, TicketConfirmation), trust (Accessibility, TrustCenter), Store (ManagedStore, ProductDetail, StoreLanding, cart, configure drawer, assessment panel, Door 2 primitives, print frame, offline panel), the quiz room shell, and every homepage section that offers a call (`sections/*`, `versions/v1`, `v3`, `v5`, `v6`, `v7`, `v8`).
- **Legal pages (phone):** PrivacyPolicy, TermsOfUse, MSA, AUP, DPA, SLA, SampleSOW.
- **Portal:** PortalCreateTicket, PortalCytracom, PortalInfrastructure, PortalSelfService; the account team card (`AccountTeamCard.tsx`, via `shared/accountManagers.ts`) on the dashboard, order detail and Store confirmations.
- **Schema / JSON-LD:**
  - `JsonLd.tsx`: Organization `contactPoint.telephone` and LocalBusiness `telephone`.
  - `LocationServicePage.tsx`: LocalBusiness telephone and address.
  - `about/Press.tsx`: telephone.
- **Emails:** `server/deskTicketFallback.ts` (HTML and text: "call …"). The shared email footer (`baseEmailTemplate` in `notificationService.ts`) carries neither phone nor address.
- **PDFs:**
  - `server/pdf/dePdfBrand.ts`: the close block, and the account team row via `accountManagers.ts`. Used by the Store quote, order, receipt and solution packet.
  - `scripts/de-documents/system/components.mts`: `CONTACT` in the 13 resource PDFs under `client/public/assets/resources/**`. Those PDFs are generated files, so rebuild them with `npm run documents:build` after the constant changes.
- **Server and assistant:**
  - `server/services/msp-advisor/knowledge.ts` (`DE_COMPANY`): the advisor prompt, fallback and call action.
  - `server/portalAuthStore.ts`, `server/widgetTicketRoute.ts`.
  - `shared/kbSeed.ts`.

### 2. Typed directly, so each must be changed by hand

| File:line | Shows | As written |
|---|---|---|
| `client/index.html:69-74` | phone + address (JSON-LD ProfessionalService) | `+1-325-480-9870`; Chandler / AZ / US |
| `client/src/components/JsonLd.tsx:60-68` | address + geo (LocalBusiness) | Chandler / AZ / US; 33.3062, -111.8413 |
| `client/src/pages/locations/LocationServicePage.tsx:126-127` | geo | 33.3062, -111.8413 |
| `client/src/pages/about/Press.tsx:8-14` | city, region (local `NAP`) | Chandler / AZ |
| `client/src/pages/legal/PrivacyPolicy.tsx:358` | address line | `Address: Chandler, AZ` |
| `client/src/pages/legal/TermsOfUse.tsx:436` | address line | `Address: Chandler, AZ` |
| `client/src/pages/legal/MSA.tsx:75` | address line | `Address: Chandler, AZ` |
| `client/src/pages/sections/DigeratiEnhancedFooterSection.tsx:145, 258` | live site footer, city | "Chandler, Arizona" |
| `client/src/components/MegaMenu.tsx:396, 1113` | city | "Chandler, AZ team", "Chandler, Arizona" |
| Contact sections (`sections/DigeratiContactSection.tsx:220`, v1/v3 `:195`, v7 `16-contact-footer.tsx:476`, v8 `:474`) | city | "Located in the heart of Chandler" |
| `public/llms.txt:29, 31` | phone + **full street address** | `+1-325-480-9870`; `3165 S Alma School Rd Suite 29, Chandler, AZ 85248` |
| `public/v2/**`, `public/scrollcraft/{quiet-pages,version-b,situation-gallery}/index.html` | phone, city | `325-480-9870`, "Chandler, AZ" (published static prototypes) |
| `document_templates/templates/{docx,pdf}/*`, `document_templates/original/*` | **retired phone** | "Primary Contact (Digerati): admin@digerati-experts.com \| (480) 519-5892" (MSA, NDA, order form and the SOWs; binary files) |

The about, location and industry pages also mention the city in prose, for
example "Chandler-based", "Chandler, Arizona HQ", "served from our Chandler
office" and "Chandler / East Valley". This copy describes where DE works and
is not a contact block. The search agent's file list for it is in the PR body.

### 3. Not served, for reference

- `scrollcraft/builds/de-v2/index.html:333` and `pages/contact.html:27` (prototype source) carry the street address. Their published copies under `public/v2` are city only.
- `scrollcraft/builds/de-v2/BRIEF.md:134-135`, `docs/CLAIMS-REGISTER.md:102` and `artifacts/design-concepts/homepage-sections-2026-10/CONTENT-INVENTORY.md:577` carry the street address. `attached_assets/*` carries the retired number.

## Tests that pin the values

If a value changes, these tests must change with it:

- `client/src/data/companyContact.test.ts` pins every phone form, Chandler/AZ and the map link.
- `shared/publicPhone.test.ts`:
  - pins the display value;
  - fails if the retired 480-519-5892 appears in `client/src`, `server` or `shared` source;
  - allows the literal number only in allowlisted files.

  It does **not** scan `document_templates/`, `public/` or `.html`, so it cannot catch the issues in section 2.
- `server/services/msp-advisor/msp-advisor.test.ts:359` matches the number literally.

## Inconsistencies for DE

1. **Street address published against the city-only rule.** `public/llms.txt:31` is served at `/llms.txt` and gives the street and ZIP. Nothing else served does.
2. **Retired phone in every contract template.** The `document_templates` MSA, NDA, order form and SOWs list (480) 519-5892 and `admin@digerati-experts.com`.
3. **Literals beside the constant.** The schema address and geo in `client/index.html` and `JsonLd.tsx`, the three legal "Address:" lines, and `Press.tsx` would not follow a change to `companyContact.ts`.
4. **Email addresses differ next to the phone.** The site uses `info@digeratiexperts.com`, account cards use `sales@digerati-experts.com`, and the templates use `admin@digerati-experts.com`. Out of scope here; listed for completeness.

## Not changed

No phone number or address was changed. DE will supply the values. Once DE
does, the order is: `shared/companyContact.ts`, then the section 2 literals,
then the tests above, then the resource PDF rebuild.

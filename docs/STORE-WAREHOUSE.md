# DE Digital Warehouse

**Status:** Staff ops console on website `main` after merge (MERGED ≠ LIVE until production SHA is verified).  
**Staff identity this phase:** live portal `role === "admin"`. Ordinary authenticated clients are denied.  
**Portal login:** `https://portal.digeratiexperts.com/portal/login`

## What this is

The **DE Digital Warehouse** is a **staff ops console** at `/internal/warehouse` — SKU workshop, Hub catalog feed, quotes, Pay Now checkout, and vendor/connector status. It is **not** the public Store and must not look or behave like a client storefront.

| Surface | Route | Auth |
| --- | --- | --- |
| Warehouse ops home | `/internal/warehouse` | Live `admin` at route **and** APIs |
| SKU workshop | `/internal/warehouse/co-managed`, `/managed`, `/product/:sku` | Live `admin` |
| Hub catalog feed | `/internal/warehouse/hub-catalog` | Live `admin` → `/api/internal/warehouse/catalog` |
| Vendors & connectors | `/internal/warehouse/vendors` | Live `admin` → `/api/internal/warehouse/connectors` |
| Quotes / checkout | `/internal/warehouse/quote-*`, `/checkout` | Live `admin`; Pay Now = `pay_now` only |
| Public curated Store | `/store`, `/store/solutions/:family`, `/store/solution`, … | Public Solution Builder — no vendor catalog, no Pay Now, no Hub staff cost |
| Legacy catalog paths | `/store/managed`, `/store/co-managed` | 301 to the appropriate public solution path |
| Staff-only SKU URLs | `/store/product/:sku` except four ProActive models | Generic 404 — same body as unknown, no `Location` |
| Client Marketplace | `/portal/marketplace` | Authenticated client; live `admin` sees a notice pointing at `/internal/warehouse` |

## Staff IA (not Door 2)

- Shell: `WarehouseShell` + MegaMenu; section nav (Ops home · SKU catalog · Managed packages · Hub feed · Vendors · Quotes · Checkout).
- Landing: `WarehouseHome` — ops cards and workshop counts. The old guided buyer `StoreLanding` is **not** mounted in the warehouse.
- Shell chrome shows Hub catalog + Pax8 health (CONNECTED / STALE / FAILED / AUTH_REQUIRED / LOCAL_WORKSHOP / UNKNOWN). Never invent healthy.
- SKU catalog, cart, and checkout copy is internal (workshop / Pay Now / staff quote). Electric accent + category pills + vendor marks stay (Joe-decided warehouse color lock). Public Store does not get those pills.

## How staff open it

1. Sign in at `https://portal.digeratiexperts.com/portal/login`.
2. Open `/internal/warehouse`.
3. An admin bookmark to `/store` 302s into the warehouse. Unauthorized users never receive `Location: /internal/...`.
4. To walk the public Store as a buyer while signed in (internal visual QA), open `/store?as=buyer`: it sets the `de_store_preview` cookie (httpOnly, 8 hours) and the `/store` redirect stops for that browser. `/store?as=staff` clears it and returns to the warehouse. The cookie only relaxes that redirect for a request that is already staff; a buyer who sets it by hand sees what they saw before (`server/warehouseRoutes.test.ts`).

## Authorization

- JWT proves the session. The **live** portal record is authoritative (`role === "admin"`).
- Catalog-bearing APIs (`/api/store/solutions/*`, `/api/store/cart/*`, `/api/internal/warehouse/catalog`, `/api/internal/warehouse/connectors`) return generic `{ error: "Not found" }` unless staff.
- Unauthorized warehouse HTML is a generic 404. Do not reveal whether a SKU, vendor, or price exists.

## Hub projection (ECO-014)

- Hub: `GET /api/integrations/v1/staff-catalog` (HMAC `website_to_hub`) — canonical tiers + `SKU_CATALOG` including internal unit cost.
- Website staff proxy: `GET /api/internal/warehouse/catalog` — never expose this to Door 2.
- If Hub is unreachable: status `LOCAL_WORKSHOP` (honest). Workshop `storeProducts.ts` remains the temporary quoting feed until cutover is verified.
- Public catalog stays `GET /api/integrations/v1/public-catalog` (tiers only, no staff cost).

## Vendor APIs

- Connectors live in Hub `de-sync`, not in the website.
- Pax8 scaffold: `GET /api/integrations/v1/connectors/pax8/health` → `AUTH_REQUIRED` until `PAX8_CLIENT_ID` / `PAX8_CLIENT_SECRET` exist outside Git; never claim `CONNECTED` without a verified token call.
- Warehouse Vendors page reads `/api/internal/warehouse/connectors` and shows Hub status strings (CONNECTED / STALE / FAILED / AUTH_REQUIRED / UNKNOWN).

## Public leakage

- `App.tsx` lazy-loads `WarehouseGate` only. `WarehouseApp` (catalog, cart, vendors) loads after `/api/internal/warehouse/session` succeeds.
- Sitemap and `robots.txt` exclude warehouse and destaged `/store` SKUs.
- Coverage scoring is labeled **experimental heuristic** — not an authoritative security score.

## Checkout eligibility

See `shared/checkoutEligibility.ts`.

- Door 1: `assessment_first`
- Door 2: `request_quote`
- Marketplace: `request_approval`
- Warehouse staff: `pay_now` (not a public default)

Do not invent Hub tenant catalogs or prices. Do not put distributor secrets in this repo.

## Pay Now sales tax

Decided 2026-10-03 (Joe delegated the choice; PR 407 and its follow-up). Provider switched from Stripe Tax to Zoho Books on 2026-10-05 (Joe: "yes switch to zoho books").

- **Zoho Books calculates; Zoho Payments charges.** Books Sales Tax Automation works out US sales tax from DE's state registrations, the customer's address and the item's tax category. Books has no calculate-only call, so the server drafts an estimate on one tax-check contact, reads the tax, and deletes the estimate. Nothing is sent to the customer. No Stripe account or per-call fee is involved. Code: `server/services/zohoBooksTax.ts`, `server/services/salesTax.ts`.
- **Tax items per Store category** live in `shared/storeTaxCodes.ts`. People-delivered services use one Books service item (`ZOHO_BOOKS_SERVICE_ITEM_ID`); its tax category in Books decides how they are taxed.
  - Digital assessments, templates and training, and hardware handling, have no confirmed Books item yet. They stay quote-only for Pay Now.
  - A confirmed item can be added without a deploy through `ZOHO_BOOKS_TAX_ITEMS`.
- **Billing address.** Staff checkout asks for one when Pay Now is selected; it goes on the estimate as the address Books taxes against.
- **Fail closed.** Pay Now steps aside to Request Quote (`TAX_RATE_UNAVAILABLE`) when:
  - the Books settings are not set and no verified table is set;
  - the readiness check below does not read `READY` (a Books organization without a tax registration answers zero tax instead of an error, so its number is never trusted);
  - Books refuses the estimate, times out after 8s, or returns totals that don't add up or a rate above 20%;
  - a line has no Books item.
- **The order record** keeps the billing address and a one-line note with the Books tax lines and the draft estimate number, and says if the draft could not be deleted.
- **Setup, once.** Done by Joe or whoever has the Books admin login:
  1. In Zoho Books (org "Digerati Experts", 693714437): Settings → Taxes → turn on Sales Tax Automation and add DE's Arizona registration.
  2. The service item and the tax-check contact already exist (created 2026-10-05): item "Website IT services (Pay Now)" `1957016000006629001` (SKU `DE-WEB-PAYNOW-SERVICES`) and contact "DE Website Tax Check" `1957016000006631001`. Once automation is on, set the item's tax category in Books.
  3. Preferred: connect Zoho once (one consent covers Books, CRM, Desk and Payments; `docs/ZOHO-OAUTH-INVENTORY.md`, "Reconnect runbook") and skip steps 3–4's token and client. Legacy: in the Zoho API Console self-client, generate a code with `ZohoBooks.estimates.CREATE,ZohoBooks.estimates.DELETE,ZohoBooks.settings.READ,ZohoBooks.contacts.READ,ZohoBooks.contacts.CREATE,ZohoBooks.invoices.CREATE,ZohoBooks.invoices.READ,ZohoBooks.customerpayments.CREATE` and exchange it for a refresh token.
  4. On the production server set `ZOHO_BOOKS_ORGANIZATION_ID`, `ZOHO_BOOKS_REFRESH_TOKEN`, `ZOHO_BOOKS_TAX_CONTACT_ID` and `ZOHO_BOOKS_SERVICE_ITEM_ID` (and `ZOHO_BOOKS_CLIENT_ID`/`_SECRET` if the token came from a different self-client than `ZOHO_CLIENT_ID_API`).
- **Readiness check** (2026-10-05). Code: `server/services/salesTaxReadiness.ts`, `GET /api/internal/warehouse/tax-status`. It is staff-only and returns a generic 404 to anyone else.
  - It reads the Books organization (is a sales tax registration on?), the service item and the tax-check contact with the same token. It never creates or changes anything, and the answer is cached for 5 minutes.
  - Statuses: `READY`, `NOT_CONFIGURED`, `AUTH_REQUIRED`, `INCOMPLETE` or `UNKNOWN`. A failed check never reads READY. `NOT_CONFIGURED` names the missing settings, never their values.
  - Staff see it in two places: the full card under **Vendors → Site integrations**, and one line under Staff Pay Now on the checkout.
- **Sales records in Books** (2026-10-05). When Zoho Payments confirms an order, fulfillment records it in Books once (`server/services/zohoBooksInvoice.ts`):
  1. Find the customer by billing email, or create them with the billing address.
  2. Create an invoice with the website order number as its reference, using the same Books items, so Sales Tax Automation taxes it the way checkout did. Books does not email it; DE's own confirmation already went out.
  3. Only when the invoice total equals what Zoho Payments charged: mark it sent and record the payment against it (mode credit card, reference the Zoho payment id, deposit account `ZOHO_BOOKS_DEPOSIT_ACCOUNT_ID` or Books' default).
  - A mismatch leaves the invoice as a draft for staff. A retried fulfillment finds the invoice by order number and creates nothing new.
  - Books trouble never stops fulfillment. The order notes end with one line saying what happened, for example `booksInvoice:INV-000123 paid`, `booksInvoice:INV-000123 left as draft (Books total $…, paid $…)` or `booksInvoice:failed (…)`.
  - Set `ZOHO_BOOKS_RECORD_PAID_ORDERS=false` to turn it off.

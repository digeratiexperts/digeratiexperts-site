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
- Electric accent + category pills + vendor marks stay (Joe-decided warehouse color lock). Public Store does not get those pills.

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

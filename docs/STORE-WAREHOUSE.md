# DE Digital Warehouse

**Status:** Implemented on website `main` after merge (MERGED ≠ LIVE until production SHA is verified).  
**Staff identity this phase:** live portal `role === "admin"`. Ordinary authenticated clients are denied.  
**Portal login:** `https://portal.digeratiexperts.com/portal/login`

## What this is

The former public `/store` workshop (SKU catalog, vendor marks, coverage heuristic, cart) is the **DE Digital Warehouse**. It is staff-only.

| Surface | Route | Auth |
| --- | --- | --- |
| Warehouse | `/internal/warehouse` and product/checkout subroutes | Live `admin` at route **and** catalog API |
| Public curated Store | `/store`, `/store/solutions/:family`, `/store/solution` (`/store/checkout` alias) | Public Solution Builder — no vendor catalog, no Pay Now |
| Legacy catalog paths | `/store/managed`, `/store/co-managed` | 301 to the appropriate public solution path |
| Staff-only SKU URLs | `/store/product/:sku` except four ProActive models | Generic 404 — same body as unknown, no `Location` |
| Client Marketplace | `/portal/marketplace` | Authenticated client; fail-safe Request Approval (no Hub catalog). Live `admin` sees a staff notice pointing at `/internal/warehouse` instead of Request Approval — still no catalog data on this surface. |

## How staff open it

1. Sign in at `https://portal.digeratiexperts.com/portal/login`.
2. Open `/internal/warehouse`.
3. An admin bookmark to `/store` 302s into the warehouse. Unauthorized users never receive `Location: /internal/...`.

## Authorization

- JWT proves the session. The **live** portal record is authoritative (`role === "admin"`).
- Catalog-bearing APIs (`/api/store/solutions/*`, `/api/store/cart/*`) return generic `{ error: "Not found" }` unless staff.
- Unauthorized warehouse HTML is a generic 404. Do not reveal whether a SKU, vendor, or price exists.

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

Do not invent Hub tenant catalogs or prices.

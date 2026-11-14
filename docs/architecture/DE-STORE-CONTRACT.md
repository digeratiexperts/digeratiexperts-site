# DE store contract (Hub ↔ public site)

Status: proposed, v1. Date: 2026-11-13. Owner: Joseph.
Repo path (once the held draft PR opens): `docs/architecture/DE-STORE-CONTRACT.md`.

This is the payload and rule contract between the Digerati Experts (DE) public store and the Intelligence Hub. The Hub is the source of truth for tax calculations, agreements and clickwrap evidence, orders, entitlements, fulfillment, shipping, refunds, and nexus. The site never computes tax from a local rate table and never marks an order shipped, delayed, cancelled, or refunded on its own.

Nothing in this contract is live until Joseph turns the flags on and applies the migration. Sending, label booking, and the tax engine stay off by default.

## 1. Conventions

| Topic | Rule |
| --- | --- |
| JSON | camelCase field names |
| Money | integer `amountCents` (no floats) plus ISO 4217 `currency`, default `"USD"` |
| Time | ISO 8601 timestamps in UTC with a `Z` suffix, e.g. `2026-11-13T18:00:00Z` |
| Dates | ISO 8601 calendar dates, e.g. `2026-11-20` |
| SLA clock | Calendar and working-day boundaries use `America/Phoenix`. The 16 CFR 435.1(c) 7-day clock, and the day-5 delay notice, start when the Hub has both payment and a properly completed order, not when DE accepts the order. |
| Working days | Monday–Friday, excluding US federal holidays, used only for the 7-working-day refund deadline |
| Country | ISO 3166-1 alpha-2, e.g. `US` |
| Region | For US addresses, the two-letter state code, e.g. `AZ` |
| Ids | Opaque strings prefixed as below; do not invent Hub ids on the site |
| Idempotency | `Idempotency-Key` header on every mutating call; a replay of the same key and body returns the original result (`200` plus `"duplicate": true` when it is a replay) |
| Auth (site → Hub) | HMAC over method, path, timestamp, event id, and raw body. Headers: `X-DE-Timestamp`, `X-DE-Event-ID` (must equal `envelope.eventId` when an envelope is sent), `X-DE-Signature`. Timestamp window: 5 minutes. No bearer token on ingest routes. |
| Auth (Hub → site) | The same HMAC scheme, direction `hub_to_store`. The site verifies before applying. |
| Errors | `{ "error": string, "code": string }` with optional `issues: [{ "path": string, "code": string }]` |
| Contract version | Every envelope carries `"contractVersion": "1"`. A newer Hub may accept `1` and refuse unknown versions with `400` / `unsupported_contract_version`. |

Id prefixes:

- `ord_` Hub order id
- `calc_` tax calculation id
- `agr_` agreement / clickwrap acceptance id
- `sig_` signature request id
- `kit_` kit / shipment unit id
- `dev_` intake device id
- `evt_` event id
- `ref_` refund id
- `siteord_` site-side order id (site-minted, unique)

## 2. Shared enumerations

Use these exact strings on both sides. Do not add aliases.

```ts
export type TaxCategory =
  | "saas"
  | "managed_service"
  | "labor"
  | "hardware"
  | "shipping"
  | "telecom"
  | "ewaste_fee"
  | "covered_electronic_device_fee"
  | "battery_fee";

export type DeviceClass = "laptop" | "tablet" | "monitor" | "battery" | "other";

export type CaliforniaFeeKind =
  | "ca_ewaste"
  | "ca_covered_electronic_device"
  | "ca_battery";

export type BuyerRole = "managed" | "comanaged" | "self_managed";

export type AddressUse = "ship_to" | "service" | "bill_to";

export type OrderStatus =
  | "received"
  | "awaiting_signature"
  | "paid_accepted"
  | "awaiting_buyer_delay_decision"
  | "cancelled"
  | "in_fulfillment"
  | "shipped"
  | "refunded";

export type SignatureState = "requested" | "accepted" | "declined" | "expired";
```

`BuyerRole` is the same on the site, the Hub account entitlement, and the released kit. `comanaged` is one word, no hyphen.

Tamper protection on a shipped agent is a per-tier setting derived from the role, not a free-form flag the site can override:

| Buyer role | Tamper protection | Uninstall of DE software |
| --- | --- | --- |
| `managed` | on | not permitted by the agreement |
| `comanaged` | on | not permitted by the agreement |
| `self_managed` | off | permitted; disclose pre-installed software before purchase |

## 3. Addresses and line items

```ts
export interface PostalAddress {
  name?: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  region: string;
  postalCode: string;
  country: string; // ISO 3166-1 alpha-2
}

export interface OrderLineInput {
  lineId: string;          // site-stable id, unique within the order
  sku: string;
  description: string;
  taxCategory: TaxCategory;
  quantity: number;        // positive integer
  unitAmountCents: number; // pre-tax unit price
  // Required for hardware so California fee rules can choose the right fee.
  deviceClass?: DeviceClass;
  // Required when taxCategory is "hardware" and the line is part of a kit.
  kitId?: string;
  // Parent kit line, when this row is an unbundled component of a kit.
  parentLineId?: string;
}
```


A storefront may show a single package price. The tax invoice, and the `lines` sent to quote/commit, must still be split at standalone prices: hardware; each SaaS or dashboard subscription as its own line; labor; shipping at actual cost; and each fee. A request that sends only a bundled kit or package total is rejected with `400` / `kit_not_unbundled`. Shipping, delivery fees, and statutory fees are their own lines, never folded into hardware. Hardware lines that may draw a California fee must set `deviceClass`.

### 3.1 State sales blocklist

DE will not sell into US states or territories that appear on a Hub settings list maintained by admins. The list starts empty. Enforcement is off until `STORE_STATE_BLOCKLIST_ENABLED=1`. Joseph chooses the states; the site does not hard-code the list.

Every admin change is logged with the actor, the time, and the before and after region lists. Only US state and territory codes are accepted (two-letter, case-insensitive, surrounding whitespace ignored). An invalid code is rejected and the list is not changed.

Order intake, including `POST /api/store/tax/quote`, checks `billTo`, `shipTo`, and `serviceAddress`. If any of those addresses is in the United States and its region is on the list, the Hub refuses the request and the site must not capture payment. The buyer-facing message is neutral and must not explain why DE does not sell there.

Failure `409` / `state_not_served`:

```ts
export interface StateNotServedIssue {
  path: "billTo.region" | "shipTo.region" | "serviceAddress.region";
  code: "state_not_served";
}

export interface StateNotServedResponse {
  // Complete buyer-facing sentence, e.g. "Digerati Experts does not currently
  // sell into New York." Two regions use "or"; three or more use an Oxford comma.
  // The site may show this string as-is. It must not add a reason.
  error: string;
  code: "state_not_served";
  blockedRegions: string[]; // uppercase US state or territory codes, discovery order
  blockedAddressUses: Array<{
    path: StateNotServedIssue["path"];
    use: AddressUse;
    region: string;
  }>;
  issues: StateNotServedIssue[];
}
```

A refused attempt is stored for reporting. The record includes the time, the matching regions and address uses, and optional email, account id, and site order id. It must not include card data or a payment reference.

If a region is added to the list after orders are already open, those unfulfilled orders (any status other than `cancelled`, `shipped`, or `refunded`) are flagged for review. They are not cancelled automatically.

## 4. Tax: quote, commit, void

The site must call `quote` before it takes payment. If tax cannot be quoted, the Hub returns a non-success status and the site must not take payment. The site must not keep or use a local rate table.

Tax is computed only through a `TaxEngine` interface in the Hub. Two named adapters ship as stubs only, with no live provider calls: `AvataxCoreSstAdapter` (AvaTax Core plus Streamlined Sales Tax) and an optional `CommunicationsTaxAdapter` for Telnyx number-resale communications tax. Both stay inert while their flags are off. Quote, commit, and void return `503` / `tax_engine_disabled` when `STORE_TAX_ENGINE_ENABLED` is off, or `503` / `tax_engine_unselected` when the flag is on but no stub is enabled to quote. The site must not take payment without a successful quote. A later live adapter can fill the same interface without changing these payloads.

Shipping and delivery fees are returned by the engine as separate lines on a successful quote, at their standalone amounts (examples a live engine would return: Colorado delivery fee $0.31, Minnesota delivery fee $0.50; North Dakota taxes shipping). The Hub and the site must not keep a local rate table for those amounts.

California statutory fee eligibility is a separate Hub rule module, not a sales-tax rate table and not a substitute for a quote:

- California Covered Electronic Waste (CEW, `ca_ewaste`) is added only when DE is registered for California use tax (`STORE_CA_USE_TAX_REGISTERED=1`) and the ship-to or service address is in CA. If that flag is off, the CEW fee is not charged.
- Laptops and tablets (`deviceClass` of `laptop` or `tablet`) pay the covered electronic device (screen) fee (`ca_covered_electronic_device`) only when CA use tax registration is on. They do not pay the battery fee.
- The battery fee (`ca_battery`) applies only to lines whose `deviceClass` is `battery`, never to laptops or tablets.
- These rules decide which fee lines would apply; they do not invent sales tax. A fee schedule amount is still returned only by a selected tax engine on a successful quote.

Base path: `/api/store/tax`.

### 4.1 `POST /api/store/tax/quote`

Request:

```ts
export interface TaxQuoteRequest {
  contractVersion: "1";
  idempotencyKey?: string; // optional if the HTTP header is present; header wins
  currency: "USD";
  // Buyer already known to the Hub, when the account exists.
  accountId?: number;
  email: string;
  buyerRole: BuyerRole;
  shipTo: PostalAddress;
  serviceAddress: PostalAddress;
  billTo: PostalAddress;
  lines: OrderLineInput[];
  // Exemption or resale certificate already on file in the Hub, if any.
  exemptionCertificateId?: string;
}
```

Success `200`:

```ts
export interface TaxQuoteResponse {
  calculationId: string;          // calc_
  quotedAt: string;               // ISO 8601 UTC
  expiresAt: string;              // ISO 8601 UTC; do not capture payment after this
  currency: "USD";
  lines: TaxedLine[];
  fees: TaxedLine[];              // jurisdiction fees returned as their own lines
  subtotalCents: number;          // sum of line unit * qty, pre-tax
  taxCents: number;
  feeCents: number;
  totalCents: number;             // subtotal + tax + fees
  destination: {
    region: string;
    country: string;
    sourcedFrom: "ship_to" | "service";
  };
}

export interface TaxedLine {
  lineId: string;
  taxCategory: TaxCategory;
  feeKind?: CaliforniaFeeKind;
  taxableAmountCents: number;
  taxCents: number;
  feeCents: number;
  // Jurisdiction detail is optional and informational; the site must not
  // recompute tax from it.
  jurisdictions?: Array<{
    name: string;
    region?: string;
    taxCents: number;
  }>;
}
```

Failure (do not take payment):

| HTTP | `code` | When |
| --- | --- | --- |
| 503 | `tax_engine_disabled` | `STORE_TAX_ENGINE_ENABLED` is off |
| 503 | `tax_engine_unselected` | No tax engine has been chosen; only the stub adapter is present |
| 503 | `tax_unavailable` | A future engine is selected but the quote failed or timed out |
| 400 | `kit_not_unbundled` | A kit line is not broken into components |
| 400 | `invalid_address` | Missing or unusable ship-to, service, or bill-to |
| 400 | `invalid_line` | Unknown category, non-positive quantity, or bad money |
| 409 | `certificate_invalid` | Exemption/resale certificate not usable |
| 409 | `state_not_served` | Billing, shipping, or service address is in a state or territory DE does not currently sell into. Do not capture payment. See §3.1. |

### 4.2 `POST /api/store/tax/commit`

Call only after the payment processor reports success, and only with a non-expired `calculationId` whose lines and addresses still match the paid cart. A mismatch returns `409` / `calculation_mismatch` and must not be treated as a tax-inclusive capture.

```ts
export interface TaxCommitRequest {
  contractVersion: "1";
  calculationId: string;
  paymentRef: string;       // processor charge or intent id
  siteOrderId: string;      // siteord_
}

export interface TaxCommitResponse {
  calculationId: string;
  committedAt: string;
  currency: "USD";
  taxCents: number;
  feeCents: number;
  totalCents: number;
}
```

### 4.3 `POST /api/store/tax/void`

Call when payment is not captured, is reversed before commit, or the order is cancelled before any commit should stand.

```ts
export interface TaxVoidRequest {
  contractVersion: "1";
  calculationId: string;
  reason: "payment_failed" | "payment_reversed" | "order_cancelled" | "expired_quote";
}

export interface TaxVoidResponse {
  calculationId: string;
  voidedAt: string;
}
```

Fees appear only as `fees[]`, each with a `taxCategory` of `ewaste_fee`, `covered_electronic_device_fee`, or `battery_fee`, and a `feeKind` of the matching `CaliforniaFeeKind` when the fee is a California statutory fee. The site may send known fee lines; the Hub drops or replaces them if they violate the rules above (for example a battery fee on a laptop, or an eWaste fee while DE is not registered for California use tax). The site must display fee lines from a successful quote and include them in the amount charged. Because this slice has no selected engine, a successful quote is not available yet.

## 5. Agreement and clickwrap evidence

The Hub records each acceptance in the signing-evidence ledger (same evidence model as Hub PR #1224; this contract references those tables and does not redefine them). The site sends the acceptance; it does not store the legal record of record.

Required before any provision or ship: every document listed in the catalog for that cart and `buyerRole` must have an `accepted` record whose `hash` matches the document version shown to the buyer.

```ts
export interface AgreementAcceptance {
  documentKey: string;      // stable key, e.g. "msa", "store-terms", "911-limitation", "refurbished-disclosure"
  version: string;          // document version string, e.g. "2026.10"
  hash: string;             // lowercase hex SHA-256 of the exact terms text shown
  buttonText: string;       // exact visible button or checkbox label the buyer used
  acceptedAt: string;       // ISO 8601 UTC
  ip: string;               // buyer IP as seen by the site
  userAgent: string;
  accountId?: number;       // Hub account id when known
  email: string;            // required even when accountId is present
}
```

The site includes one `AgreementAcceptance` per required document on `store.order_created`, or sends them earlier with `POST /api/store/agreements` (same body wrapped in the event envelope below, `eventType: "agreement.submitted"`). The Hub replies with `agr_` ids and emits `agreement.created`.

If a document still requires a wet or e-sign ceremony rather than clickwrap, the Hub emits `signature.requested` and the order stays `awaiting_signature`. The Hub will not provision, book a label, or hand a package to a carrier until every required signature is `accepted`.

## 6. Event envelope

All events, both directions, use this envelope.

```ts
export interface StoreEventEnvelope<TType extends string, TPayload> {
  contractVersion: "1";
  eventId: string;          // evt_, unique; also sent as X-DE-Event-ID
  eventType: TType;
  occurredAt: string;       // ISO 8601 UTC
  producer: "store" | "hub";
  // Present after the Hub has accepted the order.
  hubOrderId?: string;      // ord_
  siteOrderId: string;      // siteord_
  payload: TPayload;
}
```

Site → Hub ingest: `POST /api/store/events`.
Hub → site webhook: the site URL configured in the Hub (not in this document). Replays are `200 { "duplicate": true, "eventId": "..." }`.

### 6.1 Site → Hub: `store.order_created`

The site emits this when the buyer has placed the order and (if tax was available) payment has been captured. If tax could not be quoted, this event must not be sent and payment must not be captured.

```ts
export interface StoreOrderCreatedPayload {
  siteOrderId: string;
  accountId?: number;
  email: string;
  buyerRole: BuyerRole;
  currency: "USD";
  calculationId: string;
  paymentRef: string;
  paidAt: string;
  // Hub-stamped when the payload has the information needed to process the order.
  // The 16 CFR 435.1(c) clock starts at the later of paidAt and this instant.
  orderDetailsCompleteAt?: string;
  shipTo: PostalAddress;
  serviceAddress: PostalAddress;
  billTo: PostalAddress;
  lines: OrderLineInput[];
  acceptances: AgreementAcceptance[];
  // Buyer-visible shipping promise copied from the cart (informational).
  // The Hub returns the binding promisedShipByDate.
  advertisedProcessing: "1_week_then_overnight";
}

export interface StoreOrderCreatedAck {
  hubOrderId: string;         // ord_
  siteOrderId: string;
  status: OrderStatus;
  promisedShipByDate: string; // YYYY-MM-DD, America/Phoenix, last day for carrier handoff
  acceptancesRecorded: Array<{ documentKey: string; agreementId: string; state: SignatureState }>;
  missingSignatures: Array<{ documentKey: string; signatureRequestId?: string }>;
}
```

`promisedShipByDate` is the last calendar day, in `America/Phoenix`, by which the Hub must hand the package to the carrier. Under 16 CFR 435.1(c) the clock starts when the seller has both payment and a properly completed order: the later of `paidAt` and `orderDetailsCompleteAt`. That start plus 7 calendar days is the binding ship-by date. DE accepting the order (`paid_accepted`) does not start or reset the clock. The advertised promise is “process within 1 week and ship overnight.”

### 6.2 Hub → site events the site must consume

```ts
// Hub has stored clickwrap or agreement evidence.
export interface AgreementCreatedPayload {
  agreementId: string;        // agr_
  documentKey: string;
  version: string;
  hash: string;
  state: "accepted";
}

// A document still needs a signature ceremony.
export interface SignatureRequestedPayload {
  signatureRequestId: string; // sig_
  documentKey: string;
  version: string;
  hash: string;
  method: "clickwrap" | "esign";
}

// Hub has accepted the order and assigned the Hub order id.
// Emitted after store.order_created is applied, including when the
// order is still awaiting_signature.
export interface OrderCreatedPayload {
  hubOrderId: string;
  status: OrderStatus;
  buyerRole: BuyerRole;
  promisedShipByDate: string;
  totalCents: number;
  currency: "USD";
}

// Emitted only when a kit is released (required signatures present,
// entitlements written, device allowed to leave the cage).
export interface DeviceDeploymentPayload {
  hubOrderId: string;
  kitId: string;
  deviceIds: string[];        // dev_
  buyerRole: BuyerRole;
  tamperProtection: "on" | "off";
  entitlements: Array<{
    key: string;
    tier: BuyerRole;
  }>;
  releasedAt: string;
}
```

Event type strings, exactly:

- `agreement.created`
- `signature.requested`
- `order.created`
- `device.deployment`

### 6.3 Fulfillment events (Hub is the source of truth)

The site must not invent these. It only displays what the Hub has emitted.

Event type strings, exactly:

- `fulfillment.order_confirmation`
- `fulfillment.delay_notice_sent`
- `fulfillment.buyer_delay_consent`
- `fulfillment.buyer_cancel`
- `fulfillment.shipped`
- `fulfillment.refunded`

```ts
export interface OrderConfirmationPayload {
  hubOrderId: string;
  noticeId: string;
  // Recorded automatically at payment. Sent only when
  // STORE_FULFILLMENT_SENDING_ENABLED is on.
  paidAt: string;
  recordedAt: string;
  sendingEnabled: boolean;
  // Legal N-0 (renewal-00-purchase-acknowledgment) when the order includes a
  // service or subscription line and no hardware. Legal N-0b (hardware and kit
  // order confirmation) when the order is hardware- or kit-only. N-0b is recorded
  // at payment; that confirmation is what makes the hardware or kit order a
  // paid, accepted order. When an order has both hardware and a service, both
  // keys are listed on legalTemplateKeys and legalTemplateKey is omitted.
  legalTemplateKey?: "N-0" | "N-0b";
  legalTemplateKeys?: Array<"N-0" | "N-0b">;
}

export interface DelayNoticeSentPayload {
  hubOrderId: string;
  noticeId: string;
  // Why the SLA will be missed, operator-facing code, safe to show the buyer
  // only through the Hub's buyer-facing template.
  reasonCode: "parts" | "sanitization" | "signature_pending" | "carrier" | "other";
  originalPromisedShipByDate: string;
  proposedShipByDate: string;
  // Buyer may cancel for a full refund. Sending the notice is flag-gated.
  cancelByDate: string;
  sentAt: string;
  sendingEnabled: boolean;    // false when STORE_FULFILLMENT_SENDING_ENABLED is off (recorded, not sent)
  // Legal shipping templates: S-1 first delay (new date 30 days or less after
  // the promised date), S-2 (more than 30 days later, or no date), S-3 (DE
  // cannot meet the revised date). S-4 is the cancel and refund confirmation.
  legalTemplateKey: "S-1" | "S-2" | "S-3" | "S-4";
}

export interface BuyerDelayConsentPayload {
  hubOrderId: string;
  noticeId: string;
  consentedAt: string;
  newPromisedShipByDate: string;
}

export interface BuyerCancelPayload {
  hubOrderId: string;
  cancelledAt: string;
  source: "delay_notice" | "buyer_request" | "operator";
}

export interface ShippedPayload {
  hubOrderId: string;
  kitId: string;
  // Carrier handoff is the definition of shipped. A booked label is not shipped.
  handedToCarrierAt: string;
  carrier: string;
  trackingNumber: string;
  service: "overnight";
}

export interface RefundedPayload {
  hubOrderId: string;
  refundId: string;           // ref_
  amountCents: number;
  currency: "USD";
  // Deadline is 7 working days after the cancel or qualifying event.
  dueByDate: string;
  refundedAt: string;
}
```

The site may collect a buyer delay consent or cancel click and forward it to `POST /api/store/events` as `store.buyer_delay_consent` or `store.buyer_cancel` with `{ "noticeId"?: string, "hubOrderId": string }`. The Hub validates, records, emits the fulfillment event, and remains the source of truth.

## 7. Fulfillment and SLA rules the site must respect

1. Provisioning and shipping are refused until every required signature is `accepted`. A `409` / `signatures_incomplete` is returned on any ship, label, or release attempt.
2. “Shipped” means carrier handoff, not label creation.
3. Overnight label booking is performed only by the Hub and only when `STORE_OVERNIGHT_LABELS_ENABLED=1`. The site never books a carrier label.
4. If an order cannot be handed to the carrier by `promisedShipByDate` (7 calendar days from the 16 CFR 435.1(c) start: payment plus complete order details, not DE acceptance), the Hub must generate the delay-or-cancel notice by the end of calendar day 5, measured from that same start. Legal shipping templates: S-1 (first delay, new date 30 days or less after the promised date), S-2 (new date more than 30 days later, or no date), S-3 (DE cannot meet the revised date), S-4 (cancel and refund confirmation). The buyer may cancel for a full refund. Refunds are due within 7 working days of the cancel (or other qualifying event).
5. The Hub records an order confirmation automatically at payment (`fulfillment.order_confirmation`). Hardware- or kit-only orders reference Legal notice N-0b, which is what makes that order a paid, accepted order. Orders that include a service reference Legal notice N-0; an order with both hardware and a service references both. Notice sending, buyer email, and refund execution stay off until `STORE_FULFILLMENT_SENDING_ENABLED=1`. When the flag is off, the Hub still records the confirmation and `fulfillment.delay_notice_sent` with `sendingEnabled: false` and does not send.
6. Damaged lithium batteries must not be tendered for air service (49 CFR 173.185(f)); the Hub blocks overnight air handoff in that case and uses the delay path if the SLA cannot be met another way.

## 8. Overnight air battery gate

An overnight air label is refused unless device intake shows every lithium battery is healthy, not swollen, not recalled, and 100 Wh or less, and the device is powered off. Damaged or recalled batteries can never ship by air (49 CFR 173.185(f)). A booked overnight label also requires the UN3481 mark to be flagged as required for the carton.

```ts
export type BatteryCondition = "healthy" | "swollen" | "damaged" | "recalled" | "unknown";

export interface BatteryIntake {
  condition: BatteryCondition;
  wattHours: number | null;
  recalled: boolean;
  poweredOff: boolean;
  un3481MarkRequired: boolean;
}

export function overnightAirAllowed(intake: BatteryIntake): { allowed: true } | { allowed: false; code: string } {
  // Implementation lives in the Hub. Damaged or recalled is always blocked.
  // Healthy, not recalled, wattHours <= 100, poweredOff, and UN3481 flagged, otherwise blocked.
  throw new Error("defined in Hub code, not by the site");
}
```

The site never books the label. The Hub returns `409` / `air_battery_blocked` (or `un3481_mark_required` when the mark was not flagged) on a label or handoff attempt that fails this gate.

## 9. Windows provisioning

Only two Windows license paths are allowed on a refurbished kit:

1. The original OEM recovery image remains intact on the same PC, or
2. The device is processed as a Microsoft Authorized Refurbisher or Third Party Refurbisher unit (Windows 11, with TPM 2.0 and Secure Boot).

Loose product keys and license transfers are not allowed. Microsoft 365 is sold only as a Cloud Solution Provider (CSP) line item (`taxCategory: "saas"`); Office is never preloaded as a license on the device.

```ts
export type WindowsLicensePath = "oem_recovery_intact" | "authorized_refurbisher" | "third_party_refurbisher";
```

A provisioning checklist that records any other Windows license path, a loose key, or preloaded Office is rejected with `409` / `windows_license_path_invalid`.

## 10. Entitlements and release

On `device.deployment`, the Hub writes account entitlements for the purchased services and records the responsibility split implied by `buyerRole` (`managed` / `comanaged` / `self_managed`). The site does not grant entitlements itself.

`tamperProtection` on that event is `on` for `managed` and `comanaged`, and `off` for `self_managed`, so a self-managed buyer can uninstall DE software.

## 11. Nexus tracker (Hub, not a checkout API)

The Hub sums destination sales per US state and alerts internally at 80% of that state's economic-nexus threshold (default `$100_000` trailing 12 months; `$500_000` for TX, CA, and NY unless Joseph sets a different figure). The site does not implement nexus math. A read model may later be exposed to operators; it is not required for store checkout.

```ts
export interface NexusStateSnapshot {
  region: string;             // US state
  trailing12MonthCents: number;
  thresholdCents: number;
  percentOfThreshold: number; // 0–100+, alert when >= 80
  alert: boolean;
}
```

## 12. Flags (all default off)

| Flag | Default | Effect when off |
| --- | --- | --- |
| `STORE_KIT_FULFILLMENT_ENABLED` | off | Ingest and staff APIs return `503` / `store_fulfillment_disabled` |
| `STORE_TAX_ENGINE_ENABLED` | off | Quote, commit, and void return `503` / `tax_engine_disabled`; site must not take payment |
| `STORE_TAX_ENGINE_AVATAX_SST_ENABLED` | off | The AvaTax Core plus SST adapter stays a stub and makes no live calls |
| `STORE_TAX_ENGINE_COMMS_ENABLED` | off | The optional communications-tax adapter for Telnyx resale stays a stub and makes no live calls |
| `STORE_CA_USE_TAX_REGISTERED` | off | California CEW is not charged. Screen and battery fee eligibility is unchanged. |
| `STORE_OVERNIGHT_LABELS_ENABLED` | off | Labels are not booked; handoff cannot be marked from a label |
| `STORE_FULFILLMENT_SENDING_ENABLED` | off | Order confirmations, delay notices, cancel mail, and refund letters are recorded but not sent |
| `STORE_STATE_BLOCKLIST_ENABLED` | off | The settings list is not enforced at intake. The list may still be edited and starts empty. |

The migrations that create store, kit, intake, nexus, settings, blocklist audit, and blocked-attempt tables are not applied by this work. Joseph applies them.

## 13. What each side must not do

Site must not:

- Compute or cache tax from a local rate table
- Take payment without a non-expired, successful `calculationId`
- Take payment after `409` / `state_not_served`, or into a blocked billing, shipping, or service address
- Emit fulfillment events (`shipped`, `refunded`, delay notice, and so on)
- Book a carrier label
- Release a device or grant entitlements
- Mark a kit shipped when only a label exists

Hub must not:

- Auto-send notices or book labels while the sending and label flags are off. Order confirmation is still recorded automatically at payment, with `sendingEnabled: false`.
- Provision or hand to a carrier without the required signatures
- Treat a booked label as shipped
- Make a live tax-provider call from the AvaTax Core plus SST stub or the communications-tax stub
- Charge California CEW unless `STORE_CA_USE_TAX_REGISTERED` is on
- Charge a battery fee on a laptop or tablet
- Book an overnight air label when intake shows a damaged, swollen, recalled, over-100 Wh, or powered-on battery, or when the UN3481 mark is not flagged
- Provision Windows with a loose key, a transferred license, or preloaded Office
- Auto-cancel open orders when a state is added to the sales blocklist; flag them for review instead
- Put a reason in the buyer-facing `state_not_served` message
- Store card data or a payment reference on a blocked intake attempt

## 14. Open decisions for Joseph

- Confirm SLA day boundaries stay `America/Phoenix` (proposed).
- Confirm nexus thresholds: `$100k` most states, `$500k` for TX, CA, and NY (proposed).
- Confirm the public store webhook URL and HMAC secret storage (not in this document).
- Confirm which document keys are required per `buyerRole` and SKU (catalog lives in the Hub; the site renders what the Hub lists).
- Confirm when, if ever, to turn on the AvaTax Core plus SST stub or the communications-tax stub (both ship off, with no live calls).
- Confirm whether DE is registered for California use tax, which turns on California CEW (`STORE_CA_USE_TAX_REGISTERED`).
- Confirm which US states and territories belong on the sales blocklist (to be chosen Monday). The list ships empty and `STORE_STATE_BLOCKLIST_ENABLED` stays off until then.

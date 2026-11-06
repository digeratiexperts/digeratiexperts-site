# Store Purchase Funnel — Full Trace + Three Implementation Proposals

No sales/auth architecture has been changed. This document traces current behavior with
exact file/line references, then lays out three independent implementation proposals for
a decision. Nothing below has been implemented.

## Summary of the finding

A brand-new visitor — never logged into the Client Portal — cannot complete **any** path
to purchase or request pricing in the Store. Both "buy" and "get a quote" terminate at a
portal login requirement. There is currently no self-serve conversion path for a net-new
prospect anywhere in the Store.

## The two paths, traced exactly

### Path A — "Pay Now" (card checkout)

1. Visitor adds items to cart (`CartContext`, no auth required — works for anyone).
2. Visitor opens `/store/checkout` ([Checkout.tsx](client/src/pages/store/Checkout.tsx)).
   No login is required to *view* this page or fill in the billing form.
3. Visitor selects the "Credit/Debit Card" radio (`paymentMethod === "zoho"`) and submits.
4. **Client-side gate #1** ([Checkout.tsx:84-95](client/src/pages/store/Checkout.tsx#L84-L95)):
   the submit handler reads `localStorage.getItem("portalToken")`. If absent, it never
   calls the API — it shows a toast ("Identity captured — portal sign-in still required to
   pay") and silently flips `paymentMethod` to `"quote_request"`. The visitor's billing
   info is not lost, but the button they clicked did not do what its label said.
5. If a `portalToken` *is* present, the request goes to `POST /api/store/checkout/zoho`
   with `Authorization: Bearer <portalToken>`.
6. **Server-side gate #2** ([server/secureStoreCheckout.ts:265-268](server/secureStoreCheckout.ts#L265-L268)):
   the route is registered with middleware `[authMiddleware, requireRole("comanaged",
   "admin")]`. This is stricter than "logged in" — a portal user must specifically hold
   the `comanaged` role (or `admin`). A logged-in `"managed"`-tier client is rejected here
   too, not just anonymous visitors.
7. **Server-side gate #3, per line item** (`isPurchasableForRole` in
   [server/secureStoreCheckout.ts:52-57](server/secureStoreCheckout.ts#L52-L57)): even a
   `comanaged`/`admin` caller is rejected if a cart line's `requiredClientType` isn't
   `"public"` or `"comanaged"`, or if the product is `isContractOnly` / not
   `isCheckoutEnabled`.
8. **Server-side gate #4** ([server/secureStoreCheckout.ts:59-63](server/secureStoreCheckout.ts#L59-L63)
   and the `SUBSCRIPTION_BILLING_REQUIRED` branch in
   [Checkout.tsx:120-128](client/src/pages/store/Checkout.tsx#L120-L128)): recurring-billing
   categories (`comanaged_subscriptions`, `networking_managed`, `ucaas_subscriptions`) are
   blocked from one-time hosted payment entirely — the majority of the co-managed catalog.
   The client again auto-flips to `quote_request` with a toast.
9. Only if all four gates pass does the app POST to Zoho and redirect to a hosted payment
   URL or `/store/order-confirmation`.

**Net effect:** "Pay Now" only ever completes for an already-authenticated
`comanaged`/`admin` portal user buying non-recurring, checkout-enabled items. Every other
visitor — 100% of new prospects — is silently rerouted to quote request.

### Path B — "Request Formal Quote"

1. Visitor opens `/store/quote-request` ([QuoteRequest.tsx](client/src/pages/store/QuoteRequest.tsx))
   — reachable directly, or auto-redirected here from Checkout (step 4/8 above).
2. The form itself renders and is fillable with no login check on page load.
3. On submit, **client-side gate** ([QuoteRequest.tsx:79-88](client/src/pages/store/QuoteRequest.tsx#L79-L88)):
   reads `localStorage.getItem("portalToken")`. If absent, shows a "Sign in required" toast
   and calls `navigate("/portal/login?redirect=/store/quote-request")` — a hard redirect
   to the login page, losing the in-progress form state (the cart/solution itself survives
   in `localStorage`, but the quote-request form fields the visitor just typed do not).
4. If a token is present, `POST /api/store/quote-requests` runs with `[authMiddleware]`
   only ([server/routes.ts:5557](server/routes.ts#L5557)) — any authenticated portal role,
   not restricted to `comanaged`/`admin` like checkout is. Narrower than checkout's gate,
   but still a login gate.

**Net effect:** a visitor rerouted here specifically *because* they weren't logged in hits
the exact same requirement a second time, after having already typed their name, email,
company, and message into the form.

### Where this leaves a new prospect

Fills in billing info → picks "Pay Now" → silently rerouted to Request Quote → fills in
the quote form and submits → bounced to `/portal/login`, losing the quote message they
wrote. There is no point in this journey where they are told, *before* investing effort,
that an account is required.

### Every CTA that leads into this funnel

| CTA | Location | Destination |
|---|---|---|
| Product card "Add" / "Configure" | `StoreProductCard.tsx` | Adds to cart (no gate) |
| Cart drawer "Continue to Checkout" | `ShoppingCart.tsx:510-517` | `/store/checkout`, `paymentMethod="zoho"` |
| Cart drawer "Request Formal Quote" | `ShoppingCart.tsx:518-526` | **Also** `/store/checkout` — same page, `paymentMethod` set to `"quote_request"` via `goQuote()`. A user who reads both buttons as distinct destinations lands on the identical screen. |
| Checkout page's own radios | `Checkout.tsx:283-343` | Same page, branches per Path A/B above |
| "Already a co-managed client?" login link | `Checkout.tsx:346-352` | `/portal/login?redirect=/store/checkout` (the one place the login requirement is stated *before* a failed attempt) |

### The account/role model today (for context on all three proposals below)

- Portal auth is JWT-based (`portalToken` in `localStorage`), issued at `/portal/login`.
- Every portal user carries a `clientType` role: `"managed"`, `"comanaged"`, or `"admin"`
  (`server/portalAuth.ts` / `shared` role types). Checkout's `requireRole("comanaged",
  "admin")` specifically excludes `"managed"`-tier clients from card checkout today.
- Every product carries `requiredClientType` (`"public" | "comanaged" | ...`),
  `isContractOnly`, `isCheckoutEnabled`, and a `category` that determines recurring vs.
  one-time billing. These flags already exist and already drive the client-side auto-reroute
  logic — none of the three proposals below need new product data, only new *gates* on the
  paths that already read these flags.
- There is currently no concept of a "guest" or "lead" account — every order/quote record
  in the current schema is created against an authenticated portal user.

---

## Three implementation proposals

### Proposal A — Guest quote request (no account required)

**User journey:** Visitor fills out `/store/quote-request` (or the checkout page's "Request
a Quote" path) as a net-new visitor. On submit, no login check runs. The quote is created
as a standalone lead record (name/email/company/phone/message/cart snapshot) — not linked
to any portal account. Visitor sees a normal confirmation page. Sales follows up by email/
phone exactly as they would with a phone-in lead today; the human converts it to a real
order manually, at which point a portal account may or may not get created for that client.

**Account model:** No new account type. The quote-request record becomes a first-class
"unauthenticated lead," similar in shape to how `/contact` or `/book` submissions already
work elsewhere on the site (those are also unauthenticated form submissions today).

**Implementation complexity: Low.**
- Drop `authMiddleware` from `POST /api/store/quote-requests` specifically (leave every
  other store route's auth untouched).
- Quote-request records need an optional `portalUserId` instead of a required one — a
  schema/type relaxation, not a new table.
- Client-side: remove the `portalToken` check + redirect in `QuoteRequest.tsx:79-88`;
  submit directly.

**API changes required:**
- `POST /api/store/quote-requests`: relax from `[authMiddleware]` to no middleware (or a
  lightweight optional-auth middleware that still attaches a portal user if a valid token
  happens to be present, so existing clients' quotes stay linked as they are today).
- Add basic anti-abuse controls that authenticated-only endpoints get "for free" today:
  rate-limiting by IP, a honeypot field, or CAPTCHA on this one now-public endpoint. This
  is the one genuinely new piece of work.

**Security implications:** Low-moderate. The endpoint moves from "authenticated write" to
"public write," which is the same trust tier as `/contact`, `/book`, and the newsletter
signup already on the site — not a new class of exposure for this codebase, but it does
need the same spam/abuse hardening those forms presumably already have (worth confirming
they do, and copying that pattern here). No payment surface is touched.

**UX implications:** Directly fixes the "typed a quote, then got logged out mid-flow" dead
end. Does *not* fix "Pay Now" — a visitor who explicitly wants to pay by card today still
can't, and lands in the same "quote request" bucket as everyone else. Copy on the button
should probably shift from "Request Formal Quote" to something that doesn't imply it's a
lesser/slower path once it's genuinely self-serve.

**Advantages:** Smallest, lowest-risk change; solves the more common of the two funnel
exits (quote request) for every net-new visitor immediately; touches no payment code.

**Disadvantages:** Doesn't move the "can a new prospect actually buy something today"
needle — that's still Proposal B/C's job. A visitor who wants to self-checkout still can't,
they just get a better-behaved dead end.

---

### Proposal B — Guest checkout with optional account creation

**User journey:** A net-new visitor reaches `/store/checkout` with a cart of
`isCheckoutEnabled`, non-contract items (recurring-billing categories still route to
quote per the existing `SUBSCRIPTION_BILLING_REQUIRED` logic — that gate is a commercial
rule, not an auth rule, and is out of scope for this proposal). Instead of requiring
`portalToken`, checkout accepts the billing form's email as the order's identity. After
Zoho payment succeeds, the visitor lands on `/store/order-confirmation` with an offer:
"Create a password to manage this order in your Client Portal" (optional, not blocking).
If they decline, the order still exists, tied to their email, and support can look it up
by order number + email if they contact later.

**Account model:** Introduces a genuine "guest" order — one not linked to a `portalUserId`
at time of purchase. Two sub-options for the account layer, in increasing order of scope:
1. **No new account type at all** — the order is just an unlinked row with a billing
   email. If the guest later creates a portal account with the same email, a one-time
   manual/admin "claim your past orders" action links them. Simplest.
2. **Auto-provisioned lightweight account** — checkout silently creates a portal user
   record at `"managed"`-tier with a random password, emails a "set your password" link.
   Every guest becomes a real portal user immediately, no orphaned orders ever exist, but
   this is a bigger change to the portal user model (an account exists that the person
   never explicitly agreed to create — a dark-pattern risk worth flagging, not just an
   engineering one).

**Implementation complexity: High.**
- New or relaxed checkout route that accepts `[optionalAuthMiddleware]` instead of
  `[authMiddleware, requireRole("comanaged", "admin")]`, with the per-line-item
  `isPurchasableForRole` check re-derived for a guest (i.e., a "public"
  `requiredClientType` check that doesn't need a role at all).
- Order/payment records need a nullable `portalUserId` plus a `guestEmail` +
  `guestOrderToken` (a random, unguessable token emailed to the guest so *they* can look
  up their own order/confirmation without an account — this token is new surface area
  that needs its own security review, since it's effectively a bearer credential).
- Zoho-side: confirm the Zoho Payments/Subscriptions integration can create an order/
  customer record without a linked portal user id (worth a spike before committing to
  scope, per `server/secureStoreCheckout.ts`'s current assumptions).
- If pursuing sub-option 2 (auto-provisioned account): full account-creation email flow
  (set-password token, expiry, resend), which is meaningfully new infrastructure.

**API changes required:**
- `POST /api/store/checkout/zoho`: new guest-accepting variant of the role check.
- New: an order-lookup-by-token endpoint for guest order confirmation/history.
- If sub-option 2: `POST` for silent account provisioning + a password-set flow (reusing
  existing portal password-reset email infra if it exists).

**Security implications: The highest of the three proposals.** This is the one that
actually creates a new class of unauthenticated write with a payment side effect. Needs:
review of whether `requireRole("comanaged", "admin")`'s current restriction is a
commercial policy (only existing clients self-checkout) or a security backstop — if the
former, guest checkout is a business decision layered on top of an engineering change; if
the latter, this proposal needs a compensating control (e.g., manual review queue for
first-time guest orders above a dollar threshold, matching common ecommerce fraud
practice). The guest-order-lookup token is a new bearer-credential surface that needs
expiry and rate-limiting like any password-reset-style token.

**UX implications:** This is the one that actually lets a self-serve buyer complete a
purchase today for the safe subset of the catalog. Order confirmation needs new copy
explaining what happens next for a guest (no client portal login yet, here's your
receipt/order number, here's how to check status).

**Advantages:** Directly fixes the single biggest funnel ceiling identified in this trace —
a genuine self-serve buyer, today, gets nothing; this proposal gets them a completed order
for the products where that's commercially sound.

**Disadvantages:** Real engineering scope (new order-identity model, new token-based
lookup, a security review of a relaxed payment-adjacent role check) and a genuine policy
question (does DE want frictionless card checkout for a stranger at all, for any SKU?)
that this document can surface but not answer.

---

### Proposal C — Hybrid: self-serve for simple SKUs, guided intake for everything else

**User journey:** Same guest-checkout mechanism as Proposal B, but scoped *only* to a
pre-approved, genuinely simple subset of the catalog — one-time, low-touch items already
flagged `isCheckoutEnabled` and not contract/recurring (e.g., the digital
assessments/templates/training categories, and any one-time hardware SKU that doesn't need
a services engagement). Everything else in the catalog — the co-managed subscriptions,
managed-services contracts, anything `isContractOnly` — keeps today's behavior exactly:
adding it to cart routes the visitor to a **prospect-intake form** (effectively Proposal
A's guest quote request, but framed as "tell us about your environment" rather than a
generic quote form, since these SKUs genuinely need a human scoping conversation before a
price is real). The cart/checkout UI would need to visually distinguish "in your cart,
ready to buy now" items from "in your cart, needs a quick conversation first" items when
both are mixed together, rather than silently flipping the whole cart to quote-mode the
way `SUBSCRIPTION_BILLING_REQUIRED` does today.

**Account model:** Same as Proposal B's simplest sub-option (unlinked guest order with
email + lookup token) for the self-serve subset; Proposal A's account-free lead record for
the intake subset. No new account type needed.

**Implementation complexity: Medium-High** — meaningfully less than full Proposal B
because the "what's actually safe to sell to a stranger with no human review" question is
answered by *category*, reusing data that already exists (`category`, `isContractOnly`,
`isCheckoutEnabled`), rather than needing a fraud/risk framework for the whole catalog.
Still needs the same guest-order-identity plumbing as Proposal B, just gated to a smaller,
lower-risk SKU set, plus the mixed-cart UI work.
- Reuse Proposal B's guest checkout route, but with the "safe subset" allowlist enforced
  server-side (not just client-side) so it can't be bypassed by posting an arbitrary SKU.
- Reuse Proposal A's relaxed quote endpoint for the intake path.
- New: cart/checkout UI that can show both a "pay now" total and a "needs a quick call"
  list in the same view instead of the current binary reroute.

**API changes required:** Union of A's and B's, applied to disjoint SKU sets, plus a
server-side allowlist check (category/flag-based) on the guest-checkout route so the split
is enforced in one place, not just in the UI.

**Security implications:** Meaningfully lower than full Proposal B, because the dollar/
scope exposure of an unauthenticated payment is capped to the intentionally "simple" SKU
set (small one-time items) rather than the whole catalog including higher-value managed-
services contracts. Still needs the same guest-order-token hygiene as Proposal B for the
subset it does cover.

**UX implications:** This is the option that best matches how the catalog actually reads
today (Phase 1's audit already found the recurring/contract split is the majority of
SKUs) — most visitors would still land in "let's talk," but the ones buying a one-time
assessment or template can genuinely just buy it. Requires new "why is my cart split into
two totals" copy so the distinction reads as helpful, not confusing.

**Advantages:** Best risk/reward balance of the three — real self-serve conversion for the
SKUs where it's commercially uncontroversial, without opening a payment-fraud surface on
the higher-value managed-services contracts, and without an all-or-nothing policy decision
on card-present strangers.

**Disadvantages:** More product-thinking work than either A or B alone (someone has to
own and periodically review the "safe to self-checkout" allowlist as the catalog changes);
the mixed-cart UI is genuinely new interaction design, not a reuse of existing screens.

---

## Recommendation

**Proposal C**, if only one is chosen. It's the only option that actually moves the
"can a new prospect buy something today" answer from "no, never" to "yes, for the
products where that's commercially sound" — which Proposal A alone does not — while
containing the security/fraud exposure to a deliberately small, low-value SKU subset
rather than the full catalog, which Proposal B alone does not. It also matches the
catalog's actual shape: Phase 1's route audit already found most of the co-managed
catalog is recurring/contract work that legitimately benefits from a human scoping
conversation, so treating that majority as "intake" isn't a compromise, it's honest.

That said, **Proposal A is not mutually exclusive with C** and is nearly free to ship on
its own first: dropping the auth requirement on the quote-request endpoint fixes the
"lost my typed message" dead end for every visitor immediately, days before C's guest-
checkout plumbing could realistically be built and security-reviewed. If sequencing
matters, A → C is a reasonable path; C absorbs A's intake half once it exists.

Proposal B (full-catalog guest checkout) is the one I'd steer away from unless there's a
business reason to want frictionless card payment from strangers for *every* SKU
including managed-services contracts — the trace above suggests that's not how the
catalog is actually structured today (most of it is intentionally consultative), so B's
extra scope over C buys risk without a clear matching benefit.

**Nothing above has been implemented.** This is a decision document only.

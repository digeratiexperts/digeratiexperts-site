import { useEffect, useMemo, useState } from "react";
import type { BuyerRole, PostalAddress, TaxQuoteResponse } from "@shared/deStoreContract";
import { formatUsdFromCents } from "@shared/deStoreContract";
import { AutoRenewTerms } from "@/components/store/AutoRenewTerms";
import { DeStoreClickwrap, PLACE_ORDER_BUTTON_LABEL, type DeStoreClickwrapValue } from "@/components/store/DeStoreClickwrap";
import { DeStoreShell } from "@/components/store/DeStoreShell";
import { loadAutoRenewContractEnabled } from "@/lib/autoRenewCapabilities";
import { deStoreFetch, type DeStoreStatus } from "@/lib/deStoreApi";
import {
  autoRenewConsentRequiredSkus,
  frequencyFromGatedSku,
  termMonthsForFrequency,
  type AutoRenewClientConsent,
  type AutoRenewFrequency,
} from "@shared/autoRenewContract";

const emptyAddress: PostalAddress = {
  name: "",
  company: "",
  street1: "",
  street2: "",
  city: "",
  region: "",
  postalCode: "",
  country: "US",
};

function AddressFields({
  id,
  legend,
  value,
  onChange,
}: {
  id: string;
  legend: string;
  value: PostalAddress;
  onChange: (next: PostalAddress) => void;
}) {
  const set = (key: keyof PostalAddress, next: string) => onChange({ ...value, [key]: next });
  const field = (key: keyof PostalAddress, label: string, autoComplete: string, required = true) => (
    <label className="block text-sm font-medium text-zinc-200" htmlFor={`${id}-${key}`}>
      {label}
      <input
        id={`${id}-${key}`}
        autoComplete={autoComplete}
        required={required}
        className="mt-2 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-base text-white outline-none ring-de-magenta focus:ring-2"
        value={value[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      />
    </label>
  );
  return (
    <fieldset className="rounded-2xl border border-white/15 bg-de-surface p-6 sm:p-8">
      <legend className="px-2 text-xl font-semibold text-white">{legend}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {field("name", "Contact name", "name")}
        {field("company", "Business name", "organization")}
        <div className="sm:col-span-2">{field("street1", "Street address", "address-line1")}</div>
        <div className="sm:col-span-2">{field("street2", "Apartment, suite, or unit", "address-line2", false)}</div>
        {field("city", "City", "address-level2")}
        {field("region", "State", "address-level1")}
        {field("postalCode", "ZIP", "postal-code")}
      </div>
    </fieldset>
  );
}

function LineTable({ quote }: { quote: TaxQuoteResponse }) {
  const rows = [
    ...quote.lines.map((line) => ({
      id: line.lineId,
      label: line.description || line.lineId,
      amount: line.taxableAmountCents,
      tax: line.taxCents,
      fee: line.feeCents,
      category: line.taxCategory,
    })),
    ...quote.fees.map((line) => ({
      id: line.lineId,
      label: line.description || line.feeKind || line.lineId,
      amount: line.taxableAmountCents,
      tax: line.taxCents,
      fee: line.feeCents,
      category: line.taxCategory,
    })),
  ];
  return (
    <section className="rounded-2xl border border-white/15 bg-de-surface p-6 sm:p-8" aria-labelledby="order-summary-heading">
      <h2 id="order-summary-heading" className="text-2xl font-semibold text-white">
        Order summary
      </h2>
      <table className="mt-6 w-full text-left text-base text-zinc-200">
        <thead>
          <tr className="border-b border-white/15 text-sm uppercase tracking-wide text-zinc-400">
            <th className="pb-3 font-medium">Line</th>
            <th className="pb-3 font-medium">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-white/10">
              <td className="py-3 pr-4">
                <div>{row.label}</div>
                <div className="text-sm text-zinc-500">{row.category.replace(/_/g, " ")}</div>
              </td>
              <td className="py-3 align-top">{formatUsdFromCents(row.amount + row.tax + row.fee)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="mt-6 space-y-2 text-base">
        <div className="flex justify-between text-zinc-300">
          <dt>Subtotal</dt>
          <dd>{formatUsdFromCents(quote.subtotalCents)}</dd>
        </div>
        <div className="flex justify-between text-zinc-300">
          <dt>Tax</dt>
          <dd>{formatUsdFromCents(quote.taxCents)}</dd>
        </div>
        <div className="flex justify-between text-zinc-300">
          <dt>Fees</dt>
          <dd>{formatUsdFromCents(quote.feeCents)}</dd>
        </div>
        <div className="flex justify-between text-lg font-semibold text-white">
          <dt>Total</dt>
          <dd>{formatUsdFromCents(quote.totalCents)}</dd>
        </div>
      </dl>
    </section>
  );
}

function CheckoutBody({ status }: { status: DeStoreStatus }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<BuyerRole>("self_managed");
  const [billTo, setBillTo] = useState<PostalAddress>(emptyAddress);
  const [shipTo, setShipTo] = useState<PostalAddress>(emptyAddress);
  const [shipSameAsBilling, setShipSameAsBilling] = useState(false);
  const [clickwrap, setClickwrap] = useState<DeStoreClickwrapValue>({
    box1Accepted: false,
    box2Accepted: false,
    box4Accepted: false,
    box6Accepted: false,
    businessName: "",
  });
  const [quote, setQuote] = useState<TaxQuoteResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [autoRenewEnabled, setAutoRenewEnabled] = useState(false);
  const [autoRenewConsentChecked, setAutoRenewConsentChecked] = useState(false);
  const [autoRenewConsent, setAutoRenewConsent] = useState<AutoRenewClientConsent | null>(null);

  const shippingAddress = shipSameAsBilling ? billTo : shipTo;
  const readyForQuote = Boolean(email && billTo.street1 && billTo.city && billTo.region && billTo.postalCode && shippingAddress.street1);
  // Cart lines stay empty until published catalog prices exist. Do not invent a cart or a price.
  const lines: Array<{ sku: string; unitAmountCents: number; quantity: number }> = [];
  const autoRenewSkus = autoRenewConsentRequiredSkus(lines);
  const autoRenewFrequency: AutoRenewFrequency | null = autoRenewSkus.length
    ? autoRenewSkus.reduce<AutoRenewFrequency | null>((found, sku) => {
        const next = frequencyFromGatedSku(sku);
        if (!found) return next;
        return found === next ? found : null;
      }, null)
    : null;
  const autoRenewPriceCents = lines
    .filter((line) => autoRenewSkus.includes(line.sku))
    .reduce((sum, line) => sum + line.unitAmountCents * line.quantity, 0);
  const autoRenewRequired = autoRenewSkus.length > 0;
  const autoRenewReady =
    !autoRenewRequired || (autoRenewEnabled && autoRenewConsentChecked && autoRenewConsent !== null && autoRenewPriceCents > 0);
  const acknowledgementsReady =
    clickwrap.box1Accepted && clickwrap.box2Accepted && clickwrap.businessName.trim().length > 0 && autoRenewReady;

  useEffect(() => {
    const controller = new AbortController();
    loadAutoRenewContractEnabled(controller.signal).then((enabled) => {
      if (!controller.signal.aborted) setAutoRenewEnabled(enabled);
    });
    return () => controller.abort();
  }, []);

  const payload = useMemo(
    () => ({
      email,
      buyerRole: role,
      billTo,
      shipTo: shippingAddress,
      serviceAddress: billTo,
      lines,
      clickwrap: {
        ...clickwrap,
        buttonText: PLACE_ORDER_BUTTON_LABEL,
      },
      consent: autoRenewConsent,
    }),
    [email, role, billTo, shippingAddress, clickwrap, autoRenewConsent],
  );

  async function requestQuote() {
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      const res = await deStoreFetch("/api/store/v1/tax/quote", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Tax could not be quoted. No payment has been taken.");
        return;
      }
      setQuote(body as TaxQuoteResponse);
    } catch {
      setError("Tax could not be quoted. No payment has been taken.");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder() {
    if (!quote || !acknowledgementsReady) return;
    setBusy(true);
    setError("");
    try {
      const res = await deStoreFetch("/api/store/v1/checkout", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "The order could not be placed. No payment has been taken.");
        return;
      }
      setConfirmation(body.siteOrderId || "recorded");
    } catch {
      setError("The order could not be placed. No payment has been taken.");
    } finally {
      setBusy(false);
    }
  }

  if (confirmation) {
    return (
      <div className="mx-auto max-w-2xl py-12">
        <h1 className="text-4xl font-semibold text-white">Order received</h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-300">
          Your Digerati Experts order reference is {confirmation}. Fulfillment status will appear in the Client Portal when the Hub records it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm uppercase tracking-[0.22em] text-de-magenta">Checkout</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight text-white sm:text-5xl">Place an order</h1>
        <p className="mt-4 text-lg leading-relaxed text-zinc-300">{status.whereWeSellAddressStep}</p>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">{status.shippingPromise}</p>
        <p className="mt-3 text-base leading-relaxed text-zinc-400">{status.day5DelayNotice}</p>
      </header>

      {error && (
        <p className="rounded-2xl border border-red-400/40 bg-red-950/40 px-5 py-4 text-base text-red-100" role="alert">
          {error}
        </p>
      )}

      <label className="block max-w-xl text-sm font-medium text-zinc-200" htmlFor="store-email">
        Email
        <input
          id="store-email"
          type="email"
          autoComplete="email"
          className="mt-2 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-base text-white outline-none ring-de-magenta focus:ring-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label className="block max-w-xl text-sm font-medium text-zinc-200" htmlFor="store-role">
        How you will use this purchase
        <select
          id="store-role"
          className="mt-2 w-full rounded-xl border border-white/20 bg-black px-4 py-3 text-base text-white outline-none ring-de-magenta focus:ring-2"
          value={role}
          onChange={(event) => setRole(event.target.value as BuyerRole)}
        >
          <option value="managed">Managed</option>
          <option value="comanaged">Co-Managed</option>
          <option value="self_managed">Self-Managed</option>
        </select>
      </label>

      <AddressFields id="bill" legend="Billing address" value={billTo} onChange={setBillTo} />

      <label className="flex items-center gap-3 text-base text-zinc-200">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--de-magenta)]"
          checked={shipSameAsBilling}
          onChange={(event) => setShipSameAsBilling(event.target.checked)}
        />
        Ship to the billing address
      </label>
      {!shipSameAsBilling && (
        <AddressFields id="ship" legend="Shipping address" value={shipTo} onChange={setShipTo} />
      )}

      <p className="text-base leading-relaxed text-zinc-400">
        Catalog listings are not published yet, so this checkout will not invent a cart or a price. Tax, shipping, and statutory fees will appear as separate lines from the Hub after a successful quote.
      </p>

      <button
        type="button"
        disabled={!readyForQuote || busy}
        onClick={requestQuote}
        className="rounded-full border border-white/30 px-6 py-3 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        Get tax quote
      </button>

      {quote && <LineTable quote={quote} />}

      <DeStoreClickwrap
        role={role}
        hasHardware={false}
        consumerCheckout={status.consumerCheckout}
        totalCents={quote?.totalCents ?? null}
        value={clickwrap}
        onChange={setClickwrap}
        disabled={busy}
      />

      {autoRenewRequired && autoRenewEnabled && autoRenewFrequency && autoRenewPriceCents > 0 && (
        <AutoRenewTerms
          priceCents={autoRenewPriceCents}
          frequency={autoRenewFrequency}
          termMonths={termMonthsForFrequency(autoRenewFrequency)}
          checked={autoRenewConsentChecked}
          onCheckedChange={(next, consent) => {
            setAutoRenewConsentChecked(next);
            setAutoRenewConsent(consent);
          }}
          disabled={busy}
        />
      )}

      {autoRenewRequired && !autoRenewEnabled && (
        <p className="text-base leading-relaxed text-zinc-300" data-testid="text-autorenew-quote-only">
          Subscription checkout is not available. Request a quote for these items.
        </p>
      )}

      <button
        type="button"
        disabled={!quote || !acknowledgementsReady || busy || (autoRenewRequired && !autoRenewReady)}
        onClick={placeOrder}
        className="rounded-full bg-de-magenta px-8 py-4 text-lg font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
      >
        {PLACE_ORDER_BUTTON_LABEL}
      </button>
    </div>
  );
}

export default function DeStoreCheckout() {
  return (
    <DeStoreShell
      title="Store checkout"
      description="Checkout for the Digerati Experts store. Tax is quoted by the Hub, and payment is not taken if a state is blocked or tax cannot be quoted."
      canonical="/store/order"
    >
      {(status) => <CheckoutBody status={status} />}
    </DeStoreShell>
  );
}

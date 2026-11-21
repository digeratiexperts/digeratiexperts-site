import { Link } from "wouter";
import type { BuyerRole } from "@shared/deStoreContract";
import { formatUsdFromCents } from "@shared/deStoreContract";
import {
  CONSUMER_ESIGN_BOX,
  PLACE_ORDER_BUTTON_LABEL,
  box1Label,
  box2Label,
  box4Label,
  clickwrapNotice,
} from "@shared/deStoreLegalCopy";

export type DeStoreClickwrapValue = {
  box1Accepted: boolean;
  box2Accepted: boolean;
  box4Accepted: boolean;
  box6Accepted: boolean;
  businessName: string;
};

export function DeStoreClickwrap({
  role,
  hasHardware,
  consumerCheckout,
  totalCents,
  recurringTail = "",
  value,
  onChange,
  disabled,
  error,
}: {
  role: BuyerRole;
  hasHardware: boolean;
  consumerCheckout: boolean;
  totalCents: number | null;
  recurringTail?: string;
  value: DeStoreClickwrapValue;
  onChange: (next: DeStoreClickwrapValue) => void;
  disabled?: boolean;
  error?: string;
}) {
  const totalToday = totalCents == null ? "[$total today]" : formatUsdFromCents(totalCents);
  const toggle = (key: keyof DeStoreClickwrapValue) => {
    if (typeof value[key] === "boolean") onChange({ ...value, [key]: !value[key] });
  };

  return (
    <section
      className="rounded-3xl border border-white/15 bg-black/55 p-7 sm:p-10"
      aria-labelledby="store-clickwrap-heading"
    >
      <h2 id="store-clickwrap-heading" className="text-3xl font-semibold tracking-tight text-white">
        Agreements
      </h2>
      <p className="mt-3 max-w-3xl text-lg leading-8 text-zinc-200">
        Review the documents linked below, then check each box that applies. The payment button stays off until the required boxes are checked.
      </p>
      <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-3 text-base text-[rgb(var(--de-accent-ink-rgb))]">
        <li><Link href="/legal/store-terms-of-sale" className="underline underline-offset-4">Store Terms of Sale</Link></li>
        <li><Link href="/legal/limited-warranty" className="underline underline-offset-4">Limited Warranty</Link></li>
        <li><Link href="/legal/return-and-refund" className="underline underline-offset-4">Return and Refund Policy</Link></li>
        <li><Link href="/legal/preinstalled-software" className="underline underline-offset-4">Preinstalled Software Notice</Link></li>
      </ul>

      <label className="mt-8 flex cursor-pointer items-start gap-4 text-lg leading-8 text-zinc-100">
        <input
          type="checkbox"
          className="mt-1.5 h-6 w-6 shrink-0 accent-[rgb(var(--de-accent-rgb))]"
          checked={value.box1Accepted}
          disabled={disabled}
          onChange={() => toggle("box1Accepted")}
        />
        <span>{box1Label(role)}</span>
      </label>

      <label className="mt-6 block text-base font-medium text-zinc-100" htmlFor="store-business-name">
        Business legal name
      </label>
      <input
        id="store-business-name"
        type="text"
        autoComplete="organization"
        className="mt-2 w-full rounded-2xl border border-white/20 bg-black px-4 py-4 text-lg text-white outline-none ring-[rgb(var(--de-accent-ink-rgb))] focus:ring-2"
        value={value.businessName}
        disabled={disabled}
        onChange={(event) => onChange({ ...value, businessName: event.target.value })}
      />

      <label className="mt-6 flex cursor-pointer items-start gap-4 text-lg leading-8 text-zinc-100">
        <input
          type="checkbox"
          className="mt-1.5 h-6 w-6 shrink-0 accent-[rgb(var(--de-accent-rgb))]"
          checked={value.box2Accepted}
          disabled={disabled}
          onChange={() => toggle("box2Accepted")}
        />
        <span>{box2Label(value.businessName)}</span>
      </label>

      {hasHardware && (
        <label className="mt-6 flex cursor-pointer items-start gap-4 text-lg leading-8 text-zinc-100">
          <input
            type="checkbox"
            className="mt-1.5 h-6 w-6 shrink-0 accent-[rgb(var(--de-accent-rgb))]"
            checked={value.box4Accepted}
            disabled={disabled}
            onChange={() => toggle("box4Accepted")}
          />
          <span>{box4Label(role)}</span>
        </label>
      )}

      {consumerCheckout && (
        <label className="mt-6 flex cursor-pointer items-start gap-4 text-lg leading-8 text-zinc-100">
          <input
            type="checkbox"
            className="mt-1.5 h-6 w-6 shrink-0 accent-[rgb(var(--de-accent-rgb))]"
            checked={value.box6Accepted}
            disabled={disabled}
            onChange={() => toggle("box6Accepted")}
          />
          <span>{CONSUMER_ESIGN_BOX}</span>
        </label>
      )}

      <p className="mt-8 text-lg leading-8 text-zinc-100">{clickwrapNotice(totalToday, recurringTail)}</p>
      {error && (
        <p className="mt-4 text-lg text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export { PLACE_ORDER_BUTTON_LABEL };

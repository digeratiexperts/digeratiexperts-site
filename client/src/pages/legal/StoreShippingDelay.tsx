import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { DAY_5_DELAY_NOTICE_SUMMARY, SHIPPING_PROMISE } from "@shared/deStoreLegalCopy";

export default function StoreShippingDelay() {
  return (
    <LegalDocumentLayout
      title="Shipping, Delay Notice, and Order Cancellation"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Shipping promise and delay-or-cancel policy for Digerati Experts store merchandise."
      canonical="/legal/shipping-delay"
    >
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">The promise</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">{SHIPPING_PROMISE}</p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">If DE cannot ship on time</h2>
      <p className="text-[#3A3448] leading-relaxed mb-4">{DAY_5_DELAY_NOTICE_SUMMARY}</p>
      <ul className="list-disc pl-6 text-[#3A3448] space-y-3 mb-8">
        <li>If the new date is no more than thirty (30) days after the original promised date and you do not respond, you consent to the delay.</li>
        <li>If the new date is more than thirty (30) days later, or DE cannot give a date, your order is cancelled and refunded unless you expressly agree to wait. If you agree to an indefinite delay, you may still cancel at any time before the kit ships.</li>
        <li>If DE then cannot meet the new date, DE will ask you again before that date, and your order is cancelled and refunded unless you expressly agree.</li>
      </ul>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">You may cancel before shipment</h2>
      <p className="text-[#3A3448] leading-relaxed">
        You may cancel an unshipped hardware order at any time before DE hands it to the carrier, for a full refund, by using the "Cancel order" button on your order page or by emailing admin@digeratiexperts.com.
      </p>
    </LegalDocumentLayout>
  );
}

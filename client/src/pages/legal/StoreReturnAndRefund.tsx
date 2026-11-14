import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";

export default function StoreReturnAndRefund() {
  return (
    <LegalDocumentLayout
      title="Return and Refund Policy"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Return and refund policy for Digerati Experts store hardware and services."
      canonical="/legal/return-and-refund"
    >
      <p className="mb-8 text-lg leading-relaxed text-[#3A3448]">
        This policy is shown before purchase on every hardware product page and at checkout. It adds to, and does not limit, the DE Limited Warranty, MSA Exhibit I, and any law that cannot be waived.
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Dead on arrival or damaged in transit</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">
        If a kit arrives damaged, incomplete, or does not power on or work as described, tell DE within five (5) Business Days after delivery through the DE support portal or by phone at (480) 519-5892. DE will send a prepaid return label and, at your choice, ship a replacement or refund the full price including shipping. No restocking fee applies. Please keep the packaging and photograph any shipping damage.
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Returns for any reason — business buyers</h2>
      <ul className="list-disc pl-6 text-[#3A3448] space-y-3 mb-8">
        <li>You may return a hardware kit within fourteen (14) days after delivery.</li>
        <li>Unopened, with the tamper seal intact: full refund of the item price. Original shipping is not refunded, and you pay return shipping.</li>
        <li>Opened or activated but not defective: refund of the item price less a restocking fee of fifteen percent (15%), which covers inspection, re-sanitization, and re-imaging.</li>
        <li>Return all parts, accessories, and documentation. Missing items are deducted at DE's listed replacement price.</li>
      </ul>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Never charged a restocking fee</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">
        Defective items, items that do not match the listing (including the stated grade, battery health, or replaced parts), wrong items, shipping damage, and orders cancelled under the DE Shipping, Delay Notice, and Order Cancellation Policy.
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Subscriptions and services</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">
        Store subscriptions are cancelled online under MSA Exhibit I, Section I.3(c). Cancellation stops all future charges immediately; access continues through the period already paid; fees already paid for the current period are not refunded, except as the law requires or as MSA Exhibit I, Sections I.4 and I.5 provide (MSA Exhibit I, Section I.3(d)). Services already performed are covered by the services warranty in MSA Section 11.1.
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Refund timing</h2>
      <p className="text-[#3A3448] leading-relaxed mb-8">
        DE refunds to the original payment method within seven (7) working days after DE receives and checks the return, or, for card payments, by a credit issued within one (1) billing cycle. Refunds for orders cancelled before shipment follow MSA Exhibit I, Section I.4(c).
      </p>
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">Your data</h2>
      <p className="text-[#3A3448] leading-relaxed">
        Back up and remove your data before returning a device. DE sanitizes every returned device under the DE Data Sanitization Statement and is not responsible for data left on it.
      </p>
    </LegalDocumentLayout>
  );
}

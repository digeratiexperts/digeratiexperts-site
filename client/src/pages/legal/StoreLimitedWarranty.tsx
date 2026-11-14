import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { WARRANTY_MAILING_ADDRESS_PLACEHOLDER } from "@shared/deStoreLegalCopy";

export default function StoreLimitedWarranty() {
  return (
    <LegalDocumentLayout
      title="Limited Warranty"
      subtitle="Draft v2026.10-store. Not published until Joseph approves it."
      description="Digerati Experts 90-Day Limited Warranty for hardware sold in the store."
      canonical="/legal/limited-warranty"
    >
      <h2 className="text-2xl font-bold text-[#1A1228] mb-4">DE 90-Day Limited Warranty</h2>
      <p className="text-[#3A3448] leading-relaxed mb-4">
        <strong>90-DAY LIMITED WARRANTY.</strong> Digerati Experts, LLC, {WARRANTY_MAILING_ADDRESS_PLACEHOLDER}, (480) 519-5892, admin@digeratiexperts.com ("DE"), warrants to the original purchaser that each hardware item DE sells, new or refurbished, will be free from defects in materials and workmanship and will perform substantially as described on its product page under normal use for ninety (90) days from the date it is delivered.
      </p>
      <ul className="list-disc pl-6 text-[#3A3448] space-y-3 mb-8">
        <li><strong className="text-[#1A1228]">Not covered.</strong> Cosmetic wear consistent with the stated refurbished grade; damage from accident, drops, liquid, power surges, misuse, or repair by others that caused the defect; software, data, and consumables; and normal battery wear, except that a battery that fails or falls below sixty percent (60%) of design capacity during the warranty period is covered. Using non-DE service or parts does not void this warranty unless they caused the defect.</li>
        <li><strong className="text-[#1A1228]">What DE will do.</strong> DE will, at its option, repair the item, replace it with an equivalent or better item, or, if neither is practicable, refund the purchase price. DE pays shipping both ways for valid claims within the United States. A repaired or replacement item is covered for the rest of the original warranty period or thirty (30) days, whichever is longer.</li>
        <li><strong className="text-[#1A1228]">How to claim.</strong> Email DE or use the DE support portal with the order number, serial number, and a description of the problem. DE will respond within two (2) Business Days with troubleshooting steps or a return authorization and prepaid label. Back up data first; DE sanitizes returned devices and is not responsible for data left on them. DE has no informal dispute settlement mechanism under 16 C.F.R. Part 703.</li>
        <li><strong className="text-[#1A1228]">Manufacturer warranty.</strong> Each product page states whether any manufacturer warranty still applies. That warranty, if any, is in addition to this one.</li>
        <li><strong className="text-[#1A1228]">Limits.</strong> ANY IMPLIED WARRANTIES, INCLUDING MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE, ARE LIMITED TO THE 90-DAY DURATION OF THIS WRITTEN WARRANTY. DE IS NOT LIABLE FOR INCIDENTAL OR CONSEQUENTIAL DAMAGES FOR BREACH OF THIS WARRANTY, EXCEPT FOR PERSONAL INJURY. Some States do not allow limitations on how long an implied warranty lasts, so the above limitation may not apply to you. Some States do not allow the exclusion or limitation of incidental or consequential damages, so the above limitation or exclusion may not apply to you. This warranty gives you specific legal rights, and you may also have other rights which vary from State to State.</li>
        <li><strong className="text-[#1A1228]">No tie-in.</strong> This warranty does not require you to buy any Digerati Experts service or use any particular brand of parts or service.</li>
      </ul>
    </LegalDocumentLayout>
  );
}

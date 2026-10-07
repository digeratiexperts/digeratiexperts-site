import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { ShieldAlert, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function AUP() {
  return (
    <LegalDocumentLayout
      title="Acceptable Use Policy"
      subtitle="Version 2025.1 | Effective January 1, 2025"
      description="Digerati Experts Acceptable Use Policy (AUP): permitted and prohibited uses of managed services, systems, and networks."
      canonical="/legal/aup"
      icon={<ShieldAlert className="h-5 w-5" />}
    >
      <p className="mb-6 text-lg text-[#3A3448]">
        Our Acceptable Use Policy (AUP) defines the permitted and prohibited uses of Digerati Experts'
        services, systems, and networks.
      </p>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">Prohibited Activities:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>Illegal activities or violation of any laws</li>
          <li>Distribution of malware, viruses, or malicious code</li>
          <li>Unauthorized access to systems or data</li>
          <li>Network scanning or vulnerability exploitation</li>
          <li>Spamming or unsolicited bulk email</li>
          <li>Interference with service to other users</li>
          <li>Circumvention of security controls</li>
          <li>Excessive resource consumption</li>
        </ul>
      </div>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">Permitted Uses:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>Legitimate business operations and communications</li>
          <li>Authorized access to managed systems and services</li>
          <li>Reasonable resource utilization for business needs</li>
          <li>Security testing with prior written authorization</li>
          <li>Compliance with all applicable security policies</li>
        </ul>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold text-[#1A1228]">Enforcement</h2>
      <p className="mb-6 text-[#3A3448]">
        Violation of this AUP may result in immediate suspension of services, termination of your
        account, and/or legal action. We reserve the right to monitor use of our services to ensure
        compliance with this policy and applicable laws.
      </p>

      <h2 className="mb-4 mt-8 text-xl font-bold text-[#1A1228]">Request Full AUP</h2>
      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button
          variant="brand"
          onClick={() => {
            window.location.href = "mailto:legal@digeratiexperts.com?subject=AUP Request";
          }}
          data-testid="button-request-aup"
        >
          <Mail className="mr-2 h-5 w-5" />
          Request AUP via Email
        </Button>
        <Button
          variant="outline"
          className="border-black/25 text-[#1A1228] hover:bg-black/5"
          onClick={() => {
            window.location.href = PRIMARY_PHONE.telHref;
          }}
        >
          Call {PRIMARY_PHONE.display}
        </Button>
      </div>
    </LegalDocumentLayout>
  );
}

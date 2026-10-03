import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { Database, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function DPA() {
  return (
    <LegalDocumentLayout
      title="Data Processing Agreement"
      subtitle="Version 2025.1 | Effective January 1, 2025"
      description="Digerati Experts Data Processing Agreement (DPA) covers how client data is processed and protected, including HIPAA BAA, GDPR, CCPA, and PCI DSS provisions."
      canonical="/legal/dpa"
      icon={<Database className="h-5 w-5" />}
    >
      <p className="mb-6 text-lg text-[#3A3448]">
        Our Data Processing Agreement (DPA) governs how Digerati Experts processes and protects
        client data, including provisions for GDPR compliance, HIPAA Business Associate requirements,
        and other data protection regulations.
      </p>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">DPA Covers:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>Scope and duration of data processing activities</li>
          <li>Types of personal data processed</li>
          <li>Security measures and technical safeguards</li>
          <li>Data subject rights and procedures</li>
          <li>Data breach notification requirements</li>
          <li>Subprocessor agreements and approvals</li>
          <li>Data transfer mechanisms and safeguards</li>
          <li>Audit rights and compliance verification</li>
          <li>Data retention and deletion procedures</li>
        </ul>
      </div>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">Compliance Frameworks:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>
            <strong className="text-[#1A1228]">HIPAA:</strong> Business Associate Agreement provisions for Protected Health Information
          </li>
          <li>
            <strong className="text-[#1A1228]">GDPR:</strong> Standard Contractual Clauses for EU data transfers
          </li>
          <li>
            <strong className="text-[#1A1228]">CCPA:</strong> Service provider obligations for California residents
          </li>
          <li>
            <strong className="text-[#1A1228]">PCI DSS:</strong> Cardholder data processing requirements
          </li>
        </ul>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold text-[#1A1228]">Request Our DPA</h2>
      <p className="mb-6 text-[#3A3448]">
        To receive our Data Processing Agreement or discuss specific data protection requirements
        for your organization, please contact our legal team.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button
          variant="brand"
          onClick={() => {
            window.location.href = "mailto:legal@digeratiexperts.com?subject=DPA Request";
          }}
          data-testid="button-request-dpa"
        >
          <Mail className="mr-2 h-5 w-5" />
          Request DPA via Email
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

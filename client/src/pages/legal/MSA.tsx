import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { FileText, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function MSA() {
  return (
    <LegalDocumentLayout
      title="Master Service Agreement"
      subtitle="Version 2025.1 | Effective January 1, 2025"
      description="Digerati Experts Master Service Agreement (MSA) covers managed IT and security services, responsibilities, billing, and termination. Request a copy from legal."
      canonical="/legal/msa"
      icon={<FileText className="h-5 w-5" />}
    >
      <p className="mb-6 text-lg text-[#3A3448]">
        Our Master Service Agreement (MSA) establishes the comprehensive terms and conditions governing
        the provision of managed IT and security services by Digerati Experts to our clients.
      </p>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">What's Included in Our MSA:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>Scope of managed IT and security services</li>
          <li>Service level agreements (SLAs) and response times</li>
          <li>Client and service provider responsibilities</li>
          <li>Payment terms and billing procedures</li>
          <li>Data protection and security requirements</li>
          <li>HIPAA Business Associate provisions (when applicable)</li>
          <li>PCI DSS compliance obligations</li>
          <li>Liability limitations and indemnification</li>
          <li>Term, renewal, and termination conditions</li>
          <li>Dispute resolution procedures</li>
        </ul>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold text-[#1A1228]">Request Our MSA</h2>
      <p className="mb-6 text-[#3A3448]">
        To review our Master Service Agreement or discuss custom terms for your organization,
        please contact our team. We'll provide a copy and schedule a consultation to address
        your specific requirements.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button
          variant="brand"
          onClick={() => {
            window.location.href = "mailto:legal@digeratiexperts.com?subject=MSA Request";
          }}
          data-testid="button-request-msa"
        >
          <Mail className="mr-2 h-5 w-5" />
          Request MSA via Email
        </Button>
        <Button
          variant="outline"
          className="border-black/25 text-[#1A1228] hover:bg-black/5"
          onClick={() => {
            window.location.href = PRIMARY_PHONE.telHref;
          }}
          data-testid="button-call-legal"
        >
          Call {PRIMARY_PHONE.display}
        </Button>
      </div>

      <div className="mt-12 rounded-lg border border-[var(--de-paper-hairline)] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">Contact Legal Department</h3>
        <p className="mb-2 text-[#3A3448]">
          <strong className="text-[#1A1228]">Email:</strong> legal@digeratiexperts.com
        </p>
        <p className="mb-2 text-[#3A3448]">
          <strong className="text-[#1A1228]">Phone:</strong> {PRIMARY_PHONE.display}
        </p>
        <p className="text-[#3A3448]">
          <strong className="text-[#1A1228]">Address:</strong> Chandler, AZ
        </p>
      </div>
    </LegalDocumentLayout>
  );
}

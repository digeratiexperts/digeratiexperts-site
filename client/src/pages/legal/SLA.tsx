import { LegalDocumentLayout } from "@/components/LegalDocumentLayout";
import { Clock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_PHONE } from "@/data/companyContact";

export default function SLA() {
  return (
    <LegalDocumentLayout
      title="Service Level Agreement"
      subtitle="Version 2025.1 | Effective January 1, 2025"
      description="Digerati Experts Service Level Agreement (SLA): response-time targets, monitoring availability, and how to request the full SLA document."
      canonical="/legal/sla"
      icon={<Clock className="h-5 w-5" />}
    >
      <p className="mb-6 text-lg text-[#3A3448]">
        Our Service Level Agreement (SLA) defines the specific performance standards and response
        times you can expect from Digerati Experts' managed services.
      </p>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">Standard Response Times:</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-[var(--de-paper-hairline)] pb-2">
            <span className="font-semibold text-[#1A1228]">Critical (Active Breach/System Down)</span>
            <span className="font-bold text-de-magenta-paper-ink">15 minutes</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--de-paper-hairline)] pb-2">
            <span className="font-semibold text-[#1A1228]">High (Major Functionality Impaired)</span>
            <span className="font-bold text-de-magenta-paper-ink">1 hour</span>
          </div>
          <div className="flex items-center justify-between border-b border-[var(--de-paper-hairline)] pb-2">
            <span className="font-semibold text-[#1A1228]">Medium (Partial Loss)</span>
            <span className="font-bold text-de-magenta-paper-ink">4 hours</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#1A1228]">Low (Questions/Minor Issues)</span>
            <span className="font-bold text-de-magenta-paper-ink">Next business day</span>
          </div>
        </div>
      </div>

      <div className="mb-8 rounded-lg border border-[var(--de-paper-hairline)] border-l-4 border-l-[#D3126A] bg-white p-6">
        <h3 className="mb-3 text-xl font-semibold text-[#1A1228]">SLA Commitments Include:</h3>
        <ul className="list-disc space-y-2 pl-6 text-[#3A3448]">
          <li>99.9% uptime for SOC monitoring and security services</li>
          <li>24/7/365 emergency incident response availability</li>
          <li>Monthly SLA performance reports</li>
          <li>Service credits for SLA violations</li>
          <li>Escalation procedures for unresolved issues</li>
          <li>Scheduled maintenance windows with advance notice</li>
        </ul>
      </div>

      <h2 className="mb-4 mt-8 text-xl font-bold text-[#1A1228]">Request Full SLA Document</h2>
      <p className="mb-6 text-[#3A3448]">
        For the complete SLA including service credits, maintenance windows, and detailed
        performance metrics, please contact our team.
      </p>

      <div className="mt-8 flex flex-col gap-4 sm:flex-row">
        <Button
          variant="brand"
          onClick={() => {
            window.location.href = "mailto:legal@digeratiexperts.com?subject=SLA Request";
          }}
          data-testid="button-request-sla"
        >
          <Mail className="mr-2 h-5 w-5" />
          Request SLA via Email
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

import React from "react";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { EvidenceFrame } from "./EvidenceFrame";

export const AssessmentReportSample: React.FC = () => {
  return (
    <EvidenceFrame
      classification="ILLUSTRATIVE"
      title="Illustrative Cyber Risk Assessment excerpt"
      subtitle="Example presentation structure showing how assessment findings, priorities, and a remediation roadmap can be communicated."
      status="informational"
      statusLabel="EXAMPLE FORMAT"
      sourceNote="Illustrative DE assessment format — not a real client report, measured score, promised delivery timeline, or sanitized customer data."
      variant="dark"
      className="mx-auto max-w-4xl"
    >
      <div className="space-y-4 text-white">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Identity", state: "Needs review", note: "EXAMPLE" },
            { label: "Recovery", state: "Priority review", note: "EXAMPLE" },
            { label: "Network", state: "Baseline review", note: "EXAMPLE" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-de-hairline bg-de-bg p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-white/55">{item.label}</p>
              <div className="mt-2 flex flex-wrap items-baseline gap-2">
                <span className="font-heading text-lg font-semibold text-white">{item.state}</span>
                <span className="font-mono text-[10px] text-[#F04C97]">{item.note}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-de-hairline bg-de-raised p-4">
          <p className="mb-3 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-[#F04C97]">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Example priority findings
          </p>
          <div className="space-y-2.5">
            <div className="rounded-lg border border-de-hairline bg-de-bg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-white">
                <span>1. Identity control requires validation</span>
                <span className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">EXAMPLE</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/65">
                A real assessment would document the exact control, evidence observed, affected scope, risk rationale, and recommended next action.
              </p>
            </div>
            <div className="rounded-lg border border-de-hairline bg-de-bg p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-white">
                <span>2. Recovery architecture requires validation</span>
                <span className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">EXAMPLE</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/65">
                A real finding would describe backup scope, separation, restore evidence, retention, ownership, and the remediation decision appropriate to that environment.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-de-hairline bg-de-bg p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-white/55">Illustrative roadmap structure</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              { phase: "01 / VALIDATE", body: "Confirm evidence, ownership, scope, and business impact." },
              { phase: "02 / REMEDIATE", body: "Prioritize approved control and process changes by risk and dependency." },
              { phase: "03 / VERIFY", body: "Confirm the intended state, document evidence, and carry remaining work into the roadmap." },
            ].map((item) => (
              <div key={item.phase} className="rounded border border-de-hairline bg-de-raised p-3">
                <span className="font-mono text-[10px] font-bold text-[#F04C97]">{item.phase}</span>
                <p className="mt-1 text-[11px] leading-relaxed text-white/70">{item.body}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-de-hairline bg-white/[0.02] p-3 text-xs leading-relaxed text-white/55">
          <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#F04C97]" aria-hidden="true" />
          <p>When an approved sanitized real report is available, it can replace this example using the SANITIZED REAL classification and documented redaction review.</p>
        </div>

        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#F04C97]" aria-hidden="true" />
          Structure first; real evidence only after verification and approval.
        </div>
      </div>
    </EvidenceFrame>
  );
};

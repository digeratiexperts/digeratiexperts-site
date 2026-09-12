import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { EvidenceFrame } from "./EvidenceFrame";

export interface IncidentStep {
  label: string;
  detail: string;
  actor: "CONTROL" | "HUMAN_REVIEW" | "WORKFLOW";
}

export interface ScenarioDefinition {
  id: string;
  category: "IDENTITY" | "ENDPOINT" | "EMAIL" | "BACKUP";
  title: string;
  vector: string;
  steps: IncidentStep[];
  outcome: string;
}

/** Educational scenarios only. No vendor-specific actions, measured response times, event counts, or guaranteed outcomes. */
const defaultScenarios: ScenarioDefinition[] = [
  {
    id: "EXAMPLE-IDENTITY-ACCESS",
    category: "IDENTITY",
    title: "Suspicious account access",
    vector: "An identity signal indicates access that does not match the expected user context.",
    steps: [
      { label: "Signal reviewed", detail: "Available identity and session context is reviewed to determine whether the activity needs containment.", actor: "HUMAN_REVIEW" },
      { label: "Access contained as appropriate", detail: "Sessions, credentials, or access paths can be restricted according to the client environment and approved operating procedure.", actor: "CONTROL" },
      { label: "Related exposure checked", detail: "Relevant audit history and account settings are reviewed for additional indicators that require follow-up.", actor: "WORKFLOW" },
      { label: "Follow-up documented", detail: "Required remediation, user actions, and validation steps are recorded for the client team.", actor: "HUMAN_REVIEW" },
    ],
    outcome: "The access path is addressed and required validation and follow-up actions are documented.",
  },
  {
    id: "EXAMPLE-ENDPOINT-PROCESS",
    category: "ENDPOINT",
    title: "Suspicious endpoint behavior",
    vector: "Endpoint telemetry indicates a process or behavior that warrants investigation.",
    steps: [
      { label: "Endpoint signal triaged", detail: "Process, device, and available security context is reviewed to determine severity and scope.", actor: "HUMAN_REVIEW" },
      { label: "Device contained when required", detail: "The affected endpoint can be isolated or otherwise restricted when the deployed controls and client policy support that action.", actor: "CONTROL" },
      { label: "Recovery path selected", detail: "Remediation may include removal, restoration, rebuild, credential follow-up, or another documented recovery step based on findings.", actor: "WORKFLOW" },
    ],
    outcome: "The endpoint is moved into a controlled remediation path with scope and next actions documented.",
  },
  {
    id: "EXAMPLE-EMAIL-MESSAGE",
    category: "EMAIL",
    title: "Suspicious email or link",
    vector: "A message or destination is identified as suspicious and requires review before normal business activity continues.",
    steps: [
      { label: "Message context reviewed", detail: "Sender, destination, authentication, and available security signals are evaluated using the controls present in the environment.", actor: "HUMAN_REVIEW" },
      { label: "Exposure reduced", detail: "The message, link, session, or related access can be restricted using available controls when appropriate.", actor: "CONTROL" },
      { label: "Related activity checked", detail: "Relevant accounts and audit information are reviewed to identify follow-up work that may be necessary.", actor: "WORKFLOW" },
    ],
    outcome: "The suspicious activity is addressed and any required user, identity, or security follow-up is documented.",
  },
];

const actorLabel: Record<IncidentStep["actor"], string> = {
  CONTROL: "Control",
  HUMAN_REVIEW: "Human review",
  WORKFLOW: "Workflow",
};

export const IncidentFlow: React.FC<{ scenarios?: ScenarioDefinition[] }> = ({ scenarios = defaultScenarios }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const activeScenario = scenarios[selectedIdx];
  if (!activeScenario) return null;

  return (
    <EvidenceFrame
      classification="EXAMPLE"
      title="Example incident response flow"
      subtitle="An educational view of how detection, review, containment, remediation, and documentation can connect in a managed operating model."
      status="informational"
      statusLabel="EXAMPLE MODEL"
      sourceNote="Illustrative DE operating-model sequence — not live telemetry, client data, a guaranteed control action, or a measured SLA."
      variant="dark"
      className="mx-auto max-w-4xl"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-de-hairline pb-4">
        {scenarios.map((scenario, index) => {
          const isSelected = index === selectedIdx;
          return (
            <button
              key={scenario.id}
              type="button"
              onClick={() => setSelectedIdx(index)}
              className={`min-h-11 rounded-lg border px-3 py-2 font-mono text-xs font-semibold transition-colors ${isSelected ? "border-[#D3126A] bg-[#D3126A] text-white" : "border-de-hairline bg-de-bg text-white/65 hover:border-white/20 hover:text-white"}`}
              data-testid={`scenario-tab-${scenario.category.toLowerCase()}`}
            >
              {scenario.category}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeScenario.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }} className="mt-4 space-y-5">
          <div className="rounded-lg border border-de-hairline bg-de-bg p-4">
            <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#F04C97]">Example vector / {activeScenario.category}</p>
            <h5 className="mt-2 font-heading text-lg font-semibold text-white">{activeScenario.title}</h5>
            <p className="mt-1 text-sm leading-relaxed text-white/70">{activeScenario.vector}</p>
          </div>
          <div className="space-y-3">
            <p className="font-mono text-[11px] uppercase tracking-widest text-white/55">Example response sequence</p>
            <ol className="space-y-3">
              {activeScenario.steps.map((step, stepIdx) => (
                <li key={`${activeScenario.id}-${step.label}`} className="grid grid-cols-[2rem_1fr] gap-3">
                  <span className="mt-1 flex h-7 w-7 items-center justify-center rounded-full border border-[#D3126A]/35 bg-de-bg font-mono text-[10px] font-bold text-[#F04C97]">{String(stepIdx + 1).padStart(2, "0")}</span>
                  <div className="rounded-lg border border-de-hairline bg-de-bg/70 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-white">{step.label}</p>
                      <span className="rounded border border-de-hairline bg-white/[0.03] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white/50">{actorLabel[step.actor]}</span>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-white/70">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-[#D3126A]/25 bg-[#D3126A]/[0.06] p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#F04C97]" aria-hidden="true" />
            <div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#F04C97]">Illustrative resolution</span>
              <p className="mt-1 text-sm leading-relaxed text-white/85">{activeScenario.outcome}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-white/60">
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            Actual response depends on the client stack, permissions, policy, and event context.
          </div>
        </motion.div>
      </AnimatePresence>
    </EvidenceFrame>
  );
};

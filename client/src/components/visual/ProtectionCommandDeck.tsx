import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  Eye,
  Globe,
  Lock,
  Mail,
  Search,
  Shield,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { ControlGate, DiagramNode, SecurityBoundary } from "../evidence/DiagramPrimitives";
import { EvidenceFrame } from "../evidence/EvidenceFrame";

export interface ProtectionDomain {
  id: string;
  name: string;
  shortName: string;
  icon: LucideIcon;
  /** The threat class this block answers; feeds the layered-protection diagram. */
  answers: string;
  /**
   * Risk & Exposure is the continuous visibility and intelligence layer beneath
   * the other seven blocks, not a peer control. It stays one of the eight.
   */
  continuous?: boolean;
  purpose: string;
  commonQuestions: string[];
  architecture: {
    boundaryName: string;
    nodes: { title: string; subtitle: string; detail: string }[];
    gate: { label: string; policy: string };
  };
  operatingModel: {
    scopeExamples: string[];
    managementExamples: string[];
    signalExamples: string[];
    deliverableExamples: string[];
  };
}

/**
 * The eight cybersecurity blocks of the DE 2026 service model, in canonical
 * order (docs/DE-SERVICE-MODEL-2026.md). Data & Recovery and Governance &
 * Compliance Support are capability lanes (05 and 09), not blocks, and are
 * deliberately absent here. This list is a separate system from the 12 public
 * capability lanes and the 14 internal domains. Everything below is
 * illustrative: representative scope, questions and outputs, never a promise
 * of specific tooling or a client's posture.
 */
export const protectionDomains: ProtectionDomain[] = [
  {
    id: "identity",
    name: "Identity & Access",
    shortName: "Identity & access",
    icon: Lock,
    answers: "credential theft",
    purpose: "Control who can access business systems, how access is verified, and how accounts are changed or removed over time.",
    commonQuestions: ["Is MFA appropriate and enforced where required?", "Are privileged accounts separated and reviewed?", "Does offboarding remove access consistently?"],
    architecture: {
      boundaryName: "Identity boundary",
      nodes: [
        { title: "Users & administrators", subtitle: "Accounts, roles, authentication", detail: "Access inventory" },
        { title: "Access policy", subtitle: "Authentication and device/context rules", detail: "Policy layer" },
      ],
      gate: { label: "Access decision", policy: "Apply the approved authentication and access rules for the environment" },
    },
    operatingModel: {
      scopeExamples: ["User accounts", "Admin access", "SSO applications", "Joiner/mover/leaver workflow"],
      managementExamples: ["Access-policy review", "MFA configuration", "Onboarding/offboarding support"],
      signalExamples: ["Risky sign-ins", "Unexpected access changes", "Privilege changes"],
      deliverableExamples: ["Account review", "Access findings", "Remediation roadmap"],
    },
  },
  {
    id: "endpoint",
    name: "Endpoint",
    shortName: "Endpoint",
    icon: Shield,
    answers: "malware",
    purpose: "Keep managed devices visible, maintained, and protected with controls matched to device ownership, user role, and business risk.",
    commonQuestions: ["Which devices are actually in scope?", "Are security and patch states visible?", "What happens when a device needs containment or rebuild?"],
    architecture: {
      boundaryName: "Managed device boundary",
      nodes: [
        { title: "Workstations & servers", subtitle: "Company-managed devices in scope", detail: "Device inventory" },
        { title: "Security controls", subtitle: "Endpoint, patch, configuration, and policy tooling", detail: "Control layer" },
      ],
      gate: { label: "Device decision", policy: "Use the deployed controls and authorized procedure appropriate to the event" },
    },
    operatingModel: {
      scopeExamples: ["Laptops/desktops", "Servers where contracted", "Device configuration", "Patch posture"],
      managementExamples: ["Agent deployment", "Patch/configuration management", "Device lifecycle support"],
      signalExamples: ["Security alerts", "Patch drift", "Device-health exceptions"],
      deliverableExamples: ["Device inventory", "Posture findings", "Remediation actions"],
    },
  },
  {
    id: "email",
    name: "Email & Collaboration",
    shortName: "Email & collaboration",
    icon: Mail,
    answers: "phishing",
    purpose: "Reduce email-driven risk while keeping authentication, filtering, user behavior, and account settings understandable and supportable.",
    commonQuestions: ["Are domain-authentication records configured correctly?", "Are risky mailbox rules or forwarding visible?", "How are users trained and supported after suspicious messages?"],
    architecture: {
      boundaryName: "Messaging boundary",
      nodes: [
        { title: "Mail & collaboration", subtitle: "Tenant, domains, users, and shared resources", detail: "Service scope" },
        { title: "Protection layer", subtitle: "Authentication, filtering, policy, and awareness controls", detail: "Control layer" },
      ],
      gate: { label: "Message decision", policy: "Apply the mail-security controls and investigation path available in the environment" },
    },
    operatingModel: {
      scopeExamples: ["Mailboxes", "Domain authentication", "Shared resources", "User awareness"],
      managementExamples: ["Configuration review", "Filter/policy tuning", "Awareness support where included"],
      signalExamples: ["Suspicious messages", "Forwarding changes", "Account-related alerts"],
      deliverableExamples: ["Mail posture findings", "Configuration actions", "User/security follow-up"],
    },
  },
  {
    id: "browser",
    name: "Browser & Web",
    shortName: "Browser & web",
    icon: Globe,
    answers: "web-borne compromise",
    purpose: "Reduce web-borne risk on managed devices: filtering, browser policy, and safe access to the SaaS the business actually runs on.",
    commonQuestions: ["Is web or DNS filtering enforced on managed devices?", "Which browser settings and extensions are controlled?", "How is business SaaS access separated from personal browsing?"],
    architecture: {
      boundaryName: "Web boundary",
      nodes: [
        { title: "Browsers & SaaS access", subtitle: "Managed browsers, business web applications, and sessions", detail: "Access scope" },
        { title: "Filtering & policy layer", subtitle: "Web/DNS filtering, browser policy, and extension control", detail: "Control layer" },
      ],
      gate: { label: "Web decision", policy: "Apply the filtering and browser policy appropriate to the role and the device" },
    },
    operatingModel: {
      scopeExamples: ["Managed browsers", "Web/DNS filtering", "Extension policy", "Business SaaS access"],
      managementExamples: ["Policy baseline", "Filter tuning", "Exception handling"],
      signalExamples: ["Blocked destinations", "Policy drift", "Risky extensions"],
      deliverableExamples: ["Web posture findings", "Policy actions", "Exception record"],
    },
  },
  {
    id: "network",
    name: "Network",
    shortName: "Network",
    icon: Wifi,
    answers: "lateral movement",
    purpose: "Document and manage the business network so internet edge, switching, Wi-Fi, segmentation, and remote access match the operating model.",
    commonQuestions: ["Who owns and administers the network equipment?", "Are guest/IoT/business networks separated appropriately?", "Is the configuration documented and recoverable?"],
    architecture: {
      boundaryName: "Network boundary",
      nodes: [
        { title: "Internet edge", subtitle: "Firewall/router and provider handoff", detail: "Edge layer" },
        { title: "LAN & wireless", subtitle: "Switching, Wi-Fi, segmentation, and devices", detail: "Internal layer" },
      ],
      gate: { label: "Traffic decision", policy: "Apply documented network policy and segmentation appropriate to the client environment" },
    },
    operatingModel: {
      scopeExamples: ["Firewall/router", "Switching", "Business/guest Wi-Fi", "Remote-access configuration"],
      managementExamples: ["Configuration management", "Firmware/change planning", "Network documentation"],
      signalExamples: ["Availability alerts", "Configuration exceptions", "Unexpected network behavior"],
      deliverableExamples: ["Topology/documentation", "Risk findings", "Change roadmap"],
    },
  },
  {
    id: "detection",
    name: "Detection & Response",
    shortName: "Detection & response",
    icon: Activity,
    answers: "persistence",
    purpose: "Watch the environment continuously and act on what matters: detection, triage, containment, and escalation through a documented path.",
    commonQuestions: ["Who is watching, and around the clock?", "What is the containment authority and the escalation path?", "Are detections tuned to this environment or generic?"],
    architecture: {
      boundaryName: "Monitoring boundary",
      nodes: [
        { title: "Telemetry sources", subtitle: "Endpoint, identity, email, and network signals in scope", detail: "Signal scope" },
        { title: "Detection & response layer", subtitle: "Analysts, playbooks, containment, and escalation", detail: "Response layer" },
      ],
      gate: { label: "Response decision", policy: "Follow the documented playbook and containment authority for the event" },
    },
    operatingModel: {
      scopeExamples: ["Endpoint & identity telemetry", "Alert triage", "Containment actions", "Escalation path"],
      managementExamples: ["Detection tuning", "Playbook maintenance", "Incident communication"],
      signalExamples: ["Confirmed detections", "Containment events", "Escalations"],
      deliverableExamples: ["Incident summaries", "Response evidence", "Tuning changes"],
    },
  },
  {
    id: "human",
    name: "Human Risk",
    shortName: "Human risk",
    icon: Users,
    answers: "social engineering",
    purpose: "Make people a managed control: awareness, simulation, and a reporting path that fit the organization rather than a checkbox.",
    commonQuestions: ["Do users know how to report a suspicious message?", "Is training matched to role and risk?", "Are results used to adjust controls, not to assign blame?"],
    architecture: {
      boundaryName: "People boundary",
      nodes: [
        { title: "Users & roles", subtitle: "Who handles what, and what they are exposed to", detail: "Role scope" },
        { title: "Awareness & simulation layer", subtitle: "Training cadence, simulations, and the reporting path", detail: "Control layer" },
      ],
      gate: { label: "Awareness decision", policy: "Apply the training cadence and simulation scope agreed for the organization" },
    },
    operatingModel: {
      scopeExamples: ["Awareness training", "Phishing simulation where included", "Reporting path", "Role-based guidance"],
      managementExamples: ["Campaign cadence", "Content selection", "Results review"],
      signalExamples: ["Simulation results", "Reported messages", "Repeat-risk users"],
      deliverableExamples: ["Awareness summary", "Training evidence", "Follow-up actions"],
    },
  },
  {
    id: "exposure",
    name: "Risk & Exposure",
    shortName: "Risk & exposure",
    icon: Search,
    answers: "unknown exposure",
    continuous: true,
    purpose: "The continuous visibility and intelligence layer beneath the other seven: what is exposed, what is unpatched, what changed, and what that means for the business.",
    commonQuestions: ["What is exposed to the internet right now?", "Which findings are open, and who owns them?", "How is risk reported in business terms?"],
    architecture: {
      boundaryName: "Visibility layer",
      nodes: [
        { title: "Exposure & vulnerability data", subtitle: "External exposure, vulnerability posture, and configuration drift", detail: "Evidence scope" },
        { title: "Risk register & priorities", subtitle: "Findings, owners, and priorities in business terms", detail: "Intelligence layer" },
      ],
      gate: { label: "Risk decision", policy: "Prioritize by exposure and business impact, then route the finding to the block that owns it" },
    },
    operatingModel: {
      scopeExamples: ["External exposure", "Vulnerability posture", "Configuration drift", "Risk register"],
      managementExamples: ["Scan review", "Prioritization", "Roadmap upkeep"],
      signalExamples: ["New exposures", "Aging findings", "Material changes"],
      deliverableExamples: ["Risk summary", "Exposure findings", "Prioritized roadmap"],
    },
  },
];

export const ProtectionCommandDeck: React.FC<{ onDomainChange?: (id: string) => void }> = ({ onDomainChange }) => {
  const [selectedId, setSelectedId] = useState("identity");
  const selectDomain = (id: string) => {
    setSelectedId(id);
    onDomainChange?.(id);
  };
  const activeDomain = protectionDomains.find((domain) => domain.id === selectedId) ?? protectionDomains[0];
  const DomainIcon = activeDomain.icon;

  return (
    <EvidenceFrame
      classification="ILLUSTRATIVE"
      title="Eight-block protection model"
      subtitle="Explore how DE thinks about identity, endpoints, email, browser and web, network, detection and response, and human risk, with risk and exposure running continuously beneath them, without implying every client receives the same controls or tooling."
      status="informational"
      statusLabel="INTERACTIVE MODEL"
      sourceNote="Illustrative architecture. Exact scope, controls, monitoring, deliverables, vendors, and cadence depend on the selected operating model and client environment."
      variant="dark"
      className="w-full"
    >
      <div className="border-b border-de-hairline pb-4">
        <div className="flex flex-wrap items-center gap-2">
          {protectionDomains.map((domain) => {
            const isSelected = domain.id === selectedId;
            const Icon = domain.icon;
            return (
              <button
                key={domain.id}
                type="button"
                onClick={() => selectDomain(domain.id)}
                aria-pressed={isSelected}
                className={`flex min-h-11 items-center gap-2 rounded-lg border px-3.5 py-2 font-mono text-xs font-semibold transition-colors ${
                  isSelected
                    ? "border-[#D3126A] bg-[#D3126A] text-white"
                    : "border-[var(--de-paper-hairline)] bg-white text-[#3A3448] hover:border-[#D3126A]/35"
                }`}
                data-testid={`domain-tab-${domain.id}`}
                data-continuous={domain.continuous ? "true" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{domain.shortName}</span>
                {domain.continuous ? (
                  <span className={`font-normal uppercase tracking-wider ${isSelected ? "text-white/80" : "text-[#A30E52]"}`} style={{ fontSize: 10 }}>
                    · continuous
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-white/60" data-testid="domain-continuous-note">
          Seven blocks answer a threat class each. Risk &amp; exposure runs continuously beneath all seven as the visibility and intelligence layer.
        </p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeDomain.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12"
        >
          <div className="space-y-4 lg:col-span-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--de-paper-hairline)] bg-white text-[#A30E52]">
                <DomainIcon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-heading text-lg font-bold text-white">{activeDomain.name}</h3>
            </div>
            <p className="text-sm leading-relaxed text-white/70">{activeDomain.purpose}</p>

            <div className="rounded-lg border border-[var(--de-paper-hairline)] bg-white p-3.5">
              <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-[#A30E52]">Questions the assessment should answer</p>
              <ul className="space-y-2 text-xs leading-relaxed text-[#3A3448]">
                {activeDomain.commonQuestions.map((question) => (
                  <li key={question} className="flex items-start gap-2">
                    <span className="mt-1 text-[#D3126A]" aria-hidden="true">•</span>
                    <span>{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="space-y-3 lg:col-span-4">
            <SecurityBoundary label={activeDomain.architecture.boundaryName} variant="perimeter" className="h-full">
              <div className="mb-3 space-y-2.5">
                {activeDomain.architecture.nodes.map((node) => (
                  <DiagramNode
                    key={node.title}
                    title={node.title}
                    subtitle={node.subtitle}
                    metrics={node.detail}
                    icon={DomainIcon}
                    status="monitored"
                    tone="paper"
                  />
                ))}
              </div>
              <ControlGate label={activeDomain.architecture.gate.label} policy={activeDomain.architecture.gate.policy} enforced={false} tone="paper" />
            </SecurityBoundary>
          </div>

          <div className="space-y-4 rounded-xl border border-de-hairline bg-de-raised p-4 lg:col-span-4">
            <div>
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#F04C97]" aria-hidden="true" />
                Representative scope
              </p>
              <div className="flex flex-wrap gap-1.5">
                {activeDomain.operatingModel.scopeExamples.map((item) => (
                  <span key={item} className="rounded border border-[var(--de-paper-hairline)] bg-white px-2 py-0.5 font-mono text-[10px] text-[#3A3448]">{item}</span>
                ))}
              </div>
            </div>

            <div className="border-t border-de-hairline pt-3">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white">Management may include</p>
              <ul className="space-y-1 text-xs text-white/70">
                {activeDomain.operatingModel.managementExamples.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>

            <div className="border-t border-de-hairline pt-3">
              <p className="mb-2 flex items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                <Eye className="h-3.5 w-3.5 text-[#F04C97]" aria-hidden="true" />
                Signal examples
              </p>
              <ul className="space-y-1 text-xs text-white/70">
                {activeDomain.operatingModel.signalExamples.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>

            <div className="border-t border-de-hairline pt-3">
              <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-white">Representative outputs</p>
              <ul className="space-y-1 text-xs text-white/70">
                {activeDomain.operatingModel.deliverableExamples.map((item) => <li key={item}>• {item}</li>)}
              </ul>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </EvidenceFrame>
  );
};

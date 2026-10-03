import { useState, useMemo, type ReactNode } from 'react';
import { Search, ChevronDown, ChevronRight, X, Target, Users, Shield, Clock, Video, Building2, Calendar, BarChart3, ShieldCheck, MessageSquare, Phone, DollarSign, Briefcase, AlertTriangle, Key } from 'lucide-react';
import { PortalLayout } from './PortalLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Panel, StatTile, Token } from '@/components/portal/ui';

// Prospect & Client Q&A Data
const qaCategories = [
  {
    id: 'positioning',
    title: 'Positioning',
    icon: Target,
    color: 'cyan',
    items: [
      { q: 'What do you guys do?', a: 'We help small businesses understand their real cyber risk, put the right security controls in place, and be able to prove what happened when something goes wrong. We deliver this through managed security, identity and access management, cloud systems, backup and recovery, and right-sized IT operations built around how your business actually works.' },
      { q: 'Who do you work with?', a: 'Small businesses with 5–30 users who need real IT and security without enterprise overhead—typically local SMBs in a ~30-mile radius that want clarity, accountability, and controls that actually work.' },
      { q: 'Why do this now?', a: 'Usually one of three triggers: cyber insurance requirements, email/M365 account takeovers, or liability—being able to produce logs, timelines, and proof if there\'s a dispute or investigation.' },
      { q: 'How long have you been doing this?', a: 'I\'ve been doing IT since 2007—17+ years across infrastructure, cloud, and security. Digerati Experts exists because I saw too many businesses get burned by reactive IT. Everything we do is built around security-first principles: controls, evidence, and operational ownership—not just keeping things running until something breaks.' },
      { q: 'Do you do IT and cyber, or just cyber?', a: 'We do both—security-first IT. We can fully manage IT, or do co-managed security while your current IT handles day-to-day support.' }
    ]
  },
  {
    id: 'first-step',
    title: 'The First Step (CTA)',
    icon: Phone,
    color: 'orange',
    items: [
      { q: 'What\'s the first step?', a: 'A quick FTA (First Time Appointment)—15–30 minutes. I\'ll ask a few focused questions and give you a plain-English Security Reality Snapshot: what\'s solid, what\'s missing, and what matters.' },
      { q: 'If we\'re too busy for an FTA…', a: 'No problem—let\'s do coffee/lunch as the low-pressure version of the same conversation. Same questions, no pressure; if I spot something important I\'ll tell you straight.' },
      { q: 'What happens after the FTA?', a: 'If we find meaningful exposure: either a scoped fix (M365 hardening/backups/logging), a paid assessment for bigger environments, or onboarding + stabilization leading into monthly services. Onboarding is a paid engagement—typically a few thousand dollars—where we get access, document systems, deploy baseline controls, and stabilize. After that, you move into predictable monthly services.' }
    ]
  },
  {
    id: 'differentiators',
    title: 'Differentiators',
    icon: Shield,
    color: 'violet',
    items: [
      { q: 'How are you different than other MSPs?', a: 'Most MSPs keep things running. We build controls + evidence so you can respond and prove what happened—insurance, legal, and regulatory defensibility.' },
      { q: 'Do you install tools right away?', a: 'No. We understand the environment first, then design what\'s right-sized. Less bloat, fewer surprises, and controls that match how your business actually operates.' },
      { q: 'How do you handle risk when clients decline protections?', a: 'We make tradeoffs explicit. If something important is declined, we document it as risk acceptance so nobody is surprised later and accountability is clear.' }
    ]
  },
  {
    id: 'pricing',
    title: 'Pricing',
    icon: DollarSign,
    color: 'emerald',
    items: [
      { q: 'How much do you cost?', a: 'Most clients invest a few thousand dollars to get started for onboarding and stabilization, then a few hundred to a few thousand per month depending on users, risk, and what you actually need.' },
      { q: 'What\'s your minimum?', a: 'Generally: 5–30 users is ideal. Minimum monthly is typically $500/month, and onboarding starts around $1,500 depending on cleanup and access complexity.' },
      { q: 'If we push you for per-user pricing…', a: 'We don\'t lead with per-user "cheapest plan" pricing. We build a program around your environment and minimum standards so it actually reduces incidents.' }
    ]
  },
  {
    id: 'operations',
    title: 'Operations & Support',
    icon: Briefcase,
    color: 'blue',
    items: [
      { q: 'What\'s included monthly vs what\'s extra?', a: 'Monthly includes IT support + security requests, problems, and incidents—and support for anything we sold you. Out-of-scope work is handled through paid helpdesk support. If you have TechPoints available (credits your company or users can earn), we apply those first to reduce or eliminate that cost.' },
      { q: 'Do you support things you didn\'t sell?', a: 'Yes—within reason. We support the environment, but user education and troubleshooting on products we didn\'t sell can be billable. We\'ll be clear up front.' },
      { q: 'How fast are your SLAs?', a: 'Security-impacting issues and lockouts get priority. Exact response targets are documented in the agreement so there\'s no ambiguity.' },
      { q: 'How big is your team?', a: 'We operate lean and accountable with a vetted bench for coverage. Clients are not dependent on a single point of failure.' },
      { q: 'What are TechPoints?', a: 'TechPoints are credits your company or users can earn and apply toward paid-helpdesk time when needed. If TechPoints are available, we use them first to reduce or eliminate that cost.' }
    ]
  },
  {
    id: 'security-snapshot',
    title: 'Security Reality Snapshot',
    icon: ShieldCheck,
    color: 'amber',
    items: [
      { q: 'Identity / takeover', a: 'Is MFA enforced everywhere, and do you have separate admin accounts?' },
      { q: 'Backups', a: 'When was your last successful restore test—proof, not assumptions?' },
      { q: 'Incident response', a: 'If a mailbox is compromised today, what are the first 5 actions and who executes them?' },
      { q: 'Evidence / logging', a: 'Could you produce logs and an incident timeline if you had to defend yourself?' },
      { q: 'Offboarding', a: 'If someone leaves today, can you prove they lose access everywhere within 15 minutes?' }
    ]
  },
  {
    id: 'continuity',
    title: 'Continuity & Transition',
    icon: Key,
    color: 'teal',
    items: [
      { q: 'What happens if you\'re unavailable, sick, or something happens to you?', a: 'You won\'t be stuck. We maintain a Continuity Pack for every client: system inventory, credentials structure (you always retain owner-level access), restore procedures, and vendor contacts. If something happens to me, another provider can pick up the Pack and take over quickly. You\'re never locked out or dependent on one person.' },
      { q: 'Do you hold our passwords?', a: 'We manage credentials securely, but you always retain owner access. Nothing is designed to be dependent on one person.' },
      { q: 'Can we leave anytime and still get our stuff?', a: 'Yes. Your access and documentation are structured for clean transition. We provide a standard export and handoff package during the transition window.' },
      { q: 'Do you offer credential escrow / break-glass?', a: 'Yes. We can set up a client-controlled escrow for emergency admin access and critical restore instructions—so you have continuity without compromising security.' },
      { q: 'Will you help us transition if we switch?', a: 'Yes. We support an orderly transition with a defined handoff period. You get the Continuity Pack, credential exports, and reasonable assistance transferring to a new provider—no games, no lockouts. We want clean exits because our reputation depends on it.' },
      { q: 'What are client-owned access requirements?', a: 'We require that you maintain an owner/admin account for all core systems—M365, domain registrar, DNS, firewall, backups, and any critical SaaS. This explicitly prevents hostage risk: you can always access, audit, or transfer your systems without relying on us. We manage day-to-day, but you own the keys.' }
    ]
  },
  {
    id: 'objections',
    title: 'Objection Handlers',
    icon: AlertTriangle,
    color: 'rose',
    items: [
      { q: 'We already have IT.', a: 'Totally fine—this isn\'t a rip-and-replace. It\'s a second opinion focused on identity, backups, and evidence. If your provider can prove it, great. If not, you\'ll know exactly what to fix.' },
      { q: 'We\'re under contract.', a: 'Understood. We can still do a quick reality snapshot and plan timing. The goal is clarity, not disruption.' },
      { q: 'Just send info.', a: 'Happy to—but it\'ll be more relevant after a 15-minute FTA so I\'m not sending generic brochures. When\'s good for a quick slot?' },
      { q: 'We\'re too busy.', a: 'That\'s exactly why we keep the first step short. 15 minutes now saves hours later. If not, we can do coffee as the low-pressure version.' },
      { q: 'Price is the main thing.', a: 'If you\'re shopping for the cheapest IT, we\'re probably not the right fit. If you want clarity, risk reduction, and a provider that owns outcomes, we\'re usually very reasonable.' },
      { q: 'What if a client won\'t cooperate with security standards?', a: 'If baseline standards (like MFA, restore testing, and access hygiene) are refused, we document the risk and may limit scope—or decline engagement—because we won\'t silently own unmanaged risk.' }
    ]
  },
  {
    id: 'call-script',
    title: 'Outbound Call Script',
    icon: Phone,
    color: 'indigo',
    items: [
      { q: 'Opener (30-45 sec)', a: '"Hi — this is Joe with Digerati Experts. We help small businesses reduce cyber risk and be able to prove what happened if something goes wrong. Quick question: who owns IT and security decisions on your side?"' },
      { q: 'Value + Ask', a: '"I\'m not calling to sell a bundle. I\'m offering a 15-minute FTA where I ask a few focused questions and give you a Security Reality Snapshot. If I don\'t find anything meaningful, I\'ll tell you and we\'ll leave it there. Want to do that this week?"' },
      { q: 'Fallback', a: '"If you\'d rather keep it informal, we can do coffee/lunch and I\'ll run the same questions—no pressure."' }
    ]
  }
];

interface CardData {
  id: string;
  title: string;
  badge: string;
  phase: string;
  scope: 'lead' | 'track';
  keywords: string;
  items: string[];
  meta: { label: string; value: string }[];
  details: { title?: string; content: string[] };
  meetingType?: string;
}

const leadGenCards: CardData[] = [
  {
    id: 'lead-1',
    title: 'Hot Inbound Leads',
    badge: 'Source 1',
    phase: 'Lead Gen',
    scope: 'lead',
    keywords: 'lead gen hot inbound referrals marketing no meeting',
    items: [
      'Generated from marketing + referrals',
      'High intent (problem-aware / ready)',
      'Routes to Qualification → FTA'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'None' }
    ],
    details: {
      title: 'Examples',
      content: [
        'Web form, chat, ads, referrals, partner handoffs.',
        'Goal: book the FTA. Don\'t do deep discovery here.',
        'Gate: urgency + decision path + next meeting scheduled.'
      ]
    }
  },
  {
    id: 'lead-2',
    title: 'SDR / Sales Assisted Inbound',
    badge: 'Source 2',
    phase: 'Lead Gen',
    scope: 'lead',
    keywords: 'lead gen sdr assisted inbound follow up no meeting',
    items: [
      'Rep-assisted inbound follow-up',
      'Qualification + scheduling support',
      'Turns warm into committed'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'None' }
    ],
    details: {
      content: [
        'Output: booked FTA + intake request sent.',
        'Gate: decision-maker + timeline clarified.'
      ]
    }
  },
  {
    id: 'lead-3',
    title: 'SDR / Sales Cold Outreach',
    badge: 'Source 3',
    phase: 'Lead Gen',
    scope: 'lead',
    keywords: 'lead gen sdr cold outreach outbound prospecting no meeting',
    items: [
      'Generated leads from cold outbound',
      'Often starts with coffee/quick qual',
      'Routes to Qualification → FTA'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'None' }
    ],
    details: {
      content: [
        'Gate: interest + next meeting scheduled.',
        'Offer: risk snapshot / FTA — not a full audit.'
      ]
    }
  }
];

const ecosystemCards: CardData[] = [
  {
    id: 'eco-0',
    title: 'Entry Point',
    badge: 'Stage 0',
    phase: '1. Qualification',
    scope: 'track',
    keywords: 'entry point qualification coffee meeting virtual in-office onsite',
    items: [
      'Any lead source routes here',
      'Quick qual OR coffee meeting',
      'Objective: book the FTA'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'Either (Virtual or In-office)' }
    ],
    details: {
      content: [
        'Do: confirm "why now", size, urgency, decision-maker.',
        'Don\'t: free consulting. Next step is always the FTA.'
      ]
    }
  },
  {
    id: 'eco-1',
    title: 'FTA (First Time Appointment)',
    badge: 'Stage 1',
    phase: '2. Discovery',
    scope: 'track',
    keywords: 'fta first time appointment discovery nda virtual in-office zoom teams',
    items: [
      'Confirm decision path + timeline',
      'Define "success" + outcomes',
      'Agree on Assessment scope'
    ],
    meta: [
      { label: 'Meetings', value: '1' },
      { label: 'Paperwork', value: 'NDA (optional)' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office (optional)' }
    ],
    details: {
      content: [
        'NDA: only when required before sharing sensitive details.'
      ]
    }
  },
  {
    id: 'eco-2',
    title: 'Prep + Intake',
    badge: 'Stage 2',
    phase: '2. Discovery',
    scope: 'track',
    keywords: 'prep intake questionnaire data request virtual',
    items: [
      'Questionnaire + data request',
      'Access planning + stakeholders',
      'Scope confirmation'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'Assessment SOW (if required)' },
      { label: 'Meeting Type', value: 'Virtual' }
    ],
    details: {
      content: [
        'Assessment SOW: used when the assessment is billed as a formal project.'
      ]
    }
  },
  {
    id: 'eco-3',
    title: 'Managed Assessment',
    badge: 'Stage 3',
    phase: '3. Technical Assessment',
    scope: 'track',
    keywords: 'managed assessment evidence scoring analysis no meeting async',
    items: [
      'Evidence collection + scoring',
      'Third-party style analysis',
      'Roadmap mapped to outcomes'
    ],
    meta: [
      { label: 'Meetings', value: '0' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'None (Asynchronous work)' }
    ],
    details: {
      content: [
        'Deliverable: exec summary + prioritized roadmap + proof pack.'
      ]
    }
  },
  {
    id: 'eco-4',
    title: 'Readout (Decision Meeting)',
    badge: 'Stage 4',
    phase: '4. Prescribe / Close',
    scope: 'track',
    keywords: 'readout decision meeting findings virtual in-office',
    items: [
      'Share findings + business impact',
      'Prioritize remediation roadmap',
      'Select ProActive Ecosystem package'
    ],
    meta: [
      { label: 'Meetings', value: '1' },
      { label: 'Paperwork', value: 'None (unless closing same meeting)' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office (optional)' }
    ],
    details: {
      content: [
        'Decision: close now, or schedule the close meeting.'
      ]
    }
  },
  {
    id: 'eco-5',
    title: 'Close + Onboarding',
    badge: 'Stage 5',
    phase: '4. Prescribe / Close',
    scope: 'track',
    keywords: 'close onboarding msa order form sow kickoff virtual in-office',
    items: [
      'Paperwork + kickoff',
      'Access + baselines + onboarding',
      'Acceptance + governance cadence'
    ],
    meta: [
      { label: 'Meetings', value: '1–2' },
      { label: 'Paperwork', value: 'MSA + Order Form + SOW(s) + Acceptance' },
      { label: 'Meeting Type', value: 'Virtual (default) + In-office kickoff (optional)' }
    ],
    details: {
      content: [
        'Order Form = pricing authority',
        'MSA = legal authority',
        'SOW(s) = scope authority'
      ]
    }
  },
  {
    id: 'eco-6',
    title: 'Governance + Follow-Up',
    badge: 'Stage 6',
    phase: '5. Follow-Up',
    scope: 'track',
    keywords: 'governance follow-up reporting quarterly tbr virtual',
    items: [
      'Monthly reporting + quarterly TBR',
      'Roadmap progress + budgeting',
      'Add modules via new SOWs'
    ],
    meta: [
      { label: 'Meetings', value: 'Monthly / Quarterly' },
      { label: 'Paperwork', value: 'Add-on SOW (if needed)' },
      { label: 'Meeting Type', value: 'Virtual (default)' }
    ],
    details: {
      content: [
        'Goal: keep the plan alive and expand responsibly.'
      ]
    }
  }
];

interface ReviewCardData {
  id: string;
  title: string;
  badge: string;
  type: 'tbr' | 'sbr';
  frequency: string;
  keywords: string;
  items: string[];
  meta: { label: string; value: string }[];
  details: { title?: string; content: string[] };
}

const reviewCards: ReviewCardData[] = [
  {
    id: 'tbr-1',
    title: 'Technology Business Review',
    badge: 'TBR',
    type: 'tbr',
    frequency: '1–2 per year',
    keywords: 'tbr technology business review quarterly annual roadmap budget planning virtual',
    items: [
      'Review IT roadmap progress + alignment',
      'Budget planning + upcoming initiatives',
      'Technology lifecycle + refresh planning',
      'Strategic IT recommendations'
    ],
    meta: [
      { label: 'Frequency', value: '1–2 per year' },
      { label: 'Duration', value: '60–90 minutes' },
      { label: 'Attendees', value: 'Executive + IT stakeholders' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office' }
    ],
    details: {
      title: 'TBR Agenda',
      content: [
        'Roadmap review: completed milestones + upcoming projects',
        'Budget alignment: actual vs. planned spend',
        'Technology health: infrastructure, security, compliance status',
        'Strategic initiatives: new capabilities, optimizations, modernization',
        'Action items + next quarter priorities'
      ]
    }
  },
  {
    id: 'sbr-1',
    title: 'Security Business Review',
    badge: 'SBR',
    type: 'sbr',
    frequency: '1–2 per year',
    keywords: 'sbr security business review quarterly annual compliance risk posture virtual',
    items: [
      'Security posture + risk assessment',
      'Compliance status + audit readiness',
      'Threat landscape + incident review',
      'Security roadmap + recommendations'
    ],
    meta: [
      { label: 'Frequency', value: '1–2 per year' },
      { label: 'Duration', value: '60–90 minutes' },
      { label: 'Attendees', value: 'Executive + Security stakeholders' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office' }
    ],
    details: {
      title: 'SBR Agenda',
      content: [
        'Security posture: current state + improvements since last review',
        'Incident summary: threats blocked, alerts handled, response times',
        'Compliance status: framework alignment, audit findings, remediation',
        'Risk assessment: new vulnerabilities, emerging threats, exposure gaps',
        'Insurance requirements: cyber liability evidence + documentation',
        'Security roadmap: upcoming controls, training, enhancements'
      ]
    }
  }
];

const cyberCards: CardData[] = [
  {
    id: 'cyber-0',
    title: 'Entry Point',
    badge: 'Stage 0',
    phase: '1. Qualification',
    scope: 'track',
    keywords: 'entry cyber qualification coffee virtual in-office',
    items: [
      'Same lead sources',
      'Quick qual OR coffee meeting',
      'Objective: book the Security FTA'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'Either (Virtual or In-office)' }
    ],
    details: {
      content: [
        'Decision: cyber-only engagement OR roll into full Ecosystem.'
      ]
    }
  },
  {
    id: 'cyber-1',
    title: 'FTA (Security Focus)',
    badge: 'Stage 1',
    phase: '2. Discovery',
    scope: 'track',
    keywords: 'fta security discovery nda virtual in-office',
    items: [
      'Confirm decision path + timeline',
      'Define security outcomes',
      'Agree on Assessment scope'
    ],
    meta: [
      { label: 'Meetings', value: '1' },
      { label: 'Paperwork', value: 'NDA (optional)' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office (optional)' }
    ],
    details: {
      content: [
        'Focus on security pain points and compliance requirements.'
      ]
    }
  },
  {
    id: 'cyber-2',
    title: 'Prep + Intake',
    badge: 'Stage 2',
    phase: '2. Discovery',
    scope: 'track',
    keywords: 'prep intake security questionnaire virtual',
    items: [
      'Security questionnaire + data request',
      'Access approvals + stakeholders',
      'Scope confirmation'
    ],
    meta: [
      { label: 'Meetings', value: '0–1' },
      { label: 'Paperwork', value: 'Assessment SOW (if required)' },
      { label: 'Meeting Type', value: 'Virtual' }
    ],
    details: {
      content: [
        'Same intake mechanics; different evidence + reporting outputs.'
      ]
    }
  },
  {
    id: 'cyber-3',
    title: 'Security Assessment',
    badge: 'Stage 3',
    phase: '3. Technical Assessment',
    scope: 'track',
    keywords: 'security assessment exposure risk no meeting async',
    items: [
      'Exposure + control gap analysis',
      'Evidence + risk scoring',
      'Roadmap mapped to outcomes'
    ],
    meta: [
      { label: 'Meetings', value: '0' },
      { label: 'Paperwork', value: 'None' },
      { label: 'Meeting Type', value: 'None (Asynchronous work)' }
    ],
    details: {
      content: [
        'Deliverables: executive summary + proof + prioritized plan.'
      ]
    }
  },
  {
    id: 'cyber-4',
    title: 'Readout',
    badge: 'Stage 4',
    phase: '4. Prescribe / Close',
    scope: 'track',
    keywords: 'readout cyber watch findings virtual in-office',
    items: [
      'Share findings + business impact',
      'Recommend Cyber Watch (ongoing)',
      'Option: roll into Ecosystem package'
    ],
    meta: [
      { label: 'Meetings', value: '1' },
      { label: 'Paperwork', value: 'None (unless closing same meeting)' },
      { label: 'Meeting Type', value: 'Virtual (default) or In-office (optional)' }
    ],
    details: {
      content: [
        'Close path: cyber-only co-managed OR full ProActive Ecosystem.'
      ]
    }
  },
  {
    id: 'cyber-5',
    title: 'Close + Security Onboarding',
    badge: 'Stage 5',
    phase: '4. Prescribe / Close',
    scope: 'track',
    keywords: 'close security onboarding controls virtual in-office',
    items: [
      'Kickoff + access + baseline',
      'Deploy/enable controls',
      'Runbook + escalation path'
    ],
    meta: [
      { label: 'Meetings', value: '1–2' },
      { label: 'Paperwork', value: 'MSA + Order Form + Cyber SOW' },
      { label: 'Meeting Type', value: 'Virtual (default) + In-office kickoff (optional)' }
    ],
    details: {
      content: [
        'Cyber-only: Cyber SOW defines co-managed responsibilities.',
        'Ecosystem: add managed services SOW(s) as needed.'
      ]
    }
  },
  {
    id: 'cyber-6',
    title: 'Follow-Up + Cyber Liability',
    badge: 'Stage 6',
    phase: '5. Follow-Up',
    scope: 'track',
    keywords: 'follow-up cyber liability monitoring virtual',
    items: [
      'Ongoing monitoring + response workflow',
      'Insurance minimum standards verification',
      'Evidence + reporting cadence'
    ],
    meta: [
      { label: 'Meetings', value: 'Monthly / Quarterly' },
      { label: 'Paperwork', value: 'Add-on SOW (if needed)' },
      { label: 'Meeting Type', value: 'Virtual (default)' }
    ],
    details: {
      content: [
        'Typical follow-up: liability essentials check ~2–3 weeks after initial deployment.'
      ]
    }
  }
];

/** Pill toggle used for section switches and track tabs. State is carried by aria-pressed and text, not colour alone. */
function Chip({
  active,
  onClick,
  children,
  testId,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

function SectionToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" aria-label={label} onClick={onClick}>
      <ChevronDown className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}

function StageProgress({ label, step, total, value }: { label: string; step: number; total: number; value: number }) {
  return (
    <div className="border-b border-border px-4 py-3 md:px-5">
      <div className="mb-2 flex items-baseline justify-between gap-4">
        <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        <p className="pt-num text-xs text-muted-foreground">
          Step {step} / {total}
        </p>
      </div>
      <Progress value={value} className="h-2" aria-label={`${label}: step ${step} of ${total}`} />
    </div>
  );
}

export default function SalesProcess() {
  const [activeTab, setActiveTab] = useState<'ecosystem' | 'cyber'>('ecosystem');
  const [searchQuery, setSearchQuery] = useState('');
  const [showLeadGen, setShowLeadGen] = useState(true);
  const [showTrack, setShowTrack] = useState(true);
  const [showReviews, setShowReviews] = useState(true);
  const [activeLeadCard, setActiveLeadCard] = useState<string>(leadGenCards[0].id);
  const [activeTrackCard, setActiveTrackCard] = useState<string>(ecosystemCards[0].id);
  const [activeReviewCard, setActiveReviewCard] = useState<string | null>(null);
  const [drawerCard, setDrawerCard] = useState<CardData | null>(null);
  const [drawerReviewCard, setDrawerReviewCard] = useState<ReviewCardData | null>(null);
  const [showQA, setShowQA] = useState(false);
  const [expandedQACategories, setExpandedQACategories] = useState<string[]>([]);
  const [expandedQAItems, setExpandedQAItems] = useState<string[]>([]);

  const portalUser = (() => {
    try {
      return localStorage.getItem("portalUser")
        ? JSON.parse(localStorage.getItem("portalUser")!)
        : null;
    } catch {
      return null;
    }
  })();
  const isAdmin = portalUser?.role === "admin";


  // Internal sales playbook — clients must use TechSales, not the Client Portal
  if (!isAdmin) {
    return (
      <PortalLayout title="Sales Process" width="narrow">
        <Panel id="sales-moved" title="Moved to TechSales">
          <p className="text-sm text-muted-foreground">
            The Decision-Ready sales process lives in the Intelligence Hub for internal users.
            Client Portal accounts do not include sales tooling.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="brand">
              <a href="https://techsales.digerati-experts.com/" target="_blank" rel="noreferrer">
                Open TechSales
              </a>
            </Button>
            <Button variant="outline" className="border-border bg-card hover:bg-accent" asChild>
              <a href="/portal/dashboard">Back to Portal</a>
            </Button>
          </div>
        </Panel>
      </PortalLayout>
    );
  }

  const toggleQACategory = (id: string) => {
    setExpandedQACategories(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const toggleQAItem = (id: string) => {
    setExpandedQAItems(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const trackCards = activeTab === 'ecosystem' ? ecosystemCards : cyberCards;

  const filteredLeadCards = useMemo(() => {
    if (!searchQuery) return leadGenCards;
    const q = searchQuery.toLowerCase();
    return leadGenCards.filter(card =>
      card.title.toLowerCase().includes(q) ||
      card.keywords.toLowerCase().includes(q) ||
      card.items.some(item => item.toLowerCase().includes(q))
    );
  }, [searchQuery]);

  const filteredTrackCards = useMemo(() => {
    if (!searchQuery) return trackCards;
    const q = searchQuery.toLowerCase();
    return trackCards.filter(card =>
      card.title.toLowerCase().includes(q) ||
      card.keywords.toLowerCase().includes(q) ||
      card.items.some(item => item.toLowerCase().includes(q))
    );
  }, [searchQuery, trackCards]);

  const filteredReviewCards = useMemo(() => {
    if (!searchQuery) return reviewCards;
    const q = searchQuery.toLowerCase();
    return reviewCards.filter(card =>
      card.title.toLowerCase().includes(q) ||
      card.keywords.toLowerCase().includes(q) ||
      card.items.some(item => item.toLowerCase().includes(q))
    );
  }, [searchQuery, trackCards]);

  const leadProgress = useMemo(() => {
    const idx = leadGenCards.findIndex(c => c.id === activeLeadCard);
    return ((idx + 1) / leadGenCards.length) * 100;
  }, [activeLeadCard]);

  const trackProgress = useMemo(() => {
    const idx = trackCards.findIndex(c => c.id === activeTrackCard);
    return ((idx + 1) / trackCards.length) * 100;
  }, [activeTrackCard, trackCards]);

  const handleTabChange = (tab: 'ecosystem' | 'cyber') => {
    setActiveTab(tab);
    setActiveTrackCard(tab === 'ecosystem' ? ecosystemCards[0].id : cyberCards[0].id);
    setDrawerCard(null);
  };

  const openDrawer = (card: CardData) => {
    if (card.scope === 'lead') {
      setActiveLeadCard(card.id);
    } else {
      setActiveTrackCard(card.id);
    }
    setDrawerCard(card);
    setDrawerReviewCard(null);
  };

  const openReviewDrawer = (card: ReviewCardData) => {
    setActiveReviewCard(card.id);
    setDrawerReviewCard(card);
    setDrawerCard(null);
  };

  const getMeetingIcon = (meetingType: string) => {
    if (meetingType.includes('Virtual')) return <Video className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (meetingType.includes('In-office')) return <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    if (meetingType.includes('Either')) return <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    return <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
  };

  const renderStageCard = (card: CardData, active: boolean) => (
    <article
      key={card.id}
      onClick={() => openDrawer(card)}
      className={cn(
        "w-[320px] max-w-[380px] shrink-0 cursor-pointer rounded-xl border bg-background p-4 transition-colors",
        active ? "border-primary" : "border-border pt-hover-brand",
      )}
      style={{ scrollSnapAlign: 'start' }}
      aria-current={active ? "step" : undefined}
      data-testid={`card-${card.id}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold leading-tight">{card.title}</h3>
        <Token label={card.badge} tone={card.scope === 'lead' ? 'warn' : 'brand'} />
      </div>

      <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
        {card.items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

      <dl className="grid gap-2">
        {card.meta.map((m, i) => (
          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
            <dt className="font-semibold">{m.label}</dt>
            <dd className="flex items-center gap-1.5 text-right text-muted-foreground">
              {m.label === 'Meeting Type' && getMeetingIcon(m.value)}
              <span className="max-w-[170px] truncate">{m.value}</span>
            </dd>
          </div>
        ))}
      </dl>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-4 w-full border-border bg-card hover:bg-accent"
        data-testid={`button-details-${card.id}`}
      >
        View Details
      </Button>
    </article>
  );

  return (
    <PortalLayout
      title="Decision-Ready Process"
      eyebrow="DE Sales System"
      description="Two tracks. Clear stages. Meetings, paperwork, and meeting type on every step."
      width="wide"
    >
    <div className="space-y-4" data-testid="sales-process-page">
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Process at a glance">
        {[
          { value: '7', label: 'Sales Stages' },
          { value: '3', label: 'Lead Sources' },
          { value: '2', label: 'Tracks' },
          { value: '2', label: 'Reviews/Year' }
        ].map((stat) => (
          <StatTile key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </section>

      {/* Search + Controls */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-80 lg:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            placeholder="Search stages, meetings, paperwork..."
            aria-label="Search stages, meetings, paperwork"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 border-border bg-card pl-9"
            data-testid="input-search"
          />
        </div>

        <div role="group" aria-label="Show sections" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
          <Chip active={showQA} onClick={() => setShowQA(!showQA)} testId="toggle-qa">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
            Prospect/Client Q&A
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showQA && "rotate-180")} aria-hidden="true" />
          </Chip>
          <Chip active={showLeadGen} onClick={() => setShowLeadGen(!showLeadGen)} testId="toggle-lead-gen">
            Lead Gen
          </Chip>
          <Chip active={showTrack} onClick={() => setShowTrack(!showTrack)} testId="toggle-track">
            Track
          </Chip>
          <Chip active={showReviews} onClick={() => setShowReviews(!showReviews)} testId="toggle-reviews">
            TBR / SBR
          </Chip>
        </div>
      </div>

      {/* Tabs */}
      <div role="group" aria-label="Sales track" className="flex flex-wrap gap-1.5">
        {[
          { key: 'ecosystem' as const, label: 'ProActive Ecosystem' },
          { key: 'cyber' as const, label: 'Cybersecurity Track' }
        ].map(tab => (
          <Chip key={tab.key} active={activeTab === tab.key} onClick={() => handleTabChange(tab.key)} testId={`tab-${tab.key}`}>
            {tab.label}
          </Chip>
        ))}
      </div>

      {/* Prospect/Client Q&A Panel */}
      {showQA && (
        <div data-testid="section-qa">
          <Panel
            id="sales-qa"
            title="Prospect & Client Q&A"
            description="Phone-ready reference. Use these verbatim answers during prospect calls and client conversations. Click categories to expand."
            actions={
              <Button type="button" variant="ghost" size="icon" aria-label="Close Q&A" onClick={() => setShowQA(false)}>
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
            flush
          >
            <ul className="divide-y divide-border">
              {qaCategories.map(category => {
                const Icon = category.icon;
                const isExpanded = expandedQACategories.includes(category.id);

                return (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => toggleQACategory(category.id)}
                      aria-expanded={isExpanded}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none md:px-5"
                      data-testid={`qa-category-${category.id}`}
                    >
                      <span className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate text-sm font-semibold">{category.title}</span>
                        <Token label={String(category.items.length)} tone="neutral" className="pt-num" />
                      </span>
                      <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isExpanded && "rotate-90")} aria-hidden="true" />
                    </button>

                    {isExpanded && (
                      <ul className="space-y-2 bg-background/40 px-4 pb-4 md:px-5">
                        {category.items.map((item, idx) => {
                          const itemId = `${category.id}-${idx}`;
                          const isItemExpanded = expandedQAItems.includes(itemId);

                          return (
                            <li key={idx} className="overflow-hidden rounded-lg border border-border bg-card">
                              <button
                                type="button"
                                onClick={() => toggleQAItem(itemId)}
                                aria-expanded={isItemExpanded}
                                className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none"
                                data-testid={`qa-item-${itemId}`}
                              >
                                <span className="text-sm font-medium">Q: {item.q}</span>
                                <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isItemExpanded && "rotate-180")} aria-hidden="true" />
                              </button>

                              {isItemExpanded && (
                                <div className="border-t border-border px-3 py-3">
                                  <p className="text-sm leading-relaxed">
                                    <span className="font-semibold text-muted-foreground">A:</span> {item.a}
                                  </p>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      )}

      {/* Lead Generation Section */}
      {showLeadGen && (
        <div data-testid="section-lead-gen">
          <Panel
            id="sales-lead-gen"
            title="3 Sources of Leads"
            description="Lead Generation"
            actions={<SectionToggle label="Hide Lead Gen" onClick={() => setShowLeadGen(!showLeadGen)} />}
            flush
          >
            <StageProgress
              label="Lead Gen Progress"
              step={leadGenCards.findIndex(c => c.id === activeLeadCard) + 1}
              total={leadGenCards.length}
              value={leadProgress}
            />

            <div className="flex gap-4 overflow-x-auto p-4 md:p-5" style={{ scrollSnapType: 'x mandatory' }}>
              {filteredLeadCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lead sources match your search.</p>
              ) : (
                filteredLeadCards.map(card => renderStageCard(card, activeLeadCard === card.id))
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Sales Track Section */}
      {showTrack && (
        <div data-testid="section-track">
          <Panel
            id="sales-track"
            title={activeTab === 'ecosystem' ? 'ProActive Ecosystem' : 'Cybersecurity Track'}
            description="Sales Process Track"
            actions={<SectionToggle label="Hide Track" onClick={() => setShowTrack(!showTrack)} />}
            flush
          >
            <StageProgress
              label="Track Progress"
              step={trackCards.findIndex(c => c.id === activeTrackCard) + 1}
              total={trackCards.length}
              value={trackProgress}
            />

            <div className="border-b border-border px-4 py-3 md:px-5">
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                {activeTab === 'ecosystem' ? 'Sales Process' : 'Cybersecurity Track'}
              </p>
              <p className="mt-1 text-sm font-medium">
                {activeTab === 'ecosystem'
                  ? 'Qualification → Discovery → Technical Assessment → Prescribe/Close → Follow-Up'
                  : 'Co-Managed Cyber (cyber-only OR roll into ProActive Ecosystem)'
                }
              </p>
            </div>

            <div className="flex gap-4 overflow-x-auto p-4 md:p-5" style={{ scrollSnapType: 'x mandatory' }}>
              {filteredTrackCards.length === 0 ? (
                <p className="text-sm text-muted-foreground">No stages match your search.</p>
              ) : (
                filteredTrackCards.map(card => renderStageCard(card, activeTrackCard === card.id))
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* TBR / SBR Reviews Section */}
      {showReviews && (
        <div data-testid="section-reviews">
          <Panel
            id="sales-reviews"
            title="TBR & SBR — 1–2 Reviews Per Year"
            description="Business Reviews. Scheduled strategic reviews to ensure ongoing alignment between technology investments, security posture, and business objectives."
            actions={<SectionToggle label="Hide Reviews" onClick={() => setShowReviews(!showReviews)} />}
          >
            {filteredReviewCards.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reviews match your search.</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {filteredReviewCards.map(card => {
                  const active = activeReviewCard === card.id;
                  const ReviewIcon = card.type === 'tbr' ? BarChart3 : ShieldCheck;
                  return (
                    <article
                      key={card.id}
                      onClick={() => openReviewDrawer(card)}
                      className={cn(
                        "cursor-pointer rounded-xl border bg-background p-4 transition-colors",
                        active ? "border-primary" : "border-border pt-hover-brand",
                      )}
                      aria-current={active ? "true" : undefined}
                      data-testid={`card-${card.id}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <ReviewIcon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <h3 className="text-sm font-semibold leading-tight">{card.title}</h3>
                        </div>
                        <Token label={card.badge} tone={card.type === 'tbr' ? 'info' : 'ok'} />
                      </div>

                      <ul className="mb-3 list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
                        {card.items.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>

                      <dl className="grid gap-2">
                        {card.meta.map((m, i) => (
                          <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                            <dt className="font-semibold">{m.label}</dt>
                            <dd className="flex items-center gap-1.5 text-right text-muted-foreground">
                              {m.label === 'Meeting Type' && getMeetingIcon(m.value)}
                              <span className="max-w-[180px] truncate">{m.value}</span>
                            </dd>
                          </div>
                        ))}
                      </dl>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-4 w-full border-border bg-card hover:bg-accent"
                        data-testid={`button-details-${card.id}`}
                      >
                        View Details
                      </Button>
                    </article>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* Detail Drawer */}
      {drawerCard && (
        <div data-testid="drawer-detail">
          <Panel
            id="sales-drawer"
            title={drawerCard.title}
            description={<Token label={drawerCard.phase} tone={drawerCard.scope === 'lead' ? 'warn' : 'brand'} />}
            actions={
              <Button type="button" variant="ghost" size="icon" aria-label="Close details" onClick={() => setDrawerCard(null)} data-testid="button-close-drawer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          >
            <div className="text-sm leading-relaxed">
              {drawerCard.meta.find(m => m.label === 'Meeting Type') && (
                <p className="mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  <b>Meeting Type:</b> {drawerCard.meta.find(m => m.label === 'Meeting Type')?.value}
                </p>
              )}

              {drawerCard.details.title && (
                <p className="mb-2"><b>{drawerCard.details.title}:</b></p>
              )}

              <ul className="list-disc space-y-2 pl-6">
                {drawerCard.details.content.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      )}

      {/* Review Detail Drawer */}
      {drawerReviewCard && (
        <div data-testid="drawer-review-detail">
          <Panel
            id="sales-review-drawer"
            title={
              <span className="inline-flex items-center gap-2">
                {drawerReviewCard.type === 'tbr' ? (
                  <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                )}
                {drawerReviewCard.title}
              </span>
            }
            description={<Token label={`${drawerReviewCard.badge} — ${drawerReviewCard.frequency}`} tone={drawerReviewCard.type === 'tbr' ? 'info' : 'ok'} />}
            actions={
              <Button type="button" variant="ghost" size="icon" aria-label="Close review details" onClick={() => setDrawerReviewCard(null)} data-testid="button-close-review-drawer">
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            }
          >
            <div className="text-sm leading-relaxed">
              {drawerReviewCard.details.title && (
                <p className="mb-3"><b>{drawerReviewCard.details.title}:</b></p>
              )}

              <ul className="list-disc space-y-2 pl-6">
                {drawerReviewCard.details.content.map((item, i) => (
                  <li key={i}>{item}</li>
                ))}
              </ul>
            </div>
          </Panel>
        </div>
      )}
    </div>
    </PortalLayout>
  );
}

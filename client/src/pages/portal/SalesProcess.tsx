import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronDown, ChevronRight, X, Zap, Target, Users, Shield, CheckCircle, Clock, FileText, Video, Building2, Calendar, BarChart3, ShieldCheck, MessageSquare, Phone, DollarSign, Briefcase, AlertTriangle, UserCheck, Key } from 'lucide-react';
import { PortalLayout } from './PortalLayout';
import { Button } from '@/components/ui/button';

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
      <PortalLayout title="Sales Process">
        <div className="max-w-xl space-y-4 p-2">
          <h2 className="text-xl font-semibold">Moved to TechSales</h2>
          <p className="text-gray-600 dark:text-gray-400">
            The Decision-Ready sales process lives in the Intelligence Hub for internal users.
            Client Portal accounts do not include sales tooling.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-[#D3126A] hover:bg-[#D3126A]/90 text-white">
              <a href="https://techsales.digerati-experts.com/" target="_blank" rel="noreferrer">
                Open TechSales
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/portal/dashboard">Back to Portal</a>
            </Button>
          </div>
        </div>
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

  const getColorClasses = (color: string) => {
    const colorMap: Record<string, { border: string; bg: string; text: string; hoverBg: string }> = {
      cyan: { border: 'border-cyan-500/40', bg: 'bg-cyan-500/10', text: 'text-cyan-400', hoverBg: 'hover:bg-cyan-500/15' },
      orange: { border: 'border-orange-500/40', bg: 'bg-orange-500/10', text: 'text-orange-400', hoverBg: 'hover:bg-orange-500/15' },
      violet: { border: 'border-[#D3126A]/40', bg: 'bg-[#D3126A]/10', text: 'text-de-magenta-ink', hoverBg: 'hover:bg-[#D3126A]/15' },
      emerald: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/10', text: 'text-emerald-400', hoverBg: 'hover:bg-emerald-500/15' },
      blue: { border: 'border-blue-500/40', bg: 'bg-blue-500/10', text: 'text-blue-400', hoverBg: 'hover:bg-blue-500/15' },
      amber: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-400', hoverBg: 'hover:bg-amber-500/15' },
      teal: { border: 'border-teal-500/40', bg: 'bg-teal-500/10', text: 'text-teal-400', hoverBg: 'hover:bg-teal-500/15' },
      rose: { border: 'border-rose-500/40', bg: 'bg-rose-500/10', text: 'text-rose-400', hoverBg: 'hover:bg-rose-500/15' },
      indigo: { border: 'border-indigo-500/40', bg: 'bg-indigo-500/10', text: 'text-indigo-400', hoverBg: 'hover:bg-indigo-500/15' }
    };
    return colorMap[color] || colorMap.cyan;
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
    if (meetingType.includes('Virtual')) return <Video className="w-4 h-4" />;
    if (meetingType.includes('In-office')) return <Building2 className="w-4 h-4" />;
    if (meetingType.includes('Either')) return <Users className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <PortalLayout title="Sales Process">
    <div className="-m-4 md:-m-6 min-h-full bg-[#151515] text-white" data-testid="sales-process-page">
      <div className="max-w-[1320px] mx-auto p-4 md:p-6">
        <div className="rounded-[26px] border border-white/10 overflow-hidden"
          style={{
            background: `
              radial-gradient(1200px 600px at 10% 0%, rgba(255,184,0,.10), transparent 55%),
              radial-gradient(1000px 520px at 90% 20%, rgba(90,167,255,.08), transparent 55%),
              linear-gradient(180deg, #1b1b1b, #151515)
            `,
            boxShadow: '0 30px 90px rgba(0,0,0,.55)'
          }}>
          
          {/* Header */}
          <header className="px-5 py-7 border-b border-white/10 bg-gradient-to-b from-white/[0.03] to-transparent">
            <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-amber-500/35 bg-amber-500/10 text-amber-400 text-xs font-black tracking-[0.18em] uppercase mb-4">
              <Zap className="w-4 h-4" />
              DE SALES SYSTEM
            </div>
            
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white mb-2" 
                style={{ letterSpacing: '-0.03em' }}>
              Decision-Ready Process
            </h1>
            
            <p className="text-white/80 text-base max-w-[900px] font-medium leading-relaxed">
              Two tracks. Clear stages. Meetings, paperwork, and meeting type on every step.
            </p>

            {/* Stats */}
            <div className="flex gap-3.5 flex-wrap mt-5">
              {[
                { value: '7', label: 'Sales Stages' },
                { value: '3', label: 'Lead Sources' },
                { value: '2', label: 'Tracks' },
                { value: '2', label: 'Reviews/Year' }
              ].map((stat, i) => (
                <div key={i} className="flex gap-3 items-baseline px-3.5 py-3 rounded-2xl border border-white/10 bg-black/25 backdrop-blur-sm">
                  <span className="text-2xl font-black text-amber-400">{stat.value}</span>
                  <span className="text-xs text-white/60 uppercase tracking-widest font-extrabold">{stat.label}</span>
                </div>
              ))}
            </div>

            {/* Search + Controls */}
            <div className="mt-4 flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[280px] max-w-[560px]">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/45" />
                <input
                  type="text"
                  placeholder="Search stages, meetings, paperwork..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3.5 rounded-full border border-white/10 bg-black/35 text-white placeholder:text-white/45 outline-none transition-all focus:border-amber-500/55 focus:ring-2 focus:ring-amber-500/20"
                  data-testid="input-search"
                />
              </div>

              {/* Prospect/Client Q&A Button */}
              <button
                onClick={() => setShowQA(!showQA)}
                className={`inline-flex items-center gap-2.5 px-4 py-3 rounded-full border font-black text-sm transition-all ${
                  showQA 
                    ? 'border-cyan-500/70 bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 text-white shadow-lg shadow-cyan-500/15' 
                    : 'border-white/10 bg-black/30 text-white/80 hover:border-cyan-500/35'
                }`}
                data-testid="toggle-qa"
              >
                <MessageSquare className={`w-4 h-4 ${showQA ? 'text-cyan-400' : ''}`} />
                Prospect/Client Q&A
                <ChevronDown className={`w-4 h-4 transition-transform ${showQA ? 'rotate-180' : ''}`} />
              </button>

              {/* View Toggles */}
              <div className="flex gap-2.5 flex-wrap">
                <button
                  onClick={() => setShowLeadGen(!showLeadGen)}
                  className={`inline-flex items-center gap-2.5 px-3.5 py-3 rounded-full border font-black text-sm transition-all ${
                    showLeadGen 
                      ? 'border-orange-500/70 bg-gradient-to-br from-orange-500/20 to-orange-500/5 text-white shadow-lg shadow-orange-500/15' 
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-orange-500/35'
                  }`}
                  data-testid="toggle-lead-gen"
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${showLeadGen ? 'bg-orange-400 border-orange-500/75 shadow-orange-500/40 shadow-sm' : 'bg-white/25 border-white/20'}`} />
                  Lead Gen
                </button>
                <button
                  onClick={() => setShowTrack(!showTrack)}
                  className={`inline-flex items-center gap-2.5 px-3.5 py-3 rounded-full border font-black text-sm transition-all ${
                    showTrack 
                      ? 'border-[#D3126A]/70 bg-gradient-to-br from-[#D3126A]/20 to-[#D3126A]/5 text-white shadow-lg shadow-[#D3126A]/15' 
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-[#D3126A]/35'
                  }`}
                  data-testid="toggle-track"
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${showTrack ? 'bg-[#D3126A] border-[#D3126A]/75 shadow-[#D3126A]/40 shadow-sm' : 'bg-white/25 border-white/20'}`} />
                  Track
                </button>
                <button
                  onClick={() => setShowReviews(!showReviews)}
                  className={`inline-flex items-center gap-2.5 px-3.5 py-3 rounded-full border font-black text-sm transition-all ${
                    showReviews 
                      ? 'border-emerald-500/70 bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 text-white shadow-lg shadow-emerald-500/15' 
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-emerald-500/35'
                  }`}
                  data-testid="toggle-reviews"
                >
                  <span className={`w-2.5 h-2.5 rounded-full border ${showReviews ? 'bg-emerald-400 border-emerald-500/75 shadow-emerald-500/40 shadow-sm' : 'bg-white/25 border-white/20'}`} />
                  TBR / SBR
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-3 flex-wrap mt-4">
              {[
                { key: 'ecosystem' as const, label: 'ProActive Ecosystem' },
                { key: 'cyber' as const, label: 'Cybersecurity Track' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`px-5 py-3.5 rounded-full border font-black text-sm transition-all ${
                    activeTab === tab.key
                      ? 'border-amber-500/70 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-white shadow-lg shadow-amber-500/15'
                      : 'border-white/10 bg-black/30 text-white/80 hover:border-amber-500/35 hover:-translate-y-0.5'
                  }`}
                  data-testid={`tab-${tab.key}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          {/* Prospect/Client Q&A Dropdown Panel */}
          {showQA && (
            <section 
              className="px-5 py-5 border-b border-cyan-500/20" 
              style={{ background: 'linear-gradient(180deg, rgba(6,182,212,0.06) 0%, rgba(0,0,0,0.15) 100%)' }}
              data-testid="section-qa"
            >
              <div className="flex items-center justify-between gap-4 mb-4">
                <div>
                  <div className="text-xs text-cyan-400 uppercase tracking-[0.16em] font-black mb-1">Phone-Ready Reference</div>
                  <div className="text-lg font-black text-white">Prospect & Client Q&A</div>
                </div>
                <button 
                  onClick={() => setShowQA(false)}
                  className="w-10 h-10 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 grid place-items-center transition-transform hover:bg-cyan-500/20"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-cyan-200/60 text-sm font-medium mb-5 max-w-3xl">
                Use these verbatim answers during prospect calls and client conversations. Click categories to expand.
              </p>

              {/* Q&A Categories */}
              <div className="grid gap-3">
                {qaCategories.map(category => {
                  const colors = getColorClasses(category.color);
                  const Icon = category.icon;
                  const isExpanded = expandedQACategories.includes(category.id);
                  
                  return (
                    <div 
                      key={category.id}
                      className={`rounded-2xl border ${colors.border} overflow-hidden transition-all`}
                      style={{ background: 'rgba(0,0,0,0.25)' }}
                    >
                      <button
                        onClick={() => toggleQACategory(category.id)}
                        className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 ${colors.hoverBg} transition-all`}
                        data-testid={`qa-category-${category.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl ${colors.bg} ${colors.border} border grid place-items-center`}>
                            <Icon className={`w-4 h-4 ${colors.text}`} />
                          </div>
                          <span className="font-black text-white">{category.title}</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-bold ${colors.bg} ${colors.text}`}>
                            {category.items.length}
                          </span>
                        </div>
                        <ChevronRight className={`w-5 h-5 text-white/60 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {category.items.map((item, idx) => {
                            const itemId = `${category.id}-${idx}`;
                            const isItemExpanded = expandedQAItems.includes(itemId);
                            
                            return (
                              <div 
                                key={idx}
                                className={`rounded-xl border ${colors.border} overflow-hidden`}
                                style={{ background: 'rgba(0,0,0,0.3)' }}
                              >
                                <button
                                  onClick={() => toggleQAItem(itemId)}
                                  className={`w-full flex items-center justify-between gap-3 px-4 py-3 text-left ${colors.hoverBg} transition-all`}
                                  data-testid={`qa-item-${itemId}`}
                                >
                                  <span className={`font-bold text-sm ${colors.text}`}>Q: {item.q}</span>
                                  <ChevronDown className={`w-4 h-4 flex-shrink-0 text-white/40 transition-transform ${isItemExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                
                                {isItemExpanded && (
                                  <div className="px-4 pb-4">
                                    <div className="p-3.5 rounded-lg bg-white/5 border border-white/10">
                                      <p className="text-white/85 text-sm font-medium leading-relaxed">
                                        <span className="text-white/50 font-bold">A:</span> {item.a}
                                      </p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Lead Generation Section - ORANGE THEME */}
          {showLeadGen && (
            <section 
              className="px-5 py-5 border-b border-orange-500/20" 
              style={{ background: 'linear-gradient(180deg, rgba(249,115,22,0.08) 0%, rgba(0,0,0,0.15) 100%)' }}
              data-testid="section-lead-gen"
            >
              <div className="flex items-center justify-between gap-4 mb-4 cursor-pointer" onClick={() => setShowLeadGen(!showLeadGen)}>
                <div>
                  <div className="text-xs text-orange-400 uppercase tracking-[0.16em] font-black mb-1">Lead Generation</div>
                  <div className="text-lg font-black text-white">3 Sources of Leads</div>
                </div>
                <button className="w-10 h-10 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 grid place-items-center transition-transform hover:bg-orange-500/20">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Lead Gen Progress */}
              <div className="p-4 rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-500/10 to-orange-600/5 mb-4">
                <div className="flex justify-between items-baseline gap-4 mb-2.5">
                  <div className="text-xs text-orange-300/80 font-extrabold uppercase tracking-widest">Lead Gen Progress</div>
                  <div className="text-xs text-orange-300/80 font-extrabold">
                    Step {leadGenCards.findIndex(c => c.id === activeLeadCard) + 1} / {leadGenCards.length}
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${leadProgress}%`,
                      background: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)'
                    }}
                  />
                </div>
              </div>

              {/* Lead Gen Timeline */}
              <div className="relative flex gap-5 overflow-x-auto pb-5 pt-5 px-1 scroll-smooth" style={{ scrollSnapType: 'x mandatory' }}>
                <div className="absolute left-2.5 right-2.5 top-2.5 h-[3px] rounded-full bg-gradient-to-r from-orange-500/50 via-orange-400/40 to-orange-300/30 pointer-events-none" />
                
                {filteredLeadCards.map(card => (
                  <article
                    key={card.id}
                    onClick={() => openDrawer(card)}
                    className={`flex-shrink-0 w-[340px] max-w-[380px] rounded-[22px] border p-5 cursor-pointer transition-all duration-300 ${
                      activeLeadCard === card.id
                        ? 'border-orange-500 bg-gradient-to-br from-orange-500/20 to-orange-600/10 shadow-2xl shadow-orange-500/25 -translate-y-1'
                        : 'border-orange-500/25 bg-gradient-to-b from-orange-500/8 to-black/20 hover:border-orange-400 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/20'
                    }`}
                    style={{ scrollSnapAlign: 'start', boxShadow: '0 18px 55px rgba(0,0,0,.45)' }}
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <h3 className="font-black text-base text-white leading-tight">{card.title}</h3>
                      <span className="flex-shrink-0 px-3 py-2 rounded-full border border-orange-400/60 bg-orange-500/20 text-orange-300 font-black text-xs tracking-wide">
                        {card.badge}
                      </span>
                    </div>
                    
                    <ul className="list-disc pl-5 text-white/80 text-sm font-semibold leading-relaxed mb-3">
                      {card.items.map((item, i) => (
                        <li key={i} className="mb-2 marker:text-orange-400">{item}</li>
                      ))}
                    </ul>

                    <div className="grid gap-2.5 mt-3">
                      {card.meta.map((m, i) => (
                        <div key={i} className="flex justify-between items-center gap-3 px-3.5 py-3 rounded-xl border border-orange-500/20 bg-black/40 text-sm font-bold text-white/80">
                          <span className="text-orange-400 font-black">{m.label}</span>
                          <span className="flex items-center gap-2">
                            {m.label === 'Meeting Type' && getMeetingIcon(m.value)}
                            {m.value}
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      className="mt-4 w-full py-3.5 rounded-xl border border-orange-500/40 bg-orange-500/10 text-orange-300 font-black transition-all hover:-translate-y-0.5 hover:border-orange-400 hover:bg-orange-500/20"
                      data-testid={`button-details-${card.id}`}
                    >
                      View Details
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Sales Track Section - PURPLE THEME */}
          {showTrack && (
            <section 
              className="px-5 py-5 border-b border-[#D3126A]/20" 
              style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.08) 0%, rgba(0,0,0,0.15) 100%)' }}
              data-testid="section-track"
            >
              <div className="flex items-center justify-between gap-4 mb-4 cursor-pointer" onClick={() => setShowTrack(!showTrack)}>
                <div>
                  <div className="text-xs text-de-magenta-ink uppercase tracking-[0.16em] font-black mb-1">Sales Process Track</div>
                  <div className="text-lg font-black text-white">
                    {activeTab === 'ecosystem' ? 'ProActive Ecosystem' : 'Cybersecurity Track'}
                  </div>
                </div>
                <button className="w-10 h-10 rounded-xl border border-[#D3126A]/30 bg-[#D3126A]/10 text-de-magenta-ink grid place-items-center transition-transform hover:bg-[#D3126A]/20">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              {/* Track Progress */}
              <div className="p-4 rounded-2xl border border-[#D3126A]/25 bg-gradient-to-r from-[#D3126A]/10 to-transparent mb-4">
                <div className="flex justify-between items-baseline gap-4 mb-2.5">
                  <div className="text-xs text-de-magenta-ink/80 font-extrabold uppercase tracking-widest">Track Progress</div>
                  <div className="text-xs text-de-magenta-ink/80 font-extrabold">
                    Step {trackCards.findIndex(c => c.id === activeTrackCard) + 1} / {trackCards.length}
                  </div>
                </div>
                <div className="h-2.5 rounded-full bg-black/40 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${trackProgress}%`,
                      background: 'linear-gradient(90deg, #8b5cf6, #a78bfa, #c4b5fd)'
                    }}
                  />
                </div>
              </div>

              {/* Row Header */}
              <div className="mb-4 px-1.5">
                <div className="text-xs text-de-magenta-ink uppercase tracking-[0.15em] font-extrabold mb-2">
                  {activeTab === 'ecosystem' ? 'Sales Process' : 'Cybersecurity Track'}
                </div>
                <div className="text-xl font-extrabold text-white leading-snug">
                  {activeTab === 'ecosystem' 
                    ? 'Qualification → Discovery → Technical Assessment → Prescribe/Close → Follow-Up'
                    : 'Co-Managed Cyber (cyber-only OR roll into ProActive Ecosystem)'
                  }
                </div>
              </div>

              {/* Track Timeline */}
              <div className="relative flex gap-5 overflow-x-auto pb-5 pt-8 px-1 scroll-smooth" style={{ scrollSnapType: 'x mandatory' }}>
                <div className="absolute left-4 right-4 top-5 h-[3px] rounded-full bg-gradient-to-r from-[#D3126A]/50 via-[#D3126A]/40 to-[#D3126A]/30 pointer-events-none" />
                
                {filteredTrackCards.map(card => (
                  <article
                    key={card.id}
                    onClick={() => openDrawer(card)}
                    className={`flex-shrink-0 w-[360px] max-w-[390px] rounded-[20px] border p-5 cursor-pointer transition-all duration-300 backdrop-blur-[18px] overflow-hidden ${
                      activeTrackCard === card.id
                        ? 'border-[#D3126A] bg-gradient-to-br from-[#D3126A]/20 to-transparent shadow-2xl shadow-[#D3126A]/25 -translate-y-1 scale-[1.01]'
                        : 'border-[#D3126A]/25 bg-gradient-to-br from-[#D3126A]/8 to-black/20 hover:border-[#D3126A] hover:-translate-y-1.5 hover:scale-[1.01] hover:shadow-2xl hover:shadow-[#D3126A]/20'
                    }`}
                    style={{ scrollSnapAlign: 'start', boxShadow: '0 20px 60px rgba(0,0,0,.40)' }}
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-3.5">
                      <h3 className="font-black text-base text-white leading-tight">{card.title}</h3>
                      <span className="flex-shrink-0 px-3.5 py-2 rounded-full border border-[#D3126A]/60 bg-[#D3126A]/20 text-de-magenta-ink font-black text-xs tracking-wide">
                        {card.badge}
                      </span>
                    </div>
                    
                    <ul className="list-disc pl-5 text-white/80 text-sm font-medium leading-relaxed mb-3.5">
                      {card.items.map((item, i) => (
                        <li key={i} className="mb-2 marker:text-de-magenta-ink">{item}</li>
                      ))}
                    </ul>

                    <div className="grid gap-3 mt-3.5">
                      {card.meta.map((m, i) => (
                        <div key={i} className="flex justify-between items-center gap-3 px-3.5 py-3 rounded-xl border border-[#D3126A]/20 bg-black/40 text-sm font-semibold text-white/80">
                          <span className="text-de-magenta-ink font-extrabold">{m.label}</span>
                          <span className="flex items-center gap-2 text-right">
                            {m.label === 'Meeting Type' && getMeetingIcon(m.value)}
                            <span className="max-w-[160px] truncate">{m.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      className="mt-4 w-full py-3.5 rounded-xl border border-[#D3126A]/40 bg-[#D3126A]/10 text-de-magenta-ink font-extrabold transition-all hover:-translate-y-0.5 hover:border-[#D3126A] hover:bg-[#D3126A]/20"
                      data-testid={`button-details-${card.id}`}
                    >
                      View Details
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* TBR / SBR Reviews Section - EMERALD/TEAL THEME */}
          {showReviews && (
            <section 
              className="px-5 py-5" 
              style={{ background: 'linear-gradient(180deg, rgba(16,185,129,0.08) 0%, rgba(0,0,0,0.15) 100%)' }}
              data-testid="section-reviews"
            >
              <div className="flex items-center justify-between gap-4 mb-4 cursor-pointer" onClick={() => setShowReviews(!showReviews)}>
                <div>
                  <div className="text-xs text-emerald-400 uppercase tracking-[0.16em] font-black mb-1">Business Reviews</div>
                  <div className="text-lg font-black text-white">TBR & SBR — 1–2 Reviews Per Year</div>
                </div>
                <button className="w-10 h-10 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 grid place-items-center transition-transform hover:bg-emerald-500/20">
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>

              <p className="text-emerald-200/70 text-sm font-medium mb-5 max-w-3xl">
                Scheduled strategic reviews to ensure ongoing alignment between technology investments, security posture, and business objectives.
              </p>

              {/* Reviews Timeline */}
              <div className="grid md:grid-cols-2 gap-5">
                {filteredReviewCards.map(card => (
                  <article
                    key={card.id}
                    onClick={() => openReviewDrawer(card)}
                    className={`rounded-[20px] border p-5 cursor-pointer transition-all duration-300 backdrop-blur-[18px] overflow-hidden ${
                      activeReviewCard === card.id
                        ? 'border-emerald-500 bg-gradient-to-br from-emerald-500/15 to-emerald-500/5 shadow-2xl shadow-emerald-500/25 -translate-y-1'
                        : 'border-white/15 bg-gradient-to-br from-white/[0.10] to-white/[0.03] hover:border-emerald-500/45 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/15'
                    }`}
                    style={{ boxShadow: '0 18px 55px rgba(0,0,0,.40)' }}
                    data-testid={`card-${card.id}`}
                  >
                    <div className="flex justify-between items-start gap-3 mb-3.5">
                      <div className="flex items-center gap-3">
                        {card.type === 'tbr' ? (
                          <div className="w-10 h-10 rounded-xl border border-blue-500/40 bg-blue-500/15 grid place-items-center">
                            <BarChart3 className="w-5 h-5 text-blue-400" />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/15 grid place-items-center">
                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                          </div>
                        )}
                        <h3 className="font-black text-base text-white leading-tight">{card.title}</h3>
                      </div>
                      <span className={`flex-shrink-0 px-3.5 py-2 rounded-full border font-black text-xs tracking-wide ${
                        card.type === 'tbr' 
                          ? 'border-blue-500/45 bg-blue-500/15 text-blue-400'
                          : 'border-emerald-500/45 bg-emerald-500/15 text-emerald-400'
                      }`}>
                        {card.badge}
                      </span>
                    </div>
                    
                    <ul className="list-disc pl-5 text-white/80 text-sm font-medium leading-relaxed mb-3.5">
                      {card.items.map((item, i) => (
                        <li key={i} className={`mb-2 ${card.type === 'tbr' ? 'marker:text-blue-400' : 'marker:text-emerald-400'}`}>{item}</li>
                      ))}
                    </ul>

                    <div className="grid gap-2.5 mt-3.5">
                      {card.meta.map((m, i) => (
                        <div key={i} className="flex justify-between items-center gap-3 px-3.5 py-2.5 rounded-xl border border-white/12 bg-black/25 text-sm font-semibold text-white/80">
                          <span className={`font-extrabold ${card.type === 'tbr' ? 'text-blue-400' : 'text-emerald-400'}`}>{m.label}</span>
                          <span className="flex items-center gap-2 text-right">
                            {m.label === 'Meeting Type' && getMeetingIcon(m.value)}
                            <span className="max-w-[180px] truncate">{m.value}</span>
                          </span>
                        </div>
                      ))}
                    </div>

                    <button 
                      className={`mt-4 w-full py-3.5 rounded-xl border border-white/15 bg-black/30 text-white font-extrabold transition-all hover:-translate-y-0.5 ${
                        card.type === 'tbr' 
                          ? 'hover:border-blue-500 hover:bg-blue-500/10'
                          : 'hover:border-emerald-500 hover:bg-emerald-500/10'
                      }`}
                      data-testid={`button-details-${card.id}`}
                    >
                      View Details
                    </button>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* Detail Drawer - Color based on scope */}
          {drawerCard && (
            <div className={`mx-5 mb-6 rounded-[20px] border p-5 backdrop-blur-[18px] ${
              drawerCard.scope === 'lead' 
                ? 'border-orange-500/45' 
                : 'border-[#D3126A]/45'
            }`}
                 style={{ 
                   background: drawerCard.scope === 'lead'
                     ? 'linear-gradient(180deg, rgba(249,115,22,.14), rgba(0,0,0,.22))'
                     : 'linear-gradient(180deg, rgba(139,92,246,.14), rgba(0,0,0,.22))',
                   boxShadow: '0 26px 90px rgba(0,0,0,.65)'
                 }}
                 data-testid="drawer-detail"
            >
              <div className="flex justify-between items-center gap-4 mb-4">
                <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border font-black text-xs uppercase tracking-wider ${
                  drawerCard.scope === 'lead'
                    ? 'border-orange-500/55 bg-orange-500/15 text-orange-300'
                    : 'border-[#D3126A]/55 bg-[#D3126A]/15 text-de-magenta-ink'
                }`}>
                  {drawerCard.phase}
                </span>
                <button 
                  onClick={() => setDrawerCard(null)}
                  className="w-10 h-10 rounded-xl border border-white/20 bg-black/30 text-white text-xl font-black grid place-items-center hover:border-white/40"
                  data-testid="button-close-drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-2xl font-black text-white mb-3">{drawerCard.title}</h3>
              
              <div className="text-white/80 font-semibold leading-relaxed text-[15px]">
                {drawerCard.meta.find(m => m.label === 'Meeting Type') && (
                  <p className="mb-3 flex items-center gap-2">
                    <Calendar className={`w-4 h-4 ${drawerCard.scope === 'lead' ? 'text-orange-400' : 'text-de-magenta-ink'}`} />
                    <b className={drawerCard.scope === 'lead' ? 'text-orange-400' : 'text-de-magenta-ink'}>Meeting Type:</b> {drawerCard.meta.find(m => m.label === 'Meeting Type')?.value}
                  </p>
                )}
                
                {drawerCard.details.title && (
                  <p className="mb-2"><b className={drawerCard.scope === 'lead' ? 'text-orange-400' : 'text-de-magenta-ink'}>{drawerCard.details.title}:</b></p>
                )}
                
                <ul className="list-disc pl-6 space-y-2">
                  {drawerCard.details.content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Review Detail Drawer */}
          {drawerReviewCard && (
            <div className={`mx-5 mb-6 rounded-[20px] border p-5 backdrop-blur-[18px] ${
              drawerReviewCard.type === 'tbr' 
                ? 'border-blue-500/45'
                : 'border-emerald-500/45'
            }`}
                 style={{ 
                   background: drawerReviewCard.type === 'tbr'
                     ? 'linear-gradient(180deg, rgba(59,130,246,.14), rgba(0,0,0,.22))'
                     : 'linear-gradient(180deg, rgba(16,185,129,.14), rgba(0,0,0,.22))',
                   boxShadow: '0 26px 90px rgba(0,0,0,.65)'
                 }}
                 data-testid="drawer-review-detail"
            >
              <div className="flex justify-between items-center gap-4 mb-4">
                <div className="flex items-center gap-3">
                  {drawerReviewCard.type === 'tbr' ? (
                    <div className="w-10 h-10 rounded-xl border border-blue-500/40 bg-blue-500/15 grid place-items-center">
                      <BarChart3 className="w-5 h-5 text-blue-400" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-xl border border-emerald-500/40 bg-emerald-500/15 grid place-items-center">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    </div>
                  )}
                  <span className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border font-black text-xs uppercase tracking-wider ${
                    drawerReviewCard.type === 'tbr'
                      ? 'border-blue-500/55 bg-blue-500/15 text-white'
                      : 'border-emerald-500/55 bg-emerald-500/15 text-white'
                  }`}>
                    {drawerReviewCard.badge} — {drawerReviewCard.frequency}
                  </span>
                </div>
                <button 
                  onClick={() => setDrawerReviewCard(null)}
                  className="w-10 h-10 rounded-xl border border-white/20 bg-black/30 text-white text-xl font-black grid place-items-center hover:border-white/40"
                  data-testid="button-close-review-drawer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <h3 className="text-2xl font-black text-white mb-3">{drawerReviewCard.title}</h3>
              
              <div className="text-white/80 font-semibold leading-relaxed text-[15px]">
                {drawerReviewCard.details.title && (
                  <p className="mb-3">
                    <b className={drawerReviewCard.type === 'tbr' ? 'text-blue-400' : 'text-emerald-400'}>
                      {drawerReviewCard.details.title}:
                    </b>
                  </p>
                )}
                
                <ul className="list-disc pl-6 space-y-2">
                  {drawerReviewCard.details.content.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
    </PortalLayout>
  );
}

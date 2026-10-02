import { useState } from "react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BarChart3, Calendar, Download, TrendingUp, Shield, Server, CheckCircle2, ArrowRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout, Panel, Priority, StatTile, Token, type TokenTone } from "@/components/portal/ui";

interface QBRReport {
  id: string;
  quarter: string;
  year: number;
  status: "completed" | "scheduled" | "draft";
  meetingDate?: string;
  highlights: string[];
}

const qbrReports: QBRReport[] = [
  {
    id: "qbr-q1-2026",
    quarter: "Q1",
    year: 2026,
    status: "completed",
    meetingDate: "January 15, 2026",
    highlights: [
      "EDR deployment completed across all endpoints",
      "MFA rollout achieved 100% adoption",
      "Zero security incidents for 90 consecutive days",
    ],
  },
  {
    id: "qbr-q2-2026",
    quarter: "Q2",
    year: 2026,
    status: "scheduled",
    meetingDate: "April 15, 2026",
    highlights: [
      "Cloud migration Phase 1 review",
      "Security awareness training progress",
      "Budget mid-year review",
    ],
  },
  {
    id: "qbr-q3-2026",
    quarter: "Q3",
    year: 2026,
    status: "draft",
    highlights: [
      "Network refresh planning",
      "BCDR plan finalization",
      "Annual budget prep for 2027",
    ],
  },
];

const ticketMetrics = {
  totalTickets: 47,
  resolved: 43,
  avgResolutionTime: "2.4 hours",
  slaCompliance: 98.2,
  firstContactResolution: 87,
  customerSatisfaction: 4.7,
};

const securityMetrics = {
  threatsBlocked: 1243,
  patchCompliance: 96.5,
  vulnerabilities: { critical: 0, high: 1, medium: 4, low: 12 },
  phishingTestPassRate: 91,
  endpointsProtected: 45,
  uptimePercent: 99.97,
};

const infrastructureMetrics = {
  totalDevices: 52,
  online: 50,
  offline: 1,
  needsAttention: 1,
  avgCPU: 34,
  avgMemory: 62,
  avgDisk: 48,
};

const recommendations = [
  {
    priority: "high",
    title: "Upgrade aging firewall",
    description: "Current firewall is 4 years old and no longer receiving firmware updates. Recommend replacing with next-gen firewall.",
    estimatedCost: "$3,500",
    impact: "Closes 3 known vulnerabilities, improves throughput by 2x",
  },
  {
    priority: "medium",
    title: "Implement DNS filtering",
    description: "Add DNS-layer security to block malicious domains before they can load, reducing attack surface significantly.",
    estimatedCost: "$2/user/mo",
    impact: "Blocks 33% of threats at the DNS layer before they reach endpoints",
  },
  {
    priority: "low",
    title: "Standardize workstation hardware",
    description: "5 workstations are over 5 years old. Standardizing to current-gen hardware improves performance and supportability.",
    estimatedCost: "$6,000",
    impact: "Reduces support tickets by 20%, improves employee productivity",
  },
];

const REPORT_STATUS: Record<QBRReport["status"], { label: string; tone: TokenTone }> = {
  completed: { label: "Completed", tone: "ok" },
  scheduled: { label: "Scheduled", tone: "info" },
  draft: { label: "Draft", tone: "neutral" },
};

const VULN_TONE_CLASS: Record<string, string> = {
  critical: "pt-tone-bad",
  high: "pt-tone-warn",
  medium: "pt-tone-warn",
  low: "pt-tone-info",
};

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "security", label: "Security Posture", icon: Shield },
  { key: "infrastructure", label: "Infrastructure", icon: Server },
  { key: "recommendations", label: "Recommendations", icon: Target },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const SECURITY_SCORE = 88;
const RING_R = 40;
const RING_C = 2 * Math.PI * RING_R;

function MeterRow({ label, value, testId, barClass = "h-2" }: { label: string; value: number; testId?: string; barClass?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="pt-num" data-testid={testId}>{value}%</span>
      </div>
      <Progress value={value} className={barClass} aria-label={label} />
    </div>
  );
}

export default function PortalQBR() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <PortalLayout
      title="Quarterly Business Review"
      description="Performance metrics, security posture, and strategic recommendations reviewed quarterly with your vCIO."
      actions={
        <Button variant="brand" onClick={() => window.location.href = "/book"} data-testid="button-schedule-qbr">
          <Calendar aria-hidden="true" />
          Schedule QBR Meeting
        </Button>
      }
    >
      <div className="space-y-4">
        <Callout tone="warn" title="Sample preview." testId="qbr-sample-banner">
          Metrics and reports below are examples until your live QBR data is connected.
        </Callout>

        <div className="grid gap-3 md:grid-cols-3">
          {qbrReports.map((report) => {
            const status = REPORT_STATUS[report.status];
            return (
              <div key={report.id} className="flex" data-testid={`qbr-report-${report.id}`}>
                <Panel
                  className="flex-1"
                  title={`${report.quarter} ${report.year}`}
                  description={report.meetingDate ? <span className="pt-num">{report.meetingDate}</span> : "Date to be confirmed"}
                  actions={<Token label={status.label} tone={status.tone} dot />}
                >
                  <ul className="space-y-2">
                    {report.highlights.map((h, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="pt-ink pt-tone-ok mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        {h}
                      </li>
                    ))}
                  </ul>
                  {report.status === "completed" && (
                    <Button variant="outline" size="sm" className="mt-4 w-full border-border bg-card hover:bg-accent" data-testid={`button-download-${report.id}`}>
                      <Download aria-hidden="true" />
                      Download Report
                    </Button>
                  )}
                </Panel>
              </div>
            );
          })}
        </div>

        <div role="group" aria-label="QBR section" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0 lg:pb-0">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
                data-testid={`tab-qbr-${tab.key}`}
              >
                <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="Service figures">
              <StatTile
                label="Tickets resolved"
                value={ticketMetrics.resolved}
                suffix={`/${ticketMetrics.totalTickets}`}
                hint={`Avg resolution: ${ticketMetrics.avgResolutionTime}`}
                tone="ok"
                testId="stat-tickets-resolved"
              />
              <StatTile label="SLA compliance" value={ticketMetrics.slaCompliance} suffix="%" hint="Target: 95%" tone="ok" testId="stat-sla-compliance" />
              <StatTile
                label="Customer satisfaction"
                value={ticketMetrics.customerSatisfaction}
                suffix="/5.0"
                hint={`First-contact resolution: ${ticketMetrics.firstContactResolution}%`}
                testId="stat-csat"
              />
            </section>

            <Panel id="security-score" title="Security score" description="Composite of patching, phishing resilience and uptime">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                <div className="relative h-28 w-28 shrink-0" role="img" aria-label={`Security score ${SECURITY_SCORE} out of 100`}>
                  <svg className="h-full w-full" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r={RING_R} stroke="currentColor" strokeWidth="8" fill="none" className="text-secondary" />
                    <circle
                      cx="50" cy="50" r={RING_R}
                      stroke="currentColor" strokeWidth="8" fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${RING_C * (SECURITY_SCORE / 100)} ${RING_C}`}
                      transform="rotate(-90 50 50)"
                      className="pt-ink pt-tone-ok"
                    />
                    <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="pt-num fill-current text-2xl font-semibold" data-testid="text-security-score">
                      {SECURITY_SCORE}
                    </text>
                  </svg>
                </div>
                <div className="flex-1 space-y-3">
                  <MeterRow label="Patch compliance" value={securityMetrics.patchCompliance} testId="text-patch-compliance" />
                  <MeterRow label="Phishing test pass rate" value={securityMetrics.phishingTestPassRate} testId="text-phishing-rate" />
                  <MeterRow label="Uptime" value={securityMetrics.uptimePercent} testId="text-uptime-percent" />
                </div>
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Security figures">
              <StatTile label="Threats blocked" value={securityMetrics.threatsBlocked.toLocaleString()} hint="this quarter" tone="ok" testId="stat-threats-blocked" />
              <StatTile label="Endpoints protected" value={securityMetrics.endpointsProtected} hint="under EDR" tone="info" testId="stat-endpoints" />
              <StatTile label="Uptime" value={securityMetrics.uptimePercent} suffix="%" hint="monitored systems" testId="stat-uptime" />
              <StatTile label="Phishing pass rate" value={securityMetrics.phishingTestPassRate} suffix="%" hint="last simulation" testId="stat-phishing" />
            </section>

            <Panel id="vulnerability-summary" title="Vulnerability summary" description="Current open vulnerabilities across your environment">
              <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(securityMetrics.vulnerabilities).map(([level, count]) => (
                  <div
                    key={level}
                    className={cn("pt-callout rounded-lg border p-4 text-center", VULN_TONE_CLASS[level] ?? "pt-tone-info")}
                    data-testid={`vuln-${level}`}
                  >
                    <dd className="pt-num text-2xl font-semibold">{count}</dd>
                    <dt className="text-sm capitalize text-muted-foreground">{level}</dt>
                  </div>
                ))}
              </dl>
            </Panel>
          </div>
        )}

        {activeTab === "infrastructure" && (
          <div className="space-y-4">
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Device figures">
              <StatTile label="Online" value={infrastructureMetrics.online} hint="reporting in" tone="ok" testId="stat-devices-online" />
              <StatTile label="Offline" value={infrastructureMetrics.offline} hint="not reporting" tone={infrastructureMetrics.offline > 0 ? "bad" : "neutral"} testId="stat-devices-offline" />
              <StatTile label="Needs attention" value={infrastructureMetrics.needsAttention} hint="flagged by monitoring" tone={infrastructureMetrics.needsAttention > 0 ? "warn" : "neutral"} testId="stat-devices-attention" />
              <StatTile label="Total devices" value={infrastructureMetrics.totalDevices} hint="managed" testId="stat-devices-total" />
            </section>

            <Panel id="resource-utilization" title="Resource utilization (average)">
              <div className="space-y-4">
                <MeterRow label="CPU usage" value={infrastructureMetrics.avgCPU} barClass="h-3" />
                <MeterRow label="Memory usage" value={infrastructureMetrics.avgMemory} barClass="h-3" />
                <MeterRow label="Disk usage" value={infrastructureMetrics.avgDisk} barClass="h-3" />
              </div>
            </Panel>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="space-y-4">
            <Panel id="recommendations" title="Recommendations" description="Ordered by priority" flush>
              <ul className="divide-y divide-border">
                {recommendations.map((rec, idx) => (
                  <li key={idx} className="px-4 py-4 md:px-5" data-testid={`recommendation-${idx}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Priority priority={rec.priority} />
                      <h3 className="font-heading text-[15px] font-semibold leading-snug">{rec.title}</h3>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{rec.description}</p>
                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                      <div className="flex items-center gap-1.5">
                        <dt className="text-muted-foreground">Est. cost:</dt>
                        <dd className="pt-num font-medium">{rec.estimatedCost}</dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="pt-ink pt-tone-ok h-4 w-4" aria-hidden="true" />
                        <dt className="text-muted-foreground">Impact:</dt>
                        <dd className="pt-ink pt-tone-ok font-medium">{rec.impact}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ul>
            </Panel>

            <Panel
              id="discuss-recommendations"
              title="Discuss these recommendations"
              actions={
                <Button variant="brand" onClick={() => window.location.href = "/book"} data-testid="button-discuss-recommendations">
                  Book vCIO Session
                  <ArrowRight aria-hidden="true" />
                </Button>
              }
            >
              <p className="text-sm text-muted-foreground">
                Your vCIO can walk through each recommendation, prioritize based on your budget, and build an implementation timeline.
              </p>
            </Panel>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

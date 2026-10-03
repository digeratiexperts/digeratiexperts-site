import { useState } from "react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Calendar, TrendingUp, ArrowRight, Shield, Server, MonitorSmartphone, ChevronDown, ChevronUp, FileText, Map,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout, EmptyState, Panel, Priority, StatTile, Token, type TokenTone } from "@/components/portal/ui";

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  category: "security" | "infrastructure" | "productivity" | "compliance";
  priority: "critical" | "high" | "medium" | "low";
  status: "completed" | "in-progress" | "planned" | "proposed";
  quarter: string;
  estimatedCost: string;
  impact: string;
  completionPercent: number;
}

const categoryConfig = {
  security: { label: "Security", icon: Shield },
  infrastructure: { label: "Infrastructure", icon: Server },
  productivity: { label: "Productivity", icon: MonitorSmartphone },
  compliance: { label: "Compliance", icon: FileText },
};

const statusConfig: Record<RoadmapItem["status"], { label: string; tone: TokenTone }> = {
  completed: { label: "Completed", tone: "ok" },
  "in-progress": { label: "In progress", tone: "info" },
  planned: { label: "Planned", tone: "neutral" },
  proposed: { label: "Proposed", tone: "neutral" },
};

const sampleRoadmapItems: RoadmapItem[] = [
  {
    id: "1",
    title: "Endpoint Detection & Response (EDR) Deployment",
    description: "Deploy advanced EDR solution across all workstations and servers for real-time threat detection and automated response capabilities.",
    category: "security",
    priority: "critical",
    status: "completed",
    quarter: "Q1 2026",
    estimatedCost: "$4,500/yr",
    impact: "Reduces breach risk by 85%",
    completionPercent: 100,
  },
  {
    id: "2",
    title: "Multi-Factor Authentication (MFA) Rollout",
    description: "Implement MFA across all user accounts, VPN access, and cloud applications. Includes user training and enrollment support.",
    category: "security",
    priority: "critical",
    status: "completed",
    quarter: "Q1 2026",
    estimatedCost: "$1,200/yr",
    impact: "Prevents 99.9% of credential attacks",
    completionPercent: 100,
  },
  {
    id: "3",
    title: "Cloud Migration - Phase 1 (Email & Collaboration)",
    description: "Migrate on-premises Exchange to Microsoft 365, deploy SharePoint Online and Teams for collaboration.",
    category: "infrastructure",
    priority: "high",
    status: "in-progress",
    quarter: "Q2 2026",
    estimatedCost: "$8,000 migration + $22/user/mo",
    impact: "Eliminates server maintenance, enables remote work",
    completionPercent: 65,
  },
  {
    id: "4",
    title: "Security Awareness Training Program",
    description: "Monthly phishing simulations, quarterly training modules, and annual compliance certification for all staff.",
    category: "compliance",
    priority: "high",
    status: "in-progress",
    quarter: "Q2 2026",
    estimatedCost: "$3,600/yr",
    impact: "Reduces phishing click rate by 70%",
    completionPercent: 40,
  },
  {
    id: "5",
    title: "Network Infrastructure Refresh",
    description: "Replace aging switches and access points with enterprise-grade managed networking. Implement network segmentation and VLAN isolation.",
    category: "infrastructure",
    priority: "high",
    status: "planned",
    quarter: "Q3 2026",
    estimatedCost: "$15,000",
    impact: "Improves network performance by 3x, isolates critical systems",
    completionPercent: 0,
  },
  {
    id: "6",
    title: "Business Continuity & Disaster Recovery Plan",
    description: "Develop comprehensive BCDR plan with documented RTOs/RPOs, tested backup procedures, and executive runbooks.",
    category: "compliance",
    priority: "medium",
    status: "planned",
    quarter: "Q3 2026",
    estimatedCost: "$5,000",
    impact: "Recovery time from days to hours",
    completionPercent: 0,
  },
  {
    id: "7",
    title: "UCaaS Phone System Migration",
    description: "Replace legacy PBX with cloud-hosted UCaaS solution featuring mobile apps, video conferencing, and CRM integration.",
    category: "productivity",
    priority: "medium",
    status: "proposed",
    quarter: "Q4 2026",
    estimatedCost: "$35/user/mo",
    impact: "Reduces telecom costs 40%, enables mobile workforce",
    completionPercent: 0,
  },
  {
    id: "8",
    title: "Cyber Insurance Compliance Audit",
    description: "Conduct full audit against cyber insurance requirements. Document controls, remediate gaps, and prepare renewal submission.",
    category: "compliance",
    priority: "high",
    status: "proposed",
    quarter: "Q4 2026",
    estimatedCost: "$2,500",
    impact: "Potential 15-25% premium reduction",
    completionPercent: 0,
  },
];

const budgetSummary = {
  totalBudget: "$65,000",
  spent: "$14,300",
  planned: "$28,000",
  remaining: "$22,700",
  spentPercent: 22,
  plannedPercent: 43,
};

const selectClass =
  "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function PortalRoadmap() {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const filteredItems = sampleRoadmapItems.filter((item) => {
    if (filterCategory !== "all" && item.category !== filterCategory) return false;
    if (filterStatus !== "all" && item.status !== filterStatus) return false;
    return true;
  });

  const completedCount = sampleRoadmapItems.filter((i) => i.status === "completed").length;
  const inProgressCount = sampleRoadmapItems.filter((i) => i.status === "in-progress").length;
  const plannedCount = sampleRoadmapItems.filter((i) => i.status === "planned").length;

  return (
    <PortalLayout
      title="Strategic IT Roadmap"
      description="Your 3-year technology investment plan, aligned with business goals and security requirements."
      actions={
        <Button
          variant="outline"
          className="border-border bg-card hover:bg-accent"
          data-testid="button-schedule-vcio"
          onClick={() => window.location.href = "/book"}
        >
          <Calendar aria-hidden="true" />
          Schedule vCIO Review
        </Button>
      }
    >
      <div className="space-y-4">
        <Callout tone="warn" title="Sample preview." testId="roadmap-sample-banner">
          This roadmap is illustrative until your account team publishes your live vCIO plan.
        </Callout>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Roadmap figures">
          <StatTile label="Completed" value={completedCount} hint="initiatives delivered" tone="ok" testId="stat-roadmap-completed" />
          <StatTile label="In progress" value={inProgressCount} hint="underway now" tone="info" testId="stat-roadmap-progress" />
          <StatTile label="Planned" value={plannedCount} hint="scheduled next" testId="stat-roadmap-planned" />
          <StatTile label="Annual budget" value={budgetSummary.totalBudget} hint="sample figure" testId="stat-roadmap-budget" />
        </section>

        <Panel id="budget-allocation" title="Budget allocation" description="Sample allocation across the current plan year">
          <div className="space-y-3">
            <dl className="grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Spent</dt>
                <dd className="pt-num font-medium" data-testid="text-budget-spent">{budgetSummary.spent}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Planned</dt>
                <dd className="pt-num font-medium" data-testid="text-budget-planned">{budgetSummary.planned}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Remaining</dt>
                <dd className="pt-num font-medium" data-testid="text-budget-remaining">{budgetSummary.remaining}</dd>
              </div>
            </dl>
            <div
              className="relative h-3 overflow-hidden rounded-full bg-secondary"
              role="img"
              aria-label={`Budget: ${budgetSummary.spentPercent}% spent, ${budgetSummary.plannedPercent}% planned, remainder available`}
            >
              <div className="absolute left-0 top-0 h-full bg-primary" style={{ width: `${budgetSummary.spentPercent}%` }} />
              <div
                className="absolute top-0 h-full bg-muted-foreground/50"
                style={{ left: `${budgetSummary.spentPercent}%`, width: `${budgetSummary.plannedPercent}%` }}
              />
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-hidden="true">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-primary" />Spent</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-muted-foreground/50" />Planned</li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm border border-border bg-secondary" />Available</li>
            </ul>
          </div>
        </Panel>

        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter roadmap by category"
            className={selectClass}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            data-testid="select-roadmap-category"
          >
            <option value="all">All Categories</option>
            <option value="security">Security</option>
            <option value="infrastructure">Infrastructure</option>
            <option value="productivity">Productivity</option>
            <option value="compliance">Compliance</option>
          </select>
          <select
            aria-label="Filter roadmap by status"
            className={selectClass}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            data-testid="select-roadmap-status"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="in-progress">In Progress</option>
            <option value="planned">Planned</option>
            <option value="proposed">Proposed</option>
          </select>
        </div>

        <Panel
          id="roadmap-items"
          title="Initiatives"
          description={`${filteredItems.length} of ${sampleRoadmapItems.length} shown`}
          flush
        >
          {filteredItems.length === 0 ? (
            <EmptyState
              icon={Map}
              title="No initiatives match"
              description="Try another category or status."
              action={
                <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => { setFilterCategory("all"); setFilterStatus("all"); }}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {filteredItems.map((item) => {
                const cat = categoryConfig[item.category];
                const stat = statusConfig[item.status];
                const CatIcon = cat.icon;
                const isExpanded = expandedItem === item.id;

                return (
                  <li
                    key={item.id}
                    className={cn(
                      "cursor-pointer px-4 py-4 transition-colors hover:bg-accent/60 md:px-5",
                      isExpanded && "bg-accent/40",
                    )}
                    onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                    data-testid={`roadmap-item-${item.id}`}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      className="flex items-start gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedItem(isExpanded ? null : item.id); } }}
                    >
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground" title={cat.label}>
                        <CatIcon className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">{cat.label}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="font-heading text-[15px] font-semibold leading-snug" data-testid={`text-roadmap-title-${item.id}`}>{item.title}</h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2">
                              <Token label={stat.label} tone={stat.tone} dot />
                              <Priority priority={item.priority} />
                              <span className="pt-num text-xs text-muted-foreground">{item.quarter}</span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="pt-num text-sm font-medium" data-testid={`text-roadmap-cost-${item.id}`}>{item.estimatedCost}</span>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
                          </div>
                        </div>

                        {item.status === "in-progress" && (
                          <div className="mt-3">
                            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                              <span>Progress</span>
                              <span className="pt-num">{item.completionPercent}%</span>
                            </div>
                            <Progress value={item.completionPercent} className="h-2" aria-label={`${item.title} progress`} />
                          </div>
                        )}

                        {isExpanded && (
                          <div className="mt-4 space-y-3 border-t border-border pt-4">
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                              <TrendingUp className="pt-ink pt-tone-ok h-4 w-4" aria-hidden="true" />
                              <span className="text-muted-foreground">Business impact:</span>
                              <span className="pt-ink pt-tone-ok font-medium" data-testid={`text-roadmap-impact-${item.id}`}>{item.impact}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          id="roadmap-adjust"
          title="Need to adjust your roadmap?"
          actions={
            <Button
              variant="brand"
              onClick={() => window.location.href = "/book"}
              data-testid="button-schedule-strategy"
            >
              Book Strategy Session
              <ArrowRight aria-hidden="true" />
            </Button>
          }
        >
          <p className="text-sm text-muted-foreground">
            Schedule a vCIO strategy session to review priorities, update your budget, or plan new initiatives.
          </p>
        </Panel>
      </div>
    </PortalLayout>
  );
}

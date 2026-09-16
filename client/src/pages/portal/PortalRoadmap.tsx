import { useState } from "react";
import { PortalLayout } from "./PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Map, Calendar, DollarSign, TrendingUp, CheckCircle2, Clock, AlertTriangle,
  ArrowRight, Target, Shield, Server, Wifi, MonitorSmartphone, ChevronDown, ChevronUp,
  FileText, BarChart3, Layers
} from "lucide-react";

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
  security: { label: "Security", icon: Shield, color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-500/20" },
  infrastructure: { label: "Infrastructure", icon: Server, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-500/20" },
  productivity: { label: "Productivity", icon: MonitorSmartphone, color: "text-green-700 dark:text-green-400", bg: "bg-green-100 dark:bg-green-500/20" },
  compliance: { label: "Compliance", icon: FileText, color: "text-amber-800 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-500/20" },
};

const priorityConfig = {
  critical: { label: "Critical", color: "bg-red-700 text-white" },
  high: { label: "High", color: "bg-orange-100 text-orange-900 border border-orange-700/30" },
  medium: { label: "Medium", color: "bg-yellow-500 text-black" },
  low: { label: "Low", color: "bg-blue-700 text-white" },
};

const statusConfig = {
  completed: { label: "Completed", color: "bg-emerald-50 text-emerald-800 border-emerald-700/30 dark:bg-emerald-500/20 dark:text-emerald-300" },
  "in-progress": { label: "In Progress", color: "bg-blue-50 text-blue-800 border-blue-700/30 dark:bg-blue-500/20 dark:text-blue-300" },
  planned: { label: "Planned", color: "bg-purple-50 text-purple-800 border-purple-700/30 dark:bg-purple-500/20 dark:text-purple-300" },
  proposed: { label: "Proposed", color: "bg-gray-100 text-gray-700 border-gray-400/50 dark:bg-gray-500/20 dark:text-gray-300" },
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
    <PortalLayout title="Strategic IT Roadmap">
      <div className="space-y-6">
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          data-testid="roadmap-sample-banner"
        >
          <strong>Sample preview.</strong> This roadmap is illustrative until your account team publishes your live vCIO plan.
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-gray-500 dark:text-gray-400">
              Your 3-year technology investment plan, aligned with business goals and security requirements.
            </p>
          </div>
          <Button
            variant="outline"
            className="flex items-center gap-2"
            data-testid="button-schedule-vcio"
            onClick={() => window.location.href = "/book"}
          >
            <Calendar className="h-4 w-4" />
            Schedule vCIO Review
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Completed</p>
                  <p className="text-2xl font-bold" data-testid="stat-roadmap-completed">{completedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">In Progress</p>
                  <p className="text-2xl font-bold" data-testid="stat-roadmap-progress">{inProgressCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <Target className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Planned</p>
                  <p className="text-2xl font-bold" data-testid="stat-roadmap-planned">{plannedCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Annual Budget</p>
                  <p className="text-2xl font-bold" data-testid="stat-roadmap-budget">{budgetSummary.totalBudget}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Budget Allocation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">Spent: <span data-testid="text-budget-spent">{budgetSummary.spent}</span></span>
                <span className="text-gray-500 dark:text-gray-400">Planned: <span data-testid="text-budget-planned">{budgetSummary.planned}</span></span>
                <span className="text-gray-500 dark:text-gray-400">Remaining: <span data-testid="text-budget-remaining">{budgetSummary.remaining}</span></span>
              </div>
              <div className="relative h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-emerald-500 rounded-l-full"
                  style={{ width: `${budgetSummary.spentPercent}%` }}
                />
                <div
                  className="absolute top-0 h-full bg-blue-500"
                  style={{ left: `${budgetSummary.spentPercent}%`, width: `${budgetSummary.plannedPercent}%` }}
                />
              </div>
              <div className="flex items-center gap-6 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-emerald-500" />
                  <span className="text-gray-500 dark:text-gray-400">Spent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-gray-500 dark:text-gray-400">Planned</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded bg-gray-200 dark:bg-gray-700" />
                  <span className="text-gray-500 dark:text-gray-400">Available</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-3">
          <select
            aria-label="Filter roadmap by category"
            className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
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
            className="px-3 py-2 rounded-lg border bg-white dark:bg-slate-800 dark:border-slate-700 text-sm"
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

        <div className="space-y-4">
          {filteredItems.map((item) => {
            const cat = categoryConfig[item.category];
            const pri = priorityConfig[item.priority];
            const stat = statusConfig[item.status];
            const CatIcon = cat.icon;
            const isExpanded = expandedItem === item.id;

            return (
              <Card
                key={item.id}
                role="button"
                tabIndex={0}
                aria-expanded={isExpanded}
                className="cursor-pointer hover:border-[#D3126A]/50 transition-colors"
                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedItem(isExpanded ? null : item.id); } }}
                data-testid={`roadmap-item-${item.id}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg ${cat.bg} flex items-center justify-center flex-shrink-0`}>
                      <CatIcon className={`h-5 w-5 ${cat.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-lg" data-testid={`text-roadmap-title-${item.id}`}>{item.title}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge className={`${stat.color} border text-xs`}>{stat.label}</Badge>
                            <Badge className={`${pri.color} text-xs`}>{pri.label}</Badge>
                            <span className="text-xs text-gray-500 dark:text-gray-400">{item.quarter}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-300" data-testid={`text-roadmap-cost-${item.id}`}>{item.estimatedCost}</span>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>

                      {item.status === "in-progress" && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-gray-500 dark:text-gray-400">Progress</span>
                            <span className="text-gray-500 dark:text-gray-400">{item.completionPercent}%</span>
                          </div>
                          <Progress value={item.completionPercent} className="h-2" aria-label={`${item.title} progress`} />
                        </div>
                      )}

                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t dark:border-slate-700 space-y-3">
                          <p className="text-gray-600 dark:text-gray-300 text-sm">{item.description}</p>
                          <div className="flex items-center gap-2 text-sm">
                            <TrendingUp className="h-4 w-4 text-emerald-400" />
                            <span className="text-gray-500 dark:text-gray-400">Business Impact:</span>
                            <span className="text-emerald-400 font-medium" data-testid={`text-roadmap-impact-${item.id}`}>{item.impact}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-gradient-to-r from-[#D3126A]/10 to-transparent border-[#D3126A]/30">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-[#D3126A]/20 flex items-center justify-center flex-shrink-0">
                <Map className="h-8 w-8 text-[#D3126A]" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-1">Need to adjust your roadmap?</h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Schedule a vCIO strategy session to review priorities, update your budget, or plan new initiatives.
                </p>
              </div>
              <Button
                className="bg-[#D3126A] hover:bg-[#D3126A]/90"
                onClick={() => window.location.href = "/book"}
                data-testid="button-schedule-strategy"
              >
                Book Strategy Session
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

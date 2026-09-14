import { useState } from "react";
import { PortalLayout } from "./PortalLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, Calendar, Download, TrendingUp, TrendingDown, Shield, Server,
  CheckCircle2, AlertTriangle, Clock, ArrowRight, FileText, Users, Wifi,
  Activity, Target, Zap, ExternalLink
} from "lucide-react";

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

export default function PortalQBR() {
  const [activeTab, setActiveTab] = useState<"overview" | "security" | "infrastructure" | "recommendations">("overview");

  return (
    <PortalLayout title="Quarterly Business Review">
      <div className="space-y-6">
        <div
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
          data-testid="qbr-sample-banner"
        >
          <strong>Sample preview.</strong> Metrics and reports below are examples until your live QBR data is connected.
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <p className="text-gray-500 dark:text-gray-400">
            Performance metrics, security posture, and strategic recommendations reviewed quarterly with your vCIO.
          </p>
          <Button
            className="bg-[#D3126A] hover:bg-[#D3126A]/90"
            onClick={() => window.location.href = "/book"}
            data-testid="button-schedule-qbr"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Schedule QBR Meeting
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {qbrReports.map((report) => (
            <Card
              key={report.id}
              className={`hover:border-[#D3126A]/50 transition-colors ${
                report.status === "completed" ? "border-emerald-500/30" : ""
              }`}
              data-testid={`qbr-report-${report.id}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    {report.quarter} {report.year}
                  </CardTitle>
                  <Badge
                    className={
                      report.status === "completed"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-700/30 dark:bg-emerald-500/20 dark:text-emerald-300"
                        : report.status === "scheduled"
                        ? "bg-blue-50 text-blue-800 border-blue-700/30 dark:bg-blue-500/20 dark:text-blue-300"
                        : "bg-gray-100 text-gray-700 border-gray-400/50 dark:bg-gray-500/20 dark:text-gray-300"
                    }
                  >
                    {report.status === "completed" ? "Completed" : report.status === "scheduled" ? "Scheduled" : "Draft"}
                  </Badge>
                </div>
                {report.meetingDate && (
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {report.meetingDate}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {report.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {h}
                    </li>
                  ))}
                </ul>
                {report.status === "completed" && (
                  <Button variant="outline" size="sm" className="mt-4 w-full" data-testid={`button-download-${report.id}`}>
                    <Download className="h-4 w-4 mr-2" />
                    Download Report
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 border-b dark:border-slate-700 overflow-x-auto">
          {[
            { key: "overview", label: "Overview", icon: BarChart3 },
            { key: "security", label: "Security Posture", icon: Shield },
            { key: "infrastructure", label: "Infrastructure", icon: Server },
            { key: "recommendations", label: "Recommendations", icon: Target },
          ].map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? "border-[#D3126A] text-[#D3126A]"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
                data-testid={`tab-qbr-${tab.key}`}
              >
                <TabIcon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Tickets Resolved</span>
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-3xl font-bold" data-testid="stat-tickets-resolved">
                    {ticketMetrics.resolved}/{ticketMetrics.totalTickets}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Avg resolution: {ticketMetrics.avgResolutionTime}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">SLA Compliance</span>
                    <Activity className="h-4 w-4 text-emerald-400" />
                  </div>
                  <p className="text-3xl font-bold" data-testid="stat-sla-compliance">{ticketMetrics.slaCompliance}%</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Target: 95%</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Customer Satisfaction</span>
                    <Zap className="h-4 w-4 text-amber-400" />
                  </div>
                  <p className="text-3xl font-bold" data-testid="stat-csat">{ticketMetrics.customerSatisfaction}/5.0</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">First-contact resolution: {ticketMetrics.firstContactResolution}%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-emerald-400" />
                  Security Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div className="relative w-28 h-28 flex-shrink-0">
                    <svg className="w-full h-full" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="8" fill="none" className="text-gray-200 dark:text-gray-700" />
                      <circle
                        cx="50" cy="50" r="40"
                        stroke="url(#scoreGradient)" strokeWidth="8" fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 40 * 0.88} ${2 * Math.PI * 40}`}
                        transform="rotate(-90 50 50)"
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#10b981" />
                          <stop offset="100%" stopColor="#D3126A" />
                        </linearGradient>
                      </defs>
                      <text x="50" y="50" textAnchor="middle" dominantBaseline="central" className="fill-current text-2xl font-bold" data-testid="text-security-score">
                        88
                      </text>
                    </svg>
                  </div>
                  <div className="space-y-3 flex-1">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Patch Compliance</span>
                        <span data-testid="text-patch-compliance">{securityMetrics.patchCompliance}%</span>
                      </div>
                      <Progress value={securityMetrics.patchCompliance} className="h-2" aria-label="Patch compliance" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Phishing Test Pass Rate</span>
                        <span data-testid="text-phishing-rate">{securityMetrics.phishingTestPassRate}%</span>
                      </div>
                      <Progress value={securityMetrics.phishingTestPassRate} className="h-2" aria-label="Phishing test pass rate" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-500 dark:text-gray-400">Uptime</span>
                        <span data-testid="text-uptime-percent">{securityMetrics.uptimePercent}%</span>
                      </div>
                      <Progress value={securityMetrics.uptimePercent} className="h-2" aria-label="Uptime" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "security" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <Shield className="h-8 w-8 text-emerald-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold" data-testid="stat-threats-blocked">{securityMetrics.threatsBlocked.toLocaleString()}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Threats Blocked</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Server className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold" data-testid="stat-endpoints">{securityMetrics.endpointsProtected}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Endpoints Protected</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Activity className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold" data-testid="stat-uptime">{securityMetrics.uptimePercent}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Uptime</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <Users className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-3xl font-bold" data-testid="stat-phishing">{securityMetrics.phishingTestPassRate}%</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Phishing Pass Rate</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Vulnerability Summary</CardTitle>
                <CardDescription>Current open vulnerabilities across your environment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-4">
                  {Object.entries(securityMetrics.vulnerabilities).map(([level, count]) => (
                    <div
                      key={level}
                      className={`text-center p-4 rounded-lg ${
                        level === "critical"
                          ? "bg-red-500/10 border border-red-500/20"
                          : level === "high"
                          ? "bg-orange-500/10 border border-orange-500/20"
                          : level === "medium"
                          ? "bg-yellow-500/10 border border-yellow-500/20"
                          : "bg-blue-500/10 border border-blue-500/20"
                      }`}
                      data-testid={`vuln-${level}`}
                    >
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-sm capitalize text-gray-500 dark:text-gray-400">{level}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "infrastructure" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-emerald-400" data-testid="stat-devices-online">{infrastructureMetrics.online}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-red-400" data-testid="stat-devices-offline">{infrastructureMetrics.offline}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Offline</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold text-amber-400" data-testid="stat-devices-attention">{infrastructureMetrics.needsAttention}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Needs Attention</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-3xl font-bold" data-testid="stat-devices-total">{infrastructureMetrics.totalDevices}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Total Devices</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Resource Utilization (Average)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">CPU Usage</span>
                    <span>{infrastructureMetrics.avgCPU}%</span>
                  </div>
                  <Progress value={infrastructureMetrics.avgCPU} className="h-3" aria-label="CPU usage" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Memory Usage</span>
                    <span>{infrastructureMetrics.avgMemory}%</span>
                  </div>
                  <Progress value={infrastructureMetrics.avgMemory} className="h-3" aria-label="Memory usage" />
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-500 dark:text-gray-400">Disk Usage</span>
                    <span>{infrastructureMetrics.avgDisk}%</span>
                  </div>
                  <Progress value={infrastructureMetrics.avgDisk} className="h-3" aria-label="Disk usage" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "recommendations" && (
          <div className="space-y-4">
            {recommendations.map((rec, idx) => (
              <Card
                key={idx}
                className={`border-l-4 ${
                  rec.priority === "high"
                    ? "border-l-orange-500"
                    : rec.priority === "medium"
                    ? "border-l-yellow-500"
                    : "border-l-blue-500"
                }`}
                data-testid={`recommendation-${idx}`}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          className={
                            rec.priority === "high"
                              ? "bg-orange-500 text-white"
                              : rec.priority === "medium"
                              ? "bg-yellow-500 text-black"
                              : "bg-blue-500 text-white"
                          }
                        >
                          {rec.priority}
                        </Badge>
                        <h3 className="font-semibold text-lg">{rec.title}</h3>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 text-sm mb-3">{rec.description}</p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-gray-500 dark:text-gray-400">Est. Cost:</span>
                          <span className="font-medium">{rec.estimatedCost}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          <span className="text-gray-500 dark:text-gray-400">Impact:</span>
                          <span className="text-emerald-400 font-medium">{rec.impact}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card className="bg-gradient-to-r from-[#D3126A]/10 to-transparent border-[#D3126A]/30">
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="w-16 h-16 rounded-2xl bg-[#D3126A]/20 flex items-center justify-center flex-shrink-0">
                    <Target className="h-8 w-8 text-[#D3126A]" />
                  </div>
                  <div className="flex-1 text-center md:text-left">
                    <h3 className="text-xl font-bold mb-1">Discuss these recommendations</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      Your vCIO can walk through each recommendation, prioritize based on your budget, and build an implementation timeline.
                    </p>
                  </div>
                  <Button
                    className="bg-[#D3126A] hover:bg-[#D3126A]/90"
                    onClick={() => window.location.href = "/book"}
                    data-testid="button-discuss-recommendations"
                  >
                    Book vCIO Session
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { PortalLayout } from "./PortalLayout";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";

export default function PortalStatus() {
  const services = [
    {
      name: "Client Portal",
      status: "operational",
      uptime: "99.98%",
      lastIncident: "15 days ago",
    },
    {
      name: "Email Services",
      status: "operational",
      uptime: "99.95%",
      lastIncident: "8 days ago",
    },
    {
      name: "VPN Access",
      status: "operational",
      uptime: "99.99%",
      lastIncident: "22 days ago",
    },
    {
      name: "File Sync & Backup",
      status: "operational",
      uptime: "99.97%",
      lastIncident: "3 days ago",
    },
    {
      name: "Cloud Storage",
      status: "operational",
      uptime: "99.99%",
      lastIncident: "19 days ago",
    },
    {
      name: "Security Monitoring",
      status: "operational",
      uptime: "99.99%",
      lastIncident: "45 days ago",
    },
  ];

  const incidents = [
    {
      id: 1,
      date: "Nov 8, 2025",
      service: "Email Services",
      impact: "Moderate",
      duration: "45 minutes",
      resolution: "Database failover completed successfully",
    },
    {
      id: 2,
      date: "Nov 1, 2025",
      service: "File Sync & Backup",
      impact: "Low",
      duration: "12 minutes",
      resolution: "Storage backend rebalanced",
    },
    {
      id: 3,
      date: "Oct 25, 2025",
      service: "VPN Access",
      impact: "Low",
      duration: "8 minutes",
      resolution: "Connection pool reset",
    },
  ];

  const metrics = [
    {
      label: "System Uptime (30 days)",
      value: "99.98%",
      target: "99.95%",
      status: "exceeding",
    },
    {
      label: "Avg Response Time",
      value: "145ms",
      target: "<200ms",
      status: "exceeding",
    },
    {
      label: "MTTR (Mean Time to Recover)",
      value: "18 minutes",
      target: "<30 minutes",
      status: "exceeding",
    },
    {
      label: "Security Incidents",
      value: "0",
      target: "0",
      status: "on-track",
    },
  ];

  return (
    <PortalLayout title="System Status">
      <div className="space-y-6">
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-100"
          data-testid="status-sample-banner"
        >
          <strong>Sample preview.</strong> Uptime figures and incident history below are illustrative until a live status feed is connected for your tenant.
        </div>

        {/* Overall Status */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-900/30 rounded-lg p-6">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold text-green-900 dark:text-green-100">
                All Systems Operational
              </h2>
              <p className="text-sm text-green-800 dark:text-green-300">
                Last updated: {new Date().toLocaleTimeString()}
              </p>
            </div>
            {/* The page had no focusable content, so its scrollable main was unreachable by
                keyboard (a11y sweep). Reporting an issue is the natural action here. */}
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/tickets/new" data-testid="status-report-issue">Report an issue</Link>
            </Button>
          </div>
        </div>

        {/* Performance Metrics */}
        <div>
          <h2 className="text-xl font-bold mb-4">Performance Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {metrics.map((metric) => (
              <Card key={metric.label}>
                <CardContent className="pt-6">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {metric.label}
                  </p>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-2xl font-bold">{metric.value}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      (Target: {metric.target})
                    </span>
                  </div>
                  <Badge
                    className={
                      metric.status === "exceeding"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30"
                        : "bg-blue-100 text-blue-800 dark:bg-blue-900/30"
                    }
                  >
                    {metric.status === "exceeding" ? "✓ Exceeding Target" : "✓ On Track"}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Services Status */}
        <div>
          <h2 className="text-xl font-bold mb-4">Service Status</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-3">
                {services.map((service) => (
                  <div
                    key={service.name}
                    className="flex items-center justify-between p-4 border rounded-lg dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                    data-testid={`service-status-${service.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                      <div>
                        <p className="font-medium">{service.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Uptime: {service.uptime}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 mb-1 block">
                        Operational
                      </Badge>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Last incident: {service.lastIncident}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Incidents */}
        <div>
          <h2 className="text-xl font-bold mb-4">Recent Incidents</h2>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {incidents.map((incident) => (
                  <div
                    key={incident.id}
                    className="p-4 border rounded-lg dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50"
                    data-testid={`incident-${incident.id}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                          <span className="font-semibold">{incident.service}</span>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {incident.date} • Duration: {incident.duration}
                        </p>
                      </div>
                      <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30">
                        {incident.impact} Impact
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {incident.resolution}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Maintenance Schedule */}
        <div>
          <h2 className="text-xl font-bold mb-4">Scheduled Maintenance</h2>
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600 dark:text-gray-400 text-center py-8">
                No scheduled maintenance in the next 30 days
              </p>
            </CardContent>
          </Card>
        </div>

        {/* SLA Info */}
        <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Our Commitment to You
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm">
              We guarantee 99.95% uptime for all critical services. Our team monitors systems 24/7 to ensure your business never stops.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="font-semibold text-sm">Response Time SLA</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Critical: 1 hour | High: 4 hours | Medium: 24 hours
                </p>
              </div>
              <div>
                <p className="font-semibold text-sm">Uptime SLA</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  99.95% availability guaranteed
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

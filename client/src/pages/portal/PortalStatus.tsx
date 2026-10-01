import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { PortalLayout } from "./PortalLayout";
import { CheckCircle2, CalendarClock } from "lucide-react";
import { Callout, EmptyState, Panel, StatTile, Token, type TokenTone } from "@/components/portal/ui";

const impactTone = (impact: string): TokenTone => {
  switch (impact.toLowerCase()) {
    case "high":
    case "critical":
      return "bad";
    case "moderate":
      return "warn";
    default:
      return "info";
  }
};

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
    <PortalLayout
      title="System Status"
      description="Availability of the services DE manages for you. Figures on this page are a sample until a live status feed is connected for your tenant."
      eyebrow={<Token label="Sample" tone="warn" />}
      actions={
        <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
          {/* The page had no focusable content, so its scrollable main was unreachable by
              keyboard (a11y sweep). Reporting an issue is the natural action here. */}
          <Link href="/portal/tickets/new" data-testid="status-report-issue">Report an issue</Link>
        </Button>
      }
    >
      <div className="space-y-6">
        <Callout tone="warn" title="Sample preview." testId="status-sample-banner">
          Uptime figures and incident history below are illustrative until a live status feed is connected for your tenant.
        </Callout>

        {/* Overall Status (sample) */}
        <Panel id="overall-status">
          <div className="flex flex-wrap items-center gap-3">
            <CheckCircle2 className="pt-ink pt-tone-ok h-8 w-8 shrink-0" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-xl font-semibold leading-tight">All Systems Operational</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Sample view · not a live feed. Rendered {new Date().toLocaleTimeString()}.
              </p>
            </div>
            <Token label="Sample" tone="warn" />
          </div>
        </Panel>

        {/* Performance Metrics (sample) */}
        <section aria-labelledby="status-metrics-title" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="status-metrics-title" className="font-heading text-[15px] font-semibold">Performance Metrics</h2>
            <span className="text-xs text-muted-foreground">Illustrative sample figures</span>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {metrics.map((metric) => (
              <StatTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                hint={`Target ${metric.target} · ${metric.status === "exceeding" ? "exceeding target" : "on track"} (sample)`}
                tone={metric.status === "exceeding" ? "ok" : "info"}
              />
            ))}
          </div>
        </section>

        {/* Services Status (sample) */}
        <Panel id="service-status" title="Service Status" description="Illustrative sample · not a live feed" flush>
          <ul className="divide-y divide-border">
            {services.map((service) => (
              <li
                key={service.name}
                className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5"
                data-testid={`service-status-${service.name.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{service.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Uptime <span className="pt-num">{service.uptime}</span> · Last incident {service.lastIncident}
                  </p>
                </div>
                <Token label="Operational" tone="ok" dot />
              </li>
            ))}
          </ul>
        </Panel>

        {/* Recent Incidents (sample) */}
        <Panel id="recent-incidents" title="Recent Incidents" description="Illustrative sample · not a live feed" flush>
          <ul className="divide-y divide-border">
            {incidents.map((incident) => (
              <li key={incident.id} className="px-4 py-3.5 md:px-5" data-testid={`incident-${incident.id}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{incident.service}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="pt-num">{incident.date}</span> · Duration {incident.duration}
                    </p>
                  </div>
                  <Token label={`${incident.impact} impact`} tone={impactTone(incident.impact)} />
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{incident.resolution}</p>
              </li>
            ))}
          </ul>
        </Panel>

        {/* Maintenance Schedule (sample) */}
        <Panel id="scheduled-maintenance" title="Scheduled Maintenance" description="Illustrative sample · not a live feed" flush>
          <EmptyState icon={CalendarClock} title="No scheduled maintenance in the next 30 days" compact />
        </Panel>

        {/* SLA Info */}
        <Panel id="sla-commitment" title="Our Commitment to You">
          <div className="space-y-4">
            <p className="text-sm">
              We guarantee 99.95% uptime for all critical services. Our team monitors systems 24/7 to ensure your business never stops.
            </p>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium">Response Time SLA</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">Critical: 1 hour | High: 4 hours | Medium: 24 hours</dd>
              </div>
              <div>
                <dt className="text-sm font-medium">Uptime SLA</dt>
                <dd className="mt-0.5 text-xs text-muted-foreground">99.95% availability guaranteed</dd>
              </div>
            </dl>
          </div>
        </Panel>
      </div>
    </PortalLayout>
  );
}

import { Link } from "wouter";
import { Download, Key, Monitor, RefreshCw, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Callout, DataTable, EmptyState, Panel, StatTile, Token, type DataColumn } from "@/components/portal/ui";

interface VPNConnection {
  id: string;
  device: string;
  location: string;
  lastConnected: string;
  status: "connected" | "disconnected";
}

const connections: VPNConnection[] = [
  { id: "1", device: "Work Laptop", location: "Phoenix, AZ", lastConnected: "Currently connected", status: "connected" },
  { id: "2", device: "Home Desktop", location: "Chandler, AZ", lastConnected: "2 hours ago", status: "disconnected" },
  { id: "3", device: "iPhone 15", location: "Gilbert, AZ", lastConnected: "Yesterday", status: "disconnected" },
];

const CLIENTS = [
  { label: "Windows", hint: "v2.5.1", icon: Monitor, testId: "button-download-windows" },
  { label: "macOS", hint: "v2.5.1", icon: Monitor, testId: "button-download-mac" },
  { label: "iOS / Android", hint: "App Store", icon: Smartphone, testId: "button-download-mobile" },
];

export default function PortalVPN() {
  const connectedCount = connections.filter((c) => c.status === "connected").length;

  const columns: DataColumn<VPNConnection>[] = [
    {
      key: "device",
      header: "Device",
      primary: true,
      cell: (conn) => {
        const Icon = conn.device.includes("iPhone") || conn.device.includes("Android") ? Smartphone : Monitor;
        return (
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{conn.device}</span>
          </span>
        );
      },
    },
    { key: "location", header: "Location", hideBelowMd: true, className: "w-40", cell: (conn) => <span className="text-muted-foreground">{conn.location}</span> },
    {
      key: "status",
      header: "Status",
      primary: true,
      className: "w-40",
      cell: (conn) => (conn.status === "connected" ? <Token label="Connected" tone="ok" dot /> : <Token label="Disconnected" tone="neutral" dot />),
    },
    { key: "last", header: "Last connected", primary: true, align: "right", className: "w-44 whitespace-nowrap", cell: (conn) => <span className="text-muted-foreground">{conn.lastConnected}</span> },
  ];

  return (
    <PortalLayout
      title="VPN Access"
      description="Preview your secure-access tools. Downloads and configuration are unavailable until the service is connected."
    >
      <div className="space-y-4">
        <Callout tone="info" title="Sample data">
          The status and devices shown here are examples, not your account data. Downloads and configuration changes are unavailable while the secure-access connection is being prepared.
        </Callout>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="VPN figures">
          <StatTile label="VPN status" value="Active" tone="ok" hint="sample" />
          <StatTile label="Connected devices" value={connectedCount} suffix="/5" hint="sample allowance" />
          <StatTile label="Server location" value="Phoenix, AZ" hint="sample gateway" className="col-span-2 lg:col-span-1" />
        </section>

        <Panel id="vpn-clients" title="Download VPN client" description="Install the VPN client on your devices to securely connect to company resources">
          <div className="grid gap-3 sm:grid-cols-3">
            {CLIENTS.map((c) => {
              const Icon = c.icon;
              return (
                <Button key={c.testId} disabled variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent" data-testid={c.testId}>
                  <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground">Not connected</span>
                </Button>
              );
            })}
          </div>
        </Panel>

        <Panel
          id="vpn-config"
          title="VPN configuration"
          description="Configuration downloads will be available after the secure-access service is connected."
          actions={
            <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" disabled data-testid="button-regenerate-config">
              <RefreshCw aria-hidden="true" />
              Regenerate Config
            </Button>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Key className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">No configuration available</p>
                <p className="text-xs text-muted-foreground">Secure-access connection pending</p>
              </div>
            </div>
            <Button variant="brand" disabled data-testid="button-download-config">
              <Download aria-hidden="true" />
              Download
            </Button>
          </div>
        </Panel>

        <Panel id="vpn-devices" title="Example devices" description="Sample records showing the device view; not devices authorized on your account." flush>
          <DataTable<VPNConnection>
            columns={columns}
            rows={connections}
            rowKey={(conn) => conn.id}
            rowTestId={(conn) => `device-${conn.id}`}
            caption="Connected devices"
            empty={<EmptyState compact icon={Monitor} title="No devices yet" description="Devices appear here once they connect through the VPN client." />}
          />
        </Panel>

        <Callout tone="info" title="Need help connecting?">
          Check our{" "}
          <Link href="/portal/kb">Knowledge Base</Link>{" "}
          for step-by-step setup guides, or{" "}
          <Link href="/portal/tickets">submit a support ticket</Link>{" "}
          if you're experiencing issues.
        </Callout>
      </div>
    </PortalLayout>
  );
}

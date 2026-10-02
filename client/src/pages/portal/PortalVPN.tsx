import { useState } from "react";
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
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerateConfig = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setIsRegenerating(false);
      alert("New VPN configuration generated! Check your email for the updated config file.");
    }, 2000);
  };

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
      description="Install the client, download your personal configuration and see which devices are allowed on the DE VPN."
    >
      <div className="space-y-4">
        <Callout tone="info" title="Sample data">
          The status, devices and configuration shown here are examples. Live VPN figures appear once your account is linked.
        </Callout>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="VPN figures">
          <StatTile label="VPN status" value="Active" tone="ok" hint="sample" />
          <StatTile label="Connected devices" value={connectedCount} suffix="/5" hint="of your allowance" />
          <StatTile label="Server location" value="Phoenix, AZ" hint="nearest gateway" className="col-span-2 lg:col-span-1" />
        </section>

        <Panel id="vpn-clients" title="Download VPN client" description="Install the VPN client on your devices to securely connect to company resources">
          <div className="grid gap-3 sm:grid-cols-3">
            {CLIENTS.map((c) => {
              const Icon = c.icon;
              return (
                <Button key={c.testId} variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent" data-testid={c.testId}>
                  <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-muted-foreground">{c.hint}</span>
                </Button>
              );
            })}
          </div>
        </Panel>

        <Panel
          id="vpn-config"
          title="VPN configuration"
          description="Your personal VPN configuration file"
          actions={
            <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={handleRegenerateConfig} disabled={isRegenerating} data-testid="button-regenerate-config">
              <RefreshCw className={isRegenerating ? "animate-spin" : ""} aria-hidden="true" />
              {isRegenerating ? "Regenerating..." : "Regenerate Config"}
            </Button>
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <Key className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">digerati-vpn-config.ovpn</p>
                <p className="pt-num text-xs text-muted-foreground">Generated: Jan 15, 2025</p>
              </div>
            </div>
            <Button variant="brand" data-testid="button-download-config">
              <Download aria-hidden="true" />
              Download
            </Button>
          </div>
        </Panel>

        <Panel id="vpn-devices" title="Connected devices" description="Devices authorized to use your VPN connection" flush>
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

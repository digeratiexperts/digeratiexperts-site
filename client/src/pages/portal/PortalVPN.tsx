import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, Key, Link2Off, Monitor, Pencil, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLayout } from "./PortalLayout";
import { Callout, DataTable, EmptyState, Field, Panel, StatTile, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";
import { IntegrationHiddenNotice, IntegrationNeedsCompanyNotice } from "@/components/portal/IntegrationNotices";
import { usePortalIntegrations, type IntegrationStatus } from "@/lib/portalIntegrations";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";

// ---------------------------------------------------------------------------
// Sample mode (PORTAL_VPN_PROVIDER unset): today's page, unchanged.
// ---------------------------------------------------------------------------

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

const PAGE_TITLE = "VPN Access";
const SAMPLE_DESCRIPTION = "Install the client, download your personal configuration and see which devices are allowed on the DE VPN.";
const LIVE_DESCRIPTION = "Install the client and see which of your company's devices are on the DE VPN.";

function SampleVPN() {
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
    <PortalLayout title={PAGE_TITLE} description={SAMPLE_DESCRIPTION}>
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

        <HelpCallout />
      </div>
    </PortalLayout>
  );
}

function HelpCallout() {
  return (
    <Callout tone="info" title="Need help connecting?">
      Check our{" "}
      <Link href="/portal/kb">Knowledge Base</Link>{" "}
      for step-by-step setup guides, or{" "}
      <Link href="/portal/tickets">submit a support ticket</Link>{" "}
      if you're experiencing issues.
    </Callout>
  );
}

// ---------------------------------------------------------------------------
// Live mode: GET /api/portal/vpn (server/integrations/vpn, types in types.ts).
// ---------------------------------------------------------------------------

type VpnDeviceStatus = "online" | "offline" | "pending" | "active" | "blocked" | "unknown";

type VpnDevice = {
  id: string;
  name: string;
  os: string | null;
  status: VpnDeviceStatus;
  lastSeen: string | null;
  user: string | null;
  protocol?: string | null;
  notes?: string | null;
};

type VpnData = {
  provider: "tailscale" | "twingate" | "perimeter81" | "manual";
  providerName: string;
  service: { status: "reachable" | "staff_managed"; checkedAt: string };
  reportsLiveStatus: boolean;
  devices: VpnDevice[];
};

type VpnResponse = {
  success: boolean;
  status: IntegrationStatus;
  needsCompany?: boolean;
  notMapped?: boolean;
  data?: VpnData;
  manage?: { clientId: string };
};

const VPN_QUERY_KEY = ["/api/portal/vpn"] as const;
const MANUAL_RECORDS_URL = "/api/portal/admin/manual-records";

const STATUS_TOKEN: Record<VpnDeviceStatus, { label: string; tone: TokenTone }> = {
  online: { label: "Connected", tone: "ok" },
  offline: { label: "Disconnected", tone: "neutral" },
  pending: { label: "Awaiting approval", tone: "warn" },
  active: { label: "Active", tone: "info" },
  blocked: { label: "Blocked", tone: "bad" },
  unknown: { label: "Unknown", tone: "neutral" },
};

/** The vendor's own client download pages. */
type ClientLink = { label: string; hint: string; href: string; icon: typeof Monitor; testId: string };
const CLIENT_LINKS: Record<string, ClientLink[]> = {
  tailscale: [
    { label: "Windows", hint: "Tailscale", href: "https://tailscale.com/download/windows", icon: Monitor, testId: "button-download-windows" },
    { label: "macOS", hint: "Tailscale", href: "https://tailscale.com/download/mac", icon: Monitor, testId: "button-download-mac" },
    { label: "iOS / Android", hint: "Tailscale", href: "https://tailscale.com/download", icon: Smartphone, testId: "button-download-mobile" },
  ],
  twingate: [
    { label: "Windows", hint: "Twingate", href: "https://www.twingate.com/download", icon: Monitor, testId: "button-download-windows" },
    { label: "macOS", hint: "Twingate", href: "https://www.twingate.com/download", icon: Monitor, testId: "button-download-mac" },
    { label: "iOS / Android", hint: "Twingate", href: "https://www.twingate.com/download", icon: Smartphone, testId: "button-download-mobile" },
  ],
  manual: [
    { label: "WireGuard", hint: "Windows, macOS, iOS, Android", href: "https://www.wireguard.com/install/", icon: Monitor, testId: "button-download-wireguard" },
    { label: "OpenVPN Connect", hint: "Windows, macOS, iOS, Android", href: "https://openvpn.net/client/", icon: Monitor, testId: "button-download-openvpn" },
  ],
};

const PROFILE_TEXT: Record<string, string> = {
  tailscale: "Install Tailscale and sign in the way DE set up for your company. DE approves each device for your company; there is no configuration file to download.",
  twingate: "Install Twingate and sign in with your company account. DE manages which resources your account can reach; there is no configuration file to download.",
  manual: "DE issues each WireGuard or OpenVPN profile directly to you. Profiles and keys are never stored in the portal.",
};

function formatLastSeen(device: VpnDevice, provider: VpnData["provider"]): string {
  if (device.status === "online") return "Connected now";
  if (!device.lastSeen) return "Not reported";
  // Staff enter a date only; show it as entered, not shifted by time zone.
  if (provider === "manual") return new Date(device.lastSeen).toLocaleDateString(undefined, { timeZone: "UTC" });
  return formatDeskTimestamp(device.lastSeen);
}

function isMobileOs(os: string | null): boolean {
  return !!os && /ios|iphone|ipad|android/i.test(os);
}

export default function PortalVPN() {
  const integrations = usePortalIntegrations();
  const mode = integrations.vpn.mode;

  if (mode === "sample") return <SampleVPN />;

  if (mode === "hidden") {
    return (
      <PortalLayout title={PAGE_TITLE}>
        <IntegrationHiddenNotice what="VPN Access" />
      </PortalLayout>
    );
  }

  return <LiveVPN />;
}

function LiveVPN() {
  const query = useQuery<VpnResponse>({
    queryKey: VPN_QUERY_KEY,
    queryFn: () => portalGet<VpnResponse>("/api/portal/vpn"),
    retry: false,
  });
  const res = query.data;

  let body: ReactNode;
  if (query.isError) {
    body = (
      <Callout tone="bad" title="VPN data isn't available right now" testId="callout-vpn-error">
        Try again in a few minutes. If it keeps happening,{" "}
        <Link href="/portal/tickets" className="pt-link hover:underline">
          submit a support ticket
        </Link>
        .
      </Callout>
    );
  } else if (res?.needsCompany) {
    body = <IntegrationNeedsCompanyNotice what="VPN devices" />;
  } else if (res?.notMapped) {
    body = (
      <Panel id="vpn-not-linked" flush>
        <EmptyState
          icon={Link2Off}
          title="Your VPN isn't linked to the portal yet"
          description="DE hasn't connected your company's VPN account to this page, so there are no devices to show. Your DE account team can link it."
          action={
            <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
              <Link href="/portal/tickets" data-testid="link-vpn-not-linked-ticket">
                Ask DE
              </Link>
            </Button>
          }
        />
      </Panel>
    );
  } else {
    body = <LiveVPNContent data={res?.data ?? null} loading={query.isLoading} manageClientId={res?.manage?.clientId ?? null} />;
  }

  return (
    <PortalLayout title={PAGE_TITLE} description={LIVE_DESCRIPTION}>
      <div className="space-y-4">
        {body}
        <HelpCallout />
      </div>
    </PortalLayout>
  );
}

function LiveVPNContent({ data, loading, manageClientId }: { data: VpnData | null; loading: boolean; manageClientId: string | null }) {
  const devices = data?.devices ?? [];
  const provider = data?.provider ?? "manual";
  const canManage = !!manageClientId && provider === "manual";
  const [editing, setEditing] = useState<VpnDevice | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const onlineCount = devices.filter((d) => d.status === "online").length;
  const activeCount = devices.filter((d) => d.status === "active").length;
  const links = data ? CLIENT_LINKS[provider] ?? [] : [];

  const remove = async (device: VpnDevice) => {
    if (!manageClientId) return;
    if (!window.confirm(`Remove "${device.name}" from this company's VPN devices?`)) return;
    setActionError(null);
    const qs = new URLSearchParams({ clientId: manageClientId, kind: "vpn_device" });
    try {
      const r = await portalFetch(`${MANUAL_RECORDS_URL}/${encodeURIComponent(device.id)}?${qs}`, { method: "DELETE" });
      if (!r.ok) setActionError("The device could not be removed. Try again.");
    } catch {
      setActionError("The device could not be removed. Check your connection and try again.");
    }
    await queryClient.invalidateQueries({ queryKey: VPN_QUERY_KEY });
  };

  const columns: DataColumn<VpnDevice>[] = [
    {
      key: "device",
      header: "Device",
      primary: true,
      cell: (d) => {
        const Icon = isMobileOs(d.os) ? Smartphone : Monitor;
        return (
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block font-medium">{d.name}</span>
              {(d.os || d.protocol) && (
                <span className="block text-xs text-muted-foreground">
                  {[d.os, d.protocol === "wireguard" ? "WireGuard" : d.protocol === "openvpn" ? "OpenVPN" : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </span>
        );
      },
    },
    { key: "user", header: "User", hideBelowMd: true, className: "w-48", cell: (d) => <span className="text-muted-foreground">{d.user || "—"}</span> },
    {
      key: "status",
      header: "Status",
      primary: true,
      className: "w-40",
      cell: (d) => <Token label={STATUS_TOKEN[d.status]?.label ?? "Unknown"} tone={STATUS_TOKEN[d.status]?.tone ?? "neutral"} dot />,
    },
    {
      key: "last",
      header: data?.reportsLiveStatus ? "Last seen" : provider === "twingate" ? "Last sign-in" : "Last connected",
      primary: true,
      align: "right",
      className: "w-48 whitespace-nowrap",
      cell: (d) => <span className="pt-num text-muted-foreground">{formatLastSeen(d, provider)}</span>,
    },
  ];
  if (canManage) {
    columns.push({
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      className: "w-28",
      cell: (d) => (
        <span className="flex justify-end gap-1">
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${d.name}`} onClick={() => setEditing(d)} data-testid={`button-edit-vpn-device-${d.id}`}>
            <Pencil aria-hidden="true" />
          </Button>
          <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${d.name}`} onClick={() => remove(d)} data-testid={`button-delete-vpn-device-${d.id}`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
      ),
    });
  }

  return (
    <>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3" aria-label="VPN figures">
        {data?.service.status === "staff_managed" ? (
          <StatTile label="VPN service" value="Managed by DE" tone="info" hint="device list kept by DE staff" loading={loading} />
        ) : (
          <StatTile
            label="VPN service"
            value="Linked"
            tone="ok"
            hint={data ? `${data.providerName} answered ${formatDeskTimestamp(data.service.checkedAt)}` : undefined}
            loading={loading}
          />
        )}
        <StatTile label="Devices" value={devices.length} hint="on your company's VPN" loading={loading} />
        {data?.reportsLiveStatus ? (
          <StatTile label="Connected now" value={onlineCount} tone={onlineCount ? "ok" : "neutral"} hint={`of ${devices.length}`} loading={loading} className="col-span-2 lg:col-span-1" />
        ) : (
          <StatTile label="Active devices" value={activeCount} hint="allowed to connect" loading={loading} className="col-span-2 lg:col-span-1" />
        )}
      </section>

      {links.length > 0 && (
        <Panel id="vpn-clients" title="Download VPN client" description={`Install the ${data?.provider === "manual" ? "VPN" : data?.providerName} client on your devices to securely connect to company resources`}>
          <div className={`grid gap-3 ${links.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {links.map((c) => {
              const Icon = c.icon;
              return (
                <Button key={c.testId} asChild variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent">
                  <a href={c.href} target="_blank" rel="noopener noreferrer" data-testid={c.testId}>
                    <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                    <span className="flex items-center gap-1 text-sm font-medium">
                      {c.label}
                      <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">(opens the vendor's download page in a new tab)</span>
                    </span>
                    <span className="text-xs text-muted-foreground">{c.hint}</span>
                  </a>
                </Button>
              );
            })}
          </div>
        </Panel>
      )}

      {data && (
        <Callout tone="info" title="Your VPN profile is issued by DE" testId="callout-vpn-profile">
          {PROFILE_TEXT[provider] ?? "DE sets up your VPN access."} To add a device or replace a profile,{" "}
          <Link href="/portal/tickets" className="pt-link hover:underline">
            submit a support ticket
          </Link>
          .
        </Callout>
      )}

      {canManage && editing && manageClientId && (
        <ManualDeviceForm
          key={editing === "new" ? "new" : editing.id}
          clientId={manageClientId}
          device={editing === "new" ? null : editing}
          onDone={async () => {
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: VPN_QUERY_KEY });
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {actionError && (
        <Callout tone="bad" title="Not saved">
          {actionError}
        </Callout>
      )}

      <Panel
        id="vpn-devices"
        title={data?.reportsLiveStatus ? "Connected devices" : "VPN devices"}
        description="Your company's devices on the DE VPN"
        flush
        actions={
          canManage && editing === null ? (
            <Button variant="brand" size="sm" onClick={() => setEditing("new")} data-testid="button-add-vpn-device">
              <Plus aria-hidden="true" />
              Add device
            </Button>
          ) : undefined
        }
      >
        <DataTable<VpnDevice>
          columns={columns}
          rows={devices}
          rowKey={(d) => d.id}
          rowTestId={(d) => `device-${d.id}`}
          loading={loading}
          caption="VPN devices"
          empty={
            <EmptyState
              compact
              icon={Monitor}
              title="No devices yet"
              description={
                canManage
                  ? "Add the WireGuard or OpenVPN devices DE has issued to this company."
                  : provider === "manual"
                    ? "DE hasn't listed any VPN devices for your company yet."
                    : "Devices appear here once they connect through the VPN client."
              }
            />
          }
        />
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------
// "manual" provider: DE admin add / edit form (admin manual-records API).
// ---------------------------------------------------------------------------

type DeviceForm = { name: string; os: string; protocol: string; status: string; lastSeen: string; user: string; notes: string };

function toForm(d: VpnDevice | null): DeviceForm {
  return {
    name: d?.name ?? "",
    os: d?.os ?? "",
    protocol: d?.protocol ?? "wireguard",
    status: d?.status === "blocked" ? "blocked" : "active",
    lastSeen: d?.lastSeen ? d.lastSeen.slice(0, 10) : "",
    user: d?.user ?? "",
    notes: d?.notes ?? "",
  };
}

function ManualDeviceForm({ clientId, device, onDone, onCancel }: { clientId: string; device: VpnDevice | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<DeviceForm>(() => toForm(device));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof DeviceForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Enter a device name.");
      return;
    }
    setSaving(true);
    setError(null);
    // Only these fields are stored; never a key or a config file.
    const data = {
      name: form.name.trim(),
      os: form.os.trim(),
      protocol: form.protocol,
      status: form.status,
      lastSeen: form.lastSeen,
      user: form.user.trim(),
      notes: form.notes.trim(),
    };
    const url = device ? `${MANUAL_RECORDS_URL}/${encodeURIComponent(device.id)}` : MANUAL_RECORDS_URL;
    let ok = false;
    try {
      const r = await portalFetch(url, { method: device ? "PATCH" : "POST", body: JSON.stringify({ clientId, kind: "vpn_device", data }) });
      ok = r.ok;
    } catch {
      ok = false;
    }
    setSaving(false);
    if (!ok) {
      setError("The device could not be saved. Check the fields and try again.");
      return;
    }
    onDone();
  };

  return (
    <Panel id="vpn-device-form" title={device ? `Edit ${device.name}` : "Add a VPN device"} description="Staff-entered. Do not paste keys or config files here.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Device name" htmlFor="vpn-device-name" required error={error && !form.name.trim() ? error : undefined}>
            <Input id="vpn-device-name" value={form.name} onChange={(e) => set("name")(e.target.value)} maxLength={120} className="border-border bg-background" data-testid="input-vpn-device-name" />
          </Field>
          <Field label="OS / device type" htmlFor="vpn-device-os" hint="e.g. Windows 11, iPhone">
            <Input id="vpn-device-os" value={form.os} onChange={(e) => set("os")(e.target.value)} maxLength={60} className="border-border bg-background" data-testid="input-vpn-device-os" />
          </Field>
          <Field label="Protocol" labelId="vpn-device-protocol-label">
            <Select value={form.protocol} onValueChange={set("protocol")}>
              <SelectTrigger aria-labelledby="vpn-device-protocol-label" className="border-border bg-background" data-testid="select-vpn-device-protocol">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="wireguard">WireGuard</SelectItem>
                <SelectItem value="openvpn">OpenVPN</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status" labelId="vpn-device-status-label">
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger aria-labelledby="vpn-device-status-label" className="border-border bg-background" data-testid="select-vpn-device-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="blocked">Blocked / revoked</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Assigned user" htmlFor="vpn-device-user">
            <Input id="vpn-device-user" value={form.user} onChange={(e) => set("user")(e.target.value)} maxLength={120} className="border-border bg-background" data-testid="input-vpn-device-user" />
          </Field>
          <Field label="Last connected" htmlFor="vpn-device-last" hint="Leave empty if unknown">
            <Input id="vpn-device-last" type="date" value={form.lastSeen} onChange={(e) => set("lastSeen")(e.target.value)} className="border-border bg-background" data-testid="input-vpn-device-last" />
          </Field>
        </div>
        <Field label="Notes" htmlFor="vpn-device-notes">
          <Textarea id="vpn-device-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={500} rows={3} className="border-border bg-background" data-testid="input-vpn-device-notes" />
        </Field>
        {error && form.name.trim() && (
          <Callout tone="bad" title="Not saved">
            {error}
          </Callout>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" onClick={onCancel} disabled={saving} data-testid="button-cancel-vpn-device">
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={saving} data-testid="button-save-vpn-device">
            {saving ? "Saving..." : device ? "Save changes" : "Add device"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

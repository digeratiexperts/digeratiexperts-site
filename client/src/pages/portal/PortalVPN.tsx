import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ExternalLink, FileUp, Key, Link2Off, Monitor, Pencil, Plus, RefreshCw, Smartphone, Trash2 } from "lucide-react";
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
import { convertRecords, CsvError, readCsvRecords, toIsoDate, type HeaderAliases, type RowError } from "@/lib/csv";

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
const SAMPLE_DESCRIPTION = "Preview secure-access tools. Downloads and configuration are unavailable until the service is connected.";
const LIVE_DESCRIPTION = "Install the client and see which of your company's devices are on the DE VPN.";

function SampleVPN() {
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
          The status and devices shown here are examples, not your account data. Downloads and configuration changes are unavailable until the service is connected.
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
                <Button disabled key={c.testId} variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent" data-testid={c.testId}>
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
          description="Configuration is unavailable until the secure-access service is connected."
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
                <p className="truncate text-sm font-medium">No configuration available</p>
                <p className="pt-num text-xs text-muted-foreground">Secure-access connection pending</p>
              </div>
            </div>
            <Button disabled variant="brand" data-testid="button-download-config">
              <Download aria-hidden="true" />
              Download
            </Button>
          </div>
        </Panel>

        <Panel id="vpn-devices" title="Example devices" description="Sample records; not devices authorized on your account." flush>
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
  provider: "tailscale" | "twingate" | "perimeter81" | "timus" | "manual";
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
  // Timus's adapter is not built yet (server/integrations/vpn/timus.ts); ready for when it is.
  timus: [
    { label: "Windows", hint: "Timus Connect", href: "https://www.timusnetworks.com/timus-connect-agent/", icon: Monitor, testId: "button-download-windows" },
    { label: "macOS", hint: "Timus Connect", href: "https://www.timusnetworks.com/timus-connect-agent/", icon: Monitor, testId: "button-download-mac" },
    { label: "iOS / Android", hint: "Timus Connect", href: "https://www.timusnetworks.com/timus-connect-agent/", icon: Smartphone, testId: "button-download-mobile" },
  ],
  manual: [
    { label: "WireGuard", hint: "Windows, macOS, iOS, Android", href: "https://www.wireguard.com/install/", icon: Monitor, testId: "button-download-wireguard" },
    { label: "OpenVPN Connect", hint: "Windows, macOS, iOS, Android", href: "https://openvpn.net/client/", icon: Monitor, testId: "button-download-openvpn" },
  ],
};

const PROFILE_TEXT: Record<string, string> = {
  tailscale: "Install Tailscale and sign in the way DE set up for your company. DE approves each device for your company; there is no configuration file to download.",
  twingate: "Install Twingate and sign in with your company account. DE manages which resources your account can reach; there is no configuration file to download.",
  timus: "Install Timus Connect and sign in with your company account. DE manages which resources your account can reach; there is no configuration file to download.",
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
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
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

      {canManage && importing && manageClientId && (
        <ManualDeviceImport
          clientId={manageClientId}
          onDone={async (count) => {
            setImporting(false);
            setImportNotice(`Imported ${count} device${count === 1 ? "" : "s"}.`);
            await queryClient.invalidateQueries({ queryKey: VPN_QUERY_KEY });
          }}
          onCancel={() => setImporting(false)}
        />
      )}

      {importNotice && (
        <Callout tone="ok" title="Import complete" testId="callout-vpn-import-done" role="status">
          {importNotice}
        </Callout>
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
          canManage && editing === null && !importing ? (
            <span className="flex flex-wrap justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-border bg-card hover:bg-accent"
                onClick={() => {
                  setImportNotice(null);
                  setImporting(true);
                }}
                data-testid="button-import-vpn-devices"
              >
                <FileUp aria-hidden="true" />
                Import CSV
              </Button>
              <Button
                variant="brand"
                size="sm"
                onClick={() => {
                  setImportNotice(null);
                  setEditing("new");
                }}
                data-testid="button-add-vpn-device"
              >
                <Plus aria-hidden="true" />
                Add device
              </Button>
            </span>
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

// ---------------------------------------------------------------------------
// "manual" provider: DE admin CSV import (POST /api/portal/admin/manual-records/import).
// A device export (e.g. from Timus Manager) or a pasted spreadsheet range.
// ---------------------------------------------------------------------------

const MAX_IMPORT_ROWS = 500;
/** The import route accepts 1 MB bodies (server/index.ts); stay under it. */
const MAX_IMPORT_BYTES = 900_000;

const VPN_IMPORT_HEADERS: HeaderAliases<keyof DeviceForm> = {
  name: ["device", "device name", "hostname", "host name", "computer", "computer name"],
  os: ["operating system", "platform", "device type", "os version"],
  protocol: ["vpn protocol"],
  status: ["state", "profile status"],
  lastSeen: ["last seen", "last connected", "last connection", "last login", "last sign in", "last active"],
  user: ["username", "user name", "email", "user email", "assigned user", "owner"],
  notes: ["note", "comment", "comments", "description"],
};
const VPN_IMPORT_HINT =
  "First row is the column names. Accepted (any case): name or device or hostname (required), os, protocol (WireGuard / OpenVPN), status (active / blocked), last seen or last connected (a date), user or email, notes. Other columns are ignored. Up to 500 rows.";

function tooLong(label: string, v: string, max: number): string | null {
  return v.length > max ? `${label} is longer than ${max} characters` : null;
}

function convertDeviceRow(r: Partial<Record<keyof DeviceForm, string>>): { data: Record<string, string> } | { error: string } {
  const name = r.name ?? "";
  if (!name) return { error: "name is empty" };
  const protocolIn = (r.protocol ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const protocol = protocolIn === "" ? "" : protocolIn === "wireguard" || protocolIn === "wg" ? "wireguard" : protocolIn === "openvpn" || protocolIn === "ovpn" ? "openvpn" : null;
  if (protocol === null) return { error: `protocol "${r.protocol}" is not WireGuard or OpenVPN` };
  const statusIn = (r.status ?? "").toLowerCase().trim();
  const status = statusIn === "" ? "" : ["active", "enabled"].includes(statusIn) ? "active" : ["blocked", "disabled", "revoked"].includes(statusIn) ? "blocked" : null;
  if (status === null) return { error: `status "${r.status}" is not active or blocked` };
  const lastSeen = toIsoDate(r.lastSeen ?? "");
  if (lastSeen === null) return { error: `last seen "${r.lastSeen}" is not a date` };
  const data = { name, os: r.os ?? "", protocol, status, lastSeen, user: r.user ?? "", notes: r.notes ?? "" };
  const long = tooLong("name", data.name, 120) || tooLong("os", data.os, 60) || tooLong("user", data.user, 120) || tooLong("notes", data.notes, 500);
  return long ? { error: long } : { data };
}

type ImportPreview = { rows: Record<string, string>[]; errors: RowError[]; ignored: string[] } | { parseError: string };

function previewDeviceImport(text: string): ImportPreview | null {
  if (!text.trim()) return null;
  try {
    const csv = readCsvRecords(text, VPN_IMPORT_HEADERS);
    if (csv.records.length > MAX_IMPORT_ROWS) return { parseError: `The file has ${csv.records.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.` };
    if (!csv.fields.includes("name")) return { parseError: "No name column. Add a column named name, device or hostname." };
    const { rows, errors } = convertRecords(csv.records, convertDeviceRow);
    return { rows, errors, ignored: csv.unknownHeaders };
  } catch (err) {
    return { parseError: err instanceof CsvError ? err.message : "The CSV could not be read." };
  }
}

function ManualDeviceImport({ clientId, onDone, onCancel }: { clientId: string; onDone: (count: number) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const preview = useMemo(() => previewDeviceImport(text), [text]);
  const ready = !!preview && !("parseError" in preview) && preview.errors.length === 0 && preview.rows.length > 0;

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSaveError(null);
    if (!file) return;
    try {
      setText(await file.text());
    } catch {
      setSaveError("The file could not be read.");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready || !preview || "parseError" in preview) return;
    const body = JSON.stringify({ clientId, kind: "vpn_device", rows: preview.rows });
    if (new Blob([body]).size > MAX_IMPORT_BYTES) {
      setSaveError("This file is too large to import in one go. Split it into smaller files.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const r = await portalFetch(`${MANUAL_RECORDS_URL}/import`, { method: "POST", body });
      if (r.ok) {
        const out = (await r.json().catch(() => ({}))) as { imported?: number };
        setSaving(false);
        onDone(out.imported ?? preview.rows.length);
        return;
      }
      const out = (await r.json().catch(() => ({}))) as { error?: string };
      setSaveError(r.status === 413 ? "This file is too large to import in one go. Split it into smaller files." : out.error || "Nothing was imported. Try again.");
    } catch {
      setSaveError("Nothing was imported. Check your connection and try again.");
    }
    setSaving(false);
  };

  return (
    <Panel id="vpn-import" title="Import devices from CSV" description="Staff-entered. Adds every row as a new device for this company, or none if a row has a problem.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="CSV file" htmlFor="vpn-import-file" hint="A .csv export, e.g. from Timus Manager or a spreadsheet.">
          <Input id="vpn-import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} className="border-border bg-background" data-testid="input-vpn-import-file" />
        </Field>
        <Field label="Or paste CSV" htmlFor="vpn-import-text" hint={VPN_IMPORT_HINT}>
          <Textarea
            id="vpn-import-text"
            value={text}
            onChange={(e) => {
              setSaveError(null);
              setText(e.target.value);
            }}
            rows={6}
            spellCheck={false}
            placeholder={"name,os,protocol,status,last seen,user\nFront desk laptop,Windows 11,WireGuard,active,2026-10-01,ana@example.com"}
            className="border-border bg-background font-mono text-xs"
            data-testid="input-vpn-import-text"
          />
        </Field>
        {preview && "parseError" in preview && (
          <Callout tone="bad" title="The CSV can't be imported" testId="callout-vpn-import-error">
            {preview.parseError}
          </Callout>
        )}
        {preview && !("parseError" in preview) && (
          <div className="space-y-3">
            <p className="text-sm" data-testid="text-vpn-import-summary" role="status">
              <span className="pt-num font-medium">{preview.rows.length + preview.errors.length}</span> row{preview.rows.length + preview.errors.length === 1 ? "" : "s"} found
              {preview.errors.length > 0 ? (
                <>
                  , <span className="pt-num font-medium">{preview.errors.length}</span> with a problem
                </>
              ) : (
                ", all ready to import"
              )}
              .{preview.ignored.length > 0 && <span className="text-muted-foreground"> Ignored columns: {preview.ignored.join(", ")}.</span>}
            </p>
            {preview.errors.length > 0 && (
              <Callout tone="bad" title="Fix these rows, then paste or choose the file again" testId="callout-vpn-import-row-errors">
                <ul className="list-disc space-y-0.5 pl-5">
                  {preview.errors.slice(0, 5).map((er) => (
                    <li key={er.row}>
                      Row <span className="pt-num">{er.row}</span>: {er.error}
                    </li>
                  ))}
                </ul>
                {preview.errors.length > 5 && <p className="mt-1">and {preview.errors.length - 5} more.</p>}
              </Callout>
            )}
          </div>
        )}
        {saveError && (
          <Callout tone="bad" title="Not imported" testId="callout-vpn-import-save-error">
            {saveError}
          </Callout>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" onClick={onCancel} disabled={saving} data-testid="button-cancel-vpn-import">
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={!ready || saving} data-testid="button-submit-vpn-import">
            {saving ? "Importing..." : ready && preview && !("parseError" in preview) ? `Import ${preview.rows.length} device${preview.rows.length === 1 ? "" : "s"}` : "Import"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

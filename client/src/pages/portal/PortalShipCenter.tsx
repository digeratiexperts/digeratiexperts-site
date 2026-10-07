import { useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, FileUp, Link2Off, Package, Pencil, Plus, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLayout } from "./PortalLayout";
import { Callout, DataTable, EmptyState, Field, Panel, StatTile, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";
import { IntegrationHiddenNotice, IntegrationNeedsCompanyNotice } from "@/components/portal/IntegrationNotices";
import { usePortalIntegrations, type IntegrationStatus } from "@/lib/portalIntegrations";
import { portalFetch, portalGet } from "@/lib/portalApi";
import { convertRecords, CsvError, readCsvRecords, toIsoDate, type HeaderAliases, type RowError } from "@/lib/csv";

const PAGE_TITLE = "Ship Center";
const PAGE_DESCRIPTION = "Track shipments, schedule a new one and reach logistics support.";
const LIVE_DESCRIPTION = "Track your company's shipments and ask DE logistics for a new one.";

// ---------------------------------------------------------------------------
// Sample mode (PORTAL_SHIPPING_PROVIDER unset): today's page, unchanged.
// ---------------------------------------------------------------------------

interface Shipment {
  id: string;
  status: string;
  date: string;
  items: number;
  tracking: string;
}

function shipmentTone(status: string): TokenTone {
  switch (status) {
    case "Delivered":
      return "ok";
    case "In Transit":
      return "info";
    case "Processing":
      return "warn";
    default:
      return "neutral";
  }
}

function SampleShipCenter() {
  const shipmentHistory: Shipment[] = [
    { id: "SHIP-001", status: "Delivered", date: "Nov 20, 2024", items: 3, tracking: "1Z999AA10123456784" },
    { id: "SHIP-002", status: "In Transit", date: "Nov 18, 2024", items: 5, tracking: "1Z999AA10123456785" },
    { id: "SHIP-003", status: "Processing", date: "Nov 15, 2024", items: 2, tracking: "1Z999AA10123456786" },
  ];

  const columns: DataColumn<Shipment>[] = [
    {
      key: "id",
      header: "Shipment",
      primary: true,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="pt-num block font-medium">{s.id}</span>
            <span className="pt-num block text-xs text-muted-foreground">{s.tracking}</span>
          </span>
        </span>
      ),
    },
    { key: "date", header: "Date", primary: true, hideBelowMd: true, className: "w-36 whitespace-nowrap", cell: (s) => <span className="pt-num text-muted-foreground">{s.date}</span> },
    { key: "items", header: "Items", align: "right", className: "w-20", cell: (s) => <span className="pt-num">{s.items}</span> },
    { key: "status", header: "Status", primary: true, className: "w-36", cell: (s) => <Token label={s.status} tone={shipmentTone(s.status)} dot /> },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-28",
      cell: (s) => (
        <Button disabled variant="outline" size="sm" className="border-border bg-card hover:bg-accent" data-testid={`button-track-${s.id}`}>
          Track
        </Button>
      ),
    },
  ];

  return (
    <PortalLayout title={PAGE_TITLE} description={PAGE_DESCRIPTION}>
      <div className="space-y-4">
        <Callout tone="info" title="Sample data">
          The shipments, tracking numbers and figures shown here are examples, not your shipments. DE staff enter tracking numbers for real shipments. Carrier rates and labels depend on configured provider access.
        </Callout>

        <section className="grid grid-cols-2 gap-3" aria-label="Shipment figures">
          <div data-testid="card-active-shipments">
            <StatTile label="Active shipments" value={2} hint="sample" tone="info" />
          </div>
          <div data-testid="card-total-shipments">
            <StatTile label="Total shipments" value={47} hint="sample" />
          </div>
        </section>

        <div data-testid="card-shipment-history">
          <Panel id="shipment-history" title="Example shipment history" description="Sample records; tracking actions are unavailable for these examples." flush>
            <DataTable<Shipment>
              columns={columns}
              rows={shipmentHistory}
              rowKey={(s) => s.id}
              rowTestId={(s) => `row-shipment-${s.id}`}
              caption="Shipment history"
              empty={<EmptyState compact icon={Truck} title="No shipments yet" description="Shipments appear here once they are scheduled." />}
            />
          </Panel>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div data-testid="card-create-shipment">
            <Panel id="create-shipment" title="Create new shipment" description="Contact DE to arrange a shipment. Example shipment creation is unavailable." className="h-full">
              <Button disabled variant="brand" className="w-full" data-testid="button-create-shipment">
                <Package aria-hidden="true" />
                New Shipment
              </Button>
            </Panel>
          </div>
          <div data-testid="card-contact-logistics">
            <Panel id="logistics-support" title="Logistics support" description="Need help with your shipment?" className="h-full">
              <Button asChild variant="outline" className="w-full border-border bg-card hover:bg-accent" data-testid="button-contact-logistics">
                <Link href="/portal/tickets">Contact Support</Link>
              </Button>
            </Panel>
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}

// ---------------------------------------------------------------------------
// Live mode: GET /api/portal/shipping (server/integrations/shipping/types.ts).
// ---------------------------------------------------------------------------

type ShipmentStatus = "processing" | "label_created" | "in_transit" | "delivered" | "exception" | "cancelled" | "unknown";

type LiveShipment = {
  id: string;
  reference: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  status: ShipmentStatus;
  shippedAt: string | null;
  deliveredAt: string | null;
  items: number | null;
  notes: string | null;
  /** Carrier lookup for staff-entered rows (server/integrations/shipping/carriers); null when not looked up. */
  carrierStatus?: CarrierStatus | null;
};

type CarrierStatus = {
  source: "ups" | "fedex" | "usps";
  checkedAt: string;
  latestEvent: string | null;
  latestEventAt: string | null;
  latestLocation: string | null;
};

const CARRIER_LABEL: Record<CarrierStatus["source"], string> = { ups: "UPS", fedex: "FedEx", usps: "USPS" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * A carrier scan time as the carrier wrote it, in the scan's own local time:
 * no conversion to the viewer's zone (USPS sends local time with no offset).
 */
function formatCarrierTime(iso: string | null): string | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso) : null;
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return null;
  const day = `${month} ${Number(m[3])}`;
  if (m[4] === undefined) return day;
  const h = Number(m[4]);
  return `${day}, ${h % 12 || 12}:${m[5]} ${h < 12 ? "AM" : "PM"}`;
}

type ShippingData = {
  provider: "shipstation" | "easypost" | "shippo" | "manual";
  shipments: LiveShipment[];
  counts: { active: number | null; total: number };
  windowDays: number | null;
  truncated: boolean;
  reportsDeliveryStatus: boolean;
};

type ShippingResponse = {
  success: boolean;
  status: IntegrationStatus;
  needsCompany?: boolean;
  notMapped?: boolean;
  data?: ShippingData;
  manage?: { clientId: string };
};

const SHIPPING_QUERY_KEY = ["/api/portal/shipping"] as const;
const MANUAL_RECORDS_URL = "/api/portal/admin/manual-records";
const CREATE_TICKET_HREF = "/portal/tickets/create";

const PROVIDER_NAME: Record<ShippingData["provider"], string> = {
  shipstation: "ShipStation",
  easypost: "EasyPost",
  shippo: "Shippo",
  manual: "DE staff",
};

const STATUS_TOKEN: Record<ShipmentStatus, { label: string; tone: TokenTone }> = {
  processing: { label: "Processing", tone: "warn" },
  label_created: { label: "Label created", tone: "neutral" },
  in_transit: { label: "In transit", tone: "info" },
  delivered: { label: "Delivered", tone: "ok" },
  exception: { label: "Exception", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  unknown: { label: "Unknown", tone: "neutral" },
};

const STATUS_OPTIONS: ShipmentStatus[] = ["processing", "label_created", "in_transit", "delivered", "exception", "cancelled", "unknown"];

/** Date-only values (staff entry, ShipStation shipDate) are shown as entered, not shifted by time zone. */
function formatShipDate(v: string | null): string | null {
  if (!v) return null;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(v);
  const d = new Date(dateOnly ? `${v}T00:00:00Z` : v);
  if (Number.isNaN(d.getTime())) return v;
  return d.toLocaleDateString(undefined, dateOnly ? { timeZone: "UTC" } : undefined);
}

export default function PortalShipCenter() {
  const integrations = usePortalIntegrations();
  const mode = integrations.shipping.mode;

  if (mode === "sample") return <SampleShipCenter />;

  if (mode === "hidden") {
    return (
      <PortalLayout title={PAGE_TITLE}>
        <IntegrationHiddenNotice what="Ship Center" />
      </PortalLayout>
    );
  }

  return <LiveShipCenter />;
}

function LiveShipCenter() {
  const query = useQuery<ShippingResponse>({
    queryKey: SHIPPING_QUERY_KEY,
    queryFn: () => portalGet<ShippingResponse>("/api/portal/shipping"),
    retry: false,
  });
  const res = query.data;

  let body: ReactNode;
  if (query.isError) {
    body = (
      <Callout tone="bad" title="Shipment tracking isn't available right now" testId="callout-shipping-error">
        Try again in a few minutes. If it keeps happening,{" "}
        <Link href="/portal/tickets" className="pt-link hover:underline">
          submit a support ticket
        </Link>
        .
      </Callout>
    );
  } else if (res?.needsCompany) {
    body = <IntegrationNeedsCompanyNotice what="shipments" />;
  } else if (res?.notMapped) {
    body = (
      <Panel id="shipping-not-linked" flush>
        <EmptyState
          icon={Link2Off}
          title="Your shipping account isn't linked to the portal yet"
          description="DE hasn't connected your company's shipments to this page, so there is nothing to show. Your DE account team can link it."
          action={
            <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
              <Link href="/portal/tickets" data-testid="link-shipping-not-linked-ticket">
                Ask DE
              </Link>
            </Button>
          }
        />
      </Panel>
    );
  } else {
    body = <LiveShipments data={res?.data ?? null} loading={query.isLoading} manageClientId={res?.manage?.clientId ?? null} />;
  }

  return (
    <PortalLayout title={PAGE_TITLE} description={LIVE_DESCRIPTION}>
      <div className="space-y-4">
        {body}
        <LiveActions />
      </div>
    </PortalLayout>
  );
}

/**
 * The portal has no shipment-creation route, so "Create new shipment" opens a
 * support ticket for DE logistics instead of pretending to book one.
 */
function LiveActions() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div data-testid="card-create-shipment">
        <Panel id="create-shipment" title="Create new shipment" description="DE logistics books shipments for you. Open a ticket with what to send and where." className="h-full">
          <Button asChild variant="brand" className="w-full">
            <Link href={CREATE_TICKET_HREF} data-testid="button-create-shipment">
              <Package aria-hidden="true" />
              Request a shipment
            </Link>
          </Button>
        </Panel>
      </div>
      <div data-testid="card-contact-logistics">
        <Panel id="logistics-support" title="Logistics support" description="Need help with your shipment?" className="h-full">
          <Button asChild variant="outline" className="w-full border-border bg-card hover:bg-accent">
            <Link href={CREATE_TICKET_HREF} data-testid="button-contact-logistics">
              Contact Support
            </Link>
          </Button>
        </Panel>
      </div>
    </div>
  );
}

function LiveShipments({ data, loading, manageClientId }: { data: ShippingData | null; loading: boolean; manageClientId: string | null }) {
  const shipments = data?.shipments ?? [];
  const provider = data?.provider ?? "manual";
  const canManage = !!manageClientId && provider === "manual";
  const [editing, setEditing] = useState<LiveShipment | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const showItems = shipments.some((s) => s.items !== null);

  const remove = async (s: LiveShipment) => {
    if (!manageClientId) return;
    const label = s.reference || s.trackingNumber || "this shipment";
    if (!window.confirm(`Remove ${label} from this company's shipments?`)) return;
    setActionError(null);
    const qs = new URLSearchParams({ clientId: manageClientId, kind: "shipment" });
    try {
      const r = await portalFetch(`${MANUAL_RECORDS_URL}/${encodeURIComponent(s.id)}?${qs}`, { method: "DELETE" });
      if (!r.ok) setActionError("The shipment could not be removed. Try again.");
    } catch {
      setActionError("The shipment could not be removed. Check your connection and try again.");
    }
    await queryClient.invalidateQueries({ queryKey: SHIPPING_QUERY_KEY });
  };

  const columns: DataColumn<LiveShipment>[] = [
    {
      key: "id",
      header: "Shipment",
      primary: true,
      cell: (s) => (
        <span className="flex items-center gap-3">
          <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0">
            <span className="pt-num block font-medium">{s.reference || s.trackingNumber || "Shipment"}</span>
            {s.reference && s.trackingNumber && <span className="pt-num block text-xs text-muted-foreground">{s.trackingNumber}</span>}
            {s.notes && <span className="block text-xs text-muted-foreground">{s.notes}</span>}
          </span>
        </span>
      ),
    },
    { key: "carrier", header: "Carrier", hideBelowMd: true, className: "w-32", cell: (s) => <span className="text-muted-foreground">{s.carrier || "—"}</span> },
    {
      key: "date",
      header: "Shipped",
      primary: true,
      hideBelowMd: true,
      className: "w-36 whitespace-nowrap",
      cell: (s) => (
        <span className="pt-num text-muted-foreground">
          <span className="block">{formatShipDate(s.shippedAt) ?? "—"}</span>
          {s.deliveredAt && <span className="block text-xs">Delivered {formatShipDate(s.deliveredAt)}</span>}
        </span>
      ),
    },
  ];
  if (showItems) {
    columns.push({ key: "items", header: "Items", align: "right", className: "w-20", cell: (s) => <span className="pt-num">{s.items ?? "—"}</span> });
  }
  columns.push({
    key: "status",
    header: "Status",
    primary: true,
    className: "w-48",
    cell: (s) => {
      const token = <Token label={STATUS_TOKEN[s.status]?.label ?? "Unknown"} tone={STATUS_TOKEN[s.status]?.tone ?? "neutral"} dot />;
      const c = s.carrierStatus;
      if (!c || (!c.latestEvent && !c.latestLocation)) return token;
      const when = formatCarrierTime(c.latestEventAt);
      return (
        <span className="block" data-testid={`text-carrier-status-${s.id}`}>
          {token}
          {c.latestEvent && <span className="mt-1 block text-xs">{c.latestEvent}</span>}
          <span className="block text-xs text-muted-foreground">
            {[c.latestLocation, when].filter(Boolean).join(" · ")}
            {(c.latestLocation || when) && " · "}
            {CARRIER_LABEL[c.source]}
          </span>
        </span>
      );
    },
  });
  columns.push({
    key: "actions",
    header: <span className="sr-only">Actions</span>,
    primary: true,
    align: "right",
    className: canManage ? "w-48" : "w-28",
    cell: (s) => (
      <span className="flex items-center justify-end gap-1">
        {s.trackingUrl && (
          <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
            <a href={s.trackingUrl} target="_blank" rel="noopener noreferrer" data-testid={`button-track-${s.id}`}>
              Track
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span className="sr-only">(opens the carrier's tracking page in a new tab)</span>
            </a>
          </Button>
        )}
        {canManage && (
          <>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Edit ${s.reference || s.trackingNumber || "shipment"}`} onClick={() => setEditing(s)} data-testid={`button-edit-shipment-${s.id}`}>
              <Pencil aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Remove ${s.reference || s.trackingNumber || "shipment"}`} onClick={() => remove(s)} data-testid={`button-delete-shipment-${s.id}`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </span>
    ),
  });

  const activeHint = data && !data.reportsDeliveryStatus ? `${PROVIDER_NAME[provider]} doesn't report delivery progress` : "Not yet delivered";
  const totalHint = data
    ? [data.windowDays ? `Last ${data.windowDays} days` : "All on record", data.truncated ? `latest ${shipments.length} listed` : null].filter(Boolean).join(" · ")
    : undefined;

  return (
    <>
      <section className="grid grid-cols-2 gap-3" aria-label="Shipment figures">
        <div data-testid="card-active-shipments">
          <StatTile
            label="Active shipments"
            value={data?.counts.active ?? "—"}
            hint={activeHint}
            tone={data?.counts.active ? "info" : "neutral"}
            loading={loading}
          />
        </div>
        <div data-testid="card-total-shipments">
          <StatTile label="Total shipments" value={data?.counts.total ?? 0} hint={totalHint} loading={loading} />
        </div>
      </section>

      {canManage && editing && manageClientId && (
        <ManualShipmentForm
          key={editing === "new" ? "new" : editing.id}
          clientId={manageClientId}
          shipment={editing === "new" ? null : editing}
          onDone={async () => {
            setEditing(null);
            await queryClient.invalidateQueries({ queryKey: SHIPPING_QUERY_KEY });
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {canManage && importing && manageClientId && (
        <ManualShipmentImport
          clientId={manageClientId}
          onDone={async (count) => {
            setImporting(false);
            setImportNotice(`Imported ${count} shipment${count === 1 ? "" : "s"}.`);
            await queryClient.invalidateQueries({ queryKey: SHIPPING_QUERY_KEY });
          }}
          onCancel={() => setImporting(false)}
        />
      )}

      {importNotice && (
        <Callout tone="ok" title="Import complete" testId="callout-shipment-import-done" role="status">
          {importNotice}
        </Callout>
      )}

      {actionError && (
        <Callout tone="bad" title="Not saved">
          {actionError}
        </Callout>
      )}

      <div data-testid="card-shipment-history">
        <Panel
          id="shipment-history"
          title="Shipment history"
          description={data ? `Your company's shipments, from ${PROVIDER_NAME[provider]}` : "Your company's shipments"}
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
                  data-testid="button-import-shipments"
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
                  data-testid="button-add-shipment"
                >
                  <Plus aria-hidden="true" />
                  Add shipment
                </Button>
              </span>
            ) : undefined
          }
        >
          <DataTable<LiveShipment>
            columns={columns}
            rows={shipments}
            rowKey={(s) => s.id}
            rowTestId={(s) => `row-shipment-${s.id}`}
            loading={loading}
            caption="Shipment history"
            empty={
              <EmptyState
                compact
                icon={Truck}
                title="No shipments yet"
                description={
                  canManage
                    ? "Add the tracking numbers DE has shipped to this company."
                    : data?.windowDays
                      ? `No shipments in the last ${data.windowDays} days.`
                      : "Shipments appear here once DE ships something to you."
                }
              />
            }
          />
        </Panel>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// "manual" provider: DE admin add / edit form (admin manual-records API).
// ---------------------------------------------------------------------------

type ShipmentForm = {
  reference: string;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  status: ShipmentStatus;
  shippedAt: string;
  deliveredAt: string;
  items: string;
  notes: string;
};

function toForm(s: LiveShipment | null): ShipmentForm {
  return {
    reference: s?.reference ?? "",
    carrier: s?.carrier ?? "",
    trackingNumber: s?.trackingNumber ?? "",
    trackingUrl: s?.trackingUrl ?? "",
    status: s?.status ?? "processing",
    shippedAt: s?.shippedAt ? s.shippedAt.slice(0, 10) : "",
    deliveredAt: s?.deliveredAt ? s.deliveredAt.slice(0, 10) : "",
    items: s?.items !== null && s?.items !== undefined ? String(s.items) : "",
    notes: s?.notes ?? "",
  };
}

function validate(form: ShipmentForm): Partial<Record<keyof ShipmentForm, string>> {
  const errors: Partial<Record<keyof ShipmentForm, string>> = {};
  if (!form.trackingNumber.trim() && !form.reference.trim()) errors.trackingNumber = "Enter a tracking number or a reference.";
  const url = form.trackingUrl.trim();
  if (url && !/^https?:\/\/\S+$/i.test(url)) errors.trackingUrl = "Paste the full carrier link, starting with https://";
  if (form.items.trim() && !/^\d{1,6}$/.test(form.items.trim())) errors.items = "Enter a whole number.";
  return errors;
}

function ManualShipmentForm({ clientId, shipment, onDone, onCancel }: { clientId: string; shipment: LiveShipment | null; onDone: () => void; onCancel: () => void }) {
  const [form, setForm] = useState<ShipmentForm>(() => toForm(shipment));
  const [errors, setErrors] = useState<Partial<Record<keyof ShipmentForm, string>>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof ShipmentForm) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setSaveError(null);
    const data = {
      reference: form.reference.trim(),
      carrier: form.carrier.trim(),
      trackingNumber: form.trackingNumber.trim(),
      trackingUrl: form.trackingUrl.trim(),
      status: form.status,
      shippedAt: form.shippedAt,
      deliveredAt: form.deliveredAt,
      items: form.items.trim() ? Number(form.items.trim()) : null,
      notes: form.notes.trim(),
    };
    const url = shipment ? `${MANUAL_RECORDS_URL}/${encodeURIComponent(shipment.id)}` : MANUAL_RECORDS_URL;
    let ok = false;
    try {
      const r = await portalFetch(url, { method: shipment ? "PATCH" : "POST", body: JSON.stringify({ clientId, kind: "shipment", data }) });
      ok = r.ok;
    } catch {
      ok = false;
    }
    setSaving(false);
    if (!ok) {
      setSaveError("The shipment could not be saved. Check the fields and try again.");
      return;
    }
    onDone();
  };

  const title = shipment ? `Edit ${shipment.reference || shipment.trackingNumber || "shipment"}` : "Add a shipment";

  return (
    <Panel id="shipment-form" title={title} description="Staff-entered tracking for this company.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference" htmlFor="shipment-reference" hint="PO, order or ticket number">
            <Input id="shipment-reference" value={form.reference} onChange={(e) => set("reference")(e.target.value)} maxLength={80} className="border-border bg-background" data-testid="input-shipment-reference" />
          </Field>
          <Field label="Carrier" htmlFor="shipment-carrier" hint="e.g. UPS, FedEx, USPS">
            <Input id="shipment-carrier" value={form.carrier} onChange={(e) => set("carrier")(e.target.value)} maxLength={40} className="border-border bg-background" data-testid="input-shipment-carrier" />
          </Field>
          <Field label="Tracking number" htmlFor="shipment-tracking" error={errors.trackingNumber}>
            <Input id="shipment-tracking" value={form.trackingNumber} onChange={(e) => set("trackingNumber")(e.target.value)} maxLength={60} className="border-border bg-background" data-testid="input-shipment-tracking" />
          </Field>
          <Field label="Tracking link" htmlFor="shipment-tracking-url" hint="Optional. Paste the carrier's tracking page link." error={errors.trackingUrl}>
            <Input id="shipment-tracking-url" type="url" value={form.trackingUrl} onChange={(e) => set("trackingUrl")(e.target.value)} maxLength={500} className="border-border bg-background" data-testid="input-shipment-tracking-url" />
          </Field>
          <Field label="Status" labelId="shipment-status-label">
            <Select value={form.status} onValueChange={set("status")}>
              <SelectTrigger aria-labelledby="shipment-status-label" className="border-border bg-background" data-testid="select-shipment-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_TOKEN[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Items" htmlFor="shipment-items" hint="Optional" error={errors.items}>
            <Input id="shipment-items" inputMode="numeric" value={form.items} onChange={(e) => set("items")(e.target.value)} maxLength={6} className="border-border bg-background" data-testid="input-shipment-items" />
          </Field>
          <Field label="Shipped" htmlFor="shipment-shipped">
            <Input id="shipment-shipped" type="date" value={form.shippedAt} onChange={(e) => set("shippedAt")(e.target.value)} className="border-border bg-background" data-testid="input-shipment-shipped" />
          </Field>
          <Field label="Delivered" htmlFor="shipment-delivered" hint="Leave empty until delivered">
            <Input id="shipment-delivered" type="date" value={form.deliveredAt} onChange={(e) => set("deliveredAt")(e.target.value)} className="border-border bg-background" data-testid="input-shipment-delivered" />
          </Field>
        </div>
        <Field label="Items / notes" htmlFor="shipment-notes" hint="What was shipped. Shown to the client.">
          <Textarea id="shipment-notes" value={form.notes} onChange={(e) => set("notes")(e.target.value)} maxLength={500} rows={3} className="border-border bg-background" data-testid="input-shipment-notes" />
        </Field>
        {saveError && (
          <Callout tone="bad" title="Not saved">
            {saveError}
          </Callout>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" onClick={onCancel} disabled={saving} data-testid="button-cancel-shipment">
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={saving} data-testid="button-save-shipment">
            {saving ? "Saving..." : shipment ? "Save changes" : "Add shipment"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// "manual" provider: DE admin CSV import (POST /api/portal/admin/manual-records/import).
// A carrier or shipping-tool export, or a pasted spreadsheet range.
// ---------------------------------------------------------------------------

const MAX_IMPORT_ROWS = 500;
/** The import route accepts 1 MB bodies (server/index.ts); stay under it. */
const MAX_IMPORT_BYTES = 900_000;

const SHIPMENT_IMPORT_HEADERS: HeaderAliases<keyof ShipmentForm> = {
  reference: ["ref", "po", "po number", "order", "order number", "order id", "ticket"],
  carrier: ["carrier name", "shipping carrier"],
  trackingNumber: ["tracking", "tracking #", "tracking no", "tracking id", "tracking code"],
  trackingUrl: ["tracking url", "tracking link", "link", "url"],
  status: ["state", "shipment status", "delivery status"],
  shippedAt: ["shipped", "ship date", "shipped date", "shipped on", "date shipped"],
  deliveredAt: ["delivered", "delivery date", "delivered date", "delivered on", "date delivered"],
  items: ["quantity", "qty", "item count", "pieces"],
  notes: ["note", "contents", "description", "comment", "comments"],
};
const SHIPMENT_IMPORT_HINT =
  "First row is the column names. Accepted (any case): tracking number or tracking, reference or order (one of the two required), carrier, tracking link, status (processing, label created, in transit, delivered, exception, cancelled), shipped and delivered (dates), items or quantity, notes. Other columns are ignored. Up to 500 rows.";

function tooLong(label: string, v: string, max: number): string | null {
  return v.length > max ? `${label} is longer than ${max} characters` : null;
}

function importStatus(v: string): ShipmentStatus | null {
  const k = v.toLowerCase().trim().replace(/[\s-]+/g, "_");
  if (k === "") return "unknown";
  if (k === "canceled") return "cancelled";
  if (k === "intransit") return "in_transit";
  if (k === "labelcreated") return "label_created";
  return (STATUS_OPTIONS as string[]).includes(k) ? (k as ShipmentStatus) : null;
}

function convertShipmentRow(r: Partial<Record<keyof ShipmentForm, string>>): { data: Record<string, string | number | null> } | { error: string } {
  const reference = r.reference ?? "";
  const trackingNumber = r.trackingNumber ?? "";
  if (!reference && !trackingNumber) return { error: "tracking number and reference are both empty" };
  const trackingUrl = r.trackingUrl ?? "";
  if (trackingUrl && !/^https?:\/\/\S+$/i.test(trackingUrl)) return { error: "tracking link must start with https://" };
  const status = importStatus(r.status ?? "");
  if (status === null) return { error: `status "${r.status}" is not one of: ${STATUS_OPTIONS.map((s) => STATUS_TOKEN[s].label.toLowerCase()).join(", ")}` };
  const shippedAt = toIsoDate(r.shippedAt ?? "");
  if (shippedAt === null) return { error: `shipped "${r.shippedAt}" is not a date` };
  const deliveredAt = toIsoDate(r.deliveredAt ?? "");
  if (deliveredAt === null) return { error: `delivered "${r.deliveredAt}" is not a date` };
  const itemsIn = r.items ?? "";
  if (itemsIn && !/^\d{1,6}$/.test(itemsIn)) return { error: `items "${itemsIn}" is not a whole number` };
  const carrier = r.carrier ?? "";
  const notes = r.notes ?? "";
  const long =
    tooLong("reference", reference, 80) || tooLong("carrier", carrier, 40) || tooLong("tracking number", trackingNumber, 60) || tooLong("tracking link", trackingUrl, 500) || tooLong("notes", notes, 500);
  if (long) return { error: long };
  return {
    data: { reference, carrier, trackingNumber, trackingUrl, status, shippedAt, deliveredAt, items: itemsIn ? Number(itemsIn) : null, notes },
  };
}

type ImportPreview = { rows: Record<string, string | number | null>[]; errors: RowError[]; ignored: string[] } | { parseError: string };

function previewShipmentImport(text: string): ImportPreview | null {
  if (!text.trim()) return null;
  try {
    const csv = readCsvRecords(text, SHIPMENT_IMPORT_HEADERS);
    if (csv.records.length > MAX_IMPORT_ROWS) return { parseError: `The file has ${csv.records.length} rows; import at most ${MAX_IMPORT_ROWS} at a time.` };
    if (!csv.fields.includes("trackingNumber") && !csv.fields.includes("reference")) {
      return { parseError: "No tracking number or reference column. Add a column named tracking number or reference." };
    }
    const { rows, errors } = convertRecords(csv.records, convertShipmentRow);
    return { rows, errors, ignored: csv.unknownHeaders };
  } catch (err) {
    return { parseError: err instanceof CsvError ? err.message : "The CSV could not be read." };
  }
}

function ManualShipmentImport({ clientId, onDone, onCancel }: { clientId: string; onDone: (count: number) => void; onCancel: () => void }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const preview = useMemo(() => previewShipmentImport(text), [text]);
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
    const body = JSON.stringify({ clientId, kind: "shipment", rows: preview.rows });
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

  const total = preview && !("parseError" in preview) ? preview.rows.length + preview.errors.length : 0;

  return (
    <Panel id="shipment-import" title="Import shipments from CSV" description="Staff-entered tracking. Adds every row as a new shipment for this company, or none if a row has a problem.">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="CSV file" htmlFor="shipment-import-file" hint="A .csv export from a carrier account or a spreadsheet.">
          <Input id="shipment-import-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={onFile} className="border-border bg-background" data-testid="input-shipment-import-file" />
        </Field>
        <Field label="Or paste CSV" htmlFor="shipment-import-text" hint={SHIPMENT_IMPORT_HINT}>
          <Textarea
            id="shipment-import-text"
            value={text}
            onChange={(e) => {
              setSaveError(null);
              setText(e.target.value);
            }}
            rows={6}
            spellCheck={false}
            placeholder={"tracking number,carrier,status,shipped,notes\n1Z999AA10123456784,UPS,in transit,2026-10-01,2 laptops"}
            className="border-border bg-background font-mono text-xs"
            data-testid="input-shipment-import-text"
          />
        </Field>
        {preview && "parseError" in preview && (
          <Callout tone="bad" title="The CSV can't be imported" testId="callout-shipment-import-error">
            {preview.parseError}
          </Callout>
        )}
        {preview && !("parseError" in preview) && (
          <div className="space-y-3">
            <p className="text-sm" data-testid="text-shipment-import-summary" role="status">
              <span className="pt-num font-medium">{total}</span> row{total === 1 ? "" : "s"} found
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
              <Callout tone="bad" title="Fix these rows, then paste or choose the file again" testId="callout-shipment-import-row-errors">
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
          <Callout tone="bad" title="Not imported" testId="callout-shipment-import-save-error">
            {saveError}
          </Callout>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" onClick={onCancel} disabled={saving} data-testid="button-cancel-shipment-import">
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={!ready || saving} data-testid="button-submit-shipment-import">
            {saving ? "Importing..." : ready && preview && !("parseError" in preview) ? `Import ${preview.rows.length} shipment${preview.rows.length === 1 ? "" : "s"}` : "Import"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

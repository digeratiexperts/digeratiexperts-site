import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { portalGet, portalPost } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { Link } from "wouter";
import { useState } from "react";
import { CheckCircle2, History, RefreshCw, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Callout, DataTable, EmptyState, Field, Panel, Token, type DataColumn } from "@/components/portal/ui";

type IntegrationStatus = {
  configured: boolean;
  success: boolean;
  message: string;
  endpoint?: string;
};

type LifecycleEvent = {
  id: string;
  action: "onboard" | "offboard";
  email: string;
  companyName: string | null;
  jumpcloud: Record<string, unknown>;
  blackpoint: Record<string, unknown>;
  success: boolean;
  requestedBy: string | null;
  createdAt: string;
};

export function AdminLifecycle() {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [deleteJc, setDeleteJc] = useState(false);
  const [lastResult, setLastResult] = useState<LifecycleEvent | null>(null);

  const { data, isLoading, refetch, isFetching } = useQuery<{
    status: { jumpcloud: IntegrationStatus; blackpoint: IntegrationStatus };
    events: LifecycleEvent[];
  }>({
    queryKey: ["/api/portal/admin/lifecycle/status"],
    queryFn: () => portalGet("/api/portal/admin/lifecycle/status"),
  });

  const onboard = useMutation({
    mutationFn: () =>
      portalPost<{ success: boolean; event: LifecycleEvent }>("/api/portal/admin/lifecycle/onboard", {
        email,
        companyName,
        firstName,
        lastName,
      }),
    onSuccess: (res) => {
      setLastResult(res.event);
      qc.invalidateQueries({ queryKey: ["/api/portal/admin/lifecycle/status"] });
    },
  });

  const offboard = useMutation({
    mutationFn: () =>
      portalPost<{ success: boolean; event: LifecycleEvent }>("/api/portal/admin/lifecycle/offboard", {
        email,
        companyName,
        deleteJumpCloudUser: deleteJc,
      }),
    onSuccess: (res) => {
      setLastResult(res.event);
      qc.invalidateQueries({ queryKey: ["/api/portal/admin/lifecycle/status"] });
    },
  });

  const jc = data?.status.jumpcloud;
  const bp = data?.status.blackpoint;
  const events = data?.events || [];

  const eventColumns: DataColumn<LifecycleEvent>[] = [
    {
      key: "run",
      header: "Run",
      primary: true,
      cell: (ev) => (
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Token label={ev.action} tone={ev.action === "onboard" ? "ok" : "bad"} />
            <span className="truncate text-sm font-medium">{ev.email}</span>
            {ev.success ? (
              <span className="pt-ink pt-tone-ok inline-flex items-center gap-1 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                Succeeded
              </span>
            ) : (
              <span className="pt-ink pt-tone-bad inline-flex items-center gap-1 text-xs">
                <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Failed
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {ev.companyName || "—"} · <span className="pt-num">{formatDeskTimestamp(ev.createdAt)}</span>
            {ev.requestedBy ? ` · by ${ev.requestedBy}` : ""}
          </p>
        </div>
      ),
    },
    {
      key: "result",
      header: "Result",
      primary: true,
      align: "right",
      className: "max-w-md",
      cell: (ev) => (
        <span className="text-xs text-muted-foreground">
          JC: {String(ev.jumpcloud.message || "—")} · BP: {String(ev.blackpoint.message || "—")}
        </span>
      ),
    },
  ];

  return (
    <PortalLayout
      title="Onboard / Offboard"
      description="API-connected onboarding and offboarding for the directory (JumpCloud) and MDR (Blackpoint Cyber)."
      actions={
        <>
          <Button size="sm" variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
            Test connections
          </Button>
          <Button size="sm" variant="outline" className="border-border bg-card hover:bg-accent" asChild>
            <Link href="/portal/admin/login-knocks">Login alerts</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <StatusPanel
            id="status-jumpcloud"
            title="JumpCloud"
            loading={isLoading}
            status={jc}
            hint="Uses JUMPCLOUD_API_KEY (optional JUMPCLOUD_ORG_ID). Creates / unsuspends on onboard; suspends (or deletes) on offboard."
          />
          <StatusPanel
            id="status-blackpoint"
            title="Blackpoint Cyber"
            loading={isLoading}
            status={bp}
            hint="Uses BLACKPOINT_API_KEY (or BLACKPOINT_API_TOKEN). Matches tenant by company name; returns agent install / offboard checklist. Optional BLACKPOINT_INSTALLER_URL."
          />
        </div>

        <Panel id="run-lifecycle" title="Run lifecycle" description="Requires DE admin. Keys stay in server env — never paste secrets here.">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Work email" htmlFor="lc-email">
                <Input
                  id="lc-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@client.com"
                  className="border-border bg-background"
                />
              </Field>
              <Field label="Company (Blackpoint tenant match)" htmlFor="lc-company">
                <Input
                  id="lc-company"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Acme Dental"
                  className="border-border bg-background"
                />
              </Field>
              <Field label="First name" htmlFor="lc-first">
                <Input id="lc-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="border-border bg-background" />
              </Field>
              <Field label="Last name" htmlFor="lc-last">
                <Input id="lc-last" value={lastName} onChange={(e) => setLastName(e.target.value)} className="border-border bg-background" />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={deleteJc} onChange={(e) => setDeleteJc(e.target.checked)} className="h-4 w-4 rounded border-border" />
              Offboard: delete JumpCloud user (default is suspend)
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="brand" onClick={() => onboard.mutate()} disabled={!email || onboard.isPending}>
                {onboard.isPending ? "Onboarding…" : "Onboard"}
              </Button>
              <Button variant="destructive" onClick={() => offboard.mutate()} disabled={!email || offboard.isPending}>
                {offboard.isPending ? "Offboarding…" : "Offboard"}
              </Button>
            </div>
            {(onboard.isError || offboard.isError) && (
              <Callout tone="bad" title="Request failed">
                {(onboard.error || offboard.error) instanceof Error
                  ? ((onboard.error || offboard.error) as Error).message
                  : "Request failed"}
              </Callout>
            )}
            {lastResult && (
              <pre className="max-h-64 overflow-auto rounded-md border border-border bg-background p-3 text-xs">
                {JSON.stringify(lastResult, null, 2)}
              </pre>
            )}
          </div>
        </Panel>

        <Panel id="recent-runs" title="Recent runs" description={isLoading ? "Loading…" : `${events.length} run${events.length === 1 ? "" : "s"}`} flush>
          <DataTable<LifecycleEvent>
            columns={eventColumns}
            rows={events}
            rowKey={(ev) => ev.id}
            loading={isLoading}
            loadingRows={3}
            caption="Recent lifecycle runs"
            empty={<EmptyState compact icon={History} title="No lifecycle runs yet" description="Onboard or offboard a user above and the result lands here." />}
          />
        </Panel>
      </div>
    </PortalLayout>
  );
}

function StatusPanel({
  id,
  title,
  status,
  loading,
  hint,
}: {
  id: string;
  title: string;
  status?: IntegrationStatus;
  loading: boolean;
  hint: string;
}) {
  return (
    <Panel
      id={id}
      title={title}
      description={hint}
      actions={
        loading ? (
          <Token label="Checking" tone="neutral" />
        ) : !status?.configured ? (
          <Token label="Not configured" tone="neutral" />
        ) : status.success ? (
          <Token label="Connected" tone="ok" dot />
        ) : (
          <Token label="Error" tone="bad" dot />
        )
      }
    >
      {loading ? (
        <Skeleton className="h-4 w-2/3" />
      ) : (
        <>
          <p className="text-sm">{status?.message || "—"}</p>
          {status?.endpoint && <p className="mt-1 font-mono text-xs text-muted-foreground">{status.endpoint}</p>}
        </>
      )}
    </Panel>
  );
}

export default AdminLifecycle;

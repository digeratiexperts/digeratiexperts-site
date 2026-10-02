import { useQuery } from "@tanstack/react-query";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { portalGet } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import { DoorOpen, Globe, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { Callout, DataTable, EmptyState, Panel, StatTile, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";

type Knock = {
  id: string;
  kind: string;
  email: string | null;
  ip: string | null;
  userAgent: string | null;
  path: string | null;
  isBotLikely: boolean;
  botReason: string | null;
  createdAt: string;
};

type Summary = {
  sinceHours: number;
  total: number;
  bots: number;
  humans: number;
  failed: number;
  success: number;
  pageHits: number;
  uniqueIps: number;
  topIps: Array<{ ip: string; count: number; bots: number }>;
};

function kindLabel(kind: string): string {
  const map: Record<string, string> = {
    page_hit: "Knock (page)",
    login_failed: "Failed login",
    login_success: "Success",
    mfa_failed: "MFA failed",
    mfa_success: "MFA ok",
    zoho_start: "Zoho start",
    zoho_failed: "Zoho failed",
    turnstile_failed: "Bot check failed",
    locked_out: "Locked out",
  };
  return map[kind] || kind;
}

function kindTone(kind: string): TokenTone {
  if (kind.includes("fail") || kind === "locked_out" || kind === "turnstile_failed") return "bad";
  if (kind.includes("success")) return "ok";
  if (kind === "page_hit") return "neutral";
  return "info";
}

const WINDOWS = [24, 72, 168];

export function AdminLoginKnocks() {
  const [hours, setHours] = useState(24);
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<{
    summary: Summary;
    knocks: Knock[];
  }>({
    queryKey: ["/api/portal/admin/login-knocks", hours],
    queryFn: () => portalGet(`/api/portal/admin/login-knocks?hours=${hours}`),
    refetchInterval: 30_000,
  });

  const summary = data?.summary;
  const knocks = data?.knocks || [];
  const topIps = summary?.topIps || [];
  const alertHot = (summary?.failed || 0) >= 10 || (summary?.bots || 0) >= 15;

  const ipColumns: DataColumn<Summary["topIps"][number]>[] = [
    { key: "ip", header: "IP", primary: true, cell: (row) => <span className="pt-num truncate font-mono text-xs">{row.ip}</span> },
    {
      key: "count",
      header: "Knocks",
      primary: true,
      align: "right",
      className: "w-32 whitespace-nowrap",
      cell: (row) => (
        <span className="inline-flex items-center gap-2">
          {row.bots > 0 && <Token label={`${row.bots} bot`} tone="bad" />}
          <span className="pt-num font-medium">{row.count}</span>
        </span>
      ),
    },
  ];

  const knockColumns: DataColumn<Knock>[] = [
    {
      key: "when",
      header: "When",
      primary: true,
      className: "w-48 whitespace-nowrap align-top",
      cell: (k) => (
        <div>
          <time className="pt-num text-xs text-muted-foreground" dateTime={k.createdAt}>
            {formatDeskTimestamp(k.createdAt)}
          </time>
          <div className="mt-1">
            <Token label={kindLabel(k.kind)} tone={kindTone(k.kind)} />
          </div>
        </div>
      ),
    },
    {
      key: "who",
      header: "Who",
      primary: true,
      className: "align-top",
      cell: (k) => (
        <div className="min-w-0 space-y-1">
          <p className="truncate text-sm font-medium">{k.email || "—"}</p>
          <p className="pt-num truncate font-mono text-xs text-muted-foreground">
            {k.ip || "unknown ip"} · {k.path || "/portal/login"}
          </p>
          {k.isBotLikely && (
            <p className="pt-ink pt-tone-warn text-xs">
              Bot-likely{k.botReason ? `: ${k.botReason}` : ""}
            </p>
          )}
          {k.userAgent && (
            <p className="truncate text-xs text-muted-foreground" title={k.userAgent}>
              {k.userAgent}
            </p>
          )}
        </div>
      ),
    },
  ];

  return (
    <PortalLayout
      title="Login Door Alerts"
      description="Who hits the portal login: page loads, failures, successes and bot-like signals."
      width="wide"
      actions={
        <>
          <div role="group" aria-label="Time window" className="flex items-center gap-1.5">
            {WINDOWS.map((h) => {
              const active = hours === h;
              return (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  {h === 168 ? "7d" : `${h}h`}
                </button>
              );
            })}
          </div>
          <Button size="sm" variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" className="border-border bg-card hover:bg-accent" asChild>
            <Link href="/portal/admin/lifecycle">Lifecycle APIs</Link>
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {alertHot && (
          <Callout tone="warn" title="Elevated login pressure">
            {summary?.failed || 0} failed attempts and {summary?.bots || 0} bot-likely knocks in the last {summary?.sinceHours || hours}h. Review top IPs below.
          </Callout>
        )}

        {isError && (
          <Callout tone="bad" title="Knocks couldn't be loaded">
            {error instanceof Error ? error.message : "Failed to load knocks"}
          </Callout>
        )}

        <section className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6" aria-label="Login door figures">
          <StatTile label="Total knocks" value={summary?.total ?? "—"} loading={isLoading} />
          <StatTile label="Page hits" value={summary?.pageHits ?? "—"} loading={isLoading} />
          <StatTile label="Failed" value={summary?.failed ?? "—"} tone={(summary?.failed || 0) > 0 ? "bad" : "neutral"} hint={(summary?.failed || 0) > 0 ? "sign-in failures" : undefined} loading={isLoading} />
          <StatTile label="Success" value={summary?.success ?? "—"} tone="ok" hint="signed in" loading={isLoading} />
          <StatTile label="Bot-likely" value={summary?.bots ?? "—"} tone={(summary?.bots || 0) > 0 ? "warn" : "neutral"} loading={isLoading} />
          <StatTile label="Unique IPs" value={summary?.uniqueIps ?? "—"} loading={isLoading} />
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <Panel id="top-ips" title="Top IPs" description="Who is knocking most often" flush className="lg:col-span-1">
            <DataTable<Summary["topIps"][number]>
              columns={ipColumns}
              rows={topIps}
              rowKey={(row) => row.ip}
              loading={isLoading}
              loadingRows={3}
              caption="Top IPs by knock count"
              empty={<EmptyState compact icon={Globe} title="No knocks in this window yet" description="Widen the window or wait for the next refresh." />}
            />
          </Panel>

          <Panel id="live-feed" title="Live feed" description="Auto-refreshes every 30 seconds" flush className="lg:col-span-2">
            <div className="max-h-[520px] overflow-auto">
              <DataTable<Knock>
                columns={knockColumns}
                rows={knocks}
                rowKey={(k) => k.id}
                loading={isLoading}
                caption="Recent login door knocks"
                empty={<EmptyState compact icon={DoorOpen} title="Quiet door" description="Open the login page or attempt a sign-in to see knocks here." />}
              />
            </div>
          </Panel>
        </div>
      </div>
    </PortalLayout>
  );
}

export default AdminLoginKnocks;

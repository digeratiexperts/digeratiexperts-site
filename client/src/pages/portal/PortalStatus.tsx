import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { AlertTriangle, CalendarClock, CheckCircle2, History, Wrench, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel, Token, type TokenTone } from "@/components/portal/ui";
import { usePortalSession } from "@/components/portal/shell/portalSession";
import { formatResponseTargets } from "@shared/responseTargets";
import { HISTORY_DAYS, KIND_LABELS, OVERALL_LABELS, SEVERITY_LABELS, type NoticeSeverity, type OverallState } from "@shared/statusNotices";
import { STATUS_QUERY_KEY, statusApi, type ClientNotice } from "@/lib/statusApi";
import { PortalLayout } from "./PortalLayout";

/**
 * System Status: the incidents, maintenance and notices DE has posted for this
 * company or for every client (server/statusNoticeRoutes.ts). No device or
 * uptime figures: those need an RMM integration, and none exists yet.
 */

const severityTone: Record<NoticeSeverity, TokenTone> = { info: "info", degraded: "warn", outage: "bad" };

const OVERALL: Record<OverallState, { Icon: typeof CheckCircle2; tone: string; note: string }> = {
  operational: { Icon: CheckCircle2, tone: "pt-tone-ok", note: "DE has no open incidents or maintenance for your services." },
  maintenance: { Icon: Wrench, tone: "pt-tone-info", note: "Planned work is under way. See the details below." },
  degraded: { Icon: AlertTriangle, tone: "pt-tone-warn", note: "Some services are slower or partly unavailable. DE is working on it." },
  outage: { Icon: XCircle, tone: "pt-tone-bad", note: "A service is down. DE is working on it and posts updates here." },
};

const when = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function NoticeItem({ notice, showUpdates = true }: { notice: ClientNotice; showUpdates?: boolean }) {
  const span =
    notice.kind === "maintenance" && notice.endsAt
      ? `${when(notice.startsAt)} to ${when(notice.endsAt)}`
      : notice.resolvedAt
        ? `${when(notice.startsAt)} · resolved ${when(notice.resolvedAt)}`
        : `Since ${when(notice.startsAt)}${notice.endsAt ? ` · expected by ${when(notice.endsAt)}` : ""}`;
  return (
    <li className="px-4 py-4 md:px-5" data-testid={`status-notice-${notice.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{notice.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {KIND_LABELS[notice.kind]} · <span className="pt-num">{span}</span>
            {notice.affectedServices.length > 0 && <> · {notice.affectedServices.join(", ")}</>}
          </p>
        </div>
        <Token label={SEVERITY_LABELS[notice.severity]} tone={severityTone[notice.severity]} dot />
      </div>
      {notice.body && <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{notice.body}</p>}
      {showUpdates && notice.updates.length > 0 && (
        <ol className="mt-3 space-y-2 border-l border-border pl-3" aria-label="Updates">
          {[...notice.updates].reverse().map((u) => (
            <li key={u.at} className="text-sm">
              <p className="text-xs text-muted-foreground">
                <span className="pt-num">{when(u.at)}</span> · {u.byName}
              </p>
              <p className="whitespace-pre-line">{u.body}</p>
            </li>
          ))}
        </ol>
      )}
    </li>
  );
}

function NoticeList({ id, title, description, notices, empty, icon, showUpdates }: {
  id: string;
  title: string;
  description?: string;
  notices: ClientNotice[];
  empty: string;
  icon: typeof CheckCircle2;
  showUpdates?: boolean;
}) {
  return (
    <Panel id={id} title={title} description={description} flush>
      {notices.length === 0 ? (
        <EmptyState icon={icon} title={empty} compact />
      ) : (
        <ul className="divide-y divide-border">
          {notices.map((n) => (
            <NoticeItem key={n.id} notice={n} showUpdates={showUpdates} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

export default function PortalStatus() {
  const admin = usePortalSession().user?.role === "admin";
  const status = useQuery({ queryKey: STATUS_QUERY_KEY, queryFn: statusApi.view, refetchInterval: 60_000 });
  const data = status.data;
  const overall = data ? OVERALL[data.overall] : null;

  return (
    <PortalLayout
      title="System Status"
      description="Incidents, maintenance and notices for the services DE manages for you."
      actions={
        <div className="flex flex-wrap gap-2">
          {admin && (
            <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
              <Link href="/portal/admin/status" data-testid="status-manage-notices">Manage notices</Link>
            </Button>
          )}
          <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
            <Link href="/portal/tickets/new" data-testid="status-report-issue">Report an issue</Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {status.isError && (
          <Callout tone="bad" title="Status couldn't be loaded" testId="status-error">
            {status.error instanceof Error ? status.error.message : ""} If something isn't working,{" "}
            <Link href="/portal/tickets/new">report an issue</Link>.
          </Callout>
        )}

        {status.isPending ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : data && overall ? (
          <>
            {admin && !data.company && (
              <Callout tone="info" title="Showing notices for all clients only">
                Open a company with View as to see its own notices as well.
              </Callout>
            )}
            <Panel id="overall-status">
              <div className="flex flex-wrap items-center gap-3" role="status" data-testid="status-overall">
                <overall.Icon className={`pt-ink ${overall.tone} h-8 w-8 shrink-0`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-xl font-semibold leading-tight">{OVERALL_LABELS[data.overall]}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{overall.note}</p>
                </div>
              </div>
            </Panel>

            <NoticeList
              id="active-incidents"
              title="Current incidents and notices"
              notices={data.active}
              empty="Nothing open right now"
              icon={CheckCircle2}
            />
            <NoticeList
              id="scheduled-maintenance"
              title="Maintenance"
              description="In progress and scheduled"
              notices={[...data.inProgress, ...data.upcoming]}
              empty="No maintenance scheduled"
              icon={CalendarClock}
            />
            <NoticeList
              id="recent-history"
              title="Recent history"
              description={`Resolved in the last ${HISTORY_DAYS} days`}
              notices={data.history}
              empty={`Nothing resolved in the last ${HISTORY_DAYS} days`}
              icon={History}
              showUpdates={false}
            />
          </>
        ) : null}

        <Panel id="response-targets" title="How fast DE responds">
          <p className="text-sm text-muted-foreground">{formatResponseTargets(" | ")}</p>
        </Panel>
      </div>
    </PortalLayout>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ArrowRight } from "lucide-react";
import { OVERALL_LABELS, type OverallState } from "@shared/statusNotices";
import { STATUS_QUERY_KEY, statusApi } from "@/lib/statusApi";

const TONE: Record<OverallState, string> = {
  operational: "pt-tone-ok",
  maintenance: "pt-tone-info",
  degraded: "pt-tone-warn",
  outage: "pt-tone-bad",
};

/**
 * One line on Home: the overall System Status and what is coming up, linking to
 * /portal/status. Renders nothing while loading or if the status can't be read,
 * so Home never shows a guess.
 */
export function StatusLine() {
  const status = useQuery({ queryKey: STATUS_QUERY_KEY, queryFn: statusApi.view, refetchInterval: 60_000 });
  const data = status.data;
  if (!data) return null;
  const open = data.active.length + data.inProgress.length;
  const next = data.upcoming[0];
  const detail = open > 0
    ? `${open} open ${open === 1 ? "item" : "items"}`
    : next
      ? `Next maintenance ${new Date(next.startsAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
      : null;
  return (
    <Link
      href="/portal/status"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="home-status-line"
    >
      <Activity className={`pt-ink ${TONE[data.overall]} h-4 w-4 shrink-0`} aria-hidden="true" />
      <span className="font-medium">Service status: {OVERALL_LABELS[data.overall]}</span>
      {detail && <span className="text-muted-foreground">· {detail}</span>}
      <span className="ml-auto inline-flex items-center gap-1 text-muted-foreground">
        View status
        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </Link>
  );
}

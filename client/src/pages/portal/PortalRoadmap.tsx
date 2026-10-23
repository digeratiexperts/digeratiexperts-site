import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Callout, EmptyState, Panel, StatTile } from "@/components/portal/ui";
import { CompanyReadiness } from "@/components/portal/CompanyReadiness";
import { RoadmapItemCard } from "@/components/portal/roadmap/RoadmapItemCard";
import { ROADMAP_QUERY_KEY, RoadmapApiError, roadmapApi } from "@/lib/roadmapApi";
import { ROADMAP_STATUSES, STATUS_LABELS, formatQuarter, type RoadmapItem, type RoadmapStatus } from "@shared/roadmap";
import { PortalLayout } from "./PortalLayout";

/**
 * IT Roadmap for the company's owners: the items DE has written, grouped by
 * quarter, with approve / decline on proposals and a comment thread on each
 * (server/roadmapRoutes.ts). Every figure is summed from the items.
 */

const money = (n: number) => `$${n.toLocaleString("en-US")}`;
const range = (lo: number, hi: number) => (lo === hi ? money(lo) : `${money(lo)} to ${money(hi)}`);
const selectClass = "h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const DECIDABLE = new Set<RoadmapStatus>(["proposed", "approved", "declined"]);

function Decision({ item, onDone }: { item: RoadmapItem; onDone: () => void }) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const decide = useMutation({
    mutationFn: (decision: "approved" | "declined") => roadmapApi.decide(item.id, decision, note),
    onSuccess: () => {
      setNote("");
      setError(null);
      onDone();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Could not save your decision"),
  });
  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <p className="text-sm font-medium">{item.status === "proposed" ? "Your decision" : "Change your decision"}</p>
      <label htmlFor={`note-${item.id}`} className="sr-only">
        Note for DE (optional)
      </label>
      <Textarea id={`note-${item.id}`} rows={2} placeholder="Note for DE (optional)" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} />
      <div className="flex flex-wrap gap-2">
        {item.status !== "approved" && (
          <Button type="button" size="sm" onClick={() => decide.mutate("approved")} disabled={decide.isPending} data-testid={`roadmap-approve-${item.id}`}>
            Approve
          </Button>
        )}
        {item.status !== "declined" && (
          <Button type="button" size="sm" variant="outline" onClick={() => decide.mutate("declined")} disabled={decide.isPending}>
            Decline
          </Button>
        )}
      </div>
      {error && (
        <p className="pt-ink pt-tone-bad text-xs" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export default function PortalRoadmap() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<"all" | RoadmapStatus>("all");
  const q = useQuery({ queryKey: ROADMAP_QUERY_KEY, queryFn: roadmapApi.view });
  const refresh = () => void qc.invalidateQueries({ queryKey: ROADMAP_QUERY_KEY });
  const code = q.error instanceof RoadmapApiError ? q.error.code : undefined;
  const data = q.data;
  const shown = useMemo(() => (data?.items ?? []).filter((i) => status === "all" || i.status === status), [data, status]);
  const quarters = useMemo(() => {
    const groups: Array<{ quarter: string; items: RoadmapItem[] }> = [];
    for (const item of shown) {
      const last = groups[groups.length - 1];
      if (last && last.quarter === item.targetQuarter) last.items.push(item);
      else groups.push({ quarter: item.targetQuarter, items: [item] });
    }
    return groups;
  }, [shown]);
  const c = data?.summary?.committed;

  return (
    <PortalLayout
      title="IT Roadmap"
      description="The technology work DE recommends for your company, when, why and roughly what it costs. Approve what you want us to plan."
      actions={
        <Button asChild variant="outline" className="border-border bg-card hover:bg-accent" data-testid="button-schedule-vcio">
          <Link href="/book">
            <Calendar aria-hidden="true" />
            Talk it through with DE
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {code === "COMPANY_CONTEXT_REQUIRED" || code === "COMPANY_NOT_FOUND" ? (
          <CompanyReadiness missing={code === "COMPANY_CONTEXT_REQUIRED"} unavailable={code === "COMPANY_NOT_FOUND"} />
        ) : q.isError ? (
          <Callout tone="bad" title="The roadmap couldn't be loaded">
            {q.error instanceof Error ? q.error.message : ""}
          </Callout>
        ) : q.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : !data?.items?.length ? (
          <Panel id="roadmap-items">
            <EmptyState icon={Map} title="No roadmap items yet" description="Your DE team adds these after your business review." />
          </Panel>
        ) : data && c ? (
          <>
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Roadmap figures">
              <StatTile label="Waiting for you" value={data.summary.counts.proposed} hint="proposals to decide" tone={data.summary.counts.proposed > 0 ? "warn" : "neutral"} testId="stat-roadmap-proposed" />
              <StatTile label="Approved" value={data.summary.counts.approved} hint="not started yet" tone="info" testId="stat-roadmap-approved" />
              <StatTile label="In progress" value={data.summary.counts.in_progress} hint="underway now" tone="info" testId="stat-roadmap-progress" />
              <StatTile label="Done" value={data.summary.counts.done} hint="delivered" tone="ok" testId="stat-roadmap-done" />
            </section>

            {(c.oneTimeHigh > 0 || c.yearlyHigh > 0) && (
              <Callout tone="info" title="Approved and in-progress work, estimated">
                {c.oneTimeHigh > 0 && <span className="pt-num">{range(c.oneTimeLow, c.oneTimeHigh)} one-off</span>}
                {c.oneTimeHigh > 0 && c.yearlyHigh > 0 && " · "}
                {c.yearlyHigh > 0 && <span className="pt-num">{range(c.yearlyLow, c.yearlyHigh)} a year</span>}
                . Estimates, not quotes: DE confirms the price before any work starts.
              </Callout>
            )}

            <div className="flex flex-wrap gap-3">
              <select aria-label="Filter roadmap by status" className={selectClass} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} data-testid="select-roadmap-status">
                <option value="all">All items</option>
                {ROADMAP_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>

            {quarters.length === 0 ? (
              <Panel id="roadmap-items">
                <EmptyState
                  icon={Map}
                  title="Nothing matches this filter"
                  compact
                  action={
                    <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setStatus("all")}>
                      Show all
                    </Button>
                  }
                />
              </Panel>
            ) : (
              quarters.map((g) => (
                <Panel key={g.quarter} id={`roadmap-${g.quarter}`} title={formatQuarter(g.quarter)} description={`${g.items.length} ${g.items.length === 1 ? "item" : "items"}`} flush>
                  <ul className="divide-y divide-border">
                    {g.items.map((item) => (
                      <RoadmapItemCard
                        key={item.id}
                        item={item}
                        defaultOpen={item.status === "proposed"}
                        onComment={async (body) => {
                          await roadmapApi.comment(item.id, body);
                          refresh();
                        }}
                        actions={data.canDecide && DECIDABLE.has(item.status) ? <Decision item={item} onDone={refresh} /> : undefined}
                      />
                    ))}
                  </ul>
                </Panel>
              ))
            )}
          </>
        ) : null}
      </div>
    </PortalLayout>
  );
}

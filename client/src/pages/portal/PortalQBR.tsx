import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Calendar, Download, Map } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel, Token } from "@/components/portal/ui";
import { CompanyReadiness } from "@/components/portal/CompanyReadiness";
import { REVIEWS_QUERY_KEY, ReviewsApiError, reviewsApi } from "@/lib/reviewsApi";
import { formatMeetingDay } from "@shared/businessReviews";
import { STATUS_LABELS, formatQuarter, type RoadmapStatus } from "@shared/roadmap";
import { STATUS_TONES } from "@/components/portal/roadmap/RoadmapItemCard";
import { PortalLayout } from "./PortalLayout";

/**
 * Business reviews for the company's owners: each published review DE wrote
 * after a meeting, with what was decided, the roadmap items discussed and the
 * report file (server/businessReviewRoutes.ts). No scores or figures that DE
 * did not write.
 */

export default function PortalQBR() {
  const q = useQuery({ queryKey: REVIEWS_QUERY_KEY, queryFn: reviewsApi.list });
  const code = q.error instanceof ReviewsApiError ? q.error.code : undefined;
  const reviews = q.data?.reviews ?? [];

  return (
    <PortalLayout
      title="Business Reviews"
      description="What DE and your team covered at each review, what was decided, and the report to keep."
      actions={
        <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
          <Link href="/book">
            <Calendar aria-hidden="true" />
            Book your next review
          </Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {code === "COMPANY_CONTEXT_REQUIRED" || code === "COMPANY_NOT_FOUND" ? (
          <CompanyReadiness missing={code === "COMPANY_CONTEXT_REQUIRED"} unavailable={code === "COMPANY_NOT_FOUND"} />
        ) : q.isError ? (
          <Callout tone="bad" title="Business reviews couldn't be loaded">
            {q.error instanceof Error ? q.error.message : ""}
          </Callout>
        ) : q.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : reviews.length === 0 ? (
          <Panel id="reviews">
            <EmptyState icon={BarChart3} title="No business reviews yet" description="After your next review meeting, DE posts the summary and decisions here." />
          </Panel>
        ) : (
          reviews.map((r) => (
            <Panel
              key={r.id}
              id={`review-${r.id}`}
              title={r.title}
              description={`${formatMeetingDay(r.meetingOn)}${r.period ? ` · ${formatQuarter(r.period)}` : ""}`}
              actions={
                r.report ? (
                  <Button asChild size="sm" variant="outline" className="border-border bg-card hover:bg-accent">
                    <a href={r.report.url} target="_blank" rel="noreferrer" data-testid={`review-report-${r.id}`}>
                      <Download aria-hidden="true" />
                      Report
                    </a>
                  </Button>
                ) : undefined
              }
            >
              <div className="space-y-4">
                {r.summary && <p className="whitespace-pre-line text-sm">{r.summary}</p>}
                {r.decisions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Decisions</p>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm">
                      {r.decisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {r.roadmapItems.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Roadmap items discussed</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {r.roadmapItems.map((i) => (
                        <li key={i.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <Map className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <Link href="/portal/roadmap" className="underline">
                            {i.title}
                          </Link>
                          <Token label={STATUS_LABELS[i.status as RoadmapStatus] ?? i.status} tone={STATUS_TONES[i.status as RoadmapStatus] ?? "neutral"} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </Panel>
          ))
        )}
      </div>
    </PortalLayout>
  );
}

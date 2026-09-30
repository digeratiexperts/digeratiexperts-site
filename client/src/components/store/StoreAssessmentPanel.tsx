import { Link } from "wouter";
import { ArrowRight, Calendar, ClipboardList, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { openMspAdvisor } from "@/lib/openMspAdvisor";
import { CTA } from "@/lib/ctaCopy";
import { PRIMARY_PHONE } from "@/data/companyContact";

interface StoreAssessmentPanelProps {
  variant?: "sticky" | "inline";
  onFilterAssessments?: () => void;
  onBuildSolution?: () => void;
}

/**
 * Relocated assessment CTA — keeps the concept without cutting the product grid.
 */
export function StoreAssessmentPanel({
  variant = "sticky",
  onFilterAssessments,
  onBuildSolution,
}: StoreAssessmentPanelProps) {
  const isSticky = variant === "sticky";
  const shell = isSticky
    ? "lg:sticky lg:top-28 space-y-4 lg:overflow-y-auto lg:overscroll-contain"
    : "mb-10";
  const stickyStyle = isSticky
    ? {
        maxHeight:
          "calc(100dvh - 8rem - var(--de-sticky-cta-h, 0px) - var(--de-unified-bar-h, 0px) - var(--de-cookie-h, 0px))",
      }
    : undefined;

  return (
    <aside className={shell} style={stickyStyle} data-testid="store-assessment-panel">
      <div className="rounded-xl border border-white/10 bg-[#141414] p-5">
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-de-accent/30 bg-de-accent/15">
          <ClipboardList className="h-5 w-5 text-de-accent-ink" />
        </div>
        <h3 className="text-lg font-semibold text-white">Not sure where to start?</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          Book a free cyber risk assessment, build a guided stack, or open Ask DE. We map gaps
          to catalog items — no obligation.
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <Button asChild
              variant="brand"
              className="h-10 w-full"
              data-testid="button-assessment-book"
            >
                  <a href="/book">
                    <Calendar className="mr-2 h-4 w-4" />
              {CTA.primaryShort}
                  </a>
                </Button>
          {onFilterAssessments && (
            <Button
              variant="outline"
              className="h-10 w-full border-white/15 bg-transparent text-white hover:bg-white/5"
              onClick={onFilterAssessments}
              data-testid="button-filter-assessments"
            >
              View assessment products
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            className="h-10 w-full text-white/70 hover:bg-white/5 hover:text-white"
            onClick={() => {
              if (onBuildSolution) onBuildSolution();
              else openMspAdvisor({ context: "store" });
            }}
            data-testid="button-open-advisor-from-store"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            Build my solution
          </Button>
        </div>
        <p className="mt-3 text-xs text-white/55">
          Or call{" "}
          <a href={PRIMARY_PHONE.telHref} className="text-de-accent-ink underline decoration-de-accent-ink/50 underline-offset-4 hover:decoration-de-accent-ink">
            {PRIMARY_PHONE.display}
          </a>
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#121212] p-4">
        <p className="text-sm font-medium text-white">Need full-service IT?</p>
        <p className="mt-1 text-xs text-white/50">
          ProActive Ecosystem packages include layered security and support in one plan.
        </p>
        <Link href="/internal/warehouse/managed">
          <span className="mt-3 inline-flex items-center text-sm text-de-accent-ink hover:text-de-accent-ink">
            View managed packages
            <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </span>
        </Link>
      </div>
    </aside>
  );
}

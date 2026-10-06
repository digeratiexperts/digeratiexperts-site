import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { PortalCategory } from "./category";

export type StatTone = "neutral" | "ok" | "warn" | "bad" | "info";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  /** Unit or denominator rendered small beside the value ("/48", "min"). */
  suffix?: ReactNode;
  hint?: ReactNode;
  tone?: StatTone;
  href?: string;
  loading?: boolean;
  testId?: string;
  className?: string;
  /** Colours the top edge and icon well; see .pt-cat in portal.css. */
  category?: PortalCategory;
  icon?: LucideIcon;
}

const hintTone: Record<StatTone, string> = {
  neutral: "text-muted-foreground",
  ok: "pt-ink pt-tone-ok",
  warn: "pt-ink pt-tone-warn",
  bad: "pt-ink pt-tone-bad",
  info: "pt-ink pt-tone-info",
};

/** One figure, one label, one line of context. Numbers use tabular figures. */
export function StatTile({ label, value, suffix, hint, tone = "neutral", href, loading, testId, className, category, icon: Icon }: StatTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {Icon && (
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg", category ? "pt-cat-well" : "bg-muted text-muted-foreground")} aria-hidden="true">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        </div>
        {href && <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-20" />
      ) : (
        <p className="pt-num mt-2 text-[30px] font-semibold leading-none tracking-tight" data-testid={testId}>
          {value}
          {suffix && <span className="ml-1 text-sm font-medium text-muted-foreground">{suffix}</span>}
        </p>
      )}
      {hint && <p className={cn("mt-2 text-xs", hintTone[tone])}>{loading ? " " : hint}</p>}
    </>
  );
  const base = cn(
    "group block rounded-xl border border-border bg-card p-4 text-card-foreground",
    category && "pt-cat pt-cat-edge",
    href && "transition-colors pt-hover-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
    className,
  );
  if (href) {
    return (
      <Link href={href} className={base} data-cat={category}>
        {body}
      </Link>
    );
  }
  return (
    <div className={base} data-cat={category}>
      {body}
    </div>
  );
}

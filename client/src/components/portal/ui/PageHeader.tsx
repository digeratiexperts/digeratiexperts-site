import type { ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
  backLabel?: string;
  className?: string;
  /** Testid for the h1 so page tests can find the title. */
  titleTestId?: string;
}

/**
 * The one page title. Pages must not render a second h1/h2 with the same text;
 * the topbar shows breadcrumbs, this shows the title, description and actions.
 */
export function PageHeader({
  title,
  eyebrow,
  description,
  actions,
  backHref,
  backLabel = "Back",
  className,
  titleTestId,
}: PageHeaderProps) {
  return (
    <header className={cn("mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {backHref && (
          <Link
            href={backHref}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            {backLabel}
          </Link>
        )}
        {eyebrow && (
          <p className="mb-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p>
        )}
        <h1
          className="font-heading text-2xl font-semibold leading-tight tracking-tight md:text-[28px]"
          data-testid={titleTestId}
        >
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-[68ch] text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

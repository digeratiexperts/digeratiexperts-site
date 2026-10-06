import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PortalCategory } from "./category";

export interface PanelProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Remove the body padding for tables and lists that draw their own rows. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div" | "article";
  "aria-labelledby"?: string;
  id?: string;
  /** Colours the top edge and the title's icon well; see .pt-cat in portal.css. */
  category?: PortalCategory;
  icon?: LucideIcon;
}

/**
 * A raised surface with an optional header row. Use it when containment helps
 * comprehension; do not wrap every paragraph in one (premium-saas-ui skill).
 */
export function Panel({
  title,
  description,
  actions,
  children,
  flush = false,
  className,
  bodyClassName,
  as: Tag = "section",
  id,
  category,
  icon: Icon,
  ...rest
}: PanelProps) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <Tag
      id={id}
      aria-labelledby={title && headingId ? headingId : rest["aria-labelledby"]}
      className={cn("overflow-hidden rounded-xl border border-border bg-card text-card-foreground", category && "pt-cat pt-cat-edge", className)}
      data-cat={category}
    >
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 md:px-5">
          <div className="flex min-w-0 flex-1 basis-48 items-start gap-2.5">
            {Icon && (
              <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg", category ? "pt-cat-well" : "bg-muted text-muted-foreground")} aria-hidden="true">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h2 id={headingId} className="font-heading text-[15px] font-semibold leading-snug">
                  {title}
                </h2>
              )}
              {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={cn(!flush && "p-4 md:p-5", bodyClassName)}>{children}</div>
    </Tag>
  );
}

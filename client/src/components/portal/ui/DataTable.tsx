import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** Width class for the desktop table (e.g. "w-40"). */
  className?: string;
  align?: "left" | "right";
  /** Hide this column below md; the mobile card shows only `primary` columns. */
  hideBelowMd?: boolean;
  /** Included in the mobile card. */
  primary?: boolean;
}

export interface DataTableProps<T> {
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** Row becomes a link (keyboard and pointer). */
  rowHref?: (row: T) => string | undefined;
  rowTestId?: (row: T) => string;
  loading?: boolean;
  loadingRows?: number;
  empty?: ReactNode;
  caption?: string;
  className?: string;
}

/**
 * Table at md and up, stacked cards below. Rows with `rowHref` are real links:
 * the first primary cell carries the anchor, the row forwards clicks to it.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  rowTestId,
  loading,
  loadingRows = 4,
  empty,
  caption,
  className,
}: DataTableProps<T>) {
  const [, navigate] = useLocation();
  const desktopCols = columns;
  const mobileCols = columns.filter((c) => c.primary);

  const go = (href: string | undefined) => {
    if (href) navigate(href);
  };

  if (loading) {
    return (
      <div className={cn("divide-y divide-border", className)} aria-busy="true" aria-live="polite">
        {Array.from({ length: loadingRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className={className}>
      {/* md+: table */}
      <table className="hidden w-full border-collapse text-sm md:table">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="border-b border-border">
            {desktopCols.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={cn(
                  "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
                  col.align === "right" && "text-right",
                  col.hideBelowMd && "hidden lg:table-cell",
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const href = rowHref?.(row);
            return (
              <tr
                key={rowKey(row)}
                data-testid={rowTestId?.(row)}
                className={cn(
                  "border-b border-border last:border-b-0",
                  href && "cursor-pointer transition-colors hover:bg-accent/60 focus-within:bg-accent/60",
                )}
                onClick={href ? (e) => {
                  if ((e.target as HTMLElement).closest("a,button,input,select,textarea")) return;
                  go(href);
                } : undefined}
              >
                {desktopCols.map((col, i) => (
                  <td
                    key={col.key}
                    className={cn(
                      "px-4 py-3 align-middle",
                      col.align === "right" && "text-right",
                      col.hideBelowMd && "hidden lg:table-cell",
                      col.className,
                    )}
                  >
                    {i === 0 && href ? (
                      <a href={href} onClick={(e) => { e.preventDefault(); go(href); }} className="block outline-none focus-visible:underline">
                        {col.cell(row)}
                      </a>
                    ) : (
                      col.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* below md: cards */}
      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => {
          const href = rowHref?.(row);
          const [first, ...rest] = mobileCols.length ? mobileCols : desktopCols.slice(0, 2);
          const inner = (
            <>
              <div className="text-sm">{first?.cell(row)}</div>
              {rest.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                  {rest.map((col) => (
                    <span key={col.key} className="inline-flex items-center gap-1.5">
                      {col.cell(row)}
                    </span>
                  ))}
                </div>
              )}
            </>
          );
          return (
            <li key={rowKey(row)} data-testid={rowTestId ? `${rowTestId(row)}-card` : undefined}>
              {href ? (
                <a href={href} onClick={(e) => { e.preventDefault(); go(href); }} className="block px-4 py-3.5 transition-colors hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none">
                  {inner}
                </a>
              ) : (
                <div className="px-4 py-3.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

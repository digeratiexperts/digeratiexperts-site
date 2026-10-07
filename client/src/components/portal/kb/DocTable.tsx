import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Document table: dark header row, ruled cells, horizontal scroll on small
 * screens. Used by knowledge articles and the licensing tables so reference
 * content reads the same everywhere.
 */
export function DocTable({
  head,
  rows,
  caption,
  className,
}: {
  head: ReactNode[];
  rows: ReactNode[][];
  caption?: string;
  className?: string;
}) {
  return (
    <div className={cn("my-4 overflow-x-auto rounded-md border border-border", className)}>
      <table className="w-full min-w-[480px] border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead>
          <tr className="bg-[hsl(var(--sidebar-background))] text-left text-white">
            {head.map((h, i) => (
              <th key={i} scope="col" className="border-r border-white/15 px-3 py-2 font-semibold last:border-r-0">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-border even:bg-muted/40">
              {r.map((c, j) => (
                <td key={j} className="border-r border-border px-3 py-2 align-top last:border-r-0">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

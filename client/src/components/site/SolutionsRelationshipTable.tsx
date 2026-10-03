import { cn } from "@/lib/utils";
import type { ChapterTone } from "@/components/site/chapters";

/**
 * Standalone / Co-Managed / ProActive comparison table, shared by the two
 * relationship pages. Scrolls inside its own focusable region on phones so the
 * page never overflows. Hairline rows, no card chrome.
 */
export function SolutionsRelationshipTable({
  rows,
  label,
  tone = "paper",
}: {
  rows: string[][];
  label: string;
  tone?: ChapterTone;
}) {
  const paper = tone === "paper";
  const seam = paper ? "border-[var(--de-paper-hairline)]" : "border-[var(--de-hairline)]";
  const head = paper ? "text-[#1A1228]" : "text-white";
  const dim = paper ? "text-[#3A3448]" : "text-white/70";
  return (
    <div
      className={cn(
        "overflow-x-auto rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]",
      )}
      tabIndex={0}
      role="region"
      aria-label={label}
    >
      <table className={cn("w-full min-w-[760px] border-collapse border-t text-left text-sm", seam)}>
        <thead>
          <tr className={cn("border-b", seam)}>
            <th scope="col" className={cn("px-4 py-4 font-mono text-xs font-semibold uppercase tracking-[0.14em]", paper ? "text-black/60" : "text-white/60")}>
              Dimension
            </th>
            {["Standalone", "Co-Managed", "ProActive Managed IT"].map((h) => (
              <th key={h} scope="col" className={cn("px-4 py-4 font-heading text-base font-semibold", head)}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([dimension, standalone, coManaged, proactive]) => (
            <tr key={dimension} className={cn("border-b align-top", seam)}>
              <th scope="row" className={cn("w-40 px-4 py-5 font-medium", head)}>
                {dimension}
              </th>
              <td className={cn("px-4 py-5 text-base leading-relaxed", dim)}>{standalone}</td>
              <td className={cn("px-4 py-5 text-base leading-relaxed", dim)}>{coManaged}</td>
              <td className={cn("px-4 py-5 text-base leading-relaxed", dim)}>{proactive}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

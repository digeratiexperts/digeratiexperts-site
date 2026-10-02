import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  situationDoorCopy,
  situationPublicLine,
  type AnonymousSituation,
  type SituationDoor,
} from "@/lib/anonymousSituation";

/**
 * Compact continuity note for public forms that are not the Store.
 * Operating facts only. Never a person.
 */
export function SituationContinuityStrip({
  situation,
  door,
  tone,
  className,
}: {
  situation: AnonymousSituation;
  door: SituationDoor;
  tone: "paper" | "well";
  className?: string;
}) {
  const copy = situationDoorCopy(situation, door);
  const line = situationPublicLine(situation);
  const paper = tone === "paper";
  return (
    <aside
      className={cn(
        "rounded-xl border px-4 py-3 sm:px-5 sm:py-4",
        paper
          ? "border-[var(--de-paper-hairline)] bg-[var(--de-paper)] text-[#1A1228]"
          : "rounded-2xl border-de-hairline bg-de-raised text-white",
        className,
      )}
      data-testid={`situation-continuity-${door}`}
      aria-label="Remembered environment"
    >
      <p className={cn("text-base font-semibold", paper ? "text-[#1A1228]" : "text-white")}>{copy.headline}</p>
      {line ? (
        <p className={cn("mt-1 text-sm leading-relaxed", paper ? "text-[#3A3448]" : "text-white/70")}>{line}</p>
      ) : null}
      <p className={cn("mt-1 text-sm leading-relaxed", paper ? "text-[#5A5368]" : "text-white/55")}>{copy.detail}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={copy.continueHref}
          className={cn(
            "inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2",
            paper
              ? "text-de-magenta-paper-ink focus-visible:ring-offset-[var(--de-paper)]"
              : "text-de-accent-ink focus-visible:ring-offset-[var(--de-bg)]",
          )}
          data-testid={`situation-continue-${door}`}
        >
          {copy.continueLabel}
        </Link>
        <span className={cn("text-xs", paper ? "text-[#5A5368]" : "text-white/45")}>{copy.privacy}</span>
      </p>
    </aside>
  );
}

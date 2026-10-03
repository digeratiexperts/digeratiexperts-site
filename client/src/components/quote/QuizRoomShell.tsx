import { useEffect, type ReactNode } from "react";
import { Phone, X } from "lucide-react";
import { DE_LOGO_PRIMARY } from "@/lib/brandAssets";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { cn } from "@/lib/utils";

export interface QuizStage {
  label: string;
  /** 0..1 — how much of this stage is done. */
  fill: number;
}

/** Matches .de-site-canvas padding-bottom, so a short screen fits one viewport. */
const CANVAS_BOTTOM_CLEARANCE =
  "var(--de-unified-bar-h) - var(--de-sticky-cta-h) - var(--de-cookie-h) - var(--de-chrome-inset)";

const chromeLink =
  "inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-[#1A1228]/75 transition-colors duration-200 hover:text-[#1A1228] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)]";

/**
 * The quiz room (issue 419): a full-viewport paper field with thin chrome
 * (the DE logo home, a phone line, Exit) and a stage-named progress rail.
 * The page supplies <main>; the sitewide skip link lands there.
 */
export function QuizRoomShell({
  stages,
  currentStage,
  progressLabel,
  progressValue,
  exitHref,
  children,
}: {
  stages: QuizStage[];
  currentStage: number;
  progressLabel: string;
  /** 0..100 */
  progressValue: number;
  exitHref: string;
  children: ReactNode;
}) {
  // The site canvas pads its bottom for the sitewide bar and paints it graphite;
  // in the room that strip is paper too, so the field reads as one sheet.
  useEffect(() => {
    const canvas = document.getElementById("app-canvas");
    if (!canvas) return;
    const previous = canvas.style.backgroundColor;
    canvas.style.backgroundColor = "var(--de-paper)";
    return () => {
      canvas.style.backgroundColor = previous;
    };
  }, []);

  return (
    <div
      className="flex flex-col bg-de-paper text-[#1A1228]"
      style={{ minHeight: `calc(100dvh - ${CANVAS_BOTTOM_CLEARANCE})` }}
      data-testid="quiz-room"
    >
      <header className="border-b border-[var(--de-paper-hairline)] bg-de-paper">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-4 md:h-[4.5rem] md:px-8">
          <a
            href="/"
            aria-label="Digerati Experts home"
            className="inline-flex min-h-11 items-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)]"
          >
            <img src={DE_LOGO_PRIMARY} alt="Digerati Experts" width={300} height={72} className="h-8 w-auto md:h-9" />
          </a>
          <nav aria-label="Quiz" className="flex items-center gap-1 md:gap-3">
            <a href={PRIMARY_PHONE.telHref} className={chromeLink} aria-label={`Call ${PRIMARY_PHONE.display}`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{PRIMARY_PHONE.display}</span>
            </a>
            <a href={exitHref} className={chromeLink} data-testid="quiz-exit">
              <X className="h-4 w-4" aria-hidden="true" />
              Exit
            </a>
          </nav>
        </div>
        <div className="mx-auto w-full max-w-[1200px] px-4 pb-3 md:px-8">
          <div
            role="progressbar"
            aria-label={progressLabel}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progressValue)}
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}
          >
            {stages.map((stage, i) => (
              <div key={stage.label} className="min-w-0">
                <div className="h-1 overflow-hidden rounded-full bg-[#1A1228]/10">
                  <div
                    className="h-full rounded-full bg-[#D3126A] transition-[width] duration-300 ease-out motion-reduce:transition-none"
                    style={{ width: `${Math.round(Math.min(1, Math.max(0, stage.fill)) * 100)}%` }}
                  />
                </div>
                <p
                  aria-hidden="true"
                  className={cn(
                    "mt-1.5 hidden truncate font-mono text-[0.6875rem] font-semibold uppercase tracking-[0.14em] md:block",
                    i === currentStage ? "text-de-magenta-paper-ink" : "text-[#1A1228]/65",
                  )}
                >
                  {stage.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

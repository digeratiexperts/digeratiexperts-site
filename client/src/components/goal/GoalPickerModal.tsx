import { useId } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { DE_LOGO_REVERSE } from "@/lib/brandAssets";
import { useEscapeKey, useFocusTrap } from "@/hooks/useFocusTrap";
import { GOAL_PICKER_INCENTIVE, GOAL_PICKS, type GoalPick } from "@/lib/goalPicker";

type Props = {
  onClose: () => void;
  onPick: (goal: GoalPick) => void;
  reducedMotion: boolean;
};

export function GoalPickerModal({ onClose, onPick, reducedMotion }: Props) {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useFocusTrap<HTMLDivElement>({ enabled: true });

  useEscapeKey(onClose, true);

  const duration = reducedMotion ? 0 : 0.28;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[10050] flex flex-col bg-black"
        data-testid="goal-picker"
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reducedMotion ? undefined : { opacity: 0 }}
        transition={{ duration }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="flex min-h-0 flex-1 flex-col"
        >
          <button
            type="button"
            data-testid="goal-picker-close"
            onClick={onClose}
            aria-label="Close"
            className="absolute left-4 top-4 z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/90 bg-black text-white transition-colors hover:bg-white hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:left-6 sm:top-6"
          >
            <X className="h-7 w-7" strokeWidth={2.5} />
          </button>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-24 sm:px-8">
            <img
              src={DE_LOGO_REVERSE}
              alt="Digerati Experts"
              className="mb-8 h-9 w-auto sm:mb-10 sm:h-10"
            />

            <h2
              id={titleId}
              tabIndex={-1}
              className="font-heading text-center text-[1.85rem] font-bold uppercase leading-[1.05] tracking-wide text-white sm:text-[2.35rem]"
            >
              Tell us your{" "}
              <span className="text-[var(--de-magenta-ink)] underline decoration-2 underline-offset-8">
                goal
              </span>{" "}
              today
            </h2>

            <p
              id={descId}
              className="mt-5 max-w-md text-center text-[15px] leading-snug text-white/80 sm:text-base"
            >
              {GOAL_PICKER_INCENTIVE.line}
            </p>

            <div className="mt-8 flex w-full max-w-[26rem] flex-col gap-3 sm:mt-10 sm:gap-3.5">
              {GOAL_PICKS.map((goal) => (
                <button
                  key={goal.id}
                  type="button"
                  data-testid={`goal-picker-option-${goal.id}`}
                  onClick={() => onPick(goal)}
                  className="group rounded-full bg-[var(--de-magenta)] px-6 py-3.5 text-center text-white transition-colors hover:bg-[var(--de-magenta-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black sm:px-8 sm:py-4"
                >
                  <span className="block font-heading text-[15px] font-semibold leading-tight sm:text-base">
                    {goal.label}
                  </span>
                  {goal.subtitle ? (
                    <span className="mt-1 block text-[12px] font-normal leading-snug text-white/85 sm:text-[13px]">
                      {goal.subtitle}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            <button
              type="button"
              data-testid="goal-picker-dismiss"
              onClick={onClose}
              className="mt-6 text-sm text-white/70 underline-offset-4 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              No thanks
            </button>

            <p className="mt-6 max-w-sm text-center text-[11px] leading-relaxed text-white/55">
              {GOAL_PICKER_INCENTIVE.finePrint}
            </p>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

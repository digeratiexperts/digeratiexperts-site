import type { LucideIcon } from "lucide-react";
import { Check } from "lucide-react";
import { IconWell } from "@/components/visual/IconWell";
import { cn } from "@/lib/utils";

/**
 * One answer in the quiz room (issue 419): a large paper tile that answers the
 * question when pressed. A button with aria-pressed rather than a radio, so
 * arrow keys never answer by accident; Tab moves between answers, Enter or
 * Space picks one.
 */
export function QuizTile({
  label,
  hint,
  icon,
  selected,
  multi = false,
  onSelect,
  testId,
}: {
  label: string;
  hint?: string;
  icon?: LucideIcon;
  selected: boolean;
  /** Multi-select tiles show a square mark instead of a round one. */
  multi?: boolean;
  onSelect: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      data-testid={testId}
      className={cn(
        "group flex min-h-16 w-full items-center gap-4 rounded-xl border bg-white px-4 py-3.5 text-left transition-[border-color,background-color,box-shadow,transform] duration-200 ease-out active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--de-paper)] motion-reduce:transition-none motion-reduce:active:scale-100 md:px-5 md:py-4",
        selected
          ? "border-[#D3126A] bg-[#fdf3f7] shadow-[0_0_0_1px_#D3126A]"
          : "border-[var(--de-paper-hairline)] hover:border-[#1A1228]/30",
      )}
    >
      {icon ? <IconWell icon={icon} size="sm" surface="light" className="bg-de-paper" /> : null}
      <span className="min-w-0 flex-1">
        <span className="block font-heading text-[1.0625rem] font-semibold leading-snug text-[#1A1228]">{label}</span>
        {hint ? <span className="mt-0.5 block text-sm leading-snug text-black/60">{hint}</span> : null}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center border-2 transition-colors duration-200",
          multi ? "rounded-md" : "rounded-full",
          selected ? "border-[#D3126A] bg-[#D3126A] text-white" : "border-[#1A1228]/25 bg-white text-transparent",
        )}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
    </button>
  );
}

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, FileText, MonitorSmartphone, Server, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Token, type TokenTone } from "@/components/portal/ui";
import { cn } from "@/lib/utils";
import {
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  formatEstimate,
  formatQuarter,
  type RoadmapCategory,
  type RoadmapItem,
  type RoadmapPriority,
  type RoadmapStatus,
} from "@shared/roadmap";

export const CATEGORY_ICONS: Record<RoadmapCategory, typeof Shield> = {
  security: Shield,
  infrastructure: Server,
  productivity: MonitorSmartphone,
  compliance: FileText,
};
export const STATUS_TONES: Record<RoadmapStatus, TokenTone> = {
  proposed: "warn",
  approved: "info",
  in_progress: "brand",
  done: "ok",
  declined: "neutral",
};
const PRIORITY_TONES: Record<RoadmapPriority, TokenTone> = { high: "bad", medium: "warn", low: "neutral" };

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

/**
 * One roadmap item: header row that expands to the reason, the estimate, the
 * owner's decision and the comment thread. `actions` is what the viewer may do
 * (decide for owners, edit/delete for DE); `onComment` posts to the thread.
 */
export function RoadmapItemCard({
  item,
  actions,
  onComment,
  defaultOpen = false,
}: {
  item: RoadmapItem;
  actions?: ReactNode;
  onComment?: (body: string) => Promise<unknown>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = CATEGORY_ICONS[item.category];
  const estimate = formatEstimate(item);

  const post = async () => {
    if (!onComment || !comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await onComment(comment);
      setComment("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not post the comment");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={cn("px-4 py-4 md:px-5", open && "bg-accent/30")} data-testid={`roadmap-item-${item.id}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted text-muted-foreground" title={CATEGORY_LABELS[item.category]}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">{item.title}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {CATEGORY_LABELS[item.category]} · <span className="pt-num">{formatQuarter(item.targetQuarter)}</span>
            {estimate && <> · <span className="pt-num">{estimate}</span></>}
            {item.comments.length > 0 && <> · {item.comments.length} {item.comments.length === 1 ? "comment" : "comments"}</>}
          </span>
          <span className="mt-2 flex flex-wrap gap-1.5">
            <Token label={STATUS_LABELS[item.status]} tone={STATUS_TONES[item.status]} dot />
            <Token label={`${PRIORITY_LABELS[item.priority]} priority`} tone={PRIORITY_TONES[item.priority]} />
          </span>
        </span>
        {open ? <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />}
      </button>

      {open && (
        <div className="mt-4 space-y-4 pl-12">
          {item.rationale && (
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Why it matters</p>
              <p className="mt-1 whitespace-pre-line text-sm">{item.rationale}</p>
            </div>
          )}
          {item.decidedAt && (
            <p className="text-sm text-muted-foreground">
              {item.status === "declined" ? "Declined" : "Approved"} by {item.decidedByName ?? "your team"} on <span className="pt-num">{when(item.decidedAt)}</span>
              {item.decisionNote && <>: “{item.decisionNote}”</>}
            </p>
          )}
          {actions}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Comments</p>
            {item.comments.length === 0 ? (
              <p className="mt-1 text-sm text-muted-foreground">No comments yet.</p>
            ) : (
              <ol className="mt-2 space-y-2 border-l border-border pl-3">
                {item.comments.map((c) => (
                  <li key={c.at + c.byName} className="text-sm">
                    <p className="text-xs text-muted-foreground">
                      {c.byName}
                      {c.fromDe && " (DE)"} · <span className="pt-num">{when(c.at)}</span>
                    </p>
                    <p className="whitespace-pre-line">{c.body}</p>
                  </li>
                ))}
              </ol>
            )}
            {onComment && (
              <div className="mt-3 space-y-2">
                <label htmlFor={`comment-${item.id}`} className="sr-only">
                  Add a comment
                </label>
                <Textarea id={`comment-${item.id}`} rows={2} placeholder="Add a comment" value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} />
                <Button type="button" size="sm" variant="outline" disabled={!comment.trim() || busy} onClick={() => void post()}>
                  {busy ? "Posting…" : "Post comment"}
                </Button>
                {error && (
                  <p className="pt-ink pt-tone-bad text-xs" role="alert">
                    {error}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

import { cn } from "@/lib/utils";

/**
 * Status and priority tokens for portal records. Colour carries state only:
 * emerald = done/ok, amber = needs attention, rose = urgent/bad, sky = in
 * motion, magenta = waiting on the reader. Raw enum text never reaches the UI.
 */
export type TokenTone = "ok" | "warn" | "bad" | "info" | "brand" | "neutral";

const toneClass: Record<TokenTone, string> = {
  ok: "pt-token pt-tone-ok",
  warn: "pt-token pt-tone-warn",
  bad: "pt-token pt-tone-bad",
  info: "pt-token pt-tone-info",
  brand: "pt-token pt-tone-brand",
  neutral: "border-border text-muted-foreground bg-transparent",
};

export interface TokenProps {
  label: string;
  tone?: TokenTone;
  dot?: boolean;
  className?: string;
  title?: string;
}

export function Token({ label, tone = "neutral", dot = false, className, title }: TokenProps) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.06em]",
        toneClass[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
      {label}
    </span>
  );
}

const TICKET_STATUS: Record<string, { label: string; tone: TokenTone }> = {
  open: { label: "Open", tone: "warn" },
  new: { label: "New", tone: "warn" },
  in_progress: { label: "In progress", tone: "info" },
  "in progress": { label: "In progress", tone: "info" },
  pending_client: { label: "Waiting on you", tone: "brand" },
  pending: { label: "Waiting on you", tone: "brand" },
  on_hold: { label: "On hold", tone: "neutral" },
  escalated: { label: "Escalated", tone: "bad" },
  resolved: { label: "Resolved", tone: "ok" },
  closed: { label: "Closed", tone: "ok" },
};

export function ticketStatusToken(status: string | undefined | null): { label: string; tone: TokenTone } {
  const key = String(status ?? "").toLowerCase();
  return TICKET_STATUS[key] ?? { label: key ? key.replace(/_/g, " ") : "Unknown", tone: "neutral" };
}

const PRIORITY: Record<string, { label: string; tone: TokenTone }> = {
  critical: { label: "Critical", tone: "bad" },
  urgent: { label: "Urgent", tone: "bad" },
  high: { label: "High", tone: "warn" },
  medium: { label: "Medium", tone: "info" },
  normal: { label: "Normal", tone: "info" },
  low: { label: "Low", tone: "neutral" },
};

export function priorityToken(priority: string | undefined | null): { label: string; tone: TokenTone } {
  const key = String(priority ?? "").toLowerCase();
  return PRIORITY[key] ?? { label: key || "Unset", tone: "neutral" };
}

export function TicketStatus({ status, className }: { status: string | undefined | null; className?: string }) {
  const t = ticketStatusToken(status);
  return <Token label={t.label} tone={t.tone} dot className={className} />;
}

export function Priority({ priority, className }: { priority: string | undefined | null; className?: string }) {
  const t = priorityToken(priority);
  return <Token label={t.label} tone={t.tone} className={className} />;
}

const GENERIC: Record<string, TokenTone> = {
  active: "ok",
  paid: "ok",
  approved: "ok",
  completed: "ok",
  delivered: "ok",
  live: "ok",
  connected: "ok",
  pending: "warn",
  unpaid: "warn",
  overdue: "bad",
  rejected: "bad",
  failed: "bad",
  cancelled: "neutral",
  canceled: "neutral",
  draft: "neutral",
  processing: "info",
  shipped: "info",
  sent: "info",
  sample: "warn",
};

/** For invoice, order, approval and service states that share vocabulary. */
export function GenericStatus({ status, className }: { status: string | undefined | null; className?: string }) {
  const key = String(status ?? "").toLowerCase();
  const label = key ? key.replace(/_/g, " ") : "Unknown";
  return <Token label={label} tone={GENERIC[key] ?? "neutral"} dot className={className} />;
}

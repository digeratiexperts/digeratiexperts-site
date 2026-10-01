import type { ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalloutTone = "info" | "warn" | "bad" | "ok";

const tone: Record<CalloutTone, { icon: typeof Info; cls: string }> = {
  info: { icon: Info, cls: "pt-callout pt-tone-info" },
  warn: { icon: AlertTriangle, cls: "pt-callout pt-tone-warn" },
  bad: { icon: AlertCircle, cls: "pt-callout pt-tone-bad" },
  ok: { icon: CheckCircle2, cls: "pt-callout pt-tone-ok" },
};

export interface CalloutProps {
  tone?: CalloutTone;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  testId?: string;
  role?: "alert" | "status";
}

/** Inline message with state colour. `bad` announces as an alert. */
export function Callout({ tone: t = "info", title, children, action, className, testId, role }: CalloutProps) {
  const { icon: Icon, cls } = tone[t];
  return (
    <div
      role={role ?? (t === "bad" ? "alert" : "status")}
      className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", cls, className)}
      data-testid={testId}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && "mt-0.5", "text-muted-foreground [&_a]:text-foreground [&_a]:underline")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

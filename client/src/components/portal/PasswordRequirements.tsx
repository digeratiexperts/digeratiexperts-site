import { Check, Circle, Eye, EyeOff, X } from "lucide-react";
import { useMemo } from "react";
import { evaluatePassword, PASSWORD_BREACH_LABEL, type PasswordContext } from "@shared/passwordPolicy";

/**
 * Live password checklist for the Client Portal's signup, reset and change
 * forms. The rules come from shared/passwordPolicy.ts, the same list the
 * server enforces, so the page never promises a rule the server skips.
 *
 * Before anything is typed every rule is neutral; after that each rule is met
 * (green check) or not (red cross). Screen readers get "met" / "not met" text
 * and read the list through the input's aria-describedby, not on every key.
 */
export function PasswordRequirements({
  id,
  password,
  context,
  confirm,
  breached = false,
}: {
  id: string;
  password: string;
  context?: PasswordContext;
  /** When given, adds a "Passwords match" row. */
  confirm?: string;
  /** The server rejected this exact password as breached: show the last row as not met. */
  breached?: boolean;
}) {
  const rules = useMemo(() => evaluatePassword(password, context), [password, context]);
  const typed = password.length > 0;
  const rows = [
    ...rules.map((r) => ({ key: r.id, label: r.label, ok: r.ok, started: typed })),
    // Neutral until the confirmation has been typed too.
    ...(confirm !== undefined
      ? [{ key: "match", label: "Match the confirmation below", ok: confirm === password, started: typed && confirm.length > 0 }]
      : []),
  ];

  return (
    <div id={id} className="rounded-lg border border-border bg-muted/40 p-3 text-xs" data-testid="password-requirements">
      <p className="mb-2 font-medium text-foreground">Your password must:</p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const state = !row.started ? "pending" : row.ok ? "met" : "unmet";
          return (
            <li
              key={row.key}
              className={`flex items-start gap-2 ${state === "unmet" ? "pt-tone-bad pt-ink" : "text-muted-foreground"}`}
              data-testid={`password-rule-${row.key}`}
              data-state={state}
            >
              {state === "met" ? (
                <Check className="pt-tone-ok pt-ink mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              ) : state === "unmet" ? (
                <X className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
              ) : (
                <Circle className="mt-px h-3.5 w-3.5 flex-shrink-0 opacity-60" aria-hidden="true" />
              )}
              <span>
                {row.started && <span className="sr-only">{row.ok ? "Met: " : "Not met: "}</span>}
                {row.label}
              </span>
            </li>
          );
        })}
        <li
          className={`flex items-start gap-2 ${breached ? "pt-tone-bad pt-ink" : "text-muted-foreground"}`}
          data-testid="password-rule-breach"
          data-state={breached ? "unmet" : "pending"}
        >
          {breached ? (
            <X className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="mt-px h-3.5 w-3.5 flex-shrink-0 opacity-60" aria-hidden="true" />
          )}
          <span>
            {breached && <span className="sr-only">Not met: </span>}
            {PASSWORD_BREACH_LABEL}
          </span>
        </li>
      </ul>
    </div>
  );
}

/** Show / hide button that sits inside a password input's right edge. */
export function PasswordVisibilityToggle({
  shown,
  onToggle,
  testId = "button-toggle-password",
}: {
  shown: boolean;
  onToggle: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? "Hide password" : "Show password"}
      aria-pressed={shown}
      className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid={testId}
    >
      {shown ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
    </button>
  );
}

/** True when a server message is the breached-password rejection (server/passwordBreach.ts). */
export function isBreachedPasswordMessage(message: string | null | undefined): boolean {
  return /known data breach/i.test(message || "");
}

/** True when every local rule passes (the breach check still runs on submit). */
export function passwordMeetsPolicy(password: string, context?: PasswordContext): boolean {
  return evaluatePassword(password, context).every((r) => r.ok);
}

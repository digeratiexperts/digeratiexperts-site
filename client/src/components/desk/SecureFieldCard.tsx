import { useId, useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, KeyRound, Loader2, Lock } from "lucide-react";
import {
  SECURE_FIELD_KINDS,
  SECURE_FIELD_LABEL_MAX,
  SECURE_FIELD_MAX_VALUE_LENGTH,
  SECURE_FIELD_STORED_COPY,
  secureFieldPayload,
  secureFieldProblem,
  secureFieldSummary,
  type SecureFieldKind,
  type SecureFieldMeta,
} from "@/lib/deskSecureField";
import { CARD_DATA_REJECTED_CODE, CARD_DATA_REJECTED_MESSAGE } from "@shared/pciGuard";

/**
 * The DE Desk secure field (Intelligence-Hub #1179): a masked input that hands
 * a password, Wi-Fi key, licence key or PIN to the Hub ticket. One control for
 * the website DE Desk (tone "desk": the black + gold panel tokens) and the
 * Client Portal (tone "portal").
 *
 * The value lives only in this component's state while it is typed. It is
 * cleared the moment Store is pressed, sent once through `submit`, and never
 * passed to a chat thread, a ticket comment, an assistant, or `onStored`
 * (which gets metadata only). There is no reveal here.
 */
export interface SecureFieldCardProps {
  tone: "desk" | "portal";
  /** Send the payload; resolve with the stored metadata or throw an Error with a readable message. */
  submit: (payload: { label: string; kind: SecureFieldKind; secretValue: string }) => Promise<SecureFieldMeta>;
  onStored?: (meta: SecureFieldMeta) => void;
  title?: string;
  intro?: ReactNode;
  /** Extra line under the form, e.g. how DE staff open it. */
  note?: ReactNode;
  testId?: string;
}

export function SecureFieldCard({ tone, submit, onStored, title = "Share a password securely", intro, note, testId = "secure-field-card" }: SecureFieldCardProps) {
  const id = useId();
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<SecureFieldKind>("password");
  const [secretValue, setSecretValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stored, setStored] = useState<SecureFieldMeta[]>([]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const problem = secureFieldProblem({ label, secretValue });
    if (problem) {
      setError(problem);
      return;
    }
    const payload = secureFieldPayload({ label, kind, secretValue });
    // Out of state before the request: nothing re-renders it, and a failure means retyping, not a lingering value.
    setSecretValue("");
    setBusy(true);
    setError(null);
    try {
      const meta = await submit(payload);
      setStored((prev) => [...prev, meta]);
      setLabel("");
      onStored?.(meta);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "That couldn't be stored. Nothing was saved; please try again.");
    } finally {
      setBusy(false);
    }
  };

  const desk = tone === "desk";
  const shell = desk
    ? "rounded-xl border p-4 text-left"
    : "rounded-lg border border-border bg-card p-4 text-left text-card-foreground";
  const deskShellStyle = desk ? { background: "var(--desk-box)", borderColor: "var(--desk-border)", color: "var(--desk-ink)" } : undefined;
  const field = desk
    ? "w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2"
    : "w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const deskFieldStyle = desk ? { background: "var(--desk-surface)", borderColor: "var(--desk-border-strong)", color: "var(--desk-ink)" } : undefined;
  const muted = desk ? { color: "var(--desk-ink-muted)" } : undefined;

  return (
    <section className={shell} style={deskShellStyle} data-testid={testId} aria-labelledby={`${id}-title`}>
      <h4 id={`${id}-title`} className="flex items-center gap-2 text-sm font-semibold">
        <KeyRound className="h-4 w-4" aria-hidden="true" style={desk ? { color: "var(--desk-gold)" } : undefined} />
        {title}
      </h4>
      <p className={desk ? "mt-1 text-xs" : "mt-1 text-xs text-muted-foreground"} style={muted}>
        {intro ?? "Need to give DE a password, Wi-Fi key or licence key? Put it here, not in the chat."}
      </p>

      {stored.length > 0 && (
        <ul className="mt-3 space-y-1" aria-live="polite" data-testid={`${testId}-stored`}>
          {stored.map((m) => (
            <li key={m.id} className="flex items-center gap-2 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" style={desk ? { color: "var(--desk-green)" } : undefined} />
              <span>{secureFieldSummary(m)}</span>
            </li>
          ))}
        </ul>
      )}

      <form className="mt-3 space-y-2" onSubmit={onSubmit} autoComplete="off" noValidate>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <label className="block text-xs">
            <span className="sr-only">What it is for</span>
            <input
              className={field}
              style={deskFieldStyle}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={SECURE_FIELD_LABEL_MAX}
              placeholder="What it is for, e.g. Office Wi-Fi"
              data-testid={`${testId}-label`}
            />
          </label>
          <label className="block text-xs">
            <span className="sr-only">Kind</span>
            <select
              className={field}
              style={deskFieldStyle}
              value={kind}
              onChange={(e) => setKind(e.target.value as SecureFieldKind)}
              data-testid={`${testId}-kind`}
            >
              {SECURE_FIELD_KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-xs">
          <span className="sr-only">Secret value (hidden as you type)</span>
          <input
            type="password"
            name="de-secure-field-value"
            className={field}
            style={deskFieldStyle}
            value={secretValue}
            onChange={(e) => setSecretValue(e.target.value)}
            maxLength={SECURE_FIELD_MAX_VALUE_LENGTH}
            placeholder="Value (hidden as you type)"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-testid={`${testId}-value`}
          />
        </label>
        {error && (
          <p role="alert" className={desk ? "text-xs" : "text-xs text-destructive"} style={desk ? { color: "var(--desk-red)" } : undefined}>
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={desk ? "flex items-start gap-1.5 text-[11px]" : "flex items-start gap-1.5 text-[11px] text-muted-foreground"} style={desk ? { color: "var(--desk-ink-dim)" } : undefined}>
            <Lock className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
            <span>{SECURE_FIELD_STORED_COPY}</span>
          </p>
          <button
            type="submit"
            disabled={busy}
            className={desk ? "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-60" : "inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"}
            style={desk ? { background: "var(--desk-gold)", color: "var(--desk-on-gold)" } : undefined}
            data-testid={`${testId}-submit`}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Lock className="h-3.5 w-3.5" aria-hidden="true" />}
            Store securely
          </button>
        </div>
        {note && (
          <p className={desk ? "text-[11px]" : "text-[11px] text-muted-foreground"} style={desk ? { color: "var(--desk-ink-dim)" } : undefined}>
            {note}
          </p>
        )}
      </form>
    </section>
  );
}

/** POST a secure field and read the answer. Errors carry the server's readable message, never the value. */
export async function postSecureField(url: string, body: Record<string, unknown>, init: { credentials?: RequestCredentials } = {}): Promise<SecureFieldMeta> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: init.credentials ?? "include",
  });
  const data = await response.json().catch(() => null);
  if (data?.code === CARD_DATA_REJECTED_CODE) {
    throw new Error(CARD_DATA_REJECTED_MESSAGE);
  }
  if (!response.ok || !data?.secureField) {
    throw new Error(typeof data?.error === "string" && data.error ? data.error : "That couldn't be stored. Nothing was saved; please try again.");
  }
  return data.secureField as SecureFieldMeta;
}

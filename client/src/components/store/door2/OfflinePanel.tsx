import { PRIMARY_PHONE } from "@shared/companyContact";
import { StoreAction } from "./primitives";

export type OfflineKind = "durable" | "network" | "rate";

const COPY: Record<OfflineKind, { title: string; detail: string }> = {
  durable: {
    title: "DE couldn't record this yet.",
    detail: "Nothing was lost; your solution is still here on this device.",
  },
  network: {
    title: "DE couldn't record this yet.",
    detail: "Check your connection. Nothing was lost; your solution is still here on this device.",
  },
  rate: {
    title: "Too many attempts from this connection.",
    detail: `Try again in a while, or call ${PRIMARY_PHONE.display}.`,
  },
};

/** Replaces the submit row when the record could not be made: retry or email the summary; the HelpRow below carries the call. Never says "saved". */
export function OfflinePanel({
  kind,
  onRetry,
  mailto,
  retrying = false,
}: {
  kind: OfflineKind;
  onRetry: () => void;
  mailto: string;
  retrying?: boolean;
}) {
  const copy = COPY[kind];
  return (
    <div className="d2-offline" role="alert" data-testid="offline-panel">
      <p className="d2-body font-semibold">{copy.title}</p>
      <p className="d2-small d2-ink mt-1">{copy.detail}</p>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-3">
        {kind !== "rate" ? (
          {/* Busy, never disabled: a disabled control drops focus in Chromium and WebKit; onRetry ignores a second press while sending. */}
          <StoreAction variant="primary" onClick={onRetry} ariaBusy={retrying} testId="offline-retry">
            {retrying ? "Sending…" : "Try again"}
          </StoreAction>
        ) : null}
        <a href={mailto} className="d2-action d2-action--quiet" data-testid="offline-mailto">
          Email this summary to DE
        </a>
      </div>
      {/* The page's one call link is the HelpRow beneath the card; the panel names it rather than adding a second. */}
      <p className="d2-small d2-ink-soft mt-3">Or call DE using the number below.</p>
    </div>
  );
}

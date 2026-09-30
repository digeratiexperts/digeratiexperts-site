import { useState } from "react";
import { Play, Volume2 } from "lucide-react";

const SPOKEN_PRONUNCIATION = "dij-uh-RAH-tee";

interface PronunciationCardProps {
  className?: string;
}

export function PronunciationCard({ className = "" }: PronunciationCardProps): JSX.Element {
  const [status, setStatus] = useState("Ready to play pronunciation.");

  const playPronunciation = () => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
      setStatus("Audio pronunciation is not supported in this browser. Say dij-uh-RAH-tee.");
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(SPOKEN_PRONUNCIATION);
    utterance.lang = "en-US";
    utterance.rate = 0.78;
    utterance.pitch = 1;
    utterance.volume = 1;
    utterance.onstart = () => setStatus("Playing pronunciation: dij-uh-RAH-tee.");
    utterance.onend = () => setStatus("Pronunciation finished.");
    utterance.onerror = () => setStatus("Audio could not play. Say dij-uh-RAH-tee.");
    window.speechSynthesis.speak(utterance);
  };

  return (
    <aside
      className={`overflow-hidden rounded-2xl border border-de-hairline bg-de-raised ${className}`}
      style={{ boxShadow: "0 24px 70px -42px rgba(123,108,255,0.8)" }}
      aria-label="How to pronounce Digerati"
      data-testid="digerati-pronunciation-card"
    >
      <div className="grid sm:grid-cols-[minmax(0,1fr)_auto]">
        <div className="px-5 py-4 sm:px-6">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className="font-heading font-semibold text-white"
              style={{ fontSize: "1.55rem", letterSpacing: "-0.035em" }}
            >
              di·ger·a·ti
            </span>
            <span className="font-mono text-sm text-de-muted-soft">/ˌdɪdʒəˈrɑːti/</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="font-mono font-semibold text-de-accent-ink"
              style={{ fontSize: 15, letterSpacing: "0.04em" }}
            >
              dij-uh-RAH-tee
            </span>
            <span
              className="text-xs font-medium uppercase text-de-muted-soft"
              style={{ letterSpacing: "0.14em" }}
            >
              Say it with confidence.
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={playPronunciation}
          className="flex min-h-14 items-center justify-center gap-2 border-t border-de-hairline bg-de-bg px-5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset sm:border-l sm:border-t-0"
          style={{ minWidth: 112 }}
          aria-label="Play pronunciation: dij-uh-RAH-tee"
          data-testid="button-play-digerati-pronunciation"
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full border border-de-hairline"
            style={{ background: "rgba(123,108,255,0.15)" }}
          >
            <Play className="ml-0.5 h-3.5 w-3.5 fill-current" aria-hidden="true" />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-de-muted-soft" aria-hidden="true" />
            Hear it
          </span>
        </button>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
    </aside>
  );
}

export default PronunciationCard;

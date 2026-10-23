import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Listen button. Source order, always the same:
 *   1. Pre-rendered static MP3 (audioSrc). No API, no key, cannot go down.
 *   2. Live /api/tts, only if the static file is missing (e.g. a new post
 *      not yet rendered). Quota or server errors are logged, not shown.
 *   3. Device voice, silently. Word highlighting still works.
 * There is no error banner for source 2 or 3. Readers should never be told
 * the premium voice is "temporarily unavailable".
 */

type Mode = "static" | "live" | "browser";

interface BlogAudioPlayerProps {
  title: string;
  text: string;
  audioSrc?: string;
  wordCount?: number;
  onWordChange?: (idx: number) => void;
}

function computeWordCharOffsets(text: string): number[] {
  const offsets: number[] = [];
  const tokens = text.split(/(\s+)/);
  let pos = 0;
  for (const tok of tokens) {
    if (tok && !/^\s+$/.test(tok) && /[A-Za-z0-9À-ɏ]/.test(tok)) {
      offsets.push(pos);
    }
    pos += tok.length;
  }
  return offsets;
}

function pickPreferredBrowserVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.length ? en : voices;
  const preferred =
    pool.find((v) => /natural|enhanced|premium|neural/i.test(v.name)) ||
    pool.find((v) => /samantha|google.*us|microsoft.*aria|jenny/i.test(v.name)) ||
    pool[0];
  return preferred || null;
}

function logQuiet(label: string, err: unknown) {
  // Visible to developers in the console, never to readers.
  if (typeof console !== "undefined") console.info(`[listen] ${label}`, err);
}

export function BlogAudioPlayer({
  title: _title,
  text,
  audioSrc,
  wordCount = 0,
  onWordChange,
}: BlogAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("static");
  const [rate, setRate] = useState(1);
  // null = probe not finished yet; we still try the static file first.
  const [hasSource, setHasSource] = useState<boolean | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const blobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordOffsetsRef = useRef<number[]>([]);
  const onWordChangeRef = useRef(onWordChange);
  onWordChangeRef.current = onWordChange;
  const wordCountRef = useRef(wordCount);
  wordCountRef.current = wordCount;

  const browserSupportsSpeech =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Chrome lazy-loads voices; touching getVoices() early avoids a silent first click.
  useEffect(() => {
    if (!browserSupportsSpeech) return;
    const sv = window.speechSynthesis;
    const trigger = () => sv.getVoices();
    trigger();
    sv.addEventListener?.("voiceschanged", trigger);
    return () => sv.removeEventListener?.("voiceschanged", trigger);
  }, [browserSupportsSpeech]);

  // Probe whether the static file exists, so the button is never dead.
  useEffect(() => {
    let cancelled = false;
    if (!audioSrc) {
      setHasSource(false);
      return;
    }
    setHasSource(null);
    fetch(audioSrc, { method: "HEAD" })
      .then((r) => {
        if (!cancelled) setHasSource(r.ok);
      })
      .catch(() => {
        if (!cancelled) setHasSource(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audioSrc]);

  const stopBrowserSpeech = useCallback(() => {
    if (!browserSupportsSpeech) return;
    try {
      window.speechSynthesis.cancel();
    } catch (e) {
      logQuiet("cancel", e);
    }
    utteranceRef.current = null;
  }, [browserSupportsSpeech]);

  const releaseBlob = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    stopBrowserSpeech();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    onWordChangeRef.current?.(-1);
  }, [stopBrowserSpeech]);

  const playBrowserVoice = useCallback(() => {
    if (!browserSupportsSpeech) {
      setError("Audio is not supported on this device");
      return;
    }
    stopBrowserSpeech();
    const offsets = computeWordCharOffsets(text);
    wordOffsetsRef.current = offsets;
    const total = Math.max(1, offsets.length);

    const utt = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utt;
    const preferred = pickPreferredBrowserVoice();
    if (preferred) utt.voice = preferred;
    utt.rate = rateRef.current;
    utt.pitch = 1.0;
    utt.lang = preferred?.lang || "en-US";

    utt.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setLoading(false);
      setMode("browser");
      setError(null);
    };
    utt.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name && e.name !== "word") return;
      const offs = wordOffsetsRef.current;
      let idx = offs.length - 1;
      for (let i = 0; i < offs.length; i++) {
        if (offs[i] > e.charIndex) {
          idx = i - 1;
          break;
        }
      }
      idx = Math.max(0, idx);
      onWordChangeRef.current?.(idx);
      setProgress(Math.min(99, Math.round((idx / total) * 100)));
    };
    utt.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setProgress(100);
      onWordChangeRef.current?.(-1);
      utteranceRef.current = null;
    };
    utt.onerror = (e: SpeechSynthesisErrorEvent) => {
      // Benign interruptions are not failures. Anything else gets a quiet retry hint.
      const benign = ["canceled", "interrupted", "not-allowed", "audio-busy"];
      if (!benign.includes(e.error)) setError("Tap play to try again");
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    try {
      window.speechSynthesis.speak(utt);
    } catch (err) {
      logQuiet("speak", err);
      setError("Tap play to try again");
    }
  }, [text, browserSupportsSpeech, stopBrowserSpeech]);

  // Plays an audio URL through HTML5 audio. Resolves false if it cannot start.
  const playUrl = useCallback(
    async (url: string, nextMode: Mode): Promise<boolean> => {
      const audio = new Audio(url);
      audio.playbackRate = rateRef.current;
      audioRef.current = audio;

      audio.addEventListener("ended", () => {
        setIsPlaying(false);
        setIsPaused(false);
        setProgress(100);
        onWordChangeRef.current?.(-1);
      });
      audio.addEventListener("timeupdate", () => {
        if (!audio.duration) return;
        const ratio = audio.currentTime / audio.duration;
        setProgress(Math.round(ratio * 100));
        if (wordCountRef.current > 0 && onWordChangeRef.current) {
          const idx = Math.min(
            wordCountRef.current - 1,
            Math.floor(ratio * wordCountRef.current),
          );
          onWordChangeRef.current(idx);
        }
      });

      try {
        await audio.play();
        setMode(nextMode);
        setIsPlaying(true);
        setIsPaused(false);
        return true;
      } catch (e) {
        logQuiet(`play ${nextMode}`, e);
        return false;
      }
    },
    [],
  );

  // Click handler for a fresh start. Tries static, then live, then device voice.
  const startFromSource = useCallback(async () => {
    setLoading(true);
    setError(null);
    stop();
    releaseBlob();

    // 1. Pre-rendered file (normal path).
    if (audioSrc && hasSource !== false) {
      const ok = await playUrl(audioSrc, "static");
      setLoading(false);
      if (ok) return;
    }

    // 2. Live route, only for posts without a rendered file.
    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "nova" }),
        signal: controller.signal,
      });
      if (res.ok) {
        const blob = await res.blob();
        blobUrlRef.current = URL.createObjectURL(blob);
        const ok = await playUrl(blobUrlRef.current, "live");
        setLoading(false);
        if (ok) return;
      } else {
        logQuiet(`/api/tts ${res.status}`, await res.text().catch(() => ""));
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        setLoading(false);
        return;
      }
      logQuiet("/api/tts", e);
    }

    // 3. Device voice, silently.
    setLoading(false);
    playBrowserVoice();
  }, [audioSrc, hasSource, text, stop, releaseBlob, playUrl, playBrowserVoice]);

  const togglePlay = useCallback(() => {
    setError(null);

    // Device voice controls.
    if (mode === "browser" && (isPlaying || isPaused)) {
      const sv = window.speechSynthesis;
      if (isPaused) {
        sv.resume();
        setIsPaused(false);
        setIsPlaying(true);
      } else {
        sv.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
      return;
    }

    const audio = audioRef.current;
    if (!audio || (!isPlaying && !isPaused && audio.ended)) {
      void startFromSource();
      return;
    }
    if (isPaused) {
      void audio.play();
      setIsPaused(false);
      setIsPlaying(true);
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPaused(true);
      setIsPlaying(false);
      return;
    }
    audio.currentTime = 0;
    void audio.play();
    setIsPlaying(true);
    setIsPaused(false);
    setProgress(0);
  }, [mode, isPlaying, isPaused, startFromSource]);

  useEffect(() => {
    return () => {
      stop();
      releaseBlob();
      abortRef.current?.abort();
    };
  }, [stop, releaseBlob]);

  const statusLabel = loading
    ? "Loading…"
    : mode === "browser" && (isPlaying || isPaused)
      ? "Device voice"
      : error
        ? "Error"
        : "Listen";

  return (
    <div
      className="flex w-fit max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-4 pr-2 sm:gap-3"
      data-testid="blog-audio-player"
    >
      <Volume2 className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
      <span className="text-xs text-white/60 hidden sm:inline" aria-live="polite">
        {statusLabel}
      </span>

      <Button
        size="sm"
        className="h-11 w-11 rounded-full bg-de-accent hover:bg-de-accent p-0 disabled:opacity-50"
        onClick={togglePlay}
        disabled={loading || !text}
        aria-label={isPlaying && !isPaused ? "Pause audio" : "Play audio"}
        data-testid="button-audio-play"
      >
        {isPlaying && !isPaused ? (
          <Pause className="h-3.5 w-3.5 text-white" />
        ) : (
          <Play className="h-3.5 w-3.5 text-white ml-px" fill="currentColor" />
        )}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-11 w-11 rounded-full p-0 text-white/60 hover:text-white hover:bg-white/10"
        onClick={stop}
        disabled={!isPlaying && !isPaused}
        aria-label="Stop audio"
        data-testid="button-audio-stop"
      >
        <Square className="h-3 w-3" aria-hidden="true" />
      </Button>

      <div className="hidden sm:flex items-center gap-1.5">
        <div className="h-1 w-20 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-de-accent rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-white/55 tabular-nums w-8 text-right">
          {progress}%
        </span>
      </div>

      <select
        value={String(rate)}
        onChange={(e) => {
          const next = Number(e.target.value) || 1;
          setRate(next);
          if (audioRef.current) audioRef.current.playbackRate = next;
          // Device-voice rate only applies to the next utterance.
          if (mode === "browser" && (isPlaying || isPaused)) stop();
        }}
        className="hidden min-h-11 cursor-pointer border-none bg-transparent text-sm text-white/60 outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#ec4899] sm:block"
        data-testid="select-audio-rate"
        title="Playback speed"
        aria-label="Playback speed"
      >
        {[
          { label: "0.75×", value: "0.75" },
          { label: "1×", value: "1" },
          { label: "1.25×", value: "1.25" },
          { label: "1.5×", value: "1.5" },
        ].map((r) => (
          <option key={r.value} value={r.value} className="bg-[#1a1a2e] text-white">
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}

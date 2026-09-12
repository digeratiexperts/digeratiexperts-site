import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

let fallbackToastShown = false;

type OpenAIVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";

const VOICES: { label: string; value: OpenAIVoice }[] = [
  { label: "Nova (warm)", value: "nova" },
  { label: "Alloy (neutral)", value: "alloy" },
  { label: "Echo (male)", value: "echo" },
  { label: "Fable (expressive)", value: "fable" },
  { label: "Onyx (deep)", value: "onyx" },
  { label: "Shimmer (bright)", value: "shimmer" },
];

interface BlogAudioPlayerProps {
  title: string;
  text: string;
  wordCount?: number;
  onWordChange?: (idx: number) => void;
}

type Mode = "openai" | "browser";

function computeWordCharOffsets(text: string): number[] {
  const offsets: number[] = [];
  const tokens = text.split(/(\s+)/);
  let pos = 0;
  for (const tok of tokens) {
    if (tok && !/^\s+$/.test(tok) && /[A-Za-z0-9\u00C0-\u024F]/.test(tok)) {
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

export function BlogAudioPlayer({
  title: _title,
  text,
  wordCount = 0,
  onWordChange,
}: BlogAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [voice, setVoice] = useState<OpenAIVoice>("nova");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("openai");
  const [rate, setRate] = useState(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const abortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const wordOffsetsRef = useRef<number[]>([]);
  const onWordChangeRef = useRef(onWordChange);
  const wordCountRef = useRef(wordCount);
  const { toast } = useToast();
  const browserSupportsSpeech =
    typeof window !== "undefined" && "speechSynthesis" in window;

  const notifyFallbackOnce = useCallback(() => {
    if (fallbackToastShown) return;
    fallbackToastShown = true;
    toast({
      title: "Using your device's voice",
      description:
        "Premium narration is temporarily unavailable. Word highlighting still works.",
      duration: 5000,
    });
  }, [toast]);

  onWordChangeRef.current = onWordChange;
  wordCountRef.current = wordCount;

  // Preload voices in some browsers (Chrome lazy-loads them).
  useEffect(() => {
    if (!browserSupportsSpeech) return;
    const sv = window.speechSynthesis;
    const trigger = () => sv.getVoices();
    trigger();
    sv.addEventListener?.("voiceschanged", trigger);
    return () => sv.removeEventListener?.("voiceschanged", trigger);
  }, [browserSupportsSpeech]);

  const stopBrowserSpeech = useCallback(() => {
    if (!browserSupportsSpeech) return;
    try {
      window.speechSynthesis.cancel();
    } catch {}
    utteranceRef.current = null;
  }, [browserSupportsSpeech]);

  // Mobile browsers (especially iOS Safari and Android Chrome) require
  // speechSynthesis.speak() to be invoked from a user gesture. Our OpenAI
  // fetch is async, so by the time we'd want to fall back, the gesture is
  // gone and synthesis silently errors with "not-allowed" / "audio-busy".
  // Solution: prime the engine on the first click with a tiny silent
  // utterance so the audio context is unlocked for later fallback use.
  const synthPrimedRef = useRef(false);
  const primeSpeechSynthesis = useCallback(() => {
    if (!browserSupportsSpeech || synthPrimedRef.current) return;
    try {
      const sv = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      u.rate = 10;
      // Only mark as primed once the engine actually accepts the utterance.
      // If the browser rejects (mobile quirks), allow re-priming on next click.
      u.onstart = () => {
        synthPrimedRef.current = true;
      };
      u.onend = () => {
        synthPrimedRef.current = true;
      };
      u.onerror = () => {
        synthPrimedRef.current = false;
      };
      sv.speak(u);
    } catch {
      synthPrimedRef.current = false;
    }
  }, [browserSupportsSpeech]);

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

  const cleanup = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    stopBrowserSpeech();
  }, [audioUrl, stopBrowserSpeech]);

  const playBrowserFallback = useCallback(() => {
    if (!browserSupportsSpeech) {
      setError("Audio not supported on this device");
      return false;
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
      // Some engines fire char-level boundaries; only act on word-level
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
      // Benign / transient errors that recover on next user click:
      //   canceled, interrupted — we stopped or switched voices
      //   not-allowed — gesture context was lost; next click re-primes
      //   audio-busy — engine momentarily contended; retry recovers
      const benign = ["canceled", "interrupted", "not-allowed", "audio-busy"];
      if (!benign.includes(e.error)) {
        setError("Tap play again to retry");
      }
      setIsPlaying(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    try {
      window.speechSynthesis.speak(utt);
      return true;
    } catch (err) {
      setError("Tap play again to retry");
      return false;
    }
  }, [text, browserSupportsSpeech, stopBrowserSpeech]);

  const fetchAudio = useCallback(async () => {
    if (!text) return;
    setLoading(true);
    setError(null);
    cleanup();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
        signal: controller.signal,
      });

      if (!res.ok) {
        // Auto-fall back to browser speech on quota / server errors.
        if (res.status === 429 || res.status >= 500) {
          if (playBrowserFallback()) {
            notifyFallbackOnce();
            return;
          }
        }
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to generate audio");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setMode("openai");

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
        if (audio.duration) {
          const ratio = audio.currentTime / audio.duration;
          setProgress(Math.round(ratio * 100));
          if (wordCountRef.current > 0 && onWordChangeRef.current) {
            const idx = Math.min(
              wordCountRef.current - 1,
              Math.floor(ratio * wordCountRef.current),
            );
            onWordChangeRef.current(idx);
          }
        }
      });
      audio.addEventListener("error", () => {
        // Try browser fallback if HTML5 audio also fails
        if (playBrowserFallback()) {
          notifyFallbackOnce();
        } else {
          setError("Audio playback error");
          setIsPlaying(false);
        }
      });

      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      // Last-ditch: try browser fallback if we haven't already.
      if (mode !== "browser" && playBrowserFallback()) {
        notifyFallbackOnce();
        return;
      }
      setError(e.message || "Audio unavailable");
    } finally {
      setLoading(false);
    }
  }, [text, voice, cleanup, playBrowserFallback, mode, notifyFallbackOnce]);

  const togglePlay = useCallback(() => {
    // Always clear any stale error from a prior attempt and prime the
    // speech engine on this fresh user gesture so fallback works later.
    setError(null);
    primeSpeechSynthesis();

    // Browser speech mode controls
    if (mode === "browser" && (isPlaying || isPaused)) {
      const sv = window.speechSynthesis;
      if (isPaused) {
        sv.resume();
        setIsPaused(false);
        setIsPlaying(true);
      } else if (isPlaying) {
        sv.pause();
        setIsPaused(true);
        setIsPlaying(false);
      }
      return;
    }

    // OpenAI audio mode controls
    const audio = audioRef.current;
    if (!audioUrl && !isPlaying && !isPaused) {
      fetchAudio();
      return;
    }
    if (audio) {
      if (isPaused) {
        audio.play();
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
      audio.play();
      setIsPlaying(true);
      setIsPaused(false);
      setProgress(0);
    }
  }, [audioUrl, isPaused, isPlaying, mode, fetchAudio, primeSpeechSynthesis]);

  useEffect(() => {
    return () => {
      stop();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusLabel = loading
    ? "Loading…"
    : error
      ? "Error"
      : mode === "browser" && (isPlaying || isPaused)
        ? "Device voice"
        : "Listen";

  return (
    <div
      className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 backdrop-blur-sm"
      data-testid="blog-audio-player"
    >
      <Volume2 className="h-4 w-4 text-de-accent-ink" />
      <span
        className="text-xs text-white/60 hidden sm:inline"
        title={
          mode === "browser"
            ? "Using your device's built-in voice"
            : "Premium narration"
        }
      >
        {statusLabel}
      </span>

      <Button
        size="sm"
        className="h-7 w-7 rounded-full bg-de-accent hover:bg-de-accent p-0 disabled:opacity-50"
        onClick={togglePlay}
        disabled={loading}
        aria-label={isPlaying && !isPaused ? "Pause audio" : "Play audio"}
        data-testid="button-audio-play"
      >
        {isPlaying && !isPaused ? (
          <Pause className="h-3.5 w-3.5 text-white" />
        ) : (
          <Play
            className="h-3.5 w-3.5 text-white ml-px"
            fill="currentColor"
          />
        )}
      </Button>

      <Button
        size="sm"
        variant="ghost"
        className="h-7 w-7 rounded-full p-0 text-white/50 hover:text-white hover:bg-white/10"
        onClick={stop}
        disabled={!isPlaying && !isPaused && !audioUrl}
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
          // Browser speech rate only applies on the next utterance.
          if (mode === "browser" && (isPlaying || isPaused)) {
            stop();
          }
        }}
        className="hidden sm:block bg-transparent text-sm text-white/50 border-none outline-none cursor-pointer hover:text-white/70"
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
          <option
            key={r.value}
            value={r.value}
            className="bg-[#1a1a2e] text-white"
          >
            {r.label}
          </option>
        ))}
      </select>

      <select
        value={voice}
        onChange={(e) => {
          const v = e.target.value as OpenAIVoice;
          setVoice(v);
          if (isPlaying || isPaused || audioUrl || mode === "browser") {
            stop();
            cleanup();
            setMode("openai");
          }
        }}
        className="hidden md:block bg-transparent text-sm text-white/50 border-none outline-none cursor-pointer hover:text-white/70 max-w-[120px]"
        data-testid="select-audio-voice"
        title={
          mode === "browser"
            ? "Voice selection applies to premium narration only"
            : "Choose narration voice"
        }
      >
        {VOICES.map((v) => (
          <option
            key={v.value}
            value={v.value}
            className="bg-[#1a1a2e] text-white"
          >
            {v.label}
          </option>
        ))}
      </select>

      {error && !isPlaying && !isPaused && (
        <span className="text-xs text-amber-300/90 hidden sm:inline">
          {error}
        </span>
      )}
    </div>
  );
}

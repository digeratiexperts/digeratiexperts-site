import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, Square, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
type PlaybackState = "idle" | "loading" | "playing" | "paused";
// SpeechSynthesis has one queue per window. A stale player must not cancel a
// newer player's utterance when its delayed error or cleanup finally arrives.
let activeBrowserNarration: {
  utterance: SpeechSynthesisUtterance;
  interrupt: () => void;
} | null = null;

function computeWordCharOffsets(text: string): number[] {
  const offsets: number[] = [];
  let pos = 0;
  for (const token of text.split(/(\s+)/)) {
    if (token && !/^\s+$/.test(token) && /[A-Za-z0-9\u00C0-\u024F]/.test(token)) offsets.push(pos);
    pos += token.length;
  }
  return offsets;
}

function pickPreferredBrowserVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  const english = voices.filter(v => v.lang.toLowerCase().startsWith("en"));
  const pool = english.length ? english : voices;
  return pool.find(v => /natural|enhanced|premium|neural/i.test(v.name)) ||
    pool.find(v => /samantha|google.*us|microsoft.*aria|jenny/i.test(v.name)) || pool[0] || null;
}

export function BlogAudioPlayer({ title, text, wordCount = 0, onWordChange }: BlogAudioPlayerProps) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [progress, setProgress] = useState(0);
  const [voice, setVoice] = useState<OpenAIVoice>("nova");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("openai");
  const [rate, setRate] = useState(1);
  const stateRef = useRef(state);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rateRef = useRef(rate);
  const onWordChangeRef = useRef(onWordChange);
  const wordCountRef = useRef(wordCount);
  rateRef.current = rate;
  onWordChangeRef.current = onWordChange;
  wordCountRef.current = wordCount;
  const loading = state === "loading";
  const isPlaying = state === "playing";
  const isPaused = state === "paused";
  const browserSupportsSpeech = typeof window !== "undefined" &&
    typeof window.speechSynthesis?.speak === "function" &&
    typeof SpeechSynthesisUtterance !== "undefined";

  const setPlaybackState = useCallback((next: PlaybackState) => {
    stateRef.current = next;
    setState(next);
  }, []);
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  // Invalidate callbacks before cancel/pause: engines may deliver events later.
  const cancelAttempt = useCallback(() => {
    attemptRef.current++;
    clearTimer();
    abortRef.current?.abort();
    abortRef.current = null;
    const utterance = utteranceRef.current;
    utteranceRef.current = null;
    if (utterance && activeBrowserNarration?.utterance === utterance) {
      activeBrowserNarration = null;
      try { window.speechSynthesis.cancel(); } catch { /* Already unavailable. */ }
    }
    audioRef.current?.pause();
  }, [clearTimer]);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) {
      audio.onplaying = audio.onpause = audio.onended = audio.ontimeupdate = null;
      audio.onerror = audio.onwaiting = audio.onstalled = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    blobUrlRef.current = null;
    setAudioUrl(null);
  }, []);

  const stop = useCallback(() => {
    cancelAttempt();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlaybackState("idle");
    setProgress(0);
    setError(null);
    onWordChangeRef.current?.(-1);
  }, [cancelAttempt, setPlaybackState]);

  const offerBrowserFallback = useCallback(() => {
    cancelAttempt();
    releaseAudio();
    setMode("browser");
    setPlaybackState("idle");
    onWordChangeRef.current?.(-1);
    setError(browserSupportsSpeech
      ? "Tap Play for device voice."
      : "Audio unavailable here.");
  }, [browserSupportsSpeech, cancelAttempt, releaseAudio, setPlaybackState]);

  // Start/transition deadlines detect engines that accept a call but never respond.
  // They never simulate progress or restart audio in the background.
  const watchTransition = useCallback((attempt: number, message: string, delay = 12000) => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      if (attemptRef.current !== attempt) return;
      stop();
      setError(message);
    }, delay);
  }, [clearTimer, stop]);

  const playAudio = useCallback((audio: HTMLAudioElement) => {
    const attempt = ++attemptRef.current;
    const current = () => attemptRef.current === attempt && audioRef.current === audio;
    setPlaybackState("loading");
    const started = () => {
      if (!current()) return;
      clearTimer();
      setPlaybackState("playing");
      setError(null);
    };
    const failed = (reason: unknown) => {
      if (!current()) return;
      if ((reason as { name?: string })?.name === "NotAllowedError") {
        cancelAttempt();
        setPlaybackState("idle");
        setError("Audio blocked. Tap Play again.");
      } else offerBrowserFallback();
    };
    audio.onplaying = started;
    audio.onpause = () => {
      if (!current()) return;
      clearTimer();
      setPlaybackState("paused");
    };
    audio.onended = () => {
      if (!current()) return;
      clearTimer();
      setPlaybackState("idle");
      setProgress(100);
      onWordChangeRef.current?.(-1);
    };
    audio.ontimeupdate = () => {
      if (!current() || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
      const ratio = audio.currentTime / audio.duration;
      setProgress(Math.min(100, Math.round(ratio * 100)));
      if (wordCountRef.current > 0) onWordChangeRef.current?.(Math.min(wordCountRef.current - 1, Math.floor(ratio * wordCountRef.current)));
    };
    audio.onerror = () => failed(audio.error);
    audio.onwaiting = () => {
      if (!current() || audio.paused) return;
      setPlaybackState("loading");
      watchTransition(attempt, "Audio stalled. Tap Play again.");
    };
    // A stalled download can still have enough buffered audio to keep playing.
    audio.onstalled = () => { if (audio.readyState < 3) audio.onwaiting?.(new Event("waiting")); };
    watchTransition(attempt, "Audio did not start. Tap Play.");
    try {
      // play() must be handled for first play, resume AND replay. A void return
      // on older browsers waits for the playing event instead.
      const pending = audio.play();
      if (pending) pending.then(() => {
        if (!current()) {
          if (audioRef.current !== audio || stateRef.current === "idle" || stateRef.current === "paused") audio.pause();
          return;
        }
        if (!audio.paused) started();
      }).catch(failed);
    } catch (reason) { failed(reason); }
  }, [cancelAttempt, clearTimer, offerBrowserFallback, setPlaybackState, watchTransition]);

  const playBrowserVoice = useCallback(() => {
    if (!browserSupportsSpeech) {
      setError("Device voice unavailable here.");
      return;
    }
    cancelAttempt();
    setProgress(0);
    onWordChangeRef.current?.(-1);
    const attempt = attemptRef.current;
    const current = () => attemptRef.current === attempt && utteranceRef.current === utterance;
    const utterance = new SpeechSynthesisUtterance(text);
    const ownsSpeech = () => current() && activeBrowserNarration?.utterance === utterance;
    utteranceRef.current = utterance;
    const offsets = computeWordCharOffsets(text);
    const started = () => {
      if (!ownsSpeech()) return;
      clearTimer();
      setPlaybackState("playing");
      setError(null);
    };
    utterance.onstart = utterance.onresume = started;
    utterance.onpause = () => {
      if (!ownsSpeech()) return;
      clearTimer();
      setPlaybackState("paused");
    };
    utterance.onboundary = event => {
      if (!ownsSpeech() || (event.name && event.name !== "word")) return;
      let index = offsets.findIndex(offset => offset > event.charIndex) - 1;
      if (index === -2) index = offsets.length - 1;
      index = Math.max(0, index);
      onWordChangeRef.current?.(index);
      setProgress(Math.min(99, Math.round(index / Math.max(1, offsets.length) * 100)));
    };
    utterance.onend = () => {
      if (!current()) return;
      clearTimer();
      utteranceRef.current = null;
      if (activeBrowserNarration?.utterance === utterance) activeBrowserNarration = null;
      setPlaybackState("idle");
      setProgress(100);
      onWordChangeRef.current?.(-1);
    };
    utterance.onerror = () => {
      if (!current()) return;
      utteranceRef.current = null;
      if (activeBrowserNarration?.utterance === utterance) activeBrowserNarration = null;
      stop();
      setError("Device voice failed. Tap Play.");
    };
    setPlaybackState("loading");
    watchTransition(attempt, "Device voice stalled. Tap Play.");
    try {
      // A fresh tap replaces any other narration queued on this page.
      const previous = activeBrowserNarration;
      activeBrowserNarration = null;
      previous?.interrupt();
      window.speechSynthesis.cancel();
      activeBrowserNarration = {
        utterance,
        interrupt: () => { stop(); setError("Voice replaced. Tap Play."); },
      };
      const preferred = pickPreferredBrowserVoice();
      if (preferred) utterance.voice = preferred;
      utterance.lang = preferred?.lang || "en-US";
      utterance.rate = rateRef.current;
      // cancel() does not reset the global paused flag. Restore it on this
      // explicit tap; a silent priming utterance is not a portable unlock.
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);
    } catch {
      stop();
      setError("Device voice failed. Tap Play.");
    }
  }, [browserSupportsSpeech, cancelAttempt, clearTimer, setPlaybackState, stop, text, watchTransition]);

  const fetchAudio = useCallback(async () => {
    cancelAttempt();
    const attempt = attemptRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    const current = () => attemptRef.current === attempt && !controller.signal.aborted;
    setPlaybackState("loading");
    clearTimer();
    timerRef.current = setTimeout(() => { if (current()) offerBrowserFallback(); }, 30000);
    try {
      const response = await fetch("/api/tts", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }), signal: controller.signal,
      });
      if (!current()) return;
      if (!response.ok) { offerBrowserFallback(); return; }
      const blob = await response.blob();
      if (!current()) return;
      if (!blob.size) { offerBrowserFallback(); return; }
      clearTimer();
      abortRef.current = null;
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;
      setAudioUrl(url);
      const audio = new Audio(url);
      audio.playbackRate = rateRef.current;
      audioRef.current = audio;
      playAudio(audio);
    } catch {
      if (current()) offerBrowserFallback();
    }
  }, [cancelAttempt, clearTimer, offerBrowserFallback, playAudio, setPlaybackState, text, voice]);

  const togglePlay = useCallback(() => {
    if (!text.trim() || stateRef.current === "loading") return;
    setError(null);
    if (mode === "browser") {
      const utterance = utteranceRef.current;
      if (utterance && (stateRef.current === "playing" || stateRef.current === "paused")) {
        if (activeBrowserNarration?.utterance !== utterance) {
          stop();
          setError("Voice replaced. Tap Play.");
          return;
        }
        const wasPaused = stateRef.current === "paused";
        setPlaybackState("loading");
        watchTransition(attemptRef.current, "Device voice stalled. Tap Play.");
        try {
          if (wasPaused) window.speechSynthesis.resume();
          else window.speechSynthesis.pause();
        } catch { stop(); setError("Device voice failed. Tap Play."); }
      } else playBrowserVoice(); // Always directly inside the reader's tap.
      return;
    }
    const audio = audioRef.current;
    if (!audio) { void fetchAudio(); return; }
    if (stateRef.current === "playing") audio.pause();
    else {
      if (stateRef.current === "idle" && !error) { audio.currentTime = 0; setProgress(0); }
      playAudio(audio);
    }
  }, [error, fetchAudio, mode, playAudio, playBrowserVoice, setPlaybackState, stop, text, watchTransition]);

  useEffect(() => {
    if (!browserSupportsSpeech) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => { try { synth.getVoices(); } catch { /* Retry on Play. */ } };
    loadVoices();
    synth.addEventListener?.("voiceschanged", loadVoices);
    return () => synth.removeEventListener?.("voiceschanged", loadVoices);
  }, [browserSupportsSpeech]);

  useEffect(() => {
    stop();
    releaseAudio();
    setMode("openai");
    return () => { cancelAttempt(); releaseAudio(); onWordChangeRef.current?.(-1); };
  }, [text, title, voice, stop, cancelAttempt, releaseAudio]);

  useEffect(() => {
    const pageHidden = () => {
      // Media may keep playing in the background. Pending starts and device
      // speech stop explicitly rather than claiming a frozen engine is playing.
      if (document.hidden && (utteranceRef.current || stateRef.current === "loading")) {
        stop();
        setError("Playback stopped. Tap Play.");
      } else if (!document.hidden && audioRef.current && stateRef.current === "playing" && audioRef.current.paused) {
        setPlaybackState("paused");
      }
    };
    const leave = () => stop();
    document.addEventListener("visibilitychange", pageHidden);
    document.addEventListener("freeze", leave);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", pageHidden);
      document.removeEventListener("freeze", leave);
      window.removeEventListener("pagehide", leave);
    };
  }, [setPlaybackState, stop]);


  const statusLabel = loading
    ? "Loading…"
    : error
      ? "Error"
      : mode === "browser" && (isPlaying || isPaused)
        ? "Device voice"
        : "Listen";

  return (
    <div className="max-w-full" data-testid="blog-audio-player">
    <div
      className="flex w-fit max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-4 pr-2 sm:gap-3"
    >
      <Volume2 className="h-4 w-4 shrink-0 text-de-accent-ink" aria-hidden="true" />
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
        className="h-11 w-11 rounded-full bg-de-accent hover:bg-de-accent p-0 disabled:opacity-50"
        onClick={togglePlay}
        disabled={loading || !text.trim()}
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
        className="h-11 w-11 rounded-full p-0 text-white/60 hover:text-white hover:bg-white/10"
        onClick={stop}
        disabled={!loading && !isPlaying && !isPaused && !audioUrl}
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
          if (mode === "browser" && (loading || isPlaying || isPaused)) {
            stop();
          }
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
        }}
        className="hidden min-h-11 max-w-[120px] cursor-pointer border-none bg-transparent text-sm text-white/60 outline-none hover:text-white/80 focus-visible:ring-2 focus-visible:ring-[#ec4899] md:block"
        data-testid="select-audio-voice"
        aria-label="Narration voice"
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

    </div>
      <span className="sr-only" aria-live="polite">{loading ? "Starting audio" : isPlaying ? "Audio playing" : isPaused ? "Audio paused" : "Audio stopped"}</span>
      {error && <p role="status" className="mt-2 max-w-sm text-xs leading-relaxed text-amber-300/90">{error}</p>}
    </div>
  );
}

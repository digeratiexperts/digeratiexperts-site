# Digerati pronunciation audio

`digerati-pronunciation.wav` is the file the homepage pronunciation card plays
for **dij-uh-RAH-tee** (`/ˌdɪdʒəˈrɑːti/`). The card points at it through
`AUDIO_SRC` in `client/src/components/PronunciationCard.tsx` and falls back to
browser speech synthesis if the file ever fails to load. The per-syllable chips
always use synthesis — there are no per-syllable recordings.

## What the committed file is, precisely

It is **not a human recording.** It is Windows SAPI speech synthesis
(Microsoft Zira, rate −3), driven by SSML with an explicit IPA phoneme string
rather than the spelling, so the synthesiser pronounces the word instead of
guessing at it:

```xml
<phoneme alphabet="ipa" ph="ˌdɪdʒəˈrɑːti">Digerati</phoneme>
```

The phoneme tag was verified as honoured, not silently ignored, by synthesising
the same word with a deliberately wrong phoneme (`kæt`) and confirming the
output changed length accordingly.

Post-processing: leading/trailing silence trimmed with 40 ms of padding, peak
normalised to −1.5 dBFS. Result is 16-bit PCM mono, 22.05 kHz, 0.85 s, 37 KB.

WAV rather than MP3 because no MP3 encoder was available on the build machine
(the only ffmpeg present is Playwright's video-only stripped build). WAV is
universally supported and 37 KB is acceptable for media that loads on click.
Re-encoding to MP3 or Opus would cut it to roughly 10 KB if someone with an
encoder wants to.

## Replacing it with a real voice

A recorded human voice is still the better asset — it carries the brand and it
is the actual answer to "how do *they* say it". To swap:

1. Record the spoken phrase only: "dij-uh-RAH-tee". Neutral, confident
   delivery, no music, reverb, or background bed.
2. Trim the silence, normalise conservatively, avoid clipping.
3. Save it here, keeping the file small — this is homepage media.
4. Point `AUDIO_SRC` in `PronunciationCard.tsx` at the new filename. If the
   extension changes, that constant is the only line that needs editing.

No other code changes are required, and the synthesis fallback stays in place
either way.

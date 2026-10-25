# Digerati pronunciation audio

Two files say **dij-uh-RAH-tee** (`/ˌdɪdʒəˈrɑːti/`). Joe picked both on 2026-10-24:

| File | Voice | Role |
|---|---|---|
| `digerati-pronunciation.wav` | Piper `en_US-ryan-high` (male) | main |
| `digerati-pronunciation-backup.mp3` | Piper `en_US-lessac-high` (female) | failover |

Who plays them:

- The live homepage "Hear it" button: `client/src/pages/homepage-v2/sections/HeroSection.tsx`.
- The shared card: `client/src/components/PronunciationCard.tsx`.

Both try the main file first. If it cannot play, they try the backup, and if that also fails they use the browser's speech synthesis. The archived homepage versions (`client/src/pages/versions/v7`–`v10`) play the main file only, through their own `AUDIO_SRC`, which is unchanged.

## How they were made

Neither file is a human recording. Both come from [Piper](https://github.com/rhasspy/piper), an open-source neural text-to-speech engine that runs locally. There was no paid service and no API call.

- **Voice models:** `rhasspy/piper-voices` v1.0.0 on Hugging Face.
- **Input:** the sounds themselves, `[[ dˌɪdʒəɹˈɑːti ]]`, not the spelling. Fed the plain word "Digerati", Piper says "DYE-jrah-tee".
- **Command:** `echo "[[ dˌɪdʒəɹˈɑːti ]]" | piper -m en_US-ryan-high.onnx --length-scale 1.15 -f raw.wav`
- **Post-processing (ffmpeg):** trim leading and trailing silence, pad 150 ms, loudness-normalise to −16 LUFS (true peak −1.5 dB), 22.05 kHz mono. The main file is 16-bit WAV (1.06 s, 46 KB); the backup is MP3 (0.89 s, 6 KB).
- **Check:** Whisper `small.en` transcribed every sample as "Digerati" when prompted with the company name, and as "Dijerati" without the prompt, which is the right soft "g".

The file these replace was Windows SAPI (Microsoft Zira) and sounded robotic.

## Replacing them with a human recording

A real voice is still the better asset. To swap:

1. Record the word once: "dij-uh-RAH-tee". Neutral delivery, no music or reverb.
2. Trim the silence and normalise without clipping.
3. Save it over `digerati-pronunciation.wav` (or change the constants in the two files above if the name or format changes).

The backup and the synthesis fallback stay in place either way.

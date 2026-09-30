# Digerati pronunciation audio

The homepage pronunciation card currently uses the browser's built-in speech synthesis as a no-download fallback for **dij-uh-RAH-tee** (`/ˌdɪdʒəˈrɑːti/`).

For the canonical DE voice, add a clean human recording here as `digerati-pronunciation.mp3` (and optionally an Opus/WebM alternate), then update `client/src/components/PronunciationCard.tsx` to prefer that file while retaining speech synthesis as the accessibility/offline fallback.

Recording target:
- Spoken phrase only: “dij-uh-RAH-tee”
- Neutral, confident delivery
- No music, reverb, or background bed
- Normalize conservatively; avoid clipping
- Keep the file small because it is homepage media

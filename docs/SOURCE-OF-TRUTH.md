# Source of truth and agent coordination

**Canonical repo:** GitHub `digeratiexperts/digeratiexperts-site`

**Canonical authoring:** clean local branch → reviewed pull request → tested artifact → VPS deploy

**Agent roles:** Cursor/Thinking for security, architecture, commerce, and review; Antigravity Gemini Flash High for screenshots, responsive visual critique, imagery, and art direction
**Not canonical:** legacy Replit Agent commits or sync pushing over reviewed branches

## Legacy Replit safeguards

If the old Replit project still exists, keep it read-only:

1. **Pause or disconnect GitHub sync** (Settings → Git / Version control) so Replit cannot push to `main` or `fix/*` from the Repl.
2. **Do not click “Publish / Deploy from Replit”** for production — production is CyberPanel + systemd `digeratiexperts-site` as `diger7051` on de-vps (`/home/digeratiexperts.com/current` → :3300). See `deploy/vps/README.md`.
3. If the Repl must stay open for reference, treat it as **read-only**. Pull from GitHub into Replit only when you explicitly want a preview; never let Replit be the push source.
4. Prefer working on GitHub branches (`fix/homepage-hero-nav-2026-08-08`, `preserve/*`) and merge via PR.

## Preserve branches (do not delete)

| Branch | Why |
|--------|-----|
| `preserve/live-pink-sticky-nav` | Pink sticky section bar chrome |
| `preserve/internal-pages-pre-redact` | Internal sales pages removed in Aug 2026 cleanup (renamed from replit-prefixed branch) |

## Recovered from Replit (do not full-sync)

**Digerati Journal + read-aloud** was restored from the live Replit preview into git (not via full Repl sync):

- `client/src/pages/resources/Blog.tsx` / `BlogPost.tsx`
- `client/src/components/BlogAudioPlayer.tsx` (OpenAI `/api/tts` + browser `speechSynthesis` failover, word highlight, play/pause/stop/speed/voice)
- `client/src/data/resourceRegistry.ts` + `resourceRegistry.v2.json` (16 articles)
- `client/public/assets/covers/blog/*`
- `server` `POST /api/tts` + `generateSpeech` in `openaiService.ts`

If something else is still missing from git, recover surgically from Replit Checkpoints — never let Replit push over Cursor/git HEAD.

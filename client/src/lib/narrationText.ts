// Single source of truth for blog narration. The browser player and the
// build-time renderer (scripts/render-narration.ts) both call these, so the
// text the player expects and the MP3 that was rendered can never drift apart.

export type NarrationBlock =
  | { kind: "p"; text: string }
  | { kind: "h2"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "callout"; title?: string; text: string }
  | { kind: "quote"; text: string }
  | { kind: string };

export type NarrationView = "overview" | "extended";

export function narrationTextFor(blocks: ReadonlyArray<NarrationBlock>): string {
  return blocks
    .map((b) => {
      if (b.kind === "p") {
        const raw = (b as { text: string }).text.trim();
        if (raw.startsWith("> ")) return raw.slice(2);
        return raw;
      }
      if (b.kind === "h2") return (b as { text: string }).text;
      if (b.kind === "ul") return (b as { items: string[] }).items.join(". ");
      if (b.kind === "callout") {
        const c = b as { title?: string; text: string };
        return `${c.title ?? ""}: ${c.text}`.trim();
      }
      if (b.kind === "quote") return (b as { text: string }).text;
      return "";
    })
    .filter(Boolean)
    .join(". ");
}

// Static file path the site serves for a post. Lives in public/ so it is
// same-origin, cacheable, and needs no server or API key at runtime.
export function narrationPath(slug: string, view: NarrationView): string {
  return `/audio/narration/${slug}.${view}.mp3`;
}

// Prefer the static MP3 when the build shipped one. Used by the player.
export const NARRATION_VOICE = "nova" as const;

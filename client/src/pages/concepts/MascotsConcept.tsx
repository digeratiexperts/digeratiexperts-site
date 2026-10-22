// Concept (Exploration, 2026-10-21): /concepts/mascots, review page for Dex (public AI employee)
// and Rati (behind-the-scenes AI tech employee). The gold four-bar Dex and the magenta outline Rati
// are code-drawn on the logo geometry (Joe: "the yellow ones are mostly almost locked in"). The
// compact form is still open: Joe found the orb weak and asked for very different directions, so
// six ILLUSTRATIVE candidates are shown to pick from. Review only, noindex, not in navigation.
import { useSEO } from "@/hooks/useSEO";
import { DEX_MODES, DexMark, RatiMark, type DexMode, type DexState } from "@/components/mascots/Mascots";
import { DEX_EMOTIONS, DEX_INTERACTIONS, chooseDexPresence } from "@/components/mascots/dexPresence";
import { HOLIDAYS, occurrences } from "@/components/mascots/holidays";
import { useState } from "react";

const cycleOrder = Object.keys(DEX_MODES) as DexMode[];
const shortDate = (ms: number) => new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const states: { state: DexState; label: string; note: string }[] = [
  { state: "idle", label: "Idle", note: "Bars breathe in turn, like the pronunciation meter." },
  { state: "listening", label: "Listening", note: "Still and level, eyes open." },
  { state: "thinking", label: "Thinking", note: "A slow wave through the bars, eyes look up." },
  { state: "speaking", label: "Speaking", note: "The bars open slightly, in rhythm." },
];

// Each compact form has one job. It appears only where that job happens, never as decoration (Joe, 2026-10-21).
const compact: { file: string; name: string; note: string; use: string }[] = [
  { file: "dex-compact-3-capsule", name: "1 · Capsule", note: "One bar of the logo, alive. Reads at 16 px.", use: "Status line: a request is running, shown beside the text it belongs to." },
  { file: "dex-compact-1-tile", name: "2 · Tile", note: "An app-icon square with the bars pressed in.", use: "Identity: Dex's avatar in email signatures, the Zoho profile photo and the app icon." },
  { file: "dex-compact-4-beads", name: "3 · Beads", note: "A typing indicator that looks back at you.", use: "Live chat: shown while Dex is composing a reply." },
  { file: "dex-compact-6-bubble", name: "4 · Bubble", note: "A speech bubble built from the bars.", use: "Conversation: marks Dex's messages in the chat window and the launcher." },
  { file: "dex-compact-5-ring", name: "5 · Ring", note: "One bar bent into a frame, eyes inside.", use: "Attention: a badge when something needs a person. Pairs with Alert mode." },
  { file: "dex-compact-2-pebble", name: "6 · Pebble", note: "A worn gold stone with engraved lines.", use: "Quiet moments: sign-offs, empty states and “nothing needs you”." },
];

const card = "rounded-3xl border border-white/10 bg-[#151217] p-6";

export function MascotsConcept(): JSX.Element {
  useSEO({ title: "Concept: Dex and Rati", description: "Review concept. Not a live page.", canonical: "/concepts/mascots", noIndex: true });
  const [cycle, setCycle] = useState(0);
  const holidayYear = new Date().getFullYear();
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-16 text-[#f5f5f5] sm:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <header className="max-w-3xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#ff4d8d]">Concept · review only</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">Dex and Rati</h1>
          <p className="mt-4 text-lg text-[#a1a1a6]">
            Dex is Digerati Experts&rsquo; public AI employee. Rati works behind the scenes on the technical side. Both are drawn
            from the exact four bars of the DE logo, so the shape never drifts.
          </p>
        </header>

        <section className={card} aria-labelledby="pair">
          <h2 id="pair" className="text-2xl font-semibold">The pair</h2>
          <div className="mt-6 flex flex-wrap items-end justify-center gap-16 sm:gap-24">
            <figure className="text-center"><DexMark size={190} title="Dex" /><figcaption className="mt-3 text-[#a1a1a6]">Dex · public</figcaption></figure>
            <figure className="text-center"><RatiMark size={150} title="Rati" /><figcaption className="mt-3 text-[#a1a1a6]">Rati · behind the scenes</figcaption></figure>
          </div>
        </section>

        <section className={card} aria-labelledby="states">
          <h2 id="states" className="text-2xl font-semibold">Dex&rsquo;s states</h2>
          <p className="mt-2 text-[#a1a1a6]">Mood without a mouth: the bars and eyes carry it. Motion stops when a visitor prefers reduced motion.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {states.map((s) => (
              <figure key={s.state} className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 text-center">
                <DexMark size={110} state={s.state} />
                <figcaption className="mt-3"><span className="block font-semibold">{s.label}</span><span className="text-sm text-[#a1a1a6]">{s.note}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={card} aria-labelledby="modes">
          <h2 id="modes" className="text-2xl font-semibold">Dex&rsquo;s modes</h2>
          <p className="mt-2 max-w-3xl text-[#a1a1a6]">
            What Dex is doing right now, as a fixed pose. Each one is held as numbers in <code>DEX_MODES</code>, so the animation
            can tween between them later. States (above) are how he moves; modes are what he is doing. The rule: Dex changes
            shape only for a specific reason, and each change answers one situation. He never shifts for decoration.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            <DexMark size={160} mode={cycleOrder[cycle]} title={`Dex, ${DEX_MODES[cycleOrder[cycle]].label}`} />
            <button
              type="button"
              onClick={() => setCycle((c) => (c + 1) % cycleOrder.length)}
              className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold hover:border-[#ff4d8d]"
            >
              Next emotion: {DEX_MODES[cycleOrder[(cycle + 1) % cycleOrder.length]].label} (now {DEX_MODES[cycleOrder[cycle]].label})
            </button>
          </div>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(DEX_MODES) as DexMode[]).map((m) => (
              <figure key={m} className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 text-center">
                <DexMark size={110} mode={m} />
                <figcaption className="mt-3">
                  <span className="block font-semibold">{DEX_MODES[m].label}</span>
                  <span className="text-sm text-[#a1a1a6]">{DEX_MODES[m].note}</span>
                  <span className="mt-2 block text-sm text-[#ff4d8d]">Used when: {DEX_EMOTIONS[m].when}</span>
                  <span className="mt-1 block text-sm text-[#a1a1a6]">Never: {DEX_EMOTIONS[m].never}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={card} aria-labelledby="interactions">
          <h2 id="interactions" className="text-2xl font-semibold">Dex&rsquo;s interactions</h2>
          <p className="mt-2 max-w-3xl text-[#a1a1a6]">
            Each situation is a set of signals. The rules pick the emotion, the motion, the compact form and whether a DE person
            must take the next step. Nothing on this page is hand-set; change a rule and the page shows the new result.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {DEX_INTERACTIONS.map((i) => {
              const p = chooseDexPresence(i.signals);
              return (
                <figure key={i.id} className="flex gap-4 rounded-2xl border border-white/10 bg-[#0d0d10] p-5">
                  <DexMark size={72} mode={p.mode} state={p.state} />
                  <figcaption className="min-w-0 text-sm">
                    <span className="block text-base font-semibold">{i.situation}</span>
                    <span className="mt-1 block text-[#f5f5f5]">&ldquo;{DEX_EMOTIONS[p.mode].line}&rdquo;</span>
                    <span className="mt-2 block text-[#a1a1a6]">
                      Emotion: {DEX_MODES[p.mode].label} · Form: {p.form ?? "none"} · Person needed: {p.mustHandOff ? "yes" : "no"}
                    </span>
                    <span className="mt-1 block text-[#a1a1a6]">Why: {p.reason}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        <section className={card} aria-labelledby="holidays">
          <h2 id="holidays" className="text-2xl font-semibold">Dex&rsquo;s holiday sets</h2>
          <p className="mt-2 max-w-3xl text-[#a1a1a6]">
            One set per holiday: a glyph in the top-right corner, in its own colour. The set switches on for its window and off after
            it, from the date rules, so nothing needs editing each year. A holiday never changes Dex&rsquo;s emotion, and it is off in
            security, outage, billing and handoff situations. Dates below are {holidayYear}. These glyphs are first drafts for review.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {HOLIDAYS.map((h) => {
              const occ = occurrences(holidayYear).find((o) => o.holiday.id === h.id)!;
              return (
                <figure key={h.id} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[#0d0d10] p-4">
                  <DexMark size={72} holiday={h} />
                  <figcaption className="min-w-0 text-sm">
                    <span className="block font-semibold text-base">{h.name}</span>
                    <span className="block text-[#a1a1a6]">
                      {shortDate(occ.day)} · shows {shortDate(occ.day - h.before * 86_400_000)} to {shortDate(occ.day + h.after * 86_400_000)}
                    </span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </section>

        <section className={card} aria-labelledby="compact">
          <h2 id="compact" className="text-2xl font-semibold">Dex&rsquo;s compact form: six forms, one job each</h2>
          <p className="mt-2 max-w-3xl text-[#a1a1a6]">
            Where four bars are too small to read. Each form is assigned to one use case and appears only there. Generated
            candidates (ILLUSTRATIVE); each one is redrawn exactly in code like the full form before it ships.
          </p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {compact.map((c) => (
              <figure key={c.file} className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d10]">
                <img src={`/images/mascots/${c.file}.webp`} alt={`Dex compact direction: ${c.name.replace(/^\d · /, "")}`} width={800} height={800} loading="lazy" className="aspect-square w-full object-cover" />
                <figcaption className="p-4"><span className="block font-semibold">{c.name}</span><span className="text-sm text-[#a1a1a6]">{c.note}</span><span className="mt-3 block text-sm text-[#ff4d8d]">Used for: {c.use}</span></figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className={card} aria-labelledby="sizes">
          <h2 id="sizes" className="text-2xl font-semibold">At working sizes</h2>
          <p className="mt-2 text-[#a1a1a6]">The full forms at small sizes, on dark and on paper.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {["#0a0a0a", "#f7f5f2"].map((bg) => (
              <div key={bg} className="flex items-center justify-around rounded-2xl p-6" style={{ background: bg }}>
                <DexMark size={64} /><DexMark size={40} /><DexMark size={24} /><RatiMark size={48} /><RatiMark size={28} />
              </div>
            ))}
          </div>
        </section>

        <section className={card} aria-labelledby="chat">
          <h2 id="chat" className="text-2xl font-semibold">In a conversation</h2>
          <div className="mt-6 max-w-xl space-y-4">
            <div className="flex items-start gap-3">
              <DexMark size={36} state="speaking" />
              <p className="rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-[#121212]">Hi, I&rsquo;m Dex. I&rsquo;ve opened ticket 4821 and a technician is reviewing it now.</p>
            </div>
            <div className="flex items-start gap-3 opacity-90">
              <RatiMark size={36} />
              <p className="rounded-2xl rounded-tl-sm border border-[#D3126A]/40 bg-[#1a1a1c] px-4 py-3 text-sm text-[#a1a1a6]">Rati · technical review (internal): MFA prompt loop traced to a stale conditional-access policy.</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-[#a1a1a6]">Example wording only, to show the two voices; not a real ticket.</p>
        </section>
      </div>
    </main>
  );
}

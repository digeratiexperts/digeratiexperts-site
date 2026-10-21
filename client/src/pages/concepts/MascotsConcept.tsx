// Concept (Exploration, 2026-10-21): /concepts/mascots, review page for Dex (public AI employee)
// and Rati (behind-the-scenes AI tech employee). Joe picked the gold four-bar figure, the frosted
// orb and the magenta glass outline from the generated candidates; these are the exact, code-drawn
// masters built on the logo geometry. Review only, noindex, not in navigation.
import { useSEO } from "@/hooks/useSEO";
import { DexMark, DexOrb, RatiMark, type DexState } from "@/components/mascots/Mascots";

const states: { state: DexState; label: string; note: string }[] = [
  { state: "idle", label: "Idle", note: "Bars breathe in turn, like the pronunciation meter." },
  { state: "listening", label: "Listening", note: "Still and level, eyes open." },
  { state: "thinking", label: "Thinking", note: "A slow wave through the bars, eyes look up." },
  { state: "speaking", label: "Speaking", note: "The bars open slightly, in rhythm." },
];

const card = "rounded-3xl border border-white/10 bg-[#151217] p-6";

export function MascotsConcept(): JSX.Element {
  useSEO({ title: "Concept: Dex and Rati", description: "Review concept. Not a live page.", canonical: "/concepts/mascots", noIndex: true });
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
          <div className="mt-6 flex flex-wrap items-end justify-center gap-12 sm:gap-20">
            <figure className="text-center"><DexMark size={180} title="Dex" /><figcaption className="mt-3 text-[#a1a1a6]">Dex · full form</figcaption></figure>
            <figure className="text-center"><DexOrb size={180} title="Dex, compact form" /><figcaption className="mt-3 text-[#a1a1a6]">Dex · compact form</figcaption></figure>
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
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <figure className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 text-center"><DexOrb size={120} state="idle" /><figcaption className="mt-3 text-sm text-[#a1a1a6]">Orb, idle: the core breathes</figcaption></figure>
            <figure className="rounded-2xl border border-white/10 bg-[#0d0d10] p-5 text-center"><DexOrb size={120} state="speaking" /><figcaption className="mt-3 text-sm text-[#a1a1a6]">Orb, speaking: the core pulses faster</figcaption></figure>
          </div>
        </section>

        <section className={card} aria-labelledby="sizes">
          <h2 id="sizes" className="text-2xl font-semibold">At working sizes</h2>
          <p className="mt-2 text-[#a1a1a6]">Chat avatar, email signature and favicon sizes, on dark and on paper.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {["#0a0a0a", "#f7f5f2"].map((bg) => (
              <div key={bg} className="flex items-center justify-around rounded-2xl p-6" style={{ background: bg }}>
                <DexOrb size={64} /><DexOrb size={40} /><DexOrb size={24} /><DexMark size={40} /><RatiMark size={40} />
              </div>
            ))}
          </div>
        </section>

        <section className={card} aria-labelledby="chat">
          <h2 id="chat" className="text-2xl font-semibold">In a conversation</h2>
          <div className="mt-6 max-w-xl space-y-4">
            <div className="flex items-start gap-3">
              <DexOrb size={40} state="speaking" />
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

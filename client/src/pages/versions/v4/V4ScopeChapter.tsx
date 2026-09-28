import { Chapter } from "./V4Primitives";
import { environmentStarted, useEnvironmentDraft } from "./useEnvironmentDraft";

/**
 * 03 — Before anything is proposed. The peak.
 *
 * The real thing here is the assessment's scope, sized to the environment the
 * visitor drew in chapter 02. Eight questions, one per block of the DE
 * security model, each carrying the number it applies to: twelve people means
 * twelve identities to prove and twelve inboxes to defend. When nothing has
 * been typed the same questions read for "every person" and "each site", so
 * the chapter is complete either way and no scroll position is empty.
 *
 * Nothing here is a result. It is what the assessment looks at, and the
 * honest exit — you keep the findings whichever way you go — is stated in
 * the same breath. The block names are canon (docs/DE-NAMING-CANON.md, the
 * eight-block model), and they reappear in chapter 05 as what gets built.
 */

type ScopeRow = {
  block: string;
  /** The count the question applies to, as a sentence fragment. */
  subject: (env: { users: number; devices: number; sites: number }) => string;
  question: string;
};

const plural = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

const ROWS: ScopeRow[] = [
  {
    block: "Identity & Access",
    subject: (e) => (e.users > 0 ? `${plural(e.users, "person", "people")} who log in` : "every person who logs in"),
    question: "Who can reach what — and is it proven each time, or assumed?",
  },
  {
    block: "Endpoint",
    subject: (e) => (e.devices > 0 ? plural(e.devices, "computer", "computers") : "every computer"),
    question: "Is each one patched, encrypted, and recoverable if it is lost tomorrow?",
  },
  {
    block: "Email & Collaboration",
    subject: (e) => (e.users > 0 ? plural(e.users, "inbox", "inboxes") : "every inbox"),
    question: "Where would a convincing message land, and what happens in the minute after?",
  },
  {
    block: "Browser & Web",
    subject: (e) => (e.users > 0 ? `${plural(e.users, "browser", "browsers")} open all day` : "the browsers open all day"),
    question: "What can be reached from inside them, and what should not be?",
  },
  {
    block: "Network",
    subject: (e) => (e.sites > 0 ? plural(e.sites, "site", "sites") : "each site"),
    question: "What connects them, and what is exposed at every edge?",
  },
  {
    block: "Detection & Response",
    subject: () => "the moment something is wrong",
    question: "Who sees it first, and who owns the next hour?",
  },
  {
    block: "Human Risk",
    subject: (e) =>
      e.users > 0
        ? `${plural(e.users, "person", "people")} deciding under pressure`
        : "every person deciding under pressure",
    question: "What have they been shown, and what would they do on a bad day?",
  },
  {
    block: "Risk & Exposure",
    subject: () => "right now, not at the last review",
    question: "What changed since anyone last looked?",
  },
];

export function V4ScopeChapter() {
  const env = useEnvironmentDraft();
  const personal = environmentStarted(env);

  return (
    <Chapter
      id="v4-ch3"
      n="03"
      eyebrow="Before anything is proposed"
      heading="We do not promise outcomes before we understand the environment."
      lede="Any provider can list the same services. The difference is whether they looked first. This is what the assessment looks at — sized to what you told the page above."
      testId="v4-scope"
    >
      <div
        className="mt-12 border-t border-white/15"
        data-testid="v4-scope-sheet"
        data-personal={personal ? "true" : "false"}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3 font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">
          <span>Assessment scope</span>
          <span className={personal ? "text-[#F04C97]" : ""}>
            {personal
              ? `for ${env.users || "—"} people · ${env.devices || "—"} computers · ${env.sites || "—"} ${env.sites === 1 ? "site" : "sites"}`
              : "for an environment like yours"}
          </span>
        </div>

        <ol className="divide-y divide-white/10 border-t border-white/10">
          {ROWS.map((row, i) => (
            <li
              key={row.block}
              className="grid gap-x-8 gap-y-1.5 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)_minmax(0,2fr)] sm:items-baseline"
              data-testid={`v4-scope-row-${i + 1}`}
            >
              {/* The subject brightens once it carries the visitor's own number. */}
              <p
                className={`font-mono text-[12.5px] tabular-nums transition-colors duration-500 ${
                  personal ? "text-[#F7F5F2]" : "text-white/55"
                }`}
              >
                <span className="mr-3 text-white/50">{String(i + 1).padStart(2, "0")}</span>
                {row.subject(env)}
              </p>
              <p className="font-['Space_Grotesk',sans-serif] text-[clamp(1.05rem,1.6vw,1.3rem)] font-bold leading-snug text-[#F7F5F2]">
                {row.question}
              </p>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-white/55 sm:text-right">
                {row.block}
              </p>
            </li>
          ))}
        </ol>

        <div className="border-t border-white/15 pt-6 sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,7fr)] sm:gap-x-8">
          <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-white/55">Then</p>
          <p className="mt-2 max-w-[56ch] text-[15.5px] leading-relaxed text-white/60 sm:mt-0">
            You get the findings in plain English, and you keep them whichever way you go —
            including the way where the answer is that you do not need us for this.
          </p>
        </div>
      </div>
    </Chapter>
  );
}

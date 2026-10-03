// Shared content constants. Prices, inclusions and the scope note come from
// client/src/data/pricing.ts; contact details from shared/companyContact.ts.
import { PRICING_SCOPE_NOTE, pricing, type ProActiveTierKey } from "../../../client/src/data/pricing";
import { TOKENS as T } from "../system/styles.mts";

export const EDITION = "2026.10";
export const SITE = "https://digeratiexperts.com";

export const BOOK = { href: `${SITE}/book`, hrefLabel: "digeratiexperts.com/book" };
export const SLA = { href: `${SITE}/legal/sla`, label: "digeratiexperts.com/legal/sla" };

export const NO_NAMES = "This document names no customers and makes no vendor-specific claims.";
export const PRICE_NOTE = `${PRICING_SCOPE_NOTE.replace(" — ", "; ")} ${NO_NAMES}`;
export const SCOPE_NOTE =
  "Final service scope depends on assessment results, user count, endpoints, sites, compliance needs, backup scope and selected add-ons. " + NO_NAMES;

export const money = (n: number) => `$${n.toLocaleString("en-US")}`;
export const tierPrice = (k: ProActiveTierKey) =>
  `From ${money(pricing[k].user)} per user per month, with a ${money(pricing[k].monthlyMinimum)} monthly minimum.`;

/** Move-up triggers between levels, aligned to pricing.ts inclusions. */
export const MOVE_UP = {
  office:
    "Onboarding, productivity platforms, a managed network, endpoint backup and 24/7 managed detection and response become important.",
  business:
    "The organization needs backup and disaster recovery posture, compliance and risk reporting, and semi-annual planning reviews.",
  enterprise:
    "Multiple sites, regulated data, advanced compliance reporting, privileged access controls or quarterly executive reviews are required.",
};

/** Cyber Risk Assessment → recommendation → onboarding → operations (claims register, "How it works"). */
export const ENGAGEMENT = [
  { step: "Cyber Risk Assessment", detail: "Finds risk, gaps and current conditions." },
  { step: "Written recommendation", detail: "One of four ProActive models, with scope." },
  { step: "Onboarding", detail: "Access, inventory and baseline established." },
  { step: "Ongoing operations", detail: "Support, security and reviews at the level's cadence." },
];

// ---------- diagrams ----------
const txt = (x: number, y: number, s: string, o: Record<string, string | number> = {}) =>
  `<text x="${x}" y="${y}" font-family="${o.f ?? "Inter"}" font-size="${o.size ?? 7.4}" font-weight="${o.w ?? 400}" fill="${o.fill ?? T.ink2}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${s}</text>`;

/** RPO / RTO on one timeline — a definitional diagram, no figures. */
export const RECOVERY_TIMELINE = (() => {
  const W = 400, y = 52;
  const xB = 40, xI = 200, xR = 360;
  let g = `<line x1="10" y1="${y}" x2="${W - 10}" y2="${y}" stroke="${T.ink}" stroke-width="1.2"/>`;
  g += `<rect x="${xB}" y="${y - 20}" width="${xI - xB}" height="10" fill="${T.paper}" stroke="${T.ink}" stroke-width=".8"/>`;
  g += `<rect x="${xI}" y="${y - 20}" width="${xR - xI}" height="10" fill="${T.ink}"/>`;
  g += txt((xB + xI) / 2, y - 25, "RPO · data you can afford to lose", { anchor: "middle", w: 600, fill: T.ink });
  g += txt((xI + xR) / 2, y - 25, "RTO · downtime you can tolerate", { anchor: "middle", w: 600, fill: T.ink });
  for (const [x, a, b] of [[xB, "Last good backup", "restore point"], [xI, "Disruption", "ransomware, deletion, outage"], [xR, "Operating again", "systems restored"]] as const) {
    g += `<circle cx="${x}" cy="${y}" r="3.4" fill="${x === xI ? T.mag : T.ink}"/>`;
    g += txt(x, y + 15, a, { anchor: "middle", w: 600, fill: T.ink, size: 7.6 });
    g += txt(x, y + 25, b, { anchor: "middle", size: 6.8 });
  }
  return `<svg viewBox="0 0 ${W} ${y + 32}" width="100%" aria-hidden="true">${g}</svg>`;
})();
export const RECOVERY_TIMELINE_ALT =
  "Timeline. On the left, the last good backup. In the middle, the disruption. On the right, operating again. The span from last good backup to disruption is the RPO, the data you can afford to lose. The span from disruption to operating again is the RTO, the downtime you can tolerate.";

/** Co-managed: two lanes joined by a defined boundary. Labels come from the datasheet's own roles and rules. */
export const COMANAGED_LANES = (() => {
  const W = 512, H = 168;
  const lane = (y: number, title: string, sub: string, items: string[], dark: boolean) => {
    let g = `<rect x="0" y="${y}" width="${W}" height="52" fill="${dark ? T.ink : T.tint}" stroke="${T.ink}" stroke-width="${dark ? 0 : 0.8}"/>`;
    g += txt(10, y + 18, title, { f: "Space Grotesk", w: 600, size: 10, fill: dark ? "#fff" : T.ink });
    g += txt(10, y + 31, sub, { size: 7, fill: dark ? "#d9d7df" : T.ink2 });
    const cw = 88, x0 = W - items.length * (cw + 6);
    items.forEach((it, i) => {
      const x = x0 + i * (cw + 6);
      g += `<rect x="${x}" y="${y + 9}" width="${cw}" height="34" fill="${dark ? "#1b1826" : "#fff"}" stroke="${dark ? "#4a4658" : T.rule}" stroke-width=".7"/>`;
      it.split("|").forEach((ln, j) => (g += txt(x + 6, y + 22 + j * 9, ln, { size: 6.9, fill: dark ? "#fff" : T.ink })));
    });
    return g;
  };
  let g = lane(0, "Your internal IT", "Day-to-day owner where assigned", ["Daily operations|you already run", "Approvals for|assigned systems"], false);
  g += `<line x1="0" y1="84" x2="${W}" y2="84" stroke="${T.mag}" stroke-width="1.4" stroke-dasharray="5 3"/>`;
  g += txt(W / 2, 80, "Authority boundaries defined before work starts · responsibility matrix · escalation map", { anchor: "middle", w: 600, fill: T.ink, size: 7.2 });
  g += lane(98, "Digerati Experts", "Specialized roles, by scope", ["Security assessment|and roadmap", "Threat detection|and escalation", "Backup, BCDR and|recovery planning", "Project|execution"], true);
  return `<svg viewBox="0 0 ${W} ${H - 18}" width="100%" aria-hidden="true">${g}</svg>`;
})();
export const COMANAGED_ALT =
  "Two lanes. Top lane: your internal IT, the day-to-day owner where assigned, running daily operations and approvals for assigned systems. Bottom lane: Digerati Experts, providing specialized roles by scope: security assessment and roadmap, threat detection coordination and escalation, backup, BCDR and recovery planning, and project execution. Between them, a defined boundary: authority boundaries agreed before work starts, a responsibility matrix and an escalation map.";

/** QBR cadence: reviews per year by level, from pricing.ts inclusions. No dates implied. */
export const QBR_CADENCE = (() => {
  const W = 512, x0 = 120, x1 = W - 10;
  const row = (y: number, label: string, sub: string, n: number) => {
    let g = txt(0, y + 4, label, { f: "Space Grotesk", w: 600, size: 9.5, fill: T.ink }) + txt(0, y + 14, sub, { size: 6.8 });
    g += `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" stroke="${T.rule}" stroke-width="1"/>`;
    for (let i = 0; i < n; i++) {
      const x = x0 + ((x1 - x0) * (i + 0.5)) / n;
      g += `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${T.ink}"/>`;
    }
    return g;
  };
  let g = txt(x0, 8, "ONE YEAR", { f: "Plex Mono", size: 6.4, fill: T.muted }) + txt(x1, 8, "→", { f: "Plex Mono", size: 6.4, fill: T.muted, anchor: "end" });
  g += row(28, "ProActive Office", "Annual technology + cyber review", 1);
  g += row(56, "ProActive Business", "Semi-annual reviews", 2);
  g += row(84, "ProActive Enterprise", "Quarterly executive reviews", 4);
  return `<svg viewBox="0 0 ${W} 100" width="100%" aria-hidden="true">${g}</svg>`;
})();
export const QBR_CADENCE_ALT =
  "Review cadence across one year: ProActive Office, one annual technology and cyber review; ProActive Business, two semi-annual reviews; ProActive Enterprise, four quarterly executive reviews.";

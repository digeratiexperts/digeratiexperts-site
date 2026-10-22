/**
 * The session marketing kits: outputs match their YAML, copy passes the truth
 * lint, and facts come from deEvents.ts rather than from the copy.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { dateLong, fill, lint, loadKits, renderAll, ROOT, timeIn, tokensFor } from "./render";
import { sessionBySlug } from "../../client/src/data/deEvents";

const kits = loadKits();

describe("session marketing kits", () => {
  it("has a kit for every source file, each tied to a real session", () => {
    expect(kits.length).toBeGreaterThan(0);
    for (const k of kits) expect(sessionBySlug(k.src.slug)).toBeDefined();
  });

  it("passes the copy lint (CLAIMS-REGISTER, VOICE.md)", () => {
    expect(kits.flatMap(lint)).toEqual([]);
  });

  it("committed outputs are fresh (run: npx tsx scripts/de-marketing/build.ts)", () => {
    const stale = [...renderAll(kits)].filter(([rel, content]) => {
      const abs = resolve(ROOT, rel);
      return !existsSync(abs) || readFileSync(abs, "utf8") !== content;
    });
    expect(stale.map(([rel]) => rel)).toEqual([]);
  });

  it("has both card sizes for every card", () => {
    for (const k of kits)
      for (const c of k.src.cards)
        for (const size of ["1200x627", "1080x1080"])
          expect(existsSync(resolve(ROOT, `docs/marketing/sessions/out/${k.src.slug}/cards/${c.id}-${size}.png`)), `${c.id}-${size}`).toBe(true);
  });

  it("puts the join link placeholder only in the T-1 email", () => {
    for (const k of kits) {
      const t1 = new Date(`${k.session.start.slice(0, 10)}T12:00:00Z`);
      t1.setUTCDate(t1.getUTCDate() - 1);
      for (const e of k.src.emails)
        if (e.body.includes("[JOIN LINK]")) expect(e.send, `${k.src.slug} ${e.id}`).toBe(t1.toISOString().slice(0, 10));
    }
  });
});

describe("lint", () => {
  const kit = kits[0];
  const withBody = (body: string) => ({ ...kit, src: { ...kit.src, emails: [{ ...kit.src.emails[0], body }] } });

  it("rejects statistics, superlatives and un-negated guarantees", () => {
    expect(lint(withBody("Over 60% of firms fail."))).not.toEqual([]);
    expect(lint(withBody("The best protection money can buy."))).not.toEqual([]);
    expect(lint(withBody("We guarantee approval."))).not.toEqual([]);
    expect(lint(withBody("Most businesses get this wrong."))).not.toEqual([]);
  });

  it("allows a negated guarantee and a join link only on the day before", () => {
    expect(lint(withBody("We cannot guarantee coverage."))).toEqual([]);
    expect(lint(withBody("Join: [JOIN LINK]"))).not.toEqual([]);
  });
});

describe("tokens", () => {
  it("fill session facts and reject unknown tokens", () => {
    const s = sessionBySlug("cyber-insurance-renewal-readiness")!;
    const t = tokensFor(s);
    expect(t.date_long).toBe("Thursday 5 November");
    expect(t.time).toBe("11:00 AM");
    expect(t.page).toBe("https://digeratiexperts.com/events/cyber-insurance-renewal-readiness");
    expect(() => fill("{nope}", t, "test")).toThrow(/unknown token/);
  });

  it("computes other zones after US daylight saving ends (Phoenix never shifts)", () => {
    const nov = new Date("2026-11-05T11:00:00-07:00");
    expect(timeIn(nov, "America/Denver")).toBe("11:00 AM");
    expect(timeIn(nov, "America/New_York")).toBe("1:00 PM");
    const oct = new Date("2026-10-29T11:00:00-07:00");
    expect(timeIn(oct, "America/New_York")).toBe("2:00 PM");
    expect(dateLong(nov)).toBe("Thursday 5 November");
  });
});

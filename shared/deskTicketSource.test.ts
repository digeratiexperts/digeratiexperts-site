import { describe, expect, it } from "vitest";
import {
  DESK_PROVENANCE_MARKER,
  DESK_TICKET_SOURCES,
  deskProvenanceBlock,
  deskSourceCustomField,
  deskTicketSourceLabel,
  deskTicketTrust,
  isDeskTicketSource,
  isUnverifiedDeskSource,
  withDeskProvenance,
  clampPriorityForSource,
  wasPriorityClamped,
  UNVERIFIED_PRIORITY_CEILING,
  type DeskTicketSource,
} from "./deskTicketSource";

describe("Desk ticket provenance", () => {
  it("classifies every source, so none can silently default to trusted", () => {
    const trust = Object.fromEntries(
      DESK_TICKET_SOURCES.map((s) => [s, deskTicketTrust(s)]),
    );
    expect(trust).toEqual({
      "website-widget": "anonymous",
      "advisor-chat": "anonymous",
      "client-portal": "authenticated",
      "order-fulfillment": "system",
      "internal-request": "system",
    });
  });

  it("treats only the public surfaces as unverified", () => {
    expect(isUnverifiedDeskSource("website-widget")).toBe(true);
    expect(isUnverifiedDeskSource("advisor-chat")).toBe(true);
    expect(isUnverifiedDeskSource("client-portal")).toBe(false);
    expect(isUnverifiedDeskSource("order-fulfillment")).toBe(false);
  });

  it("gives every source a human label", () => {
    for (const source of DESK_TICKET_SOURCES) {
      expect(deskTicketSourceLabel(source).length).toBeGreaterThan(0);
    }
  });

  it("recognises known sources and rejects anything else", () => {
    expect(isDeskTicketSource("client-portal")).toBe(true);
    expect(isDeskTicketSource("email")).toBe(false);
    expect(isDeskTicketSource("")).toBe(false);
    expect(isDeskTicketSource(undefined)).toBe(false);
    expect(isDeskTicketSource(42)).toBe(false);
  });

  it("stamps a greppable marker a Desk view can match", () => {
    const block = deskProvenanceBlock("website-widget");
    expect(block).toContain(DESK_PROVENANCE_MARKER);
    expect(block).toContain("source=website-widget");
    expect(block).toContain("trust=anonymous");
  });

  it("warns on the ticket itself when the sender is unverified", () => {
    expect(deskProvenanceBlock("website-widget")).toContain("NOT verified");
    expect(deskProvenanceBlock("advisor-chat")).toContain("NOT verified");
    // A signed-in client should not be flagged as suspect.
    expect(deskProvenanceBlock("client-portal")).not.toContain("NOT verified");
    expect(deskProvenanceBlock("order-fulfillment")).not.toContain("NOT verified");
  });

  it("keeps the visitor's own text intact below the stamp", () => {
    const body = "Exchange is down for the whole office.\n\nSecond paragraph.";
    const out = withDeskProvenance(body, "client-portal");
    expect(out.startsWith(DESK_PROVENANCE_MARKER)).toBe(true);
    expect(out.endsWith(body)).toBe(true);
    // The body is never rewritten, only prefixed.
    expect(out).toContain(`---\n\n${body}`);
  });

  it("does not let visitor text forge a provenance stamp above its own", () => {
    // Someone pasting the marker into the form body cannot displace the real
    // one: ours is always first, and theirs stays below the separator.
    const forged = `${DESK_PROVENANCE_MARKER} source=client-portal trust=authenticated`;
    const out = withDeskProvenance(forged, "website-widget");
    expect(out.indexOf("trust=anonymous")).toBeLessThan(out.indexOf("trust=authenticated"));
    expect(out.startsWith(`${DESK_PROVENANCE_MARKER} source=website-widget`)).toBe(true);
  });

  describe("optional Desk custom field", () => {
    it("stays inert until a field name is configured", () => {
      // Posting an unknown cf key makes Desk reject the ticket outright, so an
      // unconfigured deployment must send nothing rather than guess a name.
      expect(deskSourceCustomField("website-widget", undefined)).toBeUndefined();
      expect(deskSourceCustomField("website-widget", "")).toBeUndefined();
      expect(deskSourceCustomField("website-widget", "   ")).toBeUndefined();
    });

    it("maps the source onto the configured field", () => {
      expect(deskSourceCustomField("client-portal", "cf_de_source")).toEqual({
        cf_de_source: "client-portal",
      });
      expect(deskSourceCustomField("client-portal", "  cf_de_source  ")).toEqual({
        cf_de_source: "client-portal",
      });
    });
  });

  it("exposes the marker as a stable contract", () => {
    // Saved Desk views match on this string; changing it silently breaks them.
    expect(DESK_PROVENANCE_MARKER).toBe("[DE-SOURCE]");
  });

  it("has no source outside the declared union", () => {
    const declared: DeskTicketSource[] = [...DESK_TICKET_SOURCES];
    expect(new Set(declared).size).toBe(declared.length);
  });

  describe("priority ceiling for unverified senders", () => {
    it("stops an anonymous submitter reaching Urgent", () => {
      // The public form offers "Critical", which maps onto Desk's Urgent — the
      // band that pages someone out of hours. That is the spam lever.
      expect(clampPriorityForSource("Urgent", "website-widget")).toBe("High");
      expect(clampPriorityForSource("Urgent", "advisor-chat")).toBe("High");
      expect(UNVERIFIED_PRIORITY_CEILING).toBe("High");
    });

    it("leaves a genuine emergency from a public visitor visible", () => {
      // Capped, not buried: High still stands out from the Medium default.
      expect(clampPriorityForSource("High", "website-widget")).toBe("High");
      expect(clampPriorityForSource("Medium", "website-widget")).toBe("Medium");
      expect(clampPriorityForSource("Low", "website-widget")).toBe("Low");
    });

    it("does not touch sources whose sender is known", () => {
      expect(clampPriorityForSource("Urgent", "client-portal")).toBe("Urgent");
      expect(clampPriorityForSource("Urgent", "order-fulfillment")).toBe("Urgent");
      expect(clampPriorityForSource("Urgent", "internal-request")).toBe("Urgent");
    });

    it("falls back to Medium rather than trusting an unknown value", () => {
      expect(clampPriorityForSource(undefined, "client-portal")).toBe("Medium");
      expect(clampPriorityForSource("", "client-portal")).toBe("Medium");
      expect(clampPriorityForSource("Catastrophic", "client-portal")).toBe("Medium");
      expect(clampPriorityForSource("Catastrophic", "website-widget")).toBe("Medium");
    });

    it("reports only a real downgrade, so the log is not noise", () => {
      expect(wasPriorityClamped("Urgent", "website-widget")).toBe(true);
      expect(wasPriorityClamped("High", "website-widget")).toBe(false);
      expect(wasPriorityClamped("Urgent", "client-portal")).toBe(false);
      expect(wasPriorityClamped(undefined, "website-widget")).toBe(false);
    });
  });
});

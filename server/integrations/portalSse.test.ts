import { describe, expect, it } from "vitest";
import { portalEventVisibleTo } from "./portalSse";

const clientA = { role: "user", clientId: "client-a", hubAccountId: "hub-a" };
const clientB = { role: "user", clientId: "client-b", hubAccountId: "hub-b" };

describe("portalEventVisibleTo", () => {
  it("keeps another account's event off a client stream", () => {
    expect(
      portalEventVisibleTo(clientA, {
        eventType: "account.updated",
        entityId: "client-b",
        canonicalAccountId: "hub-b",
      }),
    ).toBe(false);
    expect(
      portalEventVisibleTo(clientB, {
        eventType: "account.updated",
        entityId: "client-b",
        canonicalAccountId: "hub-b",
      }),
    ).toBe(true);
  });

  it("still shares catalog events and lets an admin see account events", () => {
    expect(
      portalEventVisibleTo(clientA, {
        eventType: "catalog.published",
        entityId: "catalog",
        canonicalAccountId: null,
      }),
    ).toBe(true);
    expect(
      portalEventVisibleTo(
        { role: "admin", clientId: null, hubAccountId: null },
        { eventType: "account.updated", entityId: "client-b", canonicalAccountId: "hub-b" },
      ),
    ).toBe(true);
  });

  it("hides an event that has no tenant when the viewer is not an admin", () => {
    expect(
      portalEventVisibleTo(clientA, {
        eventType: "document.updated",
        entityId: "doc-1",
        canonicalAccountId: null,
      }),
    ).toBe(false);
  });
});

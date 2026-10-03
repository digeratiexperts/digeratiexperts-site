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

  it("fails closed when the canonical account contradicts the entity-id fallback (#238)", () => {
    expect(
      portalEventVisibleTo(clientA, {
        eventType: "account.updated",
        entityId: "client-a",
        canonicalAccountId: "hub-b",
      }),
    ).toBe(false);
  });

  it("hides a canonical-scoped event from a viewer with no Hub account, even on a client-id match", () => {
    expect(
      portalEventVisibleTo(
        { role: "user", clientId: "client-a", hubAccountId: null },
        { eventType: "account.updated", entityId: "client-a", canonicalAccountId: "hub-a" },
      ),
    ).toBe(false);
  });

  it("still routes a legacy event with no canonical account by client id", () => {
    expect(
      portalEventVisibleTo(clientA, { eventType: "account.updated", entityId: "client-a", canonicalAccountId: null }),
    ).toBe(true);
    expect(
      portalEventVisibleTo(clientA, { eventType: "account.updated", entityId: "client-b" }),
    ).toBe(false);
  });
});

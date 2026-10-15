import { describe, expect, it } from "vitest";
import { groupsRepresentedBy, publicGroupView, representationProjectionSchema, type RepresentationProjection } from "./representation";

const projection: RepresentationProjection = {
  contract: "client-org-representation/v1",
  accountId: 9,
  model: "site",
  active: true,
  generatedAt: "2026-10-14T00:00:00.000Z",
  groups: [
    {
      scopeKey: "site:1",
      kind: "site",
      name: "HQ",
      portalRefs: [],
      representatives: [
        { role: "primary", displayName: "Pat", email: "pat@x.test", portalUserId: "p-1", communicationScopes: ["group_requests"], responsibilities: [], effectiveUntil: null },
        { role: "backup", displayName: "Sam", email: "sam@x.test", portalUserId: null, communicationScopes: ["group_concerns"], responsibilities: [], effectiveUntil: "2026-10-13" },
      ],
    },
  ],
};

describe("representation contract", () => {
  it("validates the Hub payload and rejects other contracts or extra shapes", () => {
    expect(representationProjectionSchema.safeParse(projection).success).toBe(true);
    expect(representationProjectionSchema.safeParse({ ...projection, contract: "v2" }).success).toBe(false);
    expect(representationProjectionSchema.safeParse({ ...projection, groups: [{ ...projection.groups[0], scopeKey: "site:1 OR 1=1" }] }).success).toBe(false);
  });

  it("matches by Portal user id, ignores email when the Hub names a different Portal user", () => {
    expect(groupsRepresentedBy(projection, { id: "p-1", email: "other@x.test" }, "2026-10-14")).toHaveLength(1);
    expect(groupsRepresentedBy(projection, { id: "p-9", email: "pat@x.test" }, "2026-10-14")).toHaveLength(0);
  });

  it("re-checks the end date and the active flag", () => {
    expect(groupsRepresentedBy(projection, { id: "s-1", email: "SAM@x.test" }, "2026-10-14")).toHaveLength(0);
    expect(groupsRepresentedBy(projection, { id: "s-1", email: "SAM@x.test" }, "2026-10-13")).toHaveLength(1);
    expect(groupsRepresentedBy({ ...projection, active: false }, { id: "p-1", email: null }, "2026-10-14")).toHaveLength(0);
    expect(groupsRepresentedBy(null, { id: "p-1", email: null }, "2026-10-14")).toHaveLength(0);
  });

  it("exposes only allowed kinds and names of co-representatives", () => {
    const [g] = groupsRepresentedBy(projection, { id: "p-1", email: null }, "2026-10-14");
    const view = publicGroupView(g);
    expect(view.allowedKinds).toEqual(["group_request"]);
    expect(JSON.stringify(view)).not.toContain("@x.test");
  });
});

/**
 * Enforcement for the Account Lifecycle Status disclosure boundary.
 *
 * See docs/ACCOUNT-LIFECYCLE-STATUS.md. Account Lifecycle Status is internal
 * classification: governed everywhere, displayed nowhere client-facing. These
 * tests exist so the rule fails CI instead of relying on a reviewer noticing.
 *
 * The serializer tests feed each client-bound serializer a source record that
 * is deliberately polluted with lifecycle fields — the shape a future schema
 * addition or a Hub sync would produce. An allowlist serializer drops them. A
 * serializer that starts spreading its source (`...user`) will fail here.
 *
 * When you add a client-scoped serializer, add it to CLIENT_BOUND_SERIALIZERS.
 */
import { describe, expect, it } from "vitest";
import { orgPublicUser } from "../portalOrg";
import {
  ACCOUNT_LIFECYCLE_STATUSES,
  assertNoLifecycleDisclosure,
  findLifecycleDisclosures,
} from "./tenantIdentity";

/** A portal user record carrying every lifecycle field shape we might inherit. */
const pollutedUser = {
  id: "user-1",
  email: "person@acme.example",
  fullName: "Test Person",
  role: "user",
  orgRole: "staff",
  clientId: "client-acme",
  departmentId: null,
  managerUserId: null,
  isCompanyItContact: false,
  // Everything below must never reach a client.
  accountLifecycleStatus: "At Risk",
  lifecycle_status: "Do Not Engage",
  hubLifecycle: "disqualified",
  account: { lifecycle: "Suspect", name: "Acme" },
} as any;

const CLIENT_BOUND_SERIALIZERS: Array<{ name: string; run: () => unknown }> = [
  { name: "orgPublicUser", run: () => orgPublicUser(pollutedUser) },
];

describe("Account Lifecycle Status — disclosure boundary", () => {
  describe("client-bound serializers", () => {
    for (const { name, run } of CLIENT_BOUND_SERIALIZERS) {
      it(`${name} does not disclose lifecycle even when its source carries it`, () => {
        const output = run();
        expect(findLifecycleDisclosures(output)).toEqual([]);
        expect(() => assertNoLifecycleDisclosure(output, name)).not.toThrow();
      });
    }

    it("proves the fixture would trip the guard if a serializer passed it through", () => {
      // Guards the guard: if this stops failing, the fixture has gone stale and
      // the serializer tests above would pass vacuously.
      expect(findLifecycleDisclosures(pollutedUser).length).toBeGreaterThan(0);
    });
  });

  describe("findLifecycleDisclosures", () => {
    it("flags any lifecycle-named key regardless of its value", () => {
      const found = findLifecycleDisclosures({ accountLifecycleStatus: "anything" });
      expect(found).toEqual([
        { path: "$.accountLifecycleStatus", reason: "key", found: "accountLifecycleStatus" },
      ]);
    });

    it("matches key names across casing and separator styles", () => {
      for (const key of ["lifecycle_status", "LifecycleStatus", "hub-lifecycle", "lifecycle"]) {
        expect(findLifecycleDisclosures({ [key]: "x" })).toHaveLength(1);
      }
    });

    it("flags unambiguous lifecycle values under an innocuous key", () => {
      const found = findLifecycleDisclosures({ badge: "Do Not Engage" });
      expect(found).toEqual([{ path: "$.badge", reason: "value", found: "Do Not Engage" }]);
    });

    it("finds disclosures nested in objects and arrays", () => {
      const found = findLifecycleDisclosures({
        clients: [{ name: "Acme", tags: ["At Risk"] }],
      });
      expect(found).toEqual([
        { path: "$.clients[0].tags[0]", reason: "value", found: "At Risk" },
      ]);
    });

    it("does not fire on legitimate client-visible values that merely collide", () => {
      // A portal user account is "active"; a request is "pending"; storeRole is
      // "prospect". None of these disclose the account's lifecycle.
      const clean = {
        user: { status: "active", storeRole: "prospect" },
        request: { state: "pending" },
        subscription: { state: "paused" },
      };
      expect(findLifecycleDisclosures(clean)).toEqual([]);
    });

    it("survives a circular payload without hanging", () => {
      const node: any = { name: "Acme" };
      node.self = node;
      expect(() => findLifecycleDisclosures(node)).not.toThrow();
    });

    it("returns clean for a normal portal payload", () => {
      expect(
        findLifecycleDisclosures({
          success: true,
          user: { id: "u1", email: "a@b.example", role: "user", clientId: "c1" },
        }),
      ).toEqual([]);
    });
  });

  describe("assertNoLifecycleDisclosure", () => {
    it("throws with the offending path and points at the governing doc", () => {
      expect(() => assertNoLifecycleDisclosure({ chip: "Disqualified" }, "dashboard")).toThrow(
        /dashboard.*\$\.chip.*ACCOUNT-LIFECYCLE-STATUS\.md/s,
      );
    });

    it("passes a clean payload", () => {
      expect(() => assertNoLifecycleDisclosure({ ok: true })).not.toThrow();
    });
  });

  describe("canonical vocabulary", () => {
    it("carries exactly the 13 canonical v1.1 values in canonical order", () => {
      expect([...ACCOUNT_LIFECYCLE_STATUSES]).toEqual([
        "Suspect",
        "Prospect",
        "Tentative",
        "Pending",
        "Onboarding",
        "Active",
        "Paused",
        "At Risk",
        "Offboarding",
        "Inactive",
        "Former",
        "Disqualified",
        "Do Not Engage",
      ]);
    });

    it("treats every high-sensitivity value as a disclosure under any key", () => {
      // These six are absolute per the Source of Truth.
      for (const value of ["Suspect", "At Risk", "Offboarding", "Disqualified", "Do Not Engage"]) {
        expect(findLifecycleDisclosures({ label: value })).toHaveLength(1);
      }
    });
  });
});

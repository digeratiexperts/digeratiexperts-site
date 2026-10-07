import { describe, expect, it } from "vitest";
import {
  checkCompanyPersonId,
  companyIdPatternToRegex,
  defaultOrgProfile,
  deriveIdPrefix,
  displayPersonId,
  formatDePersonId,
  parseCsv,
  planImport,
  resolveApprovers,
  resolveContactPlan,
  resolveUnit,
} from "./orgDirectory";

const ann = { userId: "u-ann", name: "Ann", email: "ann@acme.test" };
const lee = { userId: "u-lee", name: "Lee Leader", email: "lee@acme.test", awayUntil: null };
const bea = { userId: "u-bea", name: "Bea Backup", email: "bea@acme.test", awayUntil: null };
const ivy = { userId: "u-ivy", name: "Ivy IT", email: "ivy@acme.test", awayUntil: null };
const unit = { kind: "site" as const, id: "s1", name: "AZ76" };

describe("IDs", () => {
  it("derives a prefix from the company name and formats DE IDs", () => {
    expect(deriveIdPrefix("Acme Corp")).toBe("ACME");
    expect(deriveIdPrefix("Northwind Traders Inc")).toBe("NT");
    expect(deriveIdPrefix("3M")).toMatch(/^[A-Z]{2}$/);
    expect(formatDePersonId("ACME", 42)).toBe("ACME-00042");
  });

  it("checks company IDs against a simple naming rule", () => {
    expect(companyIdPatternToRegex("E#####")!.test("E00123")).toBe(true);
    expect(companyIdPatternToRegex("E#####")!.test("E0012")).toBe(false);
    expect(companyIdPatternToRegex("AA-###")!.test("NY-001")).toBe(true);
    expect(companyIdPatternToRegex("")).toBeNull();
    const profile = { companyIdPattern: "E#####", companyIdLabel: "Employee ID" };
    expect(checkCompanyPersonId(profile, "E00123")).toBeNull();
    expect(checkCompanyPersonId(profile, "X1")).toMatch(/look like E#####/);
    expect(checkCompanyPersonId(profile, "E0<script>")).toMatch(/letters, digits/);
  });

  it("shows the company ID only when the company chose its own scheme and the person has one", () => {
    const person = { dePersonId: "ACME-00001", companyPersonId: "E00123" };
    expect(displayPersonId({ idScheme: "company" }, person)).toBe("E00123");
    expect(displayPersonId({ idScheme: "de" }, person)).toBe("ACME-00001");
    expect(displayPersonId({ idScheme: "company" }, { ...person, companyPersonId: null })).toBe("ACME-00001");
  });
});

describe("resolveUnit", () => {
  it("uses the person's site, else the request's site; department structure uses the department", () => {
    expect(resolveUnit({ profile: { structure: "site" }, person: { siteId: "s1" }, departmentId: "d1", requestSiteId: "s2" })).toEqual({ kind: "site", id: "s1" });
    expect(resolveUnit({ profile: { structure: "site" }, person: { siteId: null }, departmentId: null, requestSiteId: "s2" })).toEqual({ kind: "site", id: "s2" });
    expect(resolveUnit({ profile: { structure: "department" }, person: { siteId: "s1" }, departmentId: "d1", requestSiteId: null })).toEqual({ kind: "department", id: "d1" });
    expect(resolveUnit({ profile: { structure: "department" }, person: null, departmentId: null, requestSiteId: "s1" })).toBeNull();
  });
});

describe("resolveContactPlan", () => {
  const base = { personId: "ACME-00001", primary: ann, phone: "602", today: "2026-10-06", unit, leader: lee, backup: bea, ccLeader: true };

  it("contacts a standard user directly, falls back to the leader, and copies the leader", () => {
    const plan = resolveContactPlan({ ...base, tier: "standard", awayUntil: null });
    expect(plan.fallback).toMatchObject({ userId: "u-lee", role: "leader" });
    expect(plan.cc).toEqual([{ userId: "u-lee", name: "Lee Leader", email: "lee@acme.test" }]);
    expect(plan.summary).toMatch(/directly; if unavailable, go to Lee Leader/);
  });

  it("gives a VIP direct support only: no fallback, no copy", () => {
    const plan = resolveContactPlan({ ...base, tier: "vip", awayUntil: null });
    expect(plan.fallback).toBeNull();
    expect(plan.cc).toEqual([]);
    expect(plan.summary).toMatch(/^VIP/);
  });

  it("goes to the backup when the leader is away, and says so when the person is away", () => {
    const plan = resolveContactPlan({ ...base, tier: "standard", awayUntil: "2026-10-10", leader: { ...lee, awayUntil: "2026-10-08" } });
    expect(plan.fallback).toMatchObject({ userId: "u-bea", role: "backup_leader" });
    expect(plan.summary).toMatch(/away until 2026-10-10/);
  });

  it("never names the person as their own fallback, and respects the copy setting", () => {
    const plan = resolveContactPlan({ ...base, tier: "standard", awayUntil: null, primary: { userId: "u-lee", name: "Lee Leader", email: "lee@acme.test" }, ccLeader: false });
    expect(plan.fallback?.userId).toBe("u-bea");
    expect(plan.cc).toEqual([]);
  });
});

describe("resolveApprovers", () => {
  const input = { requestedForUserId: "u-ann", today: "2026-10-06", leader: lee, backup: bea, manager: null, itContacts: [ivy] };

  it("orders leader, backup, manager, then IT contact for the leader rule", () => {
    expect(resolveApprovers({ ...input, rule: "leader" }).map((a) => a.role)).toEqual(["leader", "backup_leader", "it_contact"]);
  });

  it("uses only IT contacts for the IT contact rule", () => {
    expect(resolveApprovers({ ...input, rule: "it_contact" }).map((a) => a.userId)).toEqual(["u-ivy"]);
  });

  it("skips anyone away and the person the request is for", () => {
    const list = resolveApprovers({ ...input, rule: "leader", requestedForUserId: "u-lee", backup: { ...bea, awayUntil: "2026-10-06" } });
    expect(list.map((a) => a.userId)).toEqual(["u-ivy"]);
  });
});

describe("CSV import", () => {
  it("parses quoted fields, doubled quotes, CRLF and a BOM", () => {
    expect(parseCsv('﻿Email,Name\r\n"a@x.test","Smith, ""Jo"""\r\n\r\nb@x.test,B')).toEqual([
      ["Email", "Name"],
      ["a@x.test", 'Smith, "Jo"'],
      ["b@x.test", "B"],
    ]);
  });

  it("matches people by email and reports every problem per line", () => {
    const profile = { ...defaultOrgProfile("Acme"), companyIdPattern: "E#####" };
    const plan = planImport({
      rows: parseCsv(
        [
          "Email,Employee ID,Site,VIP",
          "ann@acme.test,E00001,AZ76,yes",
          "bob@acme.test,E00001,Nowhere,maybe",
          "nobody@acme.test,BAD,,",
          "cy@acme.test,E00009,,no",
        ].join("\n"),
      ),
      profile,
      users: [
        { id: "u-ann", email: "Ann@Acme.test", fullName: "Ann" },
        { id: "u-bob", email: "bob@acme.test", fullName: "Bob" },
        { id: "u-cy", email: "cy@acme.test", fullName: "Cy" },
      ],
      existingIds: new Map([["e00009", "u-ann"]]),
      units: [{ id: "s1", name: "Glendale", code: "AZ76" }],
    });
    const [a, b, c, d] = plan.rows;
    expect(a).toMatchObject({ userId: "u-ann", companyPersonId: "E00001", unitId: "s1", supportTier: "vip", errors: [] });
    expect(b.errors.join(" ")).toMatch(/also on line 2/);
    expect(b.errors.join(" ")).toMatch(/"Nowhere" was not found/);
    expect(b.errors.join(" ")).toMatch(/yes or no/);
    expect(c.errors.join(" ")).toMatch(/No portal user/);
    expect(c.errors.join(" ")).toMatch(/look like/);
    expect(d.errors.join(" ")).toMatch(/already belongs to someone else/);
  });

  it("needs an Email column", () => {
    const plan = planImport({ rows: [["Name"], ["Ann"]], profile: defaultOrgProfile("Acme"), users: [], existingIds: new Map(), units: [] });
    expect(plan.errors[0]).toMatch(/Email column/);
  });
});

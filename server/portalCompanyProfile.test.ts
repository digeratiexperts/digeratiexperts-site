import { describe, expect, it } from "vitest";
import { portalCompanyProfile, selectedPortalCompanyId } from "./portalCompanyProfile";

const clients = new Map([
  ["a", { id: "a", companyName: "EXAMPLE A", contactEmail: "a@example.invalid", hubAccountId: "internal-a", status: "client_active" }],
  ["b", { id: "b", companyName: "EXAMPLE B", contactEmail: "b@example.invalid" }],
]);
const alice = { id: "alice", clientId: "a", fullName: "EXAMPLE Alice", email: "alice@example.invalid", password: "never-serialize", mfaTotpSecret: "never-serialize" };
const people = [alice, alice, { ...alice, id: "disabled", isActive: false }, { ...alice, id: "bob", clientId: "b" }];
describe("selected-company profile boundary", () => {
  it("uses the selected admin company, never the admin's home company", () => {
    const result = portalCompanyProfile({ role: "admin", clientId: "b", impersonatingCompanyId: "a" }, id => clients.get(id), people);
    expect(result.company?.name).toBe("EXAMPLE A");
    expect(result.team.map(p => p.id)).toEqual(["alice"]);
    expect(Object.keys(result.company!)).toEqual(["id", "name", "email", "phone", "industry"]);
    expect(Object.keys(result.team[0])).toEqual(["id", "name", "email", "isItContact"]);
    expect(JSON.stringify(result)).not.toMatch(/never-serialize|internal-a|client_active/);
  });
  it("ignores non-admin impersonation and excludes foreign and disabled users", () => {
    const result = portalCompanyProfile({ role: "client", clientId: "b", impersonatingCompanyId: "a" }, id => clients.get(id), people);
    expect(result.company?.id).toBe("b");
    expect(result.team.map(p => p.id)).toEqual(["bob"]);
  });
  it("distinguishes selection, missing assignment, and missing company without claiming OAuth failure", () => {
    expect(portalCompanyProfile({ role: "admin", clientId: "a" }, id => clients.get(id), people).status).toBe("choose_company");
    expect(portalCompanyProfile({ role: "client" }, id => clients.get(id), people).status).toBe("company_unlinked");
    expect(portalCompanyProfile({ clientId: "missing" }, id => clients.get(id), people)).toMatchObject({ status: "company_unavailable", company: null, team: [] });
    expect(selectedPortalCompanyId(undefined)).toBeNull();
  });
});

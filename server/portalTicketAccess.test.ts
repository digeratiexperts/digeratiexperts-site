import { describe, expect, it } from "vitest";
import { canAccessPortalTicket, type TicketActor, type TicketOwnership } from "./portalTicketAccess";

/**
 * Issue #256: the ticket detail, comment and attachment routes authorized on
 * same-company only, so a coworker could read another coworker's ticket by id.
 */

const ticket: TicketOwnership = { clientId: "acme", createdBy: "u-owner" };

const actor = (p: Partial<TicketActor>): TicketActor => ({ id: "u-x", role: "user", clientId: "acme", ...p });

describe("canAccessPortalTicket", () => {
  it("lets the person who opened the ticket see it", () => {
    expect(canAccessPortalTicket(actor({ id: "u-owner" }), ticket)).toBe(true);
  });

  it("refuses a coworker in the same company who did not open it (#256)", () => {
    expect(canAccessPortalTicket(actor({ id: "u-coworker" }), ticket)).toBe(false);
  });

  it("lets a Company IT Contact see any of their company's tickets", () => {
    expect(canAccessPortalTicket(actor({ id: "u-itc", isCompanyItContact: true }), ticket)).toBe(true);
    expect(canAccessPortalTicket(actor({ id: "u-itc2", orgRole: "company_it_contact" }), ticket)).toBe(true);
  });

  it("does not grant a plain manager or dept IT contact company-wide ticket access", () => {
    expect(canAccessPortalTicket(actor({ id: "u-mgr", orgRole: "manager" }), ticket)).toBe(false);
    expect(canAccessPortalTicket(actor({ id: "u-dept", orgRole: "dept_it_contact" }), ticket)).toBe(false);
  });

  it("refuses anyone from another company, even its IT contact or owner-id collision", () => {
    expect(canAccessPortalTicket(actor({ id: "u-owner", clientId: "globex" }), ticket)).toBe(false);
    expect(canAccessPortalTicket(actor({ id: "u-itc", clientId: "globex", isCompanyItContact: true }), ticket)).toBe(false);
  });

  it("refuses a user with no company", () => {
    expect(canAccessPortalTicket(actor({ clientId: null }), ticket)).toBe(false);
    expect(canAccessPortalTicket(actor({ clientId: "" }), ticket)).toBe(false);
  });

  it("lets a DE admin see everything", () => {
    expect(canAccessPortalTicket(actor({ role: "admin", clientId: null }), ticket)).toBe(true);
    expect(canAccessPortalTicket(actor({ role: "admin", clientId: "globex" }), ticket)).toBe(true);
  });

  it("refuses an undefined actor", () => {
    expect(canAccessPortalTicket(undefined, ticket)).toBe(false);
  });

  it("does not match on an empty createdBy or actor id", () => {
    expect(canAccessPortalTicket(actor({ id: "" }), { clientId: "acme", createdBy: "" })).toBe(false);
    expect(canAccessPortalTicket(actor({ id: null }), { clientId: "acme", createdBy: null })).toBe(false);
  });
});

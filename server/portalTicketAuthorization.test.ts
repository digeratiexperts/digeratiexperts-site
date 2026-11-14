import { describe, expect, it } from "vitest";
import {
  authorizePortalTicketAccess,
  portalTicketClientView,
  visiblePortalTicketComments,
} from "./portalTicketAuthorization";

const ticket = {
  clientId: "client-a",
  createdBy: "staff-a",
};

const comments = [
  { userId: "staff-b", isInternal: false, content: "Public participant comment" },
  { userId: "staff-c", isInternal: true, content: "Private support note" },
  { userId: "staff-d", isInternal: null, content: "Unclassified imported note" },
  { userId: "staff-e", content: "Missing classification note" },
];

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: "staff-a",
    email: "staff-a@example.com",
    fullName: "Staff A",
    role: "user",
    orgRole: "staff",
    clientId: "client-a",
    ...overrides,
  };
}

describe("portal ticket authorization", () => {
  it("allows the creator and a public-comment participant but hides the ticket from a same-tenant peer", () => {
    expect(authorizePortalTicketAccess(user(), ticket, comments)).toEqual({ ok: true });
    expect(
      authorizePortalTicketAccess(
        user({ id: "staff-b", email: "staff-b@example.com", fullName: "Staff B" }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: true });
    expect(
      authorizePortalTicketAccess(
        user({ id: "staff-c", email: "staff-c@example.com", fullName: "Staff C" }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: false, status: 404, error: "Ticket not found" });
    expect(
      authorizePortalTicketAccess(
        user({ id: "staff-d", email: "staff-d@example.com", fullName: "Staff D" }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: false, status: 404, error: "Ticket not found" });
    expect(
      authorizePortalTicketAccess(
        user({ id: "staff-e", email: "staff-e@example.com", fullName: "Staff E" }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: false, status: 404, error: "Ticket not found" });
    expect(
      authorizePortalTicketAccess(
        user({
          id: "manager-a",
          email: "manager@example.com",
          fullName: "Manager A",
          orgRole: "manager",
        }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: false, status: 404, error: "Ticket not found" });
  });

  it("always hides a foreign-tenant ticket from client users, even when they appear in public comments", () => {
    const foreign = user({
      id: "foreign-staff",
      email: "foreign@example.com",
      fullName: "Foreign Staff",
      clientId: "client-b",
    });
    const commentsWithForeignUser = [
      ...comments,
      { userId: "foreign-staff", isInternal: false, content: "Imported comment" },
    ];

    expect(authorizePortalTicketAccess(foreign, ticket, commentsWithForeignUser)).toEqual({
      ok: false,
      status: 404,
      error: "Ticket not found",
    });
    expect(
      authorizePortalTicketAccess(
        { ...foreign, orgRole: "company_it_contact", isCompanyItContact: true },
        ticket,
        commentsWithForeignUser,
      ),
    ).toEqual({ ok: false, status: 404, error: "Ticket not found" });
  });

  it.each(["dept_it_contact", "company_it_contact"])(
    "allows the %s client-wide IT role within its tenant",
    (orgRole) => {
      expect(
        authorizePortalTicketAccess(
          user({
            id: "company-it",
            email: "it@example.com",
            fullName: "Company IT",
            orgRole,
          }),
          ticket,
          comments,
        ),
      ).toEqual({ ok: true });
    },
  );

  it("allows DE admins across tenants", () => {
    expect(
      authorizePortalTicketAccess(
        user({ id: "de-admin", email: "admin@de.test", fullName: "DE Admin", role: "admin", clientId: null }),
        ticket,
        comments,
      ),
    ).toEqual({ ok: true });
  });

  it("keeps internal notes hidden from every client role while retaining them for DE admins", () => {
    expect(visiblePortalTicketComments(user(), comments).map((comment) => comment.content)).toEqual([
      "Public participant comment",
    ]);
    expect(
      visiblePortalTicketComments(
        user({
          id: "company-it",
          email: "it@example.com",
          fullName: "Company IT",
          orgRole: "company_it_contact",
          isCompanyItContact: true,
        }),
        comments,
      ).map((comment) => comment.content),
    ).toEqual(["Public participant comment"]);
    expect(
      visiblePortalTicketComments(
        user({ id: "de-admin", email: "admin@de.test", fullName: "DE Admin", role: "admin", clientId: null }),
        comments,
      ),
    ).toEqual(comments);
  });

  it("does not disclose tenant, creator, or provider assignment identifiers to client users", () => {
    const persisted = {
      id: "ticket-1",
      clientId: "client-a",
      createdBy: "staff-a",
      ticketNumber: "TKT-1",
      subject: "Help",
      description: "Issue details",
      status: "open",
      priority: "medium",
      category: "general",
      assignedTo: "zoho:987654321",
      createdAt: new Date("2026-08-23T00:00:00Z"),
      updatedAt: new Date("2026-08-23T01:00:00Z"),
      resolvedAt: null,
      internalAdapterState: "must-not-leak",
    };

    expect(portalTicketClientView(user(), persisted)).toEqual({
      id: "ticket-1",
      ticketNumber: "TKT-1",
      subject: "Help",
      description: "Issue details",
      status: "open",
      priority: "medium",
      category: "general",
      assignedTo: "Digerati Experts Support",
      createdAt: new Date("2026-08-23T00:00:00Z"),
      updatedAt: new Date("2026-08-23T01:00:00Z"),
      resolvedAt: null,
    });
    expect(portalTicketClientView(
      user({ role: "admin", clientId: null }),
      persisted,
    ).assignedTo).toBe("zoho:987654321");
  });
});

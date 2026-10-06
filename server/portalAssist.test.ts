import { describe, expect, it } from "vitest";
import {
  fallbackPortalReply,
  materializePortalActions,
  portalAssistSessionId,
  sanitizeFill,
  sanitizePageInput,
} from "./services/msp-advisor/portal-assist";

/**
 * The portal help chat may only propose whitelisted fields, only show the
 * person's own requests, and has no action that submits anything.
 */

const TODAY = "2026-10-06";
const input = {
  user: { id: "u-ann", name: "Ann Acme", email: "ann@acme.test", companyName: "Acme Corp" },
  message: "",
  page: { kind: "service_request_form" as const, requestType: "loaner_computer" as const, title: "Request Loaner Computer" },
  form: { values: {}, missing: [] },
  myRequests: [{ number: "LNR-000001", type: "loaner_computer" as const, status: "submitted" as const, requestedFor: "Ann Acme", updatedAt: "2026-10-06T00:00:00Z" }],
};

describe("portal assist guard rails", () => {
  it("keeps only whitelisted, well-formed fill values", () => {
    const out = sanitizeFill(
      "loaner_computer",
      {
        contactPhone: "602-555-0100",
        deviceKind: "tablet",
        neededFrom: "2026-10-01",
        loanUntil: "2026-10-20",
        requestedForUserId: "u-gus",
        siteId: "other-company-site",
        status: "closed",
        reason: "Laptop in for repair",
      },
      TODAY,
    );
    expect(out).toEqual({ contactPhone: "602-555-0100", loanUntil: "2026-10-20", reason: "Laptop in for repair" });
  });

  it("drops a fill action off a form page and any unknown action type", () => {
    const detail = { ...input, page: { kind: "service_request_detail" as const, title: "LNR-000001" } };
    const actions = materializePortalActions(
      detail,
      [{ type: "fill_form_fields", fields: { reason: "x" } }, { type: "submit_form" }, { type: "order_now" }],
      TODAY,
    );
    expect(actions).toEqual([]);
  });

  it("shows a status card only for the person's own request number", () => {
    const own = materializePortalActions(input, [{ type: "get_request_status", number: "lnr-000001" }], TODAY);
    expect(own[0]).toMatchObject({ type: "get_request_status", number: "LNR-000001" });
    const other = materializePortalActions(input, [{ type: "get_request_status", number: "LNR-000999" }], TODAY);
    expect(other[0]).toMatchObject({ type: "get_request_status", number: undefined });
  });

  it("derives the Desk session from the user, not from the browser", () => {
    expect(portalAssistSessionId("u-ann")).toBe("portal-assist-u-ann");
    expect(sanitizePageInput({ kind: "service_request_form", requestType: "drop_tables", title: "x" }).kind).toBe("other");
  });

  it("falls back to a deterministic reply that lists what is still needed", () => {
    const out = fallbackPortalReply({ ...input, message: "help me fill this out", form: { values: {}, missing: ["Loan until"] } });
    expect(out.reply).toContain("Loan until");
    expect(out.reply).toContain("Order Now");
    expect(out.actions).toEqual([]);
  });
});

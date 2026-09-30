import { describe, expect, it } from "vitest";
import { PRIMARY_PHONE } from "@shared/companyContact";
import { DESK_ASSESSMENT_PATH, deskActionLabel, planDeskAction, sanitizeDeskActions } from "./deskActions";

describe("advisor next steps on the Desk", () => {
  it("keeps the server's materialized actions", () => {
    expect(
      sanitizeDeskActions([
        { type: "schedule_consultation", label: "Schedule a consultation", href: "https://meet.digerati-experts.com/" },
        { type: "request_callback", label: "Emergency callback" },
        { type: "navigate", label: "See pricing", href: "/pricing", path: "/pricing" },
      ]),
    ).toEqual([
      { type: "schedule_consultation", label: "Schedule a consultation", href: "https://meet.digerati-experts.com/" },
      { type: "request_callback", label: "Emergency callback" },
      { type: "navigate", label: "See pricing", href: "/pricing" },
    ]);
  });

  it("drops unknown types, missing labels, unsafe links and duplicates, and caps at three", () => {
    expect(
      sanitizeDeskActions([
        { type: "delete_everything", label: "x" },
        { type: "open_portal", label: "" },
        { type: "navigate", label: "Evil", href: "javascript:alert(1)" },
        { type: "navigate", label: "Off-site", href: "//evil.example/path" },
        { type: "open_portal", label: "Open Client Portal", href: "http://portal.example" },
        { type: "contact_sales", label: "Call", href: PRIMARY_PHONE.telHref },
        { type: "contact_sales", label: "Call again", href: PRIMARY_PHONE.telHref },
        { type: "request_assessment", label: "Assessment" },
        { type: "leave_message", label: "Leave a message" },
        { type: "create_lead", label: "One too many" },
      ]),
    ).toEqual([
      { type: "contact_sales", label: "Call", href: PRIMARY_PHONE.telHref },
      { type: "request_assessment", label: "Assessment" },
      { type: "leave_message", label: "Leave a message" },
    ]);
  });

  it("ignores anything that is not an array", () => {
    expect(sanitizeDeskActions(undefined)).toEqual([]);
    expect(sanitizeDeskActions({ type: "open_portal" })).toEqual([]);
  });

  it("plans each kind of action", () => {
    expect(planDeskAction({ type: "request_callback", label: "Callback" })).toEqual({ kind: "form", form: "callback" });
    expect(planDeskAction({ type: "create_lead", label: "Share" })).toEqual({ kind: "form", form: "lead" });
    expect(planDeskAction({ type: "leave_message", label: "Msg" })).toEqual({ kind: "form", form: "message" });
    expect(planDeskAction({ type: "request_assessment", label: "Assess" })).toEqual({ kind: "route", path: DESK_ASSESSMENT_PATH });
    expect(planDeskAction({ type: "navigate", label: "Pricing", href: "/pricing" })).toEqual({ kind: "route", path: "/pricing" });
    expect(planDeskAction({ type: "contact_sales", label: "Call", href: PRIMARY_PHONE.telHref })).toEqual({
      kind: "link",
      href: PRIMARY_PHONE.telHref,
      external: false,
    });
    expect(planDeskAction({ type: "open_portal", label: "Portal", href: "https://portal.digeratiexperts.com/portal/login" })).toEqual({
      kind: "link",
      href: "https://portal.digeratiexperts.com/portal/login",
      external: true,
    });
    expect(planDeskAction({ type: "navigate", label: "Nowhere" })).toBeNull();
  });

  it("labels a phone action by what it does, never 'Contact sales'", () => {
    expect(deskActionLabel({ type: "contact_sales", label: "Contact sales", href: PRIMARY_PHONE.telHref }, PRIMARY_PHONE.display)).toBe(
      `Call ${PRIMARY_PHONE.display}`,
    );
    expect(deskActionLabel({ type: "open_portal", label: "Open Client Portal", href: "https://x.example/" }, "325")).toBe(
      "Open Client Portal",
    );
  });
});

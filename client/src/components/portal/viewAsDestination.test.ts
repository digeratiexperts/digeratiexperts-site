import { describe, expect, it } from "vitest";
import { viewAsDestination } from "./AdminModeSwitch";

describe("viewAsDestination", () => {
  it("keeps a DE admin on the client page they were on", () => {
    expect(viewAsDestination("/portal/requests/license")).toBe("/portal/requests/license");
    expect(viewAsDestination("/portal/requests")).toBe("/portal/requests");
  });

  it("sends admin pages to the client dashboard, which View as cannot show", () => {
    expect(viewAsDestination("/portal/admin/companies")).toBe("/portal/dashboard");
    expect(viewAsDestination("/portal/admin/clients/abc")).toBe("/portal/dashboard");
    expect(viewAsDestination("/")).toBe("/portal/dashboard");
  });
});

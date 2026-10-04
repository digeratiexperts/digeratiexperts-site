import { describe, expect, it, vi } from "vitest";
import { createQuoteLeadWithCall, normalizeLeadPhone, scheduledCallFor, zohoLeadUrl, type QuoteLeadCrmDeps, type QuoteLeadCrmInput } from "./quoteLeadCrm";

const input: QuoteLeadCrmInput = {
  lead: { First_Name: "Quiz", Last_Name: "Tester", Email: "q@example-co.test", Company: "Example Co", Phone: "480-555-0100" },
  name: "Quiz Tester",
  company: "Example Co",
  phone: "480-555-0100",
  plan: "Business",
  description: "Quote Wizard: Recommended Plan: Business, Seats: 20",
  followUp: { priority: "urgent", callBy: "2026-10-05T10:15:00-07:00", callByLabel: "Mon Oct 5, 10:15 AM Arizona time" },
};

function crm(overrides: Partial<QuoteLeadCrmDeps> = {}): QuoteLeadCrmDeps & { calls: any[] } {
  const calls: any[] = [];
  return {
    calls,
    createLead: vi.fn(async () => ({ details: { id: "L1" } })),
    getRecordOwnerId: vi.fn(async () => "U1"),
    createCall: vi.fn(async (data) => {
      calls.push(data);
      return { id: "C1" };
    }),
    ...overrides,
  };
}

describe("quiz lead -> Zoho lead + scheduled call", () => {
  it("creates the lead, then one scheduled call owned by the lead's owner, due at the call-by time", async () => {
    const deps = crm();
    const result = await createQuoteLeadWithCall(deps, input);
    expect(result).toEqual({ zohoLeadId: "L1", zohoCallId: "C1", ownerId: "U1" });
    expect(deps.calls).toHaveLength(1);
    expect(deps.calls[0]).toMatchObject({
      Call_Type: "Outbound",
      Outgoing_Call_Status: "Scheduled",
      Call_Start_Time: "2026-10-05T10:15:00-07:00",
      What_Id: { id: "L1" },
      $se_module: "Leads",
      Owner: { id: "U1" },
      Reminder: "15 minutes before",
    });
    expect(deps.calls[0].Subject).toBe("Call Quiz Tester (Example Co): Business quiz lead, urgent priority");
    expect(deps.calls[0].Description).toContain("Urgent priority. Call 480-555-0100 by Mon Oct 5, 10:15 AM Arizona time.");
  });

  it("creates the lead through the assignment rule when one is configured", async () => {
    const deps = crm();
    await createQuoteLeadWithCall(deps, { ...input, assignmentRuleId: "R9" });
    expect(deps.createLead).toHaveBeenCalledWith(input.lead, { assignmentRuleId: "R9" });
  });

  it("leaves the owner to Zoho when the owner cannot be read", async () => {
    const deps = crm({ getRecordOwnerId: vi.fn(async () => null) });
    await createQuoteLeadWithCall(deps, input);
    expect(deps.calls[0].Owner).toBeUndefined();
  });

  it("never throws: no call without a lead, and a failed call keeps the lead", async () => {
    const noLead = crm({ createLead: vi.fn(async () => { throw new Error("zoho down"); }) });
    expect(await createQuoteLeadWithCall(noLead, input)).toEqual({ zohoLeadId: null, zohoCallId: null, ownerId: null });
    expect(noLead.createCall).not.toHaveBeenCalled();

    const callFails = crm({ createCall: vi.fn(async () => { throw new Error("calls module"); }) });
    expect(await createQuoteLeadWithCall(callFails, input)).toEqual({ zohoLeadId: "L1", zohoCallId: null, ownerId: "U1" });
  });

  it("builds a Zoho lead link", () => {
    expect(zohoLeadUrl("L1", "https://crm.zoho.com/crm/org1/")).toBe("https://crm.zoho.com/crm/org1/tab/Leads/L1");
    expect(scheduledCallFor({ ...input, company: "" }, "L1", null).Subject).toBe("Call Quiz Tester: Business quiz lead, urgent priority");
  });
});


describe("normalizeLeadPhone", () => {
  it("keeps real numbers as typed and drops everything else", () => {
    expect(normalizeLeadPhone(" (480) 555-0100 ")).toBe("(480) 555-0100");
    expect(normalizeLeadPhone("+1 480.555.0100 ext 22")).toBe("+1 480.555.0100 ext 22");
    expect(normalizeLeadPhone("4805550100x7")).toBe("4805550100x7");
    for (const bad of [undefined, 4805550100, "", "call me", "555", "<script>480</script>", "1".repeat(41)]) {
      expect(normalizeLeadPhone(bad)).toBeUndefined();
    }
  });
});

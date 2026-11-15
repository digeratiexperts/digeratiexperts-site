import { describe, expect, it } from "vitest";
import { readDeskTicketResponse } from "./deskTicketResponse";

// TICKETS_SOURCE=hub: the widget route answers with the Hub ticket (no Desk id).
describe("Desk ticket confirmation on the Hub path (#1179)", () => {
  it("accepts a Hub ticket and passes its secure-field token through", async () => {
    expect(await readDeskTicketResponse(Response.json({ success: true, hubTicketId: 41, ticketNumber: "DE-1041", secureFieldToken: "abc.def" })))
      .toEqual({ ticketNumber: "DE-1041", message: "Your support request has been received.", secureFieldToken: "abc.def" });
  });
  it("accepts a Hub ticket with no token (no secure field offered)", async () => {
    expect(await readDeskTicketResponse(Response.json({ success: true, hubTicketId: 41, ticketNumber: "DE-1041" })))
      .toEqual({ ticketNumber: "DE-1041", message: "Your support request has been received." });
  });
  it.each([
    { success: true, hubTicketId: 0, ticketNumber: "DE-1" },
    { success: true, hubTicketId: "41", ticketNumber: "DE-1" },
    { success: true, hubTicketId: 41, ticketNumber: " " },
    { success: false, hubTicketId: 41, ticketNumber: "DE-1" },
  ])("rejects a malformed Hub answer %j", async (body) => {
    await expect(readDeskTicketResponse(Response.json(body))).rejects.toThrow();
  });
  it("ignores a token on a non-Hub answer", async () => {
    expect(await readDeskTicketResponse(Response.json({ success: true, zohoTicketId: "123", ticketNumber: "456", secureFieldToken: "abc.def" })))
      .toEqual({ ticketNumber: "456", message: "Your support request has been received." });
  });
});

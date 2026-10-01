import { describe, expect, it } from "vitest";
import { readDeskTicketResponse } from "./deskTicketResponse";

describe("Desk ticket confirmation", () => {
  it.each([
    null, {}, { zohoTicketId: "123" }, { success: false, zohoTicketId: "123" },
    { success: true, zohoTicketId: {} }, { success: true, zohoTicketId: " " },
  ])("rejects malformed or explicit failed success payload %j", async (body) => {
    await expect(readDeskTicketResponse(Response.json(body))).rejects.toThrow();
  });
  it("keeps retry guidance for the limiter's plain-text response", async () => {
    await expect(readDeskTicketResponse(new Response("Too many requests", { status: 429 })))
      .rejects.toThrow(/wait a few minutes/i);
  });
  it("does not accept a success body on an HTTP error", async () => {
    await expect(readDeskTicketResponse(Response.json({ success: true, zohoTicketId: "123" }, { status: 503 })))
      .rejects.toThrow();
  });
  it("uses a confirmed Desk reference", async () => {
    expect(await readDeskTicketResponse(Response.json({ success: true, zohoTicketId: "123", ticketNumber: "456" })))
      .toMatchObject({ ticketNumber: "456" });
  });
});

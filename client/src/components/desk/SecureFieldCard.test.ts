/**
 * The DE Desk secure field control (#1179) and where it sits on the existing
 * surfaces. Rendered to static markup (the suite runs in node), plus source
 * checks on the three surfaces it extends: the website DE Desk modal, the
 * portal ticket page and both sides of the portal chat.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SecureFieldCard } from "./SecureFieldCard";

// tsconfig keeps "jsx": "preserve" (Vite's React plugin does the app build);
// vitest has no React plugin, so esbuild emits React.createElement.
(globalThis as { React?: typeof React }).React = React;

const here = dirname(fileURLToPath(import.meta.url));
const read = (p: string) => readFileSync(resolve(here, p), "utf8");
const card = read("SecureFieldCard.tsx");
const widget = read("../ZohoASAPWidget.tsx");
const portalPanels = read("../portal/desk/PortalSecureFields.tsx");
const ticketPage = read("../../pages/portal/PortalTicketDetail.tsx");
const portalChat = read("../../pages/portal/PortalChat.tsx");

const render = (tone: "desk" | "portal") =>
  renderToStaticMarkup(React.createElement(SecureFieldCard, { tone, submit: async () => { throw new Error("not called"); } }));

describe("SecureFieldCard", () => {
  it.each(["desk", "portal"] as const)("renders a masked, non-autofilled value field and the stored-securely line (%s)", (tone) => {
    const html = render(tone);
    const valueInput = html.match(/<input[^>]*data-testid="secure-field-card-value"[^>]*>/)?.[0] ?? "";
    expect(valueInput).toContain('type="password"');
    expect(valueInput).toMatch(/autocomplete="off"/i);
    expect(valueInput).toMatch(/spellcheck="false"/i);
    expect(valueInput).toContain('value=""');
    expect(html).toMatch(/Stored encrypted with your DE ticket/);
    expect(html).toMatch(/never appears in this chat/);
    expect(html).not.toMatch(/reveal/i);
  });

  it("clears the value before sending and only ever passes metadata on", () => {
    const submitAt = card.indexOf("const payload = secureFieldPayload(");
    expect(submitAt).toBeGreaterThan(0);
    expect(card.indexOf('setSecretValue("")', submitAt)).toBeGreaterThan(submitAt);
    expect(card.indexOf('setSecretValue("")', submitAt)).toBeLessThan(card.indexOf("await submit(payload)"));
    expect(card).toMatch(/onStored\?\.\(meta\)/);
    // The control never writes into a thread, a comment or the assistant.
    expect(card).not.toMatch(/setChatMessages|setMessages|appendDeskMessage|\/comments|\/chat\/messages|advisor/);
  });
});

describe("secure field on the existing surfaces (extended, not replaced)", () => {
  it("website DE Desk: on the Get Support confirmation, posting to the widget route with the ticket's token", () => {
    expect(widget).toMatch(/ticketResult\.secureFieldToken \? \(/);
    expect(widget).toMatch(/<SecureFieldCard\s+tone="desk"/);
    expect(widget).toMatch(/"\/api\/portal\/zoho\/ticket\/secure-field"/);
    // The existing three tabs and the success actions are still there.
    expect(widget).toMatch(/label: "Ask DE"/);
    expect(widget).toMatch(/label: "Get Support"/);
    expect(widget).toMatch(/label: "Client Tools"/);
    expect(widget).toMatch(/Create another ticket/);
  });

  it("website DE Desk: Ask DE keeps a password out of the transcript", () => {
    const send = widget.slice(widget.indexOf("const handleSendChat = async"), widget.indexOf("const userMessage: ChatMessage"));
    expect(send).toMatch(/if \(looksLikeSecret\(content\)\)/);
    expect(send).toMatch(/return;/);
  });

  it("portal ticket page: a Secure fields panel for the client side and the DE side, with no reveal", () => {
    expect(ticketPage).toMatch(/<PortalTicketSecureFields ticketId=\{ticketId\} isDeStaff=\{isDeStaff\} \/>/);
    expect(portalPanels).toMatch(/SECURE_FIELD_REVEAL_COPY/);
    expect(portalPanels).toMatch(/can't yet prove which DE staff member is asking/);
    expect(portalPanels).not.toMatch(/\/reveal/);
  });

  it("portal chat: the client side can share on a ticket; both sides stop a secret going into the thread", () => {
    expect(portalChat).toMatch(/<PortalChatSecureShare onClose=/);
    expect(portalChat).toMatch(/data-testid="button-secure-share"/);
    const clientSend = portalChat.slice(portalChat.indexOf("const handleSendMessage = useCallback("));
    expect(clientSend.slice(0, 800)).toMatch(/if \(looksLikeSecret\(messageText\)\)/);
    const deskReply = portalChat.slice(portalChat.indexOf("const handleDeskReply = async"));
    expect(deskReply.slice(0, 700)).toMatch(/if \(looksLikeSecret\(content\)\)/);
    expect(portalChat).toMatch(/data-testid="button-desk-secure-request"/);
  });

  it("says Digerati Experts or DE, never Digerati alone, in what this change touches", () => {
    for (const src of [card, portalPanels]) expect(src).not.toMatch(/Digerati(?! Experts)/);
    expect(widget).not.toMatch(/A Digerati agent/);
  });
});

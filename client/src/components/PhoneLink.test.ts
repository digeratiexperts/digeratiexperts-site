import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PRIMARY_PHONE, hasPublicPhone } from "@shared/companyContact";

// Vitest compiles .tsx with the classic JSX runtime, which needs React in scope.
(globalThis as { React?: typeof React }).React = React;
const { PhoneLink } = await import("./PhoneLink");

describe("PhoneLink", () => {
  it("shows the plain [DE_PUBLIC_PHONE] marker, never a tel: link, while no public line is set", () => {
    if (hasPublicPhone()) return;
    const html = renderToStaticMarkup(
      createElement(PhoneLink, { className: "x", "data-testid": "p" }, PRIMARY_PHONE.display),
    );
    expect(html).toContain("[DE_PUBLIC_PHONE]");
    expect(html).not.toMatch(/<a\b|href=|tel:/);
    expect(html).not.toContain("data-testid");
    expect(html).toContain("data-phone-pending");
  });

  it("renders the explicit fallback instead when one is passed", () => {
    if (hasPublicPhone()) return;
    expect(renderToStaticMarkup(createElement(PhoneLink, { fallback: null }, PRIMARY_PHONE.display))).toBe("");
  });

  it("is a tel: link once a real number is configured", () => {
    if (!hasPublicPhone()) return;
    const html = renderToStaticMarkup(createElement(PhoneLink, null, PRIMARY_PHONE.display));
    expect(html).toContain(`href="${PRIMARY_PHONE.telHref}"`);
  });
});

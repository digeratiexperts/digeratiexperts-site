import { describe, expect, it } from "vitest";
import {
  FAIL_CLOSED_STATE,
  TENANT_SCOPE_PRESENTATION,
  TENANT_SCOPE_STATES,
  canRenderCatalog,
  parseTenantScopeState,
} from "./marketplaceTenantState";

describe("parseTenantScopeState", () => {
  it("accepts each contract state on the canonical field", () => {
    for (const state of TENANT_SCOPE_STATES) {
      expect(parseTenantScopeState({ tenantState: state })).toBe(state);
    }
  });

  it("normalises case and whitespace but nothing else", () => {
    expect(parseTenantScopeState({ tenantState: " scoped " })).toBe("SCOPED");
    expect(parseTenantScopeState({ tenantState: "authorized-global" })).toBe(FAIL_CLOSED_STATE);
  });

  it("fails closed on unknown, missing, empty or non-string states", () => {
    expect(parseTenantScopeState({ tenantState: "UNRESTRICTED" })).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState({ tenantState: "" })).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState({ tenantState: 1 })).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState({ tenantState: null })).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState({})).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState(undefined)).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState("SCOPED")).toBe(FAIL_CLOSED_STATE);
  });

  it("never lets a bad canonical field fall through to a permissive legacy status", () => {
    expect(parseTenantScopeState({ tenantState: "bogus", status: "unavailable" })).toBe(FAIL_CLOSED_STATE);
  });

  it("bridges the pre-contract status field only to restricted states", () => {
    expect(parseTenantScopeState({ status: "unmapped" })).toBe("UNMAPPED");
    expect(parseTenantScopeState({ status: "unavailable" })).toBe("AUTHORITY_UNAVAILABLE");
    expect(parseTenantScopeState({ status: "ok" })).toBe(FAIL_CLOSED_STATE);
    expect(parseTenantScopeState({ status: "scoped" })).toBe(FAIL_CLOSED_STATE);
  });
});

describe("catalog rendering rules", () => {
  it("only SCOPED and AUTHORIZED_GLOBAL may show items", () => {
    expect(canRenderCatalog("SCOPED")).toBe(true);
    expect(canRenderCatalog("AUTHORIZED_GLOBAL")).toBe(true);
    expect(canRenderCatalog("UNMAPPED")).toBe(false);
    expect(canRenderCatalog("AUTHORITY_UNAVAILABLE")).toBe(false);
  });

  it("presents UNMAPPED as restricted, never as authorized, and never leaks the enum", () => {
    const unmapped = TENANT_SCOPE_PRESENTATION.UNMAPPED;
    expect(unmapped.tone).toBe("restricted");
    for (const state of TENANT_SCOPE_STATES) {
      const p = TENANT_SCOPE_PRESENTATION[state];
      const text = `${p.badge} ${p.title} ${p.body}`;
      for (const token of TENANT_SCOPE_STATES) expect(text).not.toContain(token);
      expect(text.toLowerCase()).not.toContain("unrestricted");
    }
  });
});

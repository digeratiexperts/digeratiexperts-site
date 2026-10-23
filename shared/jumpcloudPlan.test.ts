import { describe, expect, it } from "vitest";
import { planJumpCloudInstalls } from "./jumpcloudPlan";
import { STARTER_KITS, shelfEntry } from "./starterKits";
import { CLIENT_VAULT_KINDS, requirementStatus } from "./clientVault";

const input = {
  pool: [
    { itemId: "7z", kind: "app" as const, product: "7-Zip", chocoPackage: "7zip" },
    { itemId: "sage", kind: "app" as const, product: "Sage 100", chocoPackage: null },
    { itemId: "bp", kind: "license" as const, product: "Business Premium", chocoPackage: null },
  ],
  people: [{ name: "Dana", licenses: [{ itemId: "7z" }, { itemId: "bp" }] }],
  devices: [
    { id: "device:*", label: "Every machine", licenses: [{ itemId: "7z" }, { itemId: "sage" }] },
    { id: "device:front-01", label: "FRONT-01", licenses: [{ itemId: "7z" }] },
  ],
};

describe("JumpCloud install plan", () => {
  it("sends Chocolatey apps to the linked device group and to named machines", () => {
    const steps = planJumpCloudInstalls(input, { orgId: null, systemGroupId: "grp123456" });
    const ready = steps.filter((s) => s.status === "ready");
    expect(ready).toEqual([
      expect.objectContaining({ product: "7-Zip", target: { kind: "group", label: "Every machine", id: "grp123456" } }),
      expect.objectContaining({ product: "7-Zip", target: { kind: "machine", label: "FRONT-01", id: null } }),
    ]);
    // Licences never become installs; apps without a Chocolatey id and person targets are explained.
    expect(steps.some((s) => s.product === "Business Premium")).toBe(false);
    expect(steps.find((s) => s.product === "Sage 100")?.reason).toMatch(/Chocolatey/);
    expect(steps.find((s) => s.target.kind === "person")?.reason).toMatch(/machines/);
  });

  it("holds Every machine installs until the device group is linked", () => {
    const steps = planJumpCloudInstalls(input, null);
    expect(steps.find((s) => s.target.kind === "group" && s.product === "7-Zip")).toMatchObject({
      status: "skip",
      reason: expect.stringMatching(/device group/),
    });
  });
});

describe("starter kits", () => {
  it("only names parts that exist on the shelf", () => {
    for (const kit of STARTER_KITS) {
      for (const key of [...kit.apps, ...kit.licenses]) expect(shelfEntry(key), `${kit.key}: ${key}`).toBeTruthy();
      for (const key of kit.apps) expect(shelfEntry(key)?.kind).toBe("app");
      for (const key of kit.licenses) expect(shelfEntry(key)?.kind).toBe("license");
    }
  });
});

describe("kit vault checklists", () => {
  it("every kit asks for at least the signed agreement, using real vault kinds", () => {
    for (const kit of STARTER_KITS) {
      expect(kit.vaultDocs.length, kit.key).toBeGreaterThan(0);
      for (const d of kit.vaultDocs) expect(CLIENT_VAULT_KINDS).toContain(d.kind);
      expect(kit.vaultDocs.some((d) => /managed services agreement/i.test(d.title)), kit.key).toBe(true);
    }
  });

  it("counts a requirement on file only for the same kind and title", () => {
    const req = { id: "r1", clientId: "c", kind: "contract" as const, title: "Incident response plan", hint: null, source: "kit:regulated", createdAt: "" };
    expect(requirementStatus([req], [{ kind: "contract", title: "incident  response PLAN" }])[0].onFile).toBe(true);
    expect(requirementStatus([req], [{ kind: "script", title: "Incident response plan" }])[0].onFile).toBe(false);
    expect(requirementStatus([req], [{ kind: "contract", title: "Incident response plan v2" }])[0].onFile).toBe(false);
  });
});

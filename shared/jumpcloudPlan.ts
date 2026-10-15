import { EVERY_MACHINE_ID } from "./licenseBoard";

/**
 * What the License Patch Bay would ask JumpCloud to install for one company.
 *
 * JumpCloud Software Management installs Windows apps through Chocolatey and
 * binds each software app to machines or machine groups (not to users). So:
 *   app (with a Chocolatey id) -> "Every machine"  => the company's device group
 *   app (with a Chocolatey id) -> a named device   => the JumpCloud machine with that hostname
 * Everything else is listed with the reason it is not sent.
 *
 * Each company is linked to JumpCloud by an organization id (DE's MSP portal,
 * one org per client), a device group id (one org, a group per client), or
 * both. Nothing is sent until an admin presses Send.
 */

export type JumpCloudLink = {
  /** JumpCloud organization id (MSP multi-tenant: one org per client). Null = DE's default org. */
  orgId: string | null;
  /** The device group holding this company's machines: where "Every machine" installs go. */
  systemGroupId: string | null;
};

export type PlanInput = {
  pool: Array<{ itemId: string; kind: "license" | "app"; product: string; chocoPackage: string | null }>;
  people: Array<{ name: string; licenses: Array<{ itemId: string }> }>;
  devices: Array<{ id: string; label: string; licenses: Array<{ itemId: string }> }>;
};

export type PlanStep = {
  itemId: string;
  product: string;
  chocoPackage: string | null;
  target: { kind: "group" | "machine" | "person"; label: string; id: string | null };
  status: "ready" | "skip";
  reason?: string;
};

export function planJumpCloudInstalls(input: PlanInput, link: JumpCloudLink | null): PlanStep[] {
  const byId = new Map(input.pool.map((p) => [p.itemId, p]));
  const steps: PlanStep[] = [];
  const base = (itemId: string) => {
    const item = byId.get(itemId);
    return item ? { itemId, product: item.product, chocoPackage: item.chocoPackage, kind: item.kind } : null;
  };

  for (const device of input.devices) {
    const every = device.id === EVERY_MACHINE_ID;
    for (const held of device.licenses) {
      const b = base(held.itemId);
      if (!b || b.kind !== "app") continue;
      const target = every
        ? { kind: "group" as const, label: "Every machine", id: link?.systemGroupId ?? null }
        : { kind: "machine" as const, label: device.label, id: null };
      let reason: string | undefined;
      if (!b.chocoPackage) reason = "No Chocolatey package id on this app";
      else if (every && !link?.systemGroupId) reason = "Link the company's JumpCloud device group first";
      steps.push({ itemId: b.itemId, product: b.product, chocoPackage: b.chocoPackage, target, status: reason ? "skip" : "ready", reason });
    }
  }

  for (const person of input.people) {
    for (const held of person.licenses) {
      const b = base(held.itemId);
      if (!b || b.kind !== "app") continue;
      steps.push({
        itemId: b.itemId,
        product: b.product,
        chocoPackage: b.chocoPackage,
        target: { kind: "person", label: person.name, id: null },
        status: "skip",
        reason: "JumpCloud installs go to machines: patch it to their machine or Every machine",
      });
    }
  }
  return steps;
}

export const JC_ID = /^[A-Za-z0-9]{6,40}$/;

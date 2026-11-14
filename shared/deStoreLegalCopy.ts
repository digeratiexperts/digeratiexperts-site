/**
 * Store legal copy, kept verbatim from the Digerati Experts store legal set
 * (draft v2026.10-store). Placeholders stay named until Joseph fills them in.
 */
import { PRIMARY_PHONE } from "./companyContact";
import { DE_STORE_PLACE_ORDER_BUTTON, regionDisplayName } from "./deStoreContract";

export const POSTAL_ADDRESS_PLACEHOLDER = "{{POSTAL_ADDRESS}}";
export const WARRANTY_MAILING_ADDRESS_PLACEHOLDER = "{{WARRANTY_MAILING_ADDRESS}}";
export const EXCLUDED_STATES_PLACEHOLDER = "{{EXCLUDED_STATES}}";
export const WAZUH_COLLECTION_PLACEHOLDER = "{{WAZUH_COLLECTION}}";

export const PLACE_ORDER_BUTTON_LABEL = DE_STORE_PLACE_ORDER_BUTTON;

export const WHERE_WE_SELL_SHORT =
  "We currently sell only to businesses with billing and shipping addresses in supported states. See where we sell.";

export const WHERE_WE_SELL_ADDRESS_STEP_TEMPLATE =
  "Where we sell: Digerati Experts sells only to customers whose billing and shipping addresses are both in a supported state. We don't currently sell to customers in {{EXCLUDED_STATES}}.";

export const WHERE_WE_SELL_ADDRESS_STEP_NO_LIST =
  "Where we sell: Digerati Experts sells only to customers whose billing and shipping addresses are both in a supported state.";

export const BLOCKED_STATE_MESSAGE_TEMPLATE =
  `Sorry — we can't currently sell to addresses in {{STATE}}. Your billing and shipping addresses must both be in a supported state. You have not been charged. Questions: admin@digeratiexperts.com or ${PRIMARY_PHONE.display}.`;

export const SHIPPING_PROMISE =
  "Ships within 7 calendar days after a paid, accepted order. Ships overnight. Delivery is usually the next business day after shipment, depending on the carrier and your address. If we can't ship by your promised date, we'll email you before that date with a new ship date and the option to cancel for a full refund.";

export const DAY_5_DELAY_NOTICE_SUMMARY =
  "If Digerati Experts cannot ship on time, we will email you no later than the fifth (5th) day after your paid, accepted order, and in any event before the promised date, with a definite new ship date (or a statement that we cannot give one), the reason, and the option to cancel for a full refund.";

export const CLICKWRAP_NOTICE_TEMPLATE =
  'By clicking "I agree and place order," you agree to the documents checked above on behalf of the business named, and you authorize Digerati Experts to charge your payment method {{TOTAL_TODAY}}{{RECURRING_TAIL}}.';

export const BOX_1_LABEL_TEMPLATE =
  "I have read and agree to the DE Store Terms of Sale, the DE Master Services Agreement including Exhibit I (DE Store and Self-Serve Terms), the {{ROLE}} Responsibility Matrix, the DE Limited Warranty, and the DE Return and Refund Policy.";

export const BOX_2_LABEL_TEMPLATE =
  "I am buying for business use on behalf of {{BUSINESS_NAME}}, and I am authorized to accept these terms for it.";

export const BOX_4_PREINSTALLED_SOFTWARE =
  "I have read the Preinstalled Software Notice. I consent to the Digerati Experts software listed for this kit being installed and running on these devices, and I will give any notice to my users that the law requires.";

export const BOX_4_SELF_MANAGED_ADDENDUM =
  "I understand I may remove it at any time using the removal guide.";

export const CONSUMER_ESIGN_BOX =
  `I agree to receive notices, receipts, warranty terms, and other records from Digerati Experts electronically for this order and any subscription. I can get a free paper copy by calling ${PRIMARY_PHONE.display}, and I can withdraw this consent at any time by emailing admin@digeratiexperts.com, which takes effect for records sent after DE processes it. To view these records I need a device that can open PDF files and receive email. I confirm I could open the sample.`;

export const REFURBISHED_USED_GRADE_LABEL = "Refurbished (used) - Grade";

export const REFURBISHED_LISTING_BLOCK_TEMPLATE = `REFURBISHED (USED) — Grade {{GRADE}}
Previously owned. Inspected, tested, data-sanitized to NIST SP 800-88 Rev. 2 ({{SANITIZATION_METHOD}}), and configured by Digerati Experts.
Battery health: {{BATTERY_HEALTH}} of design capacity (tested {{BATTERY_TESTED_ON}}).
Replaced parts: {{REPLACED_PARTS}}.
Operating system: {{OPERATING_SYSTEM}}.
Manufacturer warranty: {{MANUFACTURER_WARRANTY}}.
DE warranty: Covered by the DE 90-Day Limited Warranty.
Preinstalled software: Digerati Experts software listed in the Preinstalled Software Notice.
Returns: Return and Refund Policy.`;

export const SANITIZATION_PUBLIC_STATEMENT = `How Digerati Experts sanitizes refurbished equipment
Every storage device in a Digerati Experts refurbished kit is sanitized before it is configured, following NIST Special Publication 800-88 Revision 2, Guidelines for Media Sanitization.
• Purge. We use a Purge technique, which NIST defines as one that renders target data recovery infeasible using state-of-the-art laboratory techniques: the drive's built-in sanitize or cryptographic erase command (following IEEE 2883 where the drive supports it), or a validated overwrite where that is the drive's reliable Purge method.
• Verify. We verify every sanitized drive, and we record the result.
• Destroy and replace. If a drive cannot be reliably purged or fails verification, we physically destroy it and install a new or separately purged drive. Replaced drives are listed on the product page.
• We never boot, browse, or copy a prior owner's data. Devices are quarantined from receipt until sanitized.
• Certificate. A Certificate of Sanitization is recorded for each drive, by serial number. Ask for a copy at any time: email admin@digeratiexperts.com with your order number.
We use Clear (overwriting all user-addressable locations with standard commands) only as an extra step, never as the only step for a device we resell.`;

export const PREINSTALLED_SOFTWARE_NOTICE = `Digerati Experts software on this device
This device comes with the Digerati Experts software listed below already installed. It is what lets Digerati Experts provide the services in your plan. Nothing is hidden: every agent appears in the device's installed-programs list under its own name.

1. Digerati Experts endpoint agent (Digerati Experts proprietary; Managed, Co-Managed, and Self-Managed plans)
Purpose: device inventory, security posture checks, and the support and management services in your plan.
Where the data goes: only to the Digerati Experts Hub. Digerati Experts staff can see it, and you can see your devices in your DE dashboard.
What it sends:
• Once, when the device enrolls: hostname, operating system and version, CPU architecture, serial number, and agent version.
• At each check-in, about every 30 seconds: hostname, agent version, signed-in username, operating system version, and the IP address the device connects from.
• Up to every 6 hours: the list of installed software (up to 500 apps: name, version, and publisher); whether the device is enrolled in mobile device management (MDM); which security tools are detected; and pass/fail checks for disk encryption, firewall, Secure Boot, TPM, managed identity, MDM, and endpoint protection (EDR/antivirus).
• Command results: only when Digerati Experts runs an approved, signed job on the device on demand, and only that job's output.
What it never collects: BitLocker recovery keys or any other passwords or secrets, screenshots, keystrokes, clipboard contents, file contents, network traffic, or continuous logs.

2. Wazuh agent (GNU GPL version 2, see Part 3; all plans)
Purpose: security monitoring and threat detection.
What it collects: {{WAZUH_COLLECTION}}
Who can see it: Digerati Experts security staff (Managed, Co-Managed); you, in your dashboard.

Your business is responsible for telling employees and other users of these devices about this monitoring when the law requires notice or consent.

Managed and Co-Managed plans: please do not disable or remove this software (MSA Article 4(e)).
Self-Managed plans: you may remove any Digerati Experts software at any time. See "How to remove Digerati Experts software" below.`;

export function wazuhCollectionIsFilled(notice: string = PREINSTALLED_SOFTWARE_NOTICE): boolean {
  return !notice.includes(WAZUH_COLLECTION_PLACEHOLDER);
}

export function formatExcludedStates(regions: string[]): string {
  if (!regions.length) return EXCLUDED_STATES_PLACEHOLDER;
  const names = regions.map((code) => regionDisplayName(code));
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} or ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, or ${names[names.length - 1]}`;
}

export function blockedStateMessage(regions: string[]): string {
  return BLOCKED_STATE_MESSAGE_TEMPLATE.replace("{{STATE}}", formatExcludedStates(regions));
}

export function whereWeSellAddressStep(regions: string[]): string {
  if (!regions.length) return WHERE_WE_SELL_ADDRESS_STEP_NO_LIST;
  return WHERE_WE_SELL_ADDRESS_STEP_TEMPLATE.replace("{{EXCLUDED_STATES}}", formatExcludedStates(regions));
}

export function roleMatrixLabel(role: "managed" | "comanaged" | "self_managed"): string {
  if (role === "managed") return "Managed";
  if (role === "comanaged") return "Co-Managed";
  return "Self-Managed";
}

export function box1Label(role: "managed" | "comanaged" | "self_managed"): string {
  return BOX_1_LABEL_TEMPLATE.replace("{{ROLE}}", roleMatrixLabel(role));
}

export function box2Label(businessName: string): string {
  const name = businessName.trim() || "[Business legal name]";
  return BOX_2_LABEL_TEMPLATE.replace("{{BUSINESS_NAME}}", name);
}

export function box4Label(role: "managed" | "comanaged" | "self_managed"): string {
  if (role === "self_managed") {
    return `${BOX_4_PREINSTALLED_SOFTWARE} ${BOX_4_SELF_MANAGED_ADDENDUM}`;
  }
  return BOX_4_PREINSTALLED_SOFTWARE;
}

export function clickwrapNotice(totalToday: string, recurringTail = ""): string {
  return CLICKWRAP_NOTICE_TEMPLATE.replace("{{TOTAL_TODAY}}", totalToday).replace(
    "{{RECURRING_TAIL}}",
    recurringTail,
  );
}

export function refurbishedGradeTitle(grade: string): string {
  return `${REFURBISHED_USED_GRADE_LABEL} ${grade}`.trim();
}

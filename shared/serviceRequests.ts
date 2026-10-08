import { z } from "zod";
import { LICENSE_PLATFORMS, type LicensePlatform } from "./licensing";

/**
 * Portal service requests (client + server + Hub contract).
 *
 * The Portal database is the source of truth for every request. The Hub gets
 * a signed copy through the DE-Sync outbox (event `service_request.upserted`,
 * path /api/ingest/service-requests) and never creates these itself.
 *
 * Two catalog items so far: a loaner computer and a computer return. Both use
 * one table (`service_requests`), one number sequence per type, one status
 * lifecycle per type and one payload schema per type, all defined here.
 */

export const SERVICE_REQUEST_TYPES = ["loaner_computer", "return_computer", "license_request", "mobile_request"] as const;
export type ServiceRequestType = (typeof SERVICE_REQUEST_TYPES)[number];

export function isServiceRequestType(v: unknown): v is ServiceRequestType {
  return typeof v === "string" && (SERVICE_REQUEST_TYPES as readonly string[]).includes(v);
}

/** Request number prefix per type: LNR-000123, RTN-000045. */
export const SERVICE_REQUEST_NUMBER_PREFIX: Record<ServiceRequestType, string> = {
  loaner_computer: "LNR",
  return_computer: "RTN",
  license_request: "LIC",
  mobile_request: "MOB",
};

export function formatServiceRequestNumber(type: ServiceRequestType, seq: number): string {
  return `${SERVICE_REQUEST_NUMBER_PREFIX[type]}-${String(seq).padStart(6, "0")}`;
}

/** Kept in a basket until the requester submits it; never sent to the Hub. */
export const BASKET_STATUS = "in_basket" as const;

/**
 * Submitted but waiting for the site / department leader (or IT contact) to
 * approve; no Desk ticket yet. Approve → submitted, reject → rejected.
 */
export const APPROVAL_STATUS = "pending_approval" as const;

/**
 * Paused until a date (or until someone resumes it), then back to the status
 * it was paused from (payload.hold.resumeStatus). Set by the requester, their
 * site / department leader or backup, the IT contact, DE staff or the Hub.
 */
export const HOLD_STATUS = "on_hold" as const;
export const HOLD_MAX_DAYS = 180;

export type ServiceRequestHold = {
  until: string;
  reason: string;
  resumeStatus: ServiceRequestStatus;
  by: { userId: string | null; name: string; role: string };
  at: string;
};

/** Requests can be amended until the work is under way (device or pickup arranged, licence approved by DE). */
export const AMENDABLE_STATUSES: readonly ServiceRequestStatus[] = ["pending_approval", "submitted", "under_review"];

export function canHold(status: ServiceRequestStatus): boolean {
  return status !== "in_basket" && status !== "on_hold" && !TERMINAL_STATUSES.includes(status);
}

/** Days from today (YYYY-MM-DD) to a later YYYY-MM-DD; NaN when unparseable. */
export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function checkHoldUntil(until: unknown, today: string): string | null {
  if (typeof until !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(until) || Number.isNaN(daysBetween(today, until))) return "Choose the date the hold ends";
  const d = daysBetween(today, until);
  if (d < 1) return "The hold must end tomorrow or later";
  if (d > HOLD_MAX_DAYS) return `A hold can last up to ${HOLD_MAX_DAYS} days`;
  return null;
}

export const LOANER_STATUSES = [
  "pending_approval",
  "on_hold",
  "submitted",
  "under_review",
  "device_assigned",
  "delivered",
  "return_due",
  "returned",
  "closed",
  "rejected",
  "cancelled",
] as const;

export const RETURN_STATUSES = [
  "pending_approval",
  "on_hold",
  "submitted",
  "under_review",
  "pickup_scheduled",
  "received",
  "restocked",
  "disposed",
  "closed",
  "rejected",
  "cancelled",
] as const;

export const LICENSE_STATUSES = [
  "pending_approval",
  "on_hold",
  "submitted",
  "under_review",
  "approved",
  "fulfilled",
  "closed",
  "rejected",
  "cancelled",
] as const;

export const MOBILE_STATUSES = [
  "pending_approval",
  "on_hold",
  "submitted",
  "under_review",
  "completed",
  "closed",
  "rejected",
  "cancelled",
] as const;

export type ServiceRequestStatus =
  | typeof BASKET_STATUS
  | (typeof LOANER_STATUSES)[number]
  | (typeof RETURN_STATUSES)[number]
  | (typeof LICENSE_STATUSES)[number]
  | (typeof MOBILE_STATUSES)[number];

export const STATUSES_BY_TYPE: Record<ServiceRequestType, readonly ServiceRequestStatus[]> = {
  loaner_computer: LOANER_STATUSES,
  return_computer: RETURN_STATUSES,
  license_request: LICENSE_STATUSES,
  mobile_request: MOBILE_STATUSES,
};

/** The happy path, in order, for the status timeline on the detail page. */
export const TIMELINE_BY_TYPE: Record<ServiceRequestType, readonly ServiceRequestStatus[]> = {
  loaner_computer: ["submitted", "under_review", "device_assigned", "delivered", "return_due", "returned", "closed"],
  return_computer: ["submitted", "under_review", "pickup_scheduled", "received", "restocked", "closed"],
  license_request: ["submitted", "under_review", "approved", "fulfilled", "closed"],
  mobile_request: ["submitted", "under_review", "completed", "closed"],
};

export const TERMINAL_STATUSES: readonly ServiceRequestStatus[] = ["closed", "rejected", "cancelled"];

/**
 * Staff transitions (DE admin in the Portal, or the Hub through the signed
 * write-back). Anything not listed is refused, so a request cannot jump back
 * from closed or skip from submitted to returned.
 */
const LOANER_TRANSITIONS: Record<string, readonly ServiceRequestStatus[]> = {
  // Approval itself is the approver's (POST …/approval); staff can only stop it.
  pending_approval: ["rejected", "cancelled"],
  // Resuming goes back to where it was held (payload.hold.resumeStatus); otherwise stop it.
  on_hold: ["rejected", "cancelled"],
  submitted: ["under_review", "device_assigned", "rejected", "cancelled"],
  under_review: ["device_assigned", "rejected", "cancelled"],
  device_assigned: ["delivered", "cancelled"],
  delivered: ["return_due", "returned"],
  return_due: ["returned"],
  returned: ["closed"],
};

const RETURN_TRANSITIONS: Record<string, readonly ServiceRequestStatus[]> = {
  // Approval itself is the approver's (POST …/approval); staff can only stop it.
  pending_approval: ["rejected", "cancelled"],
  // Resuming goes back to where it was held (payload.hold.resumeStatus); otherwise stop it.
  on_hold: ["rejected", "cancelled"],
  submitted: ["under_review", "pickup_scheduled", "rejected", "cancelled"],
  under_review: ["pickup_scheduled", "rejected", "cancelled"],
  pickup_scheduled: ["received", "cancelled"],
  received: ["restocked", "disposed"],
  restocked: ["closed"],
  disposed: ["closed"],
};

const LICENSE_TRANSITIONS: Record<string, readonly ServiceRequestStatus[]> = {
  // Approval itself is the approver's (POST …/approval); staff can only stop it.
  pending_approval: ["rejected", "cancelled"],
  // Resuming goes back to where it was held (payload.hold.resumeStatus); otherwise stop it.
  on_hold: ["rejected", "cancelled"],
  submitted: ["under_review", "approved", "rejected", "cancelled"],
  under_review: ["approved", "rejected", "cancelled"],
  approved: ["fulfilled", "cancelled"],
  fulfilled: ["closed"],
};

const MOBILE_TRANSITIONS: Record<string, readonly ServiceRequestStatus[]> = {
  pending_approval: ["rejected", "cancelled"],
  on_hold: ["rejected", "cancelled"],
  submitted: ["under_review", "completed", "rejected", "cancelled"],
  under_review: ["completed", "rejected", "cancelled"],
  completed: ["closed"],
};

const TRANSITIONS_BY_TYPE: Record<ServiceRequestType, Record<string, readonly ServiceRequestStatus[]>> = {
  loaner_computer: LOANER_TRANSITIONS,
  return_computer: RETURN_TRANSITIONS,
  license_request: LICENSE_TRANSITIONS,
  mobile_request: MOBILE_TRANSITIONS,
};

export function allowedStaffTransitions(type: ServiceRequestType, from: ServiceRequestStatus): readonly ServiceRequestStatus[] {
  const table = TRANSITIONS_BY_TYPE[type];
  return table[from] ?? [];
}

/** A requester may cancel only before a device is assigned or a pickup is scheduled. */
export const USER_CANCELLABLE: readonly ServiceRequestStatus[] = [BASKET_STATUS, APPROVAL_STATUS, "submitted", "under_review"];

export const STATUS_LABELS: Record<ServiceRequestStatus, string> = {
  in_basket: "In basket",
  pending_approval: "Awaiting approval",
  on_hold: "On hold",
  submitted: "Submitted",
  under_review: "Under review",
  device_assigned: "Device assigned",
  delivered: "Delivered",
  return_due: "Return due",
  returned: "Returned",
  pickup_scheduled: "Pickup scheduled",
  received: "Received",
  restocked: "Restocked",
  disposed: "Disposed",
  approved: "Approved",
  fulfilled: "Licence assigned",
  completed: "Completed",
  closed: "Closed",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

export const TYPE_LABELS: Record<ServiceRequestType, string> = {
  loaner_computer: "Request Loaner Computer",
  return_computer: "Return Computer",
  license_request: "Request a Software License",
  mobile_request: "Mobile & Carrier Service",
};

export const TYPE_ROUTES: Record<ServiceRequestType, string> = {
  loaner_computer: "/portal/requests/loaner-computer",
  return_computer: "/portal/requests/return-computer",
  license_request: "/portal/requests/license",
  mobile_request: "/portal/requests/mobile",
};

// ---------- field helpers ----------

/** Digits, spaces, dashes, dots, parens, an optional leading +, an optional extension; 7-15 digits. */
export function isValidPhone(v: string): boolean {
  const s = v.trim();
  if (!/^\+?[\d\s().-]+(\s*(x|ext\.?)\s*\d{1,6})?$/i.test(s)) return false;
  const main = s.replace(/(x|ext\.?)\s*\d{1,6}$/i, "");
  const digits = main.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

export function isValidZip(v: string, country: string): boolean {
  if (country === "United States of America") return /^\d{5}(-\d{4})?$/.test(v.trim());
  return v.trim().length >= 2 && v.trim().length <= 12;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: string): boolean {
  if (!ISO_DATE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Today in the requester's time zone, YYYY-MM-DD (the server passes its own clock in tests). */
export function todayIso(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "District of Columbia", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas",
  "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York",
  "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Puerto Rico",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
  "Washington", "West Virginia", "Wisconsin", "Wyoming",
] as const;

export const COUNTRIES = ["United States of America", "Canada", "Mexico", "United Kingdom", "Other"] as const;
export const DEFAULT_COUNTRY = "United States of America";

/**
 * Reason for PC return. The first option names the client company at render
 * time ("User is leaving Acme"); stored as the stable key.
 */
export const RETURN_REASONS = [
  { key: "user_leaving", label: (company: string) => `User is leaving ${company || "the company"}` },
  { key: "device_refresh", label: () => "Device replacement / refresh" },
  { key: "no_longer_needed", label: () => "Device no longer needed" },
  { key: "damaged", label: () => "Device damaged or faulty" },
  { key: "loaner_end", label: () => "End of loaner period" },
  { key: "other", label: () => "Other" },
] as const;
export type ReturnReasonKey = (typeof RETURN_REASONS)[number]["key"];
const RETURN_REASON_KEYS = RETURN_REASONS.map((r) => r.key) as [ReturnReasonKey, ...ReturnReasonKey[]];

export function returnReasonLabel(key: string, company: string): string {
  return RETURN_REASONS.find((r) => r.key === key)?.label(company) ?? key;
}

export const MOBILE_ACTIVITY_GROUPS = [
  {
    key: "line_service",
    label: "Line & service",
    activities: [
      ["add_service_existing_device", "Add Service to Existing Device"],
      ["assign_line", "Assign Line"],
      ["change_phone_number", "Change Phone Number"],
      ["change_plan", "Change Plan"],
      ["disconnect_service", "Disconnect Service"],
      ["reactivate_line", "Reactivate Line"],
      ["suspend_service", "Suspend Service"],
      ["unsuspend_service", "Unsuspend Service"],
    ],
  },
  {
    key: "device_sim",
    label: "Device & SIM",
    activities: [
      ["assign_device", "Assign Device"],
      ["equipment_swap", "Equipment Swap"],
      ["new_device_without_service", "New Device (Without Service)"],
      ["order_iccid_sim", "Order ICCID/SIM Card"],
      ["order_new_device", "Order New Device"],
      ["upgrade_device", "Upgrade Device"],
      ["upgrade_eligibility_check", "Upgrade Eligibility Check"],
      ["warranty_replacement", "Warranty Replacement"],
    ],
  },
  {
    key: "features",
    label: "Features & voicemail",
    activities: [
      ["add_remove_features", "Add/Remove Features"],
      ["reset_voicemail_password", "Reset Voicemail Password"],
    ],
  },
  {
    key: "carrier",
    label: "Carrier",
    activities: [["change_carrier", "Change Carrier"]],
  },
  {
    key: "travel",
    label: "Travel",
    activities: [["travel_request", "Travel Request"]],
  },
  {
    key: "liability",
    label: "Transfers of Liability",
    activities: [
      ["transfer_corporate_to_personal", "Transfer Corporate Line to Personal"],
      ["transfer_personal_to_corporate", "Transfer Personal Line to Corporate"],
    ],
  },
] as const;

export const MOBILE_ACTIVITIES = MOBILE_ACTIVITY_GROUPS.flatMap((g) => g.activities.map(([key, label]) => ({ key, label, group: g.key }))) as readonly {
  key: string;
  label: string;
  group: string;
}[];
export type MobileActivityKey = (typeof MOBILE_ACTIVITY_GROUPS)[number]["activities"][number][0];
const MOBILE_ACTIVITY_KEYS = MOBILE_ACTIVITIES.map((a) => a.key) as [MobileActivityKey, ...MobileActivityKey[]];

export function mobileActivityLabel(key: string): string {
  return MOBILE_ACTIVITIES.find((a) => a.key === key)?.label ?? key;
}


// ---------- address ----------

export const addressSchema = z.object({
  street: z.string().trim().min(1, "Street is required").max(200),
  city: z.string().trim().min(1, "City is required").max(120),
  state: z.string().trim().min(1, "State is required").max(120),
  country: z.string().trim().min(1, "Country is required").max(120),
  zip: z.string().trim().min(1, "Zipcode is required").max(12),
});
export type ServiceRequestAddress = z.infer<typeof addressSchema>;

/** A client site (LID), entered by DE staff as a manual record of kind "site". */
export type ServiceRequestSite = ServiceRequestAddress & { id: string; code: string; name?: string };

/** A computer assigned to a user, entered by DE staff as a manual record of kind "computer_asset". */
export type ServiceRequestAsset = {
  id: string;
  assetTag: string;
  serialNumber?: string;
  model?: string;
  assignedUserId: string;
};

// ---------- per-type field schemas (what the browser sends) ----------

const shared = {
  requestedForUserId: z.string().trim().min(1, "Requested for is required").max(80),
  contactPhone: z
    .string()
    .trim()
    .min(1, "Contact phone number is required")
    .max(40)
    .refine(isValidPhone, "Enter a valid phone number"),
  siteId: z.string().trim().max(80).optional().nullable(),
  addressNotClientLocation: z.boolean().default(false),
  customAddress: addressSchema.optional().nullable(),
};

export const loanerFieldsSchema = z.object({
  ...shared,
  deviceKind: z.enum(["laptop", "desktop"]).default("laptop"),
  neededFrom: z.string().refine(isIsoDate, "Needed from date must be YYYY-MM-DD"),
  loanUntil: z.string().refine(isIsoDate, "Loan until must be YYYY-MM-DD"),
  accessories: z.string().trim().max(2000).optional().default(""),
  reason: z.string().trim().min(1, "Reason for a loaner computer is required").max(4000),
  additionalNotes: z.string().trim().max(4000).optional().default(""),
});
export type LoanerFields = z.infer<typeof loanerFieldsSchema>;

export const returnFieldsSchema = z.object({
  ...shared,
  returnReason: z.enum(RETURN_REASON_KEYS, { errorMap: () => ({ message: "Reason for PC return is required" }) }),
  assetId: z.string().trim().max(80).optional().nullable(),
  assetNotListed: z.boolean().default(false),
  manualAsset: z
    .object({
      assetTag: z.string().trim().max(80).optional().default(""),
      serialNumber: z.string().trim().max(80).optional().default(""),
      description: z.string().trim().max(500).optional().default(""),
    })
    .optional()
    .nullable(),
  accessories: z.string().trim().min(1, "Accessories to be returned with the PC is required").max(2000),
  preferredReturnDate: z
    .string()
    .optional()
    .nullable()
    .refine((v) => !v || isIsoDate(v), "Preferred return date must be YYYY-MM-DD"),
  additionalComments: z.string().trim().max(4000).optional().default(""),
});
export type ReturnFields = z.infer<typeof returnFieldsSchema>;

const PLATFORM_KEYS = LICENSE_PLATFORMS.map((p) => p.key) as [LicensePlatform, ...LicensePlatform[]];

/**
 * Request a Software License. The account is a person in the company, or a
 * non-person account (admin, service, shared) named by the requester, who is
 * then its owner (requestedForUserId).
 */
export const licenseFieldsSchema = z.object({
  accountKind: z.enum(["person", "admin", "service", "shared"]).default("person"),
  requestedForUserId: z.string().trim().min(1, "Requested for is required").max(80),
  accountName: z.string().trim().max(200).optional().default(""),
  platform: z.enum(PLATFORM_KEYS, { errorMap: () => ({ message: "Choose a platform" }) }),
  licenseKey: z.string().trim().min(1, "Choose a licence").max(60),
  operation: z.enum(["add", "remove"]).default("add"),
  businessJustification: z.string().trim().min(1, "Business justification is required").max(2000),
});
export type LicenseFields = z.infer<typeof licenseFieldsSchema>;

export const mobileFieldsSchema = z.object({
  requestedForUserId: z.string().trim().min(1, "Requested for is required").max(80),
  activity: z.enum(MOBILE_ACTIVITY_KEYS, { errorMap: () => ({ message: "Choose a mobile activity" }) }),
  mobileNumber: z.string().trim().max(40).optional().default(""),
  carrier: z.string().trim().max(120).optional().default(""),
  deviceIdentifier: z.string().trim().max(200).optional().default(""),
  effectiveDate: z
    .string()
    .optional()
    .default("")
    .refine((v) => !v || isIsoDate(v), "Effective date must be YYYY-MM-DD"),
  details: z.string().trim().min(1, "Tell us what you need changed").max(4000),
});
export type MobileFields = z.infer<typeof mobileFieldsSchema>;

export type AnyRequestFields = LoanerFields | ReturnFields | LicenseFields | MobileFields;

export type FieldErrors = Record<string, string>;

/**
 * Cross-field rules both the browser and the server run, after the schema:
 * dates in order and not in the past, LID vs custom address, asset vs manual
 * asset. Returns field-keyed messages ({} when valid).
 */
export function crossFieldErrors(
  type: ServiceRequestType,
  input: AnyRequestFields,
  today: string,
): FieldErrors {
  const errors: FieldErrors = {};
  if (type === "license_request") {
    const f = input as LicenseFields;
    if (f.accountKind !== "person" && !f.accountName) errors.accountName = "Name the account (for example svc-backup or helpdesk@)";
    return errors;
  }
  if (type === "mobile_request") {
    const f = input as MobileFields;
    if (f.effectiveDate && isIsoDate(f.effectiveDate) && f.effectiveDate < today) {
      errors.effectiveDate = "Requested effective date must be today or later";
    }
    return errors;
  }
  const fields = input as LoanerFields | ReturnFields;
  if (fields.addressNotClientLocation) {
    const parsed = addressSchema.safeParse(fields.customAddress ?? {});
    if (!parsed.success) {
      for (const issue of parsed.error.issues) errors[`customAddress.${issue.path.join(".")}`] = issue.message;
    } else if (!isValidZip(parsed.data.zip, parsed.data.country)) {
      errors["customAddress.zip"] = "Enter a ZIP or ZIP+4 (12345 or 12345-6789)";
    }
  } else if (!fields.siteId) {
    errors.siteId = "Site Location Code (LID) is required";
  }

  if (type === "loaner_computer") {
    const f = fields as LoanerFields;
    if (isIsoDate(f.neededFrom) && f.neededFrom < today) errors.neededFrom = "Needed from date must be today or later";
    if (isIsoDate(f.neededFrom) && isIsoDate(f.loanUntil) && f.loanUntil < f.neededFrom) {
      errors.loanUntil = "Loan until must be on or after the Needed from date";
    }
  } else {
    const f = fields as ReturnFields;
    if (f.assetNotListed) {
      const m = f.manualAsset;
      if (!m || !(m.assetTag || m.serialNumber || m.description)) {
        errors["manualAsset.assetTag"] = "Enter an asset tag, serial number or description";
      }
    } else if (!f.assetId) {
      errors.assetId = "Select a computer from your assigned assets";
    }
    if (f.preferredReturnDate && isIsoDate(f.preferredReturnDate) && f.preferredReturnDate < today) {
      errors.preferredReturnDate = "Preferred return date must be today or later";
    }
  }
  return errors;
}

export function fieldsSchemaFor(type: ServiceRequestType) {
  if (type === "license_request") return licenseFieldsSchema;
  if (type === "mobile_request") return mobileFieldsSchema;
  return type === "loaner_computer" ? loanerFieldsSchema : returnFieldsSchema;
}

/** Schema issues + cross-field rules, field-keyed. `data` is set only when there are no errors. */
export function validateServiceRequestFields(
  type: ServiceRequestType,
  input: unknown,
  today: string,
): { data?: AnyRequestFields; errors: FieldErrors } {
  const parsed = fieldsSchemaFor(type).safeParse(input);
  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_form";
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors };
  }
  const errors = crossFieldErrors(type, parsed.data as AnyRequestFields, today);
  return Object.keys(errors).length ? { errors } : { data: parsed.data, errors };
}

// ---------- the record as the Portal API returns it ----------

export type ServiceRequestPerson = { userId: string; name: string; email: string };

export type ServiceRequestStatusEvent = {
  status: ServiceRequestStatus;
  at: string;
  /** "requester" | "staff" | "hub" | "system" */
  by: string;
  note?: string | null;
};

export type ServiceRequestAttachment = {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  uploadedAt: string;
};

export type ServiceRequestRecord = {
  id: string;
  number: string;
  type: ServiceRequestType;
  status: ServiceRequestStatus;
  accountId: string;
  accountName: string;
  requestedFor: ServiceRequestPerson;
  submittedBy: ServiceRequestPerson;
  payload: Record<string, unknown>;
  site: ServiceRequestSite | null;
  customAddress: ServiceRequestAddress | null;
  attachments: ServiceRequestAttachment[];
  statusHistory: ServiceRequestStatusEvent[];
  revision: number;
  hubSyncStatus: "not_sent" | "queued" | "synced" | "retrying" | "failed";
  hubSyncedAt: string | null;
  deskTicketId: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

// ---------- Hub contract ----------

export const SERVICE_REQUEST_HUB_EVENT = "service_request.upserted" as const;
export const SERVICE_REQUEST_HUB_PATH = "/api/ingest/service-requests" as const;
export const SERVICE_REQUEST_HUB_ENTITY = "service_request" as const;

/**
 * Envelope payload for `service_request.upserted` (contract version 1). The
 * Hub upserts by `requestId` and keeps the row with the highest `revision`,
 * so a late retry of an older revision never overwrites a newer one.
 */
export type ServiceRequestHubPayload = {
  contractVersion: 1;
  requestId: string;
  number: string;
  type: ServiceRequestType;
  status: Exclude<ServiceRequestStatus, typeof BASKET_STATUS>;
  revision: number;
  portalClientId: string;
  accountName: string;
  requestedFor: ServiceRequestPerson;
  submittedBy: ServiceRequestPerson;
  fields: Record<string, unknown>;
  site: ServiceRequestSite | null;
  customAddress: ServiceRequestAddress | null;
  attachments: Array<Pick<ServiceRequestAttachment, "id" | "fileName" | "contentType" | "sizeBytes">>;
  statusHistory: ServiceRequestStatusEvent[];
  deskTicketId: string | null;
  submittedAt: string;
  updatedAt: string;
};

// ---------- help chat ----------

/**
 * Fields the Ask DE help chat may propose values for, per type. Identity,
 * site and asset are lookups with tenant rules, so the person picks those.
 * The server drops anything else the model returns; the browser checks again.
 */
export const SERVICE_REQUEST_AI_FILLABLE: Record<ServiceRequestType, readonly string[]> = {
  loaner_computer: ["contactPhone", "deviceKind", "neededFrom", "loanUntil", "accessories", "reason", "additionalNotes"],
  return_computer: [
    "contactPhone",
    "returnReason",
    "accessories",
    "preferredReturnDate",
    "additionalComments",
    "manualAsset.assetTag",
    "manualAsset.serialNumber",
    "manualAsset.description",
  ],
  license_request: ["businessJustification", "accountName"],
  mobile_request: ["activity", "mobileNumber", "carrier", "deviceIdentifier", "effectiveDate", "details"],
};

// ---------- required-information chips ----------

export type RequiredChip = { field: string; label: string };

/** Unfilled required fields in page order, for the right-rail chips. */
export function unfilledRequiredChips(type: ServiceRequestType, f: Record<string, any>): RequiredChip[] {
  const out: RequiredChip[] = [];
  const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
  if (blank(f.requestedForUserId)) out.push({ field: "requestedForUserId", label: "Requested for" });
  if (type === "license_request") {
    if (f.accountKind && f.accountKind !== "person" && blank(f.accountName)) out.push({ field: "accountName", label: "Account name" });
    if (blank(f.platform)) out.push({ field: "platform", label: "Platform" });
    if (blank(f.licenseKey)) out.push({ field: "licenseKey", label: "License" });
    if (blank(f.businessJustification)) out.push({ field: "businessJustification", label: "Business justification" });
    return out;
  }
  if (type === "mobile_request") {
    if (blank(f.activity)) out.push({ field: "activity", label: "Activity" });
    if (blank(f.details)) out.push({ field: "details", label: "What you need" });
    return out;
  }
  if (type === "loaner_computer") {
    if (blank(f.contactPhone)) out.push({ field: "contactPhone", label: "Contact phone number" });
    if (blank(f.neededFrom)) out.push({ field: "neededFrom", label: "Needed from date" });
    if (blank(f.loanUntil)) out.push({ field: "loanUntil", label: "Loan until" });
  } else {
    if (blank(f.contactPhone)) out.push({ field: "contactPhone", label: "Contact Phone Number" });
    if (blank(f.returnReason)) out.push({ field: "returnReason", label: "Reason for PC return" });
    if (!f.assetNotListed && blank(f.assetId)) out.push({ field: "assetId", label: "Select from your assigned assets" });
  }
  if (!f.addressNotClientLocation && blank(f.siteId)) out.push({ field: "siteId", label: "Site Location Code (LID)" });
  if (f.addressNotClientLocation) {
    const a = f.customAddress || {};
    for (const [k, label] of [
      ["street", "Street"],
      ["city", "City"],
      ["state", "State"],
      ["country", "Country"],
      ["zip", "Zipcode"],
    ] as const) {
      if (blank(a[k])) out.push({ field: `customAddress.${k}`, label });
    }
  }
  if (type === "loaner_computer") {
    if (blank(f.reason)) out.push({ field: "reason", label: "Reason for a loaner computer" });
  } else if (blank(f.accessories)) {
    out.push({ field: "accessories", label: "Accessories to be returned with the PC" });
  }
  return out;
}

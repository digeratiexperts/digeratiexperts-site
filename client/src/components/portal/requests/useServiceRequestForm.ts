import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_COUNTRY,
  RETURN_REASONS,
  SERVICE_REQUEST_AI_FILLABLE,
  todayIso,
  unfilledRequiredChips,
  validateServiceRequestFields,
  type FieldErrors,
  type ServiceRequestRecord,
  type ServiceRequestType,
} from "@shared/serviceRequests";
import { ServiceRequestApiError, srApi } from "@/lib/serviceRequestsApi";
import { PORTAL_TICKET_MAX_FILES, PORTAL_TICKET_MAX_FILE_BYTES, isAllowedPortalTicketExtension } from "@shared/portalTicketFileRules";

export type FormValues = Record<string, any>;

export function initialValues(type: ServiceRequestType): FormValues {
  if (type === "license_request") {
    return { requestedForUserId: "", accountKind: "person", accountName: "", platform: "", licenseKey: "", operation: "add", businessJustification: "" };
  }
  const common = {
    requestedForUserId: "",
    contactPhone: "",
    siteId: "",
    addressNotClientLocation: false,
    customAddress: { street: "", city: "", state: "", country: DEFAULT_COUNTRY, zip: "" },
  };
  if (type === "loaner_computer") {
    return { ...common, deviceKind: "laptop", neededFrom: "", loanUntil: "", accessories: "", reason: "", additionalNotes: "" };
  }
  return {
    ...common,
    returnReason: RETURN_REASONS[0].key,
    assetId: "",
    assetNotListed: false,
    manualAsset: { assetTag: "", serialNumber: "", description: "" },
    accessories: "",
    preferredReturnDate: "",
    additionalComments: "",
  };
}

/** Fields the help chat may fill (shared/serviceRequests.ts). */
export const AI_FILLABLE = SERVICE_REQUEST_AI_FILLABLE;

function setPath(obj: FormValues, path: string, value: unknown): FormValues {
  const [head, ...rest] = path.split(".");
  if (!rest.length) return { ...obj, [head]: value };
  return { ...obj, [head]: setPath(obj[head] ?? {}, rest.join("."), value) };
}

export function getPath(obj: FormValues, path: string): any {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj as any);
}

/** What the server receives: UI-only values dropped, unused branches nulled. */
export function toSubmission(type: ServiceRequestType, v: FormValues): Record<string, unknown> {
  if (type === "license_request") {
    return {
      requestedForUserId: v.requestedForUserId,
      accountKind: v.accountKind,
      accountName: v.accountKind === "person" ? "" : v.accountName,
      platform: v.platform || undefined,
      licenseKey: v.licenseKey,
      operation: v.operation,
      businessJustification: v.businessJustification,
    };
  }
  const out: Record<string, unknown> = { ...v };
  out.siteId = v.addressNotClientLocation ? null : v.siteId || null;
  out.customAddress = v.addressNotClientLocation ? v.customAddress : null;
  if (type === "return_computer") {
    out.assetId = v.assetNotListed ? null : v.assetId || null;
    out.manualAsset = v.assetNotListed ? v.manualAsset : null;
    out.preferredReturnDate = v.preferredReturnDate || null;
  }
  return out;
}

export type SubmitResult =
  | { kind: "submitted"; request: ServiceRequestRecord; attachmentFailures: string[] }
  | { kind: "basket"; request: ServiceRequestRecord; attachmentFailures: string[] };

export function useServiceRequestForm(type: ServiceRequestType) {
  const [values, setValues] = useState<FormValues>(() => initialValues(type));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState<false | "submit" | "basket">(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const timers = useRef<number[]>([]);
  const valuesRef = useRef(values);
  valuesRef.current = values;

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const today = todayIso();

  const revalidate = useCallback(
    (next: FormValues) => {
      if (!attempted) return;
      setErrors(validateServiceRequestFields(type, toSubmission(type, next), today).errors);
    },
    [attempted, type, today],
  );

  const setField = useCallback(
    (path: string, value: unknown) => {
      setValues((prev) => {
        const next = setPath(prev, path, value);
        revalidate(next);
        return next;
      });
    },
    [revalidate],
  );

  const patch = useCallback(
    (entries: Record<string, unknown>) => {
      setValues((prev) => {
        let next = prev;
        for (const [k, v] of Object.entries(entries)) next = setPath(next, k, v);
        revalidate(next);
        return next;
      });
    },
    [revalidate],
  );

  /** Help chat fill: only whitelisted keys; returns what was applied. Never submits. */
  const fillFromAssistant = useCallback(
    (entries: Record<string, unknown>): string[] => {
      const allowed = new Set(AI_FILLABLE[type]);
      const applied: Record<string, unknown> = {};
      for (const [k, raw] of Object.entries(entries || {})) {
        if (!allowed.has(k) || raw === undefined || raw === null) continue;
        let v: unknown = typeof raw === "string" ? raw.slice(0, 2000) : raw;
        if (k === "deviceKind" && v !== "laptop" && v !== "desktop") continue;
        if (k === "returnReason" && !RETURN_REASONS.some((r) => r.key === v)) continue;
        if (typeof v !== "string") v = String(v);
        applied[k] = v;
      }
      if (type === "return_computer" && Object.keys(applied).some((k) => k.startsWith("manualAsset."))) {
        applied.assetNotListed = true;
      }
      const keys = Object.keys(applied);
      if (!keys.length) return [];
      patch(applied);
      setHighlighted((prev) => new Set([...prev, ...keys]));
      const t = window.setTimeout(() => {
        setHighlighted((prev) => {
          const next = new Set(prev);
          keys.forEach((k) => next.delete(k));
          return next;
        });
      }, 2600);
      timers.current.push(t);
      setAnnouncement(`The assistant filled ${keys.length} field${keys.length === 1 ? "" : "s"}. Review them before you submit.`);
      return keys.filter((k) => k !== "assetNotListed");
    },
    [patch, type],
  );

  const chips = useMemo(() => unfilledRequiredChips(type, values), [type, values]);

  const addFiles = useCallback((list: FileList | File[]) => {
    setFileError(null);
    const incoming = Array.from(list);
    setFiles((prev) => {
      const next = [...prev];
      for (const f of incoming) {
        if (!isAllowedPortalTicketExtension(f.name)) {
          setFileError(`${f.name}: allowed types are PNG, JPG, PDF, TXT and LOG`);
          continue;
        }
        if (f.size > PORTAL_TICKET_MAX_FILE_BYTES) {
          setFileError(`${f.name} is larger than 10 MB`);
          continue;
        }
        if (next.length >= PORTAL_TICKET_MAX_FILES) {
          setFileError(`Up to ${PORTAL_TICKET_MAX_FILES} attachments per request`);
          break;
        }
        next.push(f);
      }
      return next;
    });
  }, []);

  const removeFile = useCallback((index: number) => setFiles((prev) => prev.filter((_, i) => i !== index)), []);

  const focusField = useCallback((field: string) => {
    const id = FIELD_DOM_IDS[field] ?? field;
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    el.focus({ preventScroll: true });
  }, []);

  const submit = useCallback(
    async (mode: "submit" | "basket"): Promise<SubmitResult | null> => {
      setAttempted(true);
      setFormError(null);
      const current = valuesRef.current;
      const checked = validateServiceRequestFields(type, toSubmission(type, current), today);
      setErrors(checked.errors);
      const keys = Object.keys(checked.errors);
      if (keys.length) {
        setAnnouncement(`${keys.length} field${keys.length === 1 ? " needs" : "s need"} attention: ${keys.map(labelFor).join(", ")}.`);
        focusField(firstInPageOrder(keys));
        return null;
      }
      setBusy(mode);
      try {
        const { request } = await srApi.create(type, toSubmission(type, current), mode);
        const attachmentFailures: string[] = [];
        for (const f of files) {
          try {
            await srApi.attach(request.id, f);
          } catch {
            attachmentFailures.push(f.name);
          }
        }
        setAnnouncement(mode === "submit" ? `Request ${request.number} submitted.` : `Added ${request.number} to your request basket.`);
        return { kind: mode === "submit" ? "submitted" : "basket", request, attachmentFailures };
      } catch (error) {
        if (error instanceof ServiceRequestApiError && Object.keys(error.fieldErrors).length) {
          setErrors(error.fieldErrors);
          const k = Object.keys(error.fieldErrors);
          setAnnouncement(`${k.length} field${k.length === 1 ? " needs" : "s need"} attention.`);
          focusField(firstInPageOrder(k));
        } else {
          const message = error instanceof Error ? error.message : "Something went wrong";
          setFormError(message);
          setAnnouncement(message);
        }
        return null;
      } finally {
        setBusy(false);
      }
    },
    [files, focusField, today, type],
  );

  const reset = useCallback(
    (keep: Partial<FormValues> = {}) => {
      setValues({ ...initialValues(type), ...keep });
      setErrors({});
      setAttempted(false);
      setFiles([]);
      setFormError(null);
    },
    [type],
  );

  return {
    values,
    setField,
    patch,
    errors,
    chips,
    highlighted,
    isHighlighted: (k: string) => highlighted.has(k),
    fillFromAssistant,
    files,
    addFiles,
    removeFile,
    fileError,
    busy,
    formError,
    announcement,
    submit,
    reset,
    focusField,
    today,
  };
}

/** DOM ids for the field keys (lookups render their combobox button with this id). */
export const FIELD_DOM_IDS: Record<string, string> = {
  requestedForUserId: "sr-requested-for",
  contactPhone: "sr-contact-phone",
  deviceKind: "sr-device-laptop",
  neededFrom: "sr-needed-from",
  loanUntil: "sr-loan-until",
  siteId: "sr-site",
  "customAddress.street": "sr-addr-street",
  "customAddress.city": "sr-addr-city",
  "customAddress.state": "sr-addr-state",
  "customAddress.country": "sr-addr-country",
  "customAddress.zip": "sr-addr-zip",
  accessories: "sr-accessories",
  reason: "sr-reason",
  additionalNotes: "sr-notes",
  returnReason: "sr-return-reason",
  assetId: "sr-asset",
  "manualAsset.assetTag": "sr-manual-asset-tag",
  "manualAsset.serialNumber": "sr-manual-asset-serial",
  "manualAsset.description": "sr-manual-asset-description",
  preferredReturnDate: "sr-preferred-return",
  accountName: "sr-account-name",
  platform: "sr-platform",
  licenseKey: "sr-license",
  businessJustification: "sr-justification",
  additionalComments: "sr-comments",
};

const PAGE_ORDER = Object.keys(FIELD_DOM_IDS);

function firstInPageOrder(keys: string[]): string {
  return [...keys].sort((a, b) => {
    const ia = PAGE_ORDER.indexOf(a);
    const ib = PAGE_ORDER.indexOf(b);
    return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib);
  })[0];
}

const LABELS: Record<string, string> = {
  requestedForUserId: "Requested for",
  contactPhone: "Contact phone number",
  neededFrom: "Needed from date",
  loanUntil: "Loan until",
  siteId: "Site Location Code",
  reason: "Reason for a loaner computer",
  returnReason: "Reason for PC return",
  assetId: "Assigned asset",
  "manualAsset.assetTag": "Computer details",
  accessories: "Accessories",
  preferredReturnDate: "Preferred return date",
  accountName: "Account name",
  platform: "Platform",
  licenseKey: "License",
  businessJustification: "Business justification",
  "customAddress.street": "Street",
  "customAddress.city": "City",
  "customAddress.state": "State",
  "customAddress.country": "Country",
  "customAddress.zip": "Zipcode",
};

function labelFor(key: string): string {
  return LABELS[key] ?? key;
}

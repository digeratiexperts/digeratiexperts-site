import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { queryClient } from "@/lib/queryClient";
import { portalGet } from "@/lib/portalApi";
import { Link } from "wouter";
import { Callout, Field, Panel, Token } from "@/components/portal/ui";

type MeResponse = {
  success?: boolean;
  user?: {
    email?: string;
    managerUserId?: string | null;
    manager?: { id: string; email: string; fullName: string } | null;
    companyDomains?: string[];
  };
};

function emailDomain(email: string): string | null {
  const t = email.trim().toLowerCase();
  const at = t.lastIndexOf("@");
  if (at < 1 || at === t.length - 1) return null;
  return t.slice(at + 1);
}

function isPrivilegedAccess(formData: Record<string, unknown>): boolean {
  const level = String(formData.accessLevel || "");
  const resource = String(formData.resourceType || "");
  return /admin|privileged/i.test(level) || /privileged|admin/i.test(resource);
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "email" | "select" | "checkbox" | "textarea" | "date";
  required: boolean;
  options?: string[];
  placeholder?: string;
  helperText?: string;
  /** Show this field only when another field matches */
  showWhen?: { fieldId: string; equals?: string; oneOf?: string[] };
}

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  ticketCategory: string;
  fields: FormField[];
}

/**
 * Access Request options map to DE-managed access patterns evidenced in:
 * - ProActive Ecosystem (M365/Entra, MFA/SSO, onboarding, PAM)
 * - Standalone Network & Secure Access
 * - Managed Workplace / SaaS lifecycle
 * - UCaaS catalog
 * - Client Portal + Zoho Assist / remote support
 * - Client-owned credentials/tenants (Bill of Rights / sales process)
 */
const ACCESS_RESOURCE_TYPES = [
  "Microsoft 365 / Entra ID (user, group, mailbox, SharePoint/Teams, admin role)",
  "VPN / remote access",
  "Line-of-business application",
  "Shared mailbox / distribution list",
  "File share / cloud storage (SharePoint, OneDrive, managed storage)",
  "Privileged / admin access (PAM-aware)",
  "Client-owned admin or security console",
  "Network resource / printer / Wi-Fi",
  "Vendor / third-party SaaS",
  "UCaaS / phone system",
  "Client Portal user access",
  "Other",
] as const;

const ACCESS_LEVELS = [
  "Read / view only",
  "Standard user",
  "Contribute / edit",
  "Admin / privileged",
] as const;

const formTemplates: FormTemplate[] = [
  {
    id: "FT-001",
    name: "Access Request",
    description:
      "Request access to Microsoft 365, apps, remote access, shared resources, or other systems DE manages for your organization",
    ticketCategory: "Access & Security",
    fields: [
      {
        id: "requestFor",
        label: "Who needs access?",
        type: "select",
        required: true,
        options: ["Myself (logged-in user)", "Another user (named below)"],
        helperText: "Select whether this request is for you or for someone else at your company.",
      },
      {
        id: "userName",
        label: "User full name",
        type: "text",
        required: true,
        placeholder: "First and last name",
        showWhen: { fieldId: "requestFor", equals: "Another user (named below)" },
      },
      {
        id: "userEmail",
        label: "User work email",
        type: "email",
        required: true,
        placeholder: "name@company.com",
        showWhen: { fieldId: "requestFor", equals: "Another user (named below)" },
        helperText: "Use the user's primary work email (usually their Microsoft 365 / Entra ID sign-in).",
      },
      {
        id: "resourceType",
        label: "Access type",
        type: "select",
        required: true,
        options: [...ACCESS_RESOURCE_TYPES],
        helperText:
          "Choose the closest match. DE provisions access for systems we manage under your agreement; client-owned consoles stay under your ownership per the Client Bill of Rights.",
      },
      {
        id: "resourceOther",
        label: "Describe the other access needed",
        type: "text",
        required: true,
        placeholder: "e.g. specific system, vendor portal, or resource",
        showWhen: { fieldId: "resourceType", equals: "Other" },
      },
      {
        id: "resourceName",
        label: "Resource name or URL",
        type: "text",
        required: true,
        placeholder: "e.g. Finance SharePoint site, VPN profile name, app.vendor.com",
        helperText: "Name the mailbox, site, app, group, console, or network resource as specifically as you can.",
      },
      {
        id: "accessLevel",
        label: "Access level",
        type: "select",
        required: true,
        options: [...ACCESS_LEVELS],
        helperText:
          "Request least privilege needed. Admin / privileged access may require manager approval and PAM controls where applicable.",
      },
      {
        id: "duration",
        label: "Access duration",
        type: "select",
        required: true,
        options: ["Permanent (until revoked)", "Temporary (date range)"],
      },
      {
        id: "startDate",
        label: "Access start date",
        type: "date",
        required: false,
        helperText: "Optional. Leave blank if access should start as soon as approved.",
      },
      {
        id: "endDate",
        label: "Access end date",
        type: "date",
        required: true,
        showWhen: { fieldId: "duration", equals: "Temporary (date range)" },
        helperText: "Temporary access will be scheduled for review/removal on this date.",
      },
      {
        id: "justification",
        label: "Business justification",
        type: "textarea",
        required: true,
        placeholder:
          "Why is this access required? Include role, project, or business process that depends on it.",
      },
      {
        id: "managerEmail",
        label: "Manager / approver email",
        type: "email",
        required: false,
        placeholder: "manager@yourcompany.com",
        helperText:
          "Optional but recommended for admin/privileged requests. DE may route for client approval before provisioning. Must be your company domain and must match the manager listed on your profile (People & Org).",
      },
      {
        id: "urgency",
        label: "Urgency",
        type: "select",
        required: true,
        options: ["Low", "Medium", "High", "Critical"],
        helperText: "Critical = user blocked from core work. High = needed within one business day.",
      },
      {
        id: "managerApproval",
        label: "I confirm this request is authorized by my company and the details are accurate",
        type: "checkbox",
        required: true,
      },
    ],
  },
  {
    id: "FT-002",
    name: "Device Request",
    description: "Request new hardware or device replacement",
    ticketCategory: "Hardware & Devices",
    fields: [
      {
        id: "f1",
        label: "Device Type",
        type: "select",
        required: true,
        options: ["Laptop", "Desktop", "Monitor", "Printer", "Phone"],
      },
      {
        id: "f2",
        label: "Replacement / New Device",
        type: "select",
        required: true,
        options: ["Replacement (existing device)", "New Device"],
      },
      {
        id: "f3",
        label: "Specifications Needed",
        type: "textarea",
        required: false,
        placeholder: "Any specific requirements?",
      },
    ],
  },
  {
    id: "FT-003",
    name: "Onboarding Request",
    description: "Submit new employee onboarding information",
    ticketCategory: "Access & Security",
    fields: [
      {
        id: "f1",
        label: "Full Name",
        type: "text",
        required: true,
        placeholder: "First and Last Name",
      },
      {
        id: "f2",
        label: "Email",
        type: "email",
        required: true,
        placeholder: "name@company.com",
      },
      {
        id: "f3",
        label: "Department",
        type: "select",
        required: true,
        options: ["Sales", "Marketing", "Engineering", "Operations", "HR"],
      },
      {
        id: "f4",
        label: "Start Date",
        type: "text",
        required: true,
        placeholder: "MM/DD/YYYY",
      },
    ],
  },
];

function fieldIsVisible(field: FormField, formData: Record<string, unknown>): boolean {
  if (!field.showWhen) return true;
  const value = String(formData[field.showWhen.fieldId] ?? "");
  if (field.showWhen.equals !== undefined) return value === field.showWhen.equals;
  if (field.showWhen.oneOf) return field.showWhen.oneOf.includes(value);
  return true;
}

function urgencyToPriority(urgency: string): string {
  const map: Record<string, string> = {
    Low: "low",
    Medium: "medium",
    High: "high",
    Critical: "critical",
  };
  return map[urgency] || "medium";
}

function buildTicketPayload(
  template: FormTemplate,
  formData: Record<string, unknown>,
  visibleFields: FormField[]
): { subject: string; description: string; priority: string; category: string } {
  const lines = visibleFields
    .filter((f) => f.type !== "checkbox")
    .map((f) => {
      const raw = formData[f.id];
      const value =
        raw === undefined || raw === null || raw === ""
          ? "(not provided)"
          : typeof raw === "boolean"
            ? raw
              ? "Yes"
              : "No"
            : String(raw);
      return `${f.label}: ${value}`;
    });

  if (template.id === "FT-001") {
    const resourceType = String(formData.resourceType || "Access");
    const resourceName = String(formData.resourceName || "").trim();
    const subject = resourceName
      ? `Access Request: ${resourceType.split(" (")[0]} — ${resourceName}`
      : `Access Request: ${resourceType.split(" (")[0]}`;

    return {
      subject: subject.slice(0, 200),
      description: [
        "Portal Access Request",
        "",
        ...lines,
        "",
        "Submitted via Client Portal → Request Forms → Access Request",
      ].join("\n"),
      priority: urgencyToPriority(String(formData.urgency || "Medium")),
      category: template.ticketCategory,
    };
  }

  const subjectParts = visibleFields
    .filter((f) => f.type === "select" || f.type === "text" || f.type === "email")
    .slice(0, 2)
    .map((f) => String(formData[f.id] || "").trim())
    .filter(Boolean);

  return {
    subject: `${template.name}${subjectParts.length ? `: ${subjectParts.join(" — ")}` : ""}`.slice(0, 200),
    description: [
      `Portal ${template.name}`,
      "",
      ...lines,
      "",
      `Submitted via Client Portal → Request Forms → ${template.name}`,
    ].join("\n"),
    priority: urgencyToPriority(String(formData.urgency || formData.f_urgency || "Medium")),
    category: template.ticketCategory,
  };
}

export function PortalAdvancedForms() {
  const [, navigate] = useLocation();
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [ticketNumber, setTicketNumber] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { data: meData } = useQuery<MeResponse>({
    queryKey: ["/api/portal/me"],
    queryFn: () => portalGet<MeResponse>("/api/portal/me"),
  });
  const manager = meData?.user?.manager || null;
  const companyDomains = meData?.user?.companyDomains || [];
  const hasManagerOnProfile = !!meData?.user?.managerUserId && !!manager?.email;

  useEffect(() => {
    if (selectedTemplate?.id !== "FT-001") return;
    if (formData.managerEmail) return;
    if (manager?.email) {
      setFormData((prev) => ({ ...prev, managerEmail: manager.email }));
    }
  }, [selectedTemplate?.id, manager?.email]);

  const visibleFields = useMemo(() => {
    if (!selectedTemplate) return [];
    return selectedTemplate.fields.filter((f) => fieldIsVisible(f, formData));
  }, [selectedTemplate, formData]);

  const privileged = selectedTemplate?.id === "FT-001" && isPrivilegedAccess(formData);

  const handleFieldChange = (fieldId: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [fieldId]: value }));
    setFieldErrors((prev) => {
      if (!prev[fieldId]) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  };

  const validate = (): boolean => {
    if (!selectedTemplate) return false;
    const errors: Record<string, string> = {};

    for (const field of visibleFields) {
      const value = formData[field.id];
      if (!field.required) continue;

      if (field.type === "checkbox") {
        if (!value) errors[field.id] = "This confirmation is required.";
        continue;
      }

      if (value === undefined || value === null || String(value).trim() === "") {
        errors[field.id] = `${field.label} is required.`;
      }
    }

    if (
      formData.duration === "Temporary (date range)" &&
      formData.startDate &&
      formData.endDate &&
      String(formData.endDate) < String(formData.startDate)
    ) {
      errors.endDate = "End date must be on or after the start date.";
    }

    if (selectedTemplate.id === "FT-001") {
      const mgrEmail = String(formData.managerEmail || "").trim().toLowerCase();
      const priv = isPrivilegedAccess(formData);

      // Privileged: manager must exist on profile; email field optional but validated when present
      if (priv && !hasManagerOnProfile) {
        errors.managerEmail =
          "Admin / privileged requests require a manager on your profile (People & Org). Then enter their company-domain email here.";
      }

      if (mgrEmail) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mgrEmail)) {
          errors.managerEmail = "Enter a valid manager / approver email.";
        } else {
          const domain = emailDomain(mgrEmail);
          if (companyDomains.length && domain && !companyDomains.includes(domain)) {
            errors.managerEmail = `Must use your company domain (${companyDomains.join(", ")}).`;
          } else if (!hasManagerOnProfile) {
            errors.managerEmail =
              "No manager is listed on your profile. Ask your Company IT Contact to assign one under People & Org.";
          } else if (manager && mgrEmail !== manager.email.toLowerCase()) {
            errors.managerEmail = `Must match your assigned manager (${manager.email}).`;
          }
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const resetForm = () => {
    setSelectedTemplate(null);
    setFormData({});
    setFieldErrors({});
    setSubmitError("");
    setTicketNumber(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    if (!validate()) return;

    setSubmitting(true);
    setSubmitError("");

    try {
      const payload = buildTicketPayload(selectedTemplate, formData, visibleFields);
      const needsApproval =
        selectedTemplate.id === "FT-001" ||
        selectedTemplate.id === "FT-002" ||
        /access|device|license|hardware/i.test(selectedTemplate.name);

      const response = await fetch(
        needsApproval ? "/api/portal/approvals" : "/api/portal/tickets",
        {
          method: "POST",
          body: JSON.stringify(
            needsApproval
              ? {
                  type: selectedTemplate.ticketCategory || selectedTemplate.name,
                  title: payload.subject,
                  description: payload.description,
                  priority: payload.priority,
                  payload: { formId: selectedTemplate.id, fields: formData },
                }
              : payload,
          ),
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("portalToken")}`,
          },
        },
      );

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Failed to submit request");
      }

      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/approvals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/dashboard"] });

      setTicketNumber(
        result.request?.requestNumber || result.ticket?.ticketNumber || null,
      );
      setSubmitted(true);
      setTimeout(() => {
        setSubmitted(false);
        resetForm();
        navigate(needsApproval ? "/portal/approvals" : "/portal/tickets");
      }, 2500);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to submit request. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const selectTemplate = (template: FormTemplate) => {
    setSelectedTemplate(template);
    setFormData({});
    setFieldErrors({});
    setSubmitError("");
  };

  const renderContent = () => {
    if (submitted) {
      return (
        <Callout tone="ok" title="Request submitted successfully" role="status">
          {ticketNumber ? `Reference ${ticketNumber} was created.` : "Your request was created."} Redirecting…
        </Callout>
      );
    }

    if (!selectedTemplate) {
      return (
        <div className="grid gap-4 md:grid-cols-2" role="list" aria-label="Request forms">
          {formTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              role="listitem"
              onClick={() => selectTemplate(template)}
              className="group flex min-h-[44px] flex-col rounded-xl border border-border bg-card p-4 text-left text-card-foreground transition-colors pt-hover-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5"
              data-testid={`form-template-${template.id}`}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="font-heading text-[15px] font-semibold leading-snug">{template.name}</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
              </span>
              <span className="mt-1.5 flex-1 text-sm text-muted-foreground">{template.description}</span>
              <span className="mt-4">
                <Token label={`${template.fields.length} fields`} tone="neutral" />
              </span>
            </button>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {selectedTemplate.id === "FT-001" && (
          <Callout tone="info" title="This request goes through an approval workflow">
            <div className="space-y-2">
              <p>
                Submitting starts an approval workflow (your manager → optional skip-level → IT Contact) before
                Digerati provisions access. For break/fix issues, open a regular support ticket instead.
              </p>
              <p>
                <strong className="text-foreground">Manager / approver email</strong> is optional but recommended for admin/privileged
                requests. DE may route for client approval before provisioning. The address must be on your
                company domain
                {companyDomains.length ? ` (${companyDomains.join(", ")})` : ""} and must match the manager
                listed on your profile
                {manager?.email ? ` — currently ${manager.fullName} (${manager.email})` : ""}.
                {!hasManagerOnProfile && (
                  <>
                    {" "}
                    No manager is assigned yet — ask your Company IT Contact to set one under{" "}
                    <Link href="/portal/people" className="pt-link font-medium hover:underline">
                      People & Org
                    </Link>
                    .
                  </>
                )}
              </p>
            </div>
          </Callout>
        )}

        {selectedTemplate.id === "FT-001" && privileged && (
          <Callout tone="warn" title="Admin / privileged access">
            Confirm <strong className="text-foreground">Manager / approver email</strong> matches your
            profile manager on the company domain so DE can route client approval before provisioning.
          </Callout>
        )}

        {submitError && (
          <Callout tone="bad" title="Something needs attention" testId="error-message">
            {submitError}
          </Callout>
        )}

        <Panel id="request-form" title={selectedTemplate.name} description={selectedTemplate.description}>
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {visibleFields.map((field) => {
              const error = fieldErrors[field.id];
              const inputId = `form-field-${field.id}`;
              const helpId = `${inputId}-help`;
              const errorId = `${inputId}-error`;
              const describedBy = [field.helperText ? helpId : null, error ? errorId : null]
                .filter(Boolean)
                .join(" ") || undefined;
              const controlClass = "border-border bg-background";

              if (field.type === "checkbox") {
                return (
                  <div key={field.id} className="space-y-1.5">
                    <label htmlFor={inputId} className="flex min-h-[44px] cursor-pointer items-start gap-2.5 text-sm">
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={Boolean(formData[field.id])}
                        onChange={(e) => handleFieldChange(field.id, e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border accent-primary"
                        required={field.required}
                        aria-invalid={!!error}
                        aria-describedby={describedBy}
                        data-testid={`checkbox-form-${field.id}`}
                      />
                      <span>
                        {field.label}
                        {field.required && (
                          <span className="pt-link ml-0.5" aria-hidden>
                            *
                          </span>
                        )}
                      </span>
                    </label>
                    {field.helperText && (
                      <p id={helpId} className="text-xs text-muted-foreground">
                        {field.helperText}
                      </p>
                    )}
                    {error && (
                      <p id={errorId} className="pt-ink pt-tone-bad text-xs" role="alert">
                        {error}
                      </p>
                    )}
                  </div>
                );
              }

              return (
                <Field
                  key={field.id}
                  label={field.label}
                  htmlFor={inputId}
                  required={field.required}
                  hint={field.helperText ? <span id={helpId}>{field.helperText}</span> : undefined}
                  error={error ? <span id={errorId}>{error}</span> : undefined}
                >
                  {field.type === "text" && (
                    <Input
                      id={inputId}
                      type="text"
                      placeholder={field.placeholder}
                      value={String(formData[field.id] ?? "")}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      className={controlClass}
                      data-testid={`input-form-${field.id}`}
                    />
                  )}

                  {field.type === "email" && (
                    <Input
                      id={inputId}
                      type="email"
                      placeholder={field.placeholder}
                      value={String(formData[field.id] ?? "")}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      className={controlClass}
                      data-testid={`input-form-${field.id}`}
                    />
                  )}

                  {field.type === "date" && (
                    <Input
                      id={inputId}
                      type="date"
                      value={String(formData[field.id] ?? "")}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      className={controlClass}
                      data-testid={`input-form-${field.id}`}
                    />
                  )}

                  {field.type === "select" && (
                    <select
                      id={inputId}
                      className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={String(formData[field.id] ?? "")}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      data-testid={`select-form-${field.id}`}
                    >
                      <option value="">Select an option…</option>
                      {field.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}

                  {field.type === "textarea" && (
                    <Textarea
                      id={inputId}
                      placeholder={field.placeholder}
                      value={String(formData[field.id] ?? "")}
                      onChange={(e) => handleFieldChange(field.id, e.target.value)}
                      className={`min-h-24 ${controlClass}`}
                      required={field.required}
                      aria-invalid={!!error}
                      aria-describedby={describedBy}
                      data-testid={`textarea-form-${field.id}`}
                    />
                  )}
                </Field>
              );
            })}

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" variant="brand" disabled={submitting} data-testid="button-submit-advanced-form">
                {submitting ? "Submitting…" : "Submit Request"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="border-border bg-card hover:bg-accent"
                onClick={resetForm}
                data-testid="button-back-to-forms"
              >
                Back to Forms
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    );
  };

  const inForm = !!selectedTemplate && !submitted;

  return (
    <PortalLayout
      title="Request Forms"
      description={
        selectedTemplate && !submitted
          ? `${selectedTemplate.name} · fields marked * are required.`
          : "Pick a form and submit your request. Each submission creates a ticket for the DE team, routed for approval where needed."
      }
      eyebrow={inForm ? "Request Forms" : undefined}
      width={inForm ? "narrow" : "default"}
    >
      {renderContent()}
    </PortalLayout>
  );
}

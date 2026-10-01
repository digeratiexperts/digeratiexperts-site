import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Paperclip, Phone, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PortalLayout } from "./PortalLayout";
import { queryClient } from "@/lib/queryClient";
import { portalFetch } from "@/lib/portalApi";
import {
  PORTAL_TICKET_ACCEPT,
  PORTAL_TICKET_MAX_FILES,
  uploadPortalTicketAttachment,
  validatePortalTicketFile,
} from "@/lib/portalTicketAttach";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { isDeAdmin, readImpersonatingCompany, readPortalUser } from "@/lib/portalRoles";
import { INTERNAL_COMPANY_NAME, NO_CLIENT_TICKET_ERROR, ticketCompanyName } from "@shared/portalTicketOrg";
import { Callout, Field, Panel } from "@/components/portal/ui";

const DESK_TICKET_DRAFT_KEY = "de-portal-desk-ticket-draft";

const CATEGORIES = [
  "Email",
  "Access & Security",
  "Network & VPN",
  "Software & Applications",
  "Hardware & Devices",
  "Backup & Recovery",
  "Collaboration",
  "Other",
];

const PRIORITIES: { value: string; label: string; hint: string }[] = [
  { value: "low", label: "Low", hint: "Can wait a few days" },
  { value: "medium", label: "Medium", hint: "Soon; response within 24 hours" },
  { value: "high", label: "High", hint: "Urgent; response within 4 hours" },
  { value: "critical", label: "Critical", hint: "Something is down; call us as well" },
];

export default function PortalCreateTicket() {
  const [, navigate] = useLocation();
  const portalUser = readPortalUser();
  const impersonatingCompany = readImpersonatingCompany();
  const isAdmin = isDeAdmin(portalUser);
  const filingCompanyName =
    ticketCompanyName(impersonatingCompany) ||
    ticketCompanyName(portalUser?.client) ||
    (isAdmin ? INTERNAL_COMPANY_NAME : "");
  const canSubmitWithoutClient = isAdmin;
  const missingClient = !portalUser?.clientId && !impersonatingCompany?.id && !canSubmitWithoutClient;
  const [formData, setFormData] = useState({ subject: "", category: "", priority: "medium", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftNotice, setDraftNotice] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DESK_TICKET_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as { subject?: string; description?: string; priority?: string };
      sessionStorage.removeItem(DESK_TICKET_DRAFT_KEY);
      setFormData((prev) => ({
        ...prev,
        subject: typeof draft.subject === "string" ? draft.subject.slice(0, 200) : prev.subject,
        description: typeof draft.description === "string" ? draft.description.slice(0, 5000) : prev.description,
        priority:
          draft.priority === "low" || draft.priority === "medium" || draft.priority === "high" || draft.priority === "urgent"
            ? draft.priority
            : prev.priority,
      }));
      setDraftNotice(true);
    } catch {
      sessionStorage.removeItem(DESK_TICKET_DRAFT_KEY);
    }
  }, []);

  const addFiles = (incoming: FileList | File[]) => {
    const next = [...files];
    const problems: string[] = [];
    for (const file of Array.from(incoming)) {
      if (next.length >= PORTAL_TICKET_MAX_FILES) {
        problems.push(`You can attach up to ${PORTAL_TICKET_MAX_FILES} files.`);
        break;
      }
      const invalid = validatePortalTicketFile(file);
      if (invalid) {
        problems.push(invalid);
        continue;
      }
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) continue;
      next.push(file);
    }
    setFiles(next);
    setError(problems.length ? problems[0] : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (missingClient) {
      setError(NO_CLIENT_TICKET_ERROR);
      return;
    }
    setSubmitting(true);
    setError("");

    try {
      const ticketData = {
        subject: formData.subject,
        category: formData.category,
        priority: formData.priority,
        description: formData.description,
        ...(impersonatingCompany?.id || portalUser?.clientId ? { clientId: impersonatingCompany?.id || portalUser?.clientId } : {}),
      };

      const response = await portalFetch("/api/portal/tickets", { method: "POST", body: JSON.stringify(ticketData) });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to create ticket");
      }

      const created = (await response.json()) as { ticket?: { id?: string } };
      const ticketId = created.ticket?.id;
      const attachErrors: string[] = [];
      if (ticketId && files.length) {
        for (const file of files) {
          try {
            await uploadPortalTicketAttachment(ticketId, file);
          } catch (attachErr) {
            attachErrors.push(attachErr instanceof Error ? attachErr.message : `Could not attach ${file.name}.`);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/dashboard"] });

      setFormData({ subject: "", category: "", priority: "medium", description: "" });
      setFiles([]);
      if (ticketId && attachErrors.length) {
        navigate(`/portal/tickets/${ticketId}`);
        setError(`Ticket created, but ${attachErrors.length} file${attachErrors.length === 1 ? "" : "s"} did not attach: ${attachErrors[0]}`);
        return;
      }
      navigate(ticketId ? `/portal/tickets/${ticketId}` : "/portal/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = !missingClient && !!formData.subject && !!formData.category && !!formData.description && !submitting;

  return (
    <PortalLayout
      title="New support ticket"
      description="Tell us what's wrong. A DE engineer picks it up and you'll see every reply here."
      backHref="/portal/tickets"
      backLabel="Back to tickets"
      width="narrow"
    >
      <div className="space-y-4">
        {error && (
          <Callout tone="bad" title="Something needs attention" testId="error-message">
            {error}
          </Callout>
        )}

        {missingClient && !error && (
          <Callout tone="bad" testId="missing-client-message">
            {NO_CLIENT_TICKET_ERROR}
          </Callout>
        )}

        {isAdmin && !missingClient && (
          <Callout tone="info" testId="internal-ticket-context">
            {impersonatingCompany?.id ? `Filing on behalf of ${filingCompanyName}.` : `This will file as an internal ticket for ${filingCompanyName}.`}
          </Callout>
        )}

        {draftNotice && (
          <Callout tone="info" title="Prefilled from a website DE Desk session">
            Choose a category, add your notes, then submit.
          </Callout>
        )}

        <Callout tone="warn" title={`Something down right now? Call ${PRIMARY_PHONE.display}.`}>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            Response targets: Critical 1 hour · High 4 hours · Medium 24 hours.
          </span>
        </Callout>

        <Panel id="new-ticket" title="Ticket details">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Field label="Subject" htmlFor="ticket-subject" required hint="One line that says what's wrong">
              <Input
                id="ticket-subject"
                placeholder="e.g. VPN drops every 20 minutes from home"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
                maxLength={200}
                className="border-border bg-background"
                data-testid="input-subject"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Category" labelId="ticket-category-label" required>
                <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                  <SelectTrigger aria-labelledby="ticket-category-label" className="border-border bg-background" data-testid="select-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Priority" labelId="ticket-priority-label" required hint={PRIORITIES.find((p) => p.value === formData.priority)?.hint}>
                <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                  <SelectTrigger aria-labelledby="ticket-priority-label" className="border-border bg-background" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label} · {p.hint}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Description" htmlFor="ticket-description" required hint="What were you trying to do, what did you see, when did it start, what have you tried?">
              <Textarea
                id="ticket-description"
                placeholder={"What were you trying to do?\nWhat error did you see?\nWhen did this start?\nWhat have you already tried?"}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-36 border-border bg-background"
                required
                maxLength={5000}
                data-testid="textarea-description"
              />
            </Field>

            <div className="space-y-2">
              <p className="text-sm font-medium">Attachments</p>
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Add ticket attachments"
                multiple
                accept={PORTAL_TICKET_ACCEPT}
                className="sr-only"
                data-testid="input-ticket-files"
                onChange={(event) => {
                  if (event.target.files) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <div
                className="rounded-lg border border-dashed border-border bg-background/60 p-5 text-center"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
                }}
              >
                <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm font-medium">Screenshots, PDFs or logs</p>
                <p className="mx-auto mt-0.5 max-w-md text-xs text-muted-foreground">
                  PNG, JPG, PDF, TXT or LOG. Up to {PORTAL_TICKET_MAX_FILES} files, 10 MB each. Files attach as soon as the ticket is created.
                </p>
                <Button type="button" variant="outline" size="sm" className="mt-3 border-border bg-card hover:bg-accent" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-files">
                  <Paperclip aria-hidden="true" />
                  Choose files
                </Button>
                {files.length > 0 && (
                  <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left">
                    {files.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Remove ${file.name}`} onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" variant="brand" disabled={!canSubmit} data-testid="button-submit">
                {submitting ? "Creating…" : "Create ticket"}
              </Button>
              <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => navigate("/portal/tickets")} data-testid="button-cancel">
                Cancel
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PortalLayout>
  );
}

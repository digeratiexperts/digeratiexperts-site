import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PortalLayout } from "./PortalLayout";
import { ArrowLeft, Upload, AlertCircle, Info, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DESK_TICKET_DRAFT_KEY = "de-portal-desk-ticket-draft";

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
  const [formData, setFormData] = useState({
    subject: "",
    category: "",
    priority: "medium",
    description: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [draftNotice, setDraftNotice] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(DESK_TICKET_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as {
        subject?: string;
        description?: string;
        priority?: string;
      };
      sessionStorage.removeItem(DESK_TICKET_DRAFT_KEY);
      setFormData((prev) => ({
        ...prev,
        subject: typeof draft.subject === "string" ? draft.subject.slice(0, 200) : prev.subject,
        description:
          typeof draft.description === "string" ? draft.description.slice(0, 5000) : prev.description,
        priority:
          draft.priority === "low" ||
          draft.priority === "medium" ||
          draft.priority === "high" ||
          draft.priority === "urgent"
            ? draft.priority
            : prev.priority,
      }));
      setDraftNotice(true);
    } catch {
      sessionStorage.removeItem(DESK_TICKET_DRAFT_KEY);
    }
  }, []);

  const categories = [
    "Email",
    "Access & Security",
    "Network & VPN",
    "Software & Applications",
    "Hardware & Devices",
    "Backup & Recovery",
    "Collaboration",
    "Other",
  ];

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
      if (next.some((existing) => existing.name === file.name && existing.size === file.size)) {
        continue;
      }
      next.push(file);
    }
    setFiles(next);
    if (problems.length) setError(problems[0]);
    else setError("");
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
        ...(impersonatingCompany?.id || portalUser?.clientId
          ? { clientId: impersonatingCompany?.id || portalUser?.clientId }
          : {}),
      };

      const response = await portalFetch("/api/portal/tickets", {
        method: "POST",
        body: JSON.stringify(ticketData),
      });

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
            attachErrors.push(
              attachErr instanceof Error ? attachErr.message : `Could not attach ${file.name}.`,
            );
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/portal/dashboard"] });

      setFormData({ subject: "", category: "", priority: "medium", description: "" });
      setFiles([]);
      if (ticketId && attachErrors.length) {
        navigate(`/portal/tickets/${ticketId}`);
        setError(
          `Ticket created, but ${attachErrors.length} file${attachErrors.length === 1 ? "" : "s"} did not attach: ${attachErrors[0]}`,
        );
        return;
      }
      navigate(ticketId ? `/portal/tickets/${ticketId}` : "/portal/tickets");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout title="Create Support Ticket">
      <div className="space-y-6 max-w-2xl">
        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300" data-testid="error-message">
                {error}
              </p>
            </div>
          </div>
        )}

        {missingClient && !error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300" data-testid="missing-client-message">
                {NO_CLIENT_TICKET_ERROR}
              </p>
            </div>
          </div>
        )}

        {isAdmin && !missingClient && (
          <div className="rounded-lg border border-[var(--de-paper-hairline)] bg-de-paper p-4 dark:border-de-hairline dark:bg-de-raised">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#1A1228] dark:text-de-magenta-ink" />
              <p className="text-sm text-[#1A1228] dark:text-white" data-testid="internal-ticket-context">
                {impersonatingCompany?.id
                  ? `Filing on behalf of ${filingCompanyName}.`
                  : `This will file as an internal ticket for ${filingCompanyName}.`}
              </p>
            </div>
          </div>
        )}

        {draftNotice && (
          <div className="rounded-lg border border-[var(--de-paper-hairline)] bg-de-paper p-4 dark:border-[#D3126A]/30 dark:bg-[#D3126A]/10">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#1A1228] dark:text-de-magenta-ink" />
              <p className="text-sm text-[#1A1228] dark:text-white">
                Prefilled from a website DE Desk session. Choose a category, add your notes, then
                submit.
              </p>
            </div>
          </div>
        )}

        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/portal/tickets")}
          className="gap-2"
          data-testid="button-back"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Tickets
        </Button>

        {/* Info Box */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/30 rounded-lg">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-800 dark:text-blue-300">
              For urgent issues, please call our support team at {PRIMARY_PHONE.display}. Response time: Critical (1 hour), High (4 hours), Medium (24 hours).
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Submit a New Ticket</CardTitle>
            <CardDescription>
              Describe the issue you're experiencing and our team will get back to you shortly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Subject */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Subject *</label>
                <Input
                  placeholder="Brief description of your issue"
                  value={formData.subject}
                  onChange={(e) =>
                    setFormData({ ...formData, subject: e.target.value })
                  }
                  required
                  data-testid="input-subject"
                />
              </div>

              {/* Category */}
              <div className="space-y-2">
                <label id="ticket-category-label" className="text-sm font-medium">Category *</label>
                <Select
                  value={formData.category}
                  onValueChange={(value) =>
                    setFormData({ ...formData, category: value })
                  }
                >
                  <SelectTrigger aria-labelledby="ticket-category-label" data-testid="select-category">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label id="ticket-priority-label" className="text-sm font-medium">Priority *</label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) =>
                    setFormData({ ...formData, priority: value })
                  }
                >
                  <SelectTrigger aria-labelledby="ticket-priority-label" data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Can wait</SelectItem>
                    <SelectItem value="medium">Medium - Soon</SelectItem>
                    <SelectItem value="high">High - Urgent</SelectItem>
                    <SelectItem value="critical">Critical - Down</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Description *</label>
                <Textarea
                  placeholder="Please provide detailed information about your issue:
- What were you trying to do?
- What error did you see?
- When did this start?
- What have you already tried?"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="min-h-32"
                  required
                  data-testid="textarea-description"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Attachments</label>
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
                <div className="rounded-lg border-2 border-dashed border-[#D3126A]/40 bg-de-paper/40 p-6 text-center dark:border-[#D3126A]/30 dark:bg-[#D3126A]/10">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-[#D3126A] dark:text-de-magenta-ink" />
                  <p className="mb-1 text-sm font-medium text-gray-800 dark:text-gray-200">
                    Screenshots, PDFs, or logs
                  </p>
                  <p className="mx-auto max-w-md text-xs text-gray-600 dark:text-gray-400">
                    PNG, JPG, PDF, TXT, or LOG — up to {PORTAL_TICKET_MAX_FILES} files, 10MB each.
                    Files attach as soon as the ticket is created.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-4 border-[#D3126A]/40 bg-white text-[#1A1228] hover:bg-de-paper dark:border-[#D3126A]/40 dark:bg-transparent dark:text-white"
                    onClick={() => fileInputRef.current?.click()}
                    data-testid="button-choose-files"
                  >
                    Choose Files
                  </Button>
                  {files.length > 0 && (
                    <ul className="mx-auto mt-4 max-w-md space-y-2 text-left">
                      {files.map((file) => (
                        <li
                          key={`${file.name}-${file.size}`}
                          className="flex items-center justify-between gap-2 rounded-md border border-[var(--de-paper-hairline)] bg-white px-3 py-2 text-sm dark:border-de-hairline dark:bg-slate-900/60"
                        >
                          <span className="min-w-0 truncate">{file.name}</span>
                          <button
                            type="button"
                            className="shrink-0 rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-white/10"
                            aria-label={`Remove ${file.name}`}
                            onClick={() => setFiles((prev) => prev.filter((item) => item !== file))}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  disabled={
                    missingClient ||
                    !formData.subject ||
                    !formData.category ||
                    !formData.description ||
                    submitting
                  }
                  className="bg-[#D3126A] hover:bg-[#D3126A]/90 text-white"
                  data-testid="button-submit"
                >
                  {submitting ? "Creating..." : "Create Ticket"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/portal/tickets")}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

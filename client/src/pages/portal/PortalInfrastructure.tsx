import { useState } from "react";
import { useLocation } from "wouter";
import { Phone } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { Callout, Field, Panel } from "@/components/portal/ui";

const ISSUE_TYPES = [
  {
    value: "Infrastructure - Problem",
    label: "Report a problem",
    help: "Something is broken or degraded (systems, network, phones, printers, apps).",
  },
  {
    value: "Infrastructure - Onsite Outage",
    label: "Request IT onsite (outage)",
    help: "Active outage or major disruption — ask Digerati to come onsite.",
  },
  {
    value: "Infrastructure - Project Onsite",
    label: "Plan a project / onsite visit",
    help: "Schedule project work, installs, or a planned onsite engagement.",
  },
] as const;

export function PortalInfrastructure() {
  const [, setLocation] = useLocation();
  const [issueType, setIssueType] = useState<string>(ISSUE_TYPES[0].value);
  const [subject, setSubject] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedHelp = ISSUE_TYPES.find((t) => t.value === issueType)?.help;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required.");
      return;
    }
    setSubmitting(true);
    try {
      const token = localStorage.getItem("portalToken");
      const body = [
        description.trim(),
        "",
        locationDetail.trim() ? `Site / location: ${locationDetail.trim()}` : null,
        `Submitted via Client Portal → Infrastructure Issues`,
      ]
        .filter(Boolean)
        .join("\n");

      const res = await fetch("/api/portal/tickets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: subject.trim(),
          description: body,
          priority,
          category: issueType,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit issue");
      setLocation("/portal/tickets");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PortalLayout
      title="Infrastructure Issues"
      description="Staff can report problems, request onsite help during an outage, or plan a project visit. Day-to-day IT communication still goes through your Company or Department IT Contact."
      width="narrow"
    >
      <div className="space-y-4">
        {error && (
          <Callout tone="bad" title="Something needs attention" testId="error-message">
            {error}
          </Callout>
        )}

        <Callout tone="warn" title={`Business down right now? Call ${PRIMARY_PHONE.display}.`}>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
            A phone call reaches an engineer faster than a form during an active outage.
          </span>
        </Callout>

        <Panel id="infrastructure-issue" title="Report a problem or request onsite IT">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <Field label="Issue type" labelId="issue-type-label" required hint={selectedHelp}>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger id="issue-type" aria-labelledby="issue-type-label" className="border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ISSUE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Subject" htmlFor="subject" required>
              <Input
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                required
                autoComplete="off"
                placeholder="Short summary"
                className="border-border bg-background"
              />
            </Field>

            <Field label="Site / address (if onsite)" htmlFor="site">
              <Input
                id="site"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                autoComplete="street-address"
                placeholder="Office location or address"
                className="border-border bg-background"
              />
            </Field>

            <Field label="Urgency" labelId="priority-label" required>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="priority" aria-labelledby="priority-label" className="border-border bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical — business down</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="What is happening?" htmlFor="description" required>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={6}
                placeholder="Who is affected, when it started, and what you need from Digerati."
                className="border-border bg-background"
              />
            </Field>

            <div className="flex flex-wrap gap-2 border-t border-border pt-4">
              <Button type="submit" variant="brand" disabled={submitting}>
                {submitting ? "Submitting…" : "Submit to Digerati"}
              </Button>
            </div>
          </form>
        </Panel>
      </div>
    </PortalLayout>
  );
}

export default PortalInfrastructure;

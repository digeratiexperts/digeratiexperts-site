import { useState } from "react";
import { useLocation } from "wouter";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
        credentials: "include",
        headers: {
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
    <PortalLayout title="Infrastructure Issues">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Report a problem or request onsite IT</CardTitle>
            <p className="text-sm text-slate-600">
              Staff can report problems, request onsite help during an outage, or plan a project visit.
              Day-to-day IT communication still goes through your Company or Department IT Contact.
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <Label htmlFor="issue-type">Issue type *</Label>
                <Select value={issueType} onValueChange={setIssueType}>
                  <SelectTrigger id="issue-type">
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
                {selectedHelp && <p className="text-xs text-slate-500">{selectedHelp}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="Short summary"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="site">Site / address (if onsite)</Label>
                <Input
                  id="site"
                  value={locationDetail}
                  onChange={(e) => setLocationDetail(e.target.value)}
                  autoComplete="street-address"
                  placeholder="Office location or address"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Urgency *</Label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger id="priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical — business down</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">What is happening? *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={6}
                  placeholder="Who is affected, when it started, and what you need from Digerati."
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 text-red-800 px-3 py-2 text-sm">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? "Submitting…" : "Submit to Digerati"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

export default PortalInfrastructure;

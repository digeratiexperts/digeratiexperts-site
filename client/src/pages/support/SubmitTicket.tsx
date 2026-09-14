import { useState } from "react";
import { useLocation } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { IconWell } from "@/components/visual/IconWell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { AlertCircle, Clock, Phone, Loader2 } from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

const cardClass = "rounded-2xl border border-de-hairline bg-de-raised";
const fieldClass = "border-de-hairline bg-de-bg text-white placeholder:text-white/55";

export default function SubmitTicket() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [priority, setPriority] = useState("medium");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSEO({
    title: "Submit Support Ticket | Digerati Experts",
    description:
      "Open a support ticket with Digerati Experts. Required fields, priority, and a tracked follow-up — or call for urgent production issues.",
    canonical: "/support/submit-ticket",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!name.trim() || !email.trim() || !phone.trim() || !subject.trim() || !description.trim()) {
      toast({
        title: "Missing fields",
        description: "Please complete all required fields.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const priorityLabel =
        priority === "critical"
          ? "Critical"
          : priority === "high"
            ? "High"
            : priority === "low"
              ? "Low"
              : "Medium";

      const response = await fetch("/api/portal/zoho/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          subject: subject.trim(),
          description: [
            description.trim(),
            "",
            `Submitted by: ${name.trim()}`,
            `Phone: ${phone.trim()}`,
            `Source: /support/submit-ticket`,
          ].join("\n"),
          priority: priorityLabel,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error((result as { error?: string }).error || "Failed to submit ticket");
      }

      toast({
        title: "Ticket submitted",
        description: "Our support team will follow up shortly.",
      });
      setLocation("/support/ticket-confirmation");
    } catch (error: any) {
      toast({
        title: "Could not submit ticket",
        description: error?.message || "Please try again or call us.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <PageTemplate
      title="Submit Support Ticket"
      subtitle="Get help from our support team. Open a ticket and we’ll track it to resolution."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Submit Ticket" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild variant="outline" size="lg" className="h-12 border-white/20 px-6 font-semibold text-white hover:bg-white/10">
            <a href={PRIMARY_PHONE.telHref}>
              <Phone className="mr-2 h-4 w-4" />
              Call {PRIMARY_PHONE.display}
            </a>
          </Button>
        </div>
      }
    >
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className={`p-6 md:p-8 ${cardClass}`}>
            <h2 className="text-xl font-semibold text-white">New Support Request</h2>
            <p className="mt-2 text-white/60">
              Please provide as much detail as possible to help us resolve your issue quickly.
            </p>
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name" className="text-white/80">Your Name *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    required
                    data-testid="input-name"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-white/80">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    required
                    data-testid="input-email"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone" className="text-white/80">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(480) 000-0000"
                    required
                    data-testid="input-phone"
                    className={`mt-1.5 ${fieldClass}`}
                  />
                </div>
                <div>
                  <Label htmlFor="priority" className="text-white/80">Priority *</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="priority" data-testid="select-priority" className={`mt-1.5 ${fieldClass}`}>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - General Question</SelectItem>
                      <SelectItem value="medium">Medium - Minor Issue</SelectItem>
                      <SelectItem value="high">High - Production Issue</SelectItem>
                      <SelectItem value="critical">Critical - System Down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="subject" className="text-white/80">Subject *</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief description of your issue"
                  required
                  data-testid="input-subject"
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-white/80">Detailed Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe your issue in detail. Include any error messages, when the issue started, and steps you've already tried."
                  rows={8}
                  required
                  data-testid="textarea-description"
                  className={`mt-1.5 ${fieldClass}`}
                />
              </div>

              <Button
                type="submit"
                size="lg"
                variant="brand"
                disabled={isSubmitting}
                className="h-12 w-full font-semibold"
                data-testid="button-submit-ticket"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit Support Ticket"
                )}
              </Button>
            </form>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`p-6 ${cardClass}`}>
            <IconWell icon={Clock} size="md" surface="dark" className="mb-3" />
            <h2 className="text-lg font-semibold text-white">Response Times</h2>
            <div className="mt-4 space-y-3">
              <div>
                <p className="font-semibold text-de-accent-ink">Critical Issues</p>
                <p className="text-sm text-white/60">Immediate response</p>
              </div>
              <div>
                <p className="font-semibold text-white">High Priority</p>
                <p className="text-sm text-white/60">Tracked to resolution</p>
              </div>
              <div>
                <p className="font-semibold text-white/80">Medium/Low Priority</p>
                <p className="text-sm text-white/60">Within 2 hours</p>
              </div>
            </div>
          </div>

          <div className={`p-6 ${cardClass}`}>
            <IconWell icon={Phone} size="md" surface="dark" className="mb-3" />
            <h2 className="text-lg font-semibold text-white">Need Immediate Help?</h2>
            <p className="mt-2 mb-4 text-white/65">For urgent issues, call us directly:</p>
            <a
              href={PRIMARY_PHONE.telHref}
              className="text-2xl font-bold text-de-accent-ink hover:text-white"
            >
              {PRIMARY_PHONE.display}
            </a>
          </div>

          <div className={`p-6 ${cardClass}`}>
            <IconWell icon={AlertCircle} size="md" surface="dark" className="mb-3" />
            <h2 className="text-lg font-semibold text-white">Emergency Contact</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/65">
              For after-hours emergencies, use our emergency hotline available 24/7 to all managed service clients.
            </p>
          </div>
        </div>
      </div>
    </PageTemplate>
  );
}

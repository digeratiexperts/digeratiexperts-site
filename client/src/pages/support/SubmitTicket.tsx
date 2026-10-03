import { useState } from "react";
import { useLocation } from "wouter";
import { PageTemplate } from "@/components/PageTemplate";
import { Chapter, Container, HeroActions } from "@/components/site/chapters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useSEO } from "@/hooks/useSEO";
import { Loader2 } from "lucide-react";
import { PRIMARY_PHONE } from "@/data/companyContact";

const fieldClass =
  "h-11 border-[var(--de-paper-hairline)] bg-white text-[#1A1228] placeholder:text-black/55 focus-visible:border-[#D3126A] focus-visible:ring-2 focus-visible:ring-[#D3126A]/40";
const labelClass = "text-base font-medium text-[#1A1228]";
const selectItemClass = "text-base text-[#1A1228] focus:bg-black/5 focus:text-[#1A1228]";

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
      layout="chapters"
      eyebrow="Support · Tickets"
      title="Submit Support Ticket"
      subtitle="Get help from our support team. Open a ticket and we’ll track it to resolution."
      breadcrumbs={[{ label: "Support", href: "/about/support" }, { label: "Submit Ticket" }]}
      actions={
        <div className="flex flex-col gap-3 sm:flex-row">
          <HeroActions
            primary={{ label: `Call ${PRIMARY_PHONE.display}`, href: PRIMARY_PHONE.telHref }}
            secondary={{ label: "Remote Support", href: "/support/remote-support" }}
          />
        </div>
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-8">
              <div className="rounded-xl border border-[var(--de-paper-hairline)] bg-white p-6 md:p-8">
                <h2 className="font-heading text-xl font-semibold text-[#1A1228]">New Support Request</h2>
                <p className="mt-2 text-[#3A3448]">
                  Please provide as much detail as possible to help us resolve your issue quickly.
                </p>
            <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label htmlFor="name" className={labelClass}>Your Name *</Label>
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
                  <Label htmlFor="email" className={labelClass}>Email Address *</Label>
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
                  <Label htmlFor="phone" className={labelClass}>Phone Number *</Label>
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
                  <Label htmlFor="priority" className={labelClass}>Priority *</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger id="priority" data-testid="select-priority" className={`mt-1.5 ${fieldClass}`}>
                      <SelectValue placeholder="Select priority" />
                    </SelectTrigger>
                    <SelectContent className="border-[var(--de-paper-hairline)] bg-white">
                      <SelectItem value="low" className={selectItemClass}>Low - General Question</SelectItem>
                      <SelectItem value="medium" className={selectItemClass}>Medium - Minor Issue</SelectItem>
                      <SelectItem value="high" className={selectItemClass}>High - Production Issue</SelectItem>
                      <SelectItem value="critical" className={selectItemClass}>Critical - System Down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="subject" className={labelClass}>Subject *</Label>
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
                <Label htmlFor="description" className={labelClass}>Detailed Description *</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe your issue in detail. Include any error messages, when the issue started, and steps you've already tried."
                  rows={8}
                  required
                  data-testid="textarea-description"
                  className={`mt-1.5 h-auto ${fieldClass}`}
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

            <aside className="space-y-8 lg:col-span-4">
              <section>
                <h2 className="font-heading text-lg font-semibold text-[#1A1228]">Response Times</h2>
                <dl className="mt-3 border-t border-[var(--de-paper-hairline)]">
                  <div className="border-b border-[var(--de-paper-hairline)] py-3">
                    <dt className="font-semibold text-de-magenta-paper-ink">Critical Issues</dt>
                    <dd className="text-sm text-[#3A3448]">Immediate response</dd>
                  </div>
                  <div className="border-b border-[var(--de-paper-hairline)] py-3">
                    <dt className="font-semibold text-[#1A1228]">High Priority</dt>
                    <dd className="text-sm text-[#3A3448]">Tracked to resolution</dd>
                  </div>
                  <div className="border-b border-[var(--de-paper-hairline)] py-3">
                    <dt className="font-semibold text-[#1A1228]">Medium/Low Priority</dt>
                    <dd className="text-sm text-[#3A3448]">Within 2 hours</dd>
                  </div>
                </dl>
              </section>

              <section>
                <h2 className="font-heading text-lg font-semibold text-[#1A1228]">Need Immediate Help?</h2>
                <p className="mb-2 mt-2 text-[#3A3448]">For urgent issues, call us directly:</p>
                <a
                  href={PRIMARY_PHONE.telHref}
                  className="inline-flex min-h-11 items-center text-2xl font-semibold text-de-magenta-paper-ink underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ec4899]"
                >
                  {PRIMARY_PHONE.display}
                </a>
              </section>

              <section className="border-t border-[var(--de-paper-hairline)] pt-8">
                <h2 className="font-heading text-lg font-semibold text-[#1A1228]">Emergency Contact</h2>
                <p className="mt-2 text-sm leading-relaxed text-[#3A3448]">
                  For after-hours emergencies, use our emergency hotline available 24/7 to all managed service clients.
                </p>
              </section>
            </aside>
          </div>
        </Container>
      </Chapter>
    </PageTemplate>
  );
}

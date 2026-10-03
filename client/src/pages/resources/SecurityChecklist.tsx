import { PageTemplate } from "@/components/PageTemplate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Lock, Server, Users, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Chapter, ClosingCta, Container, HeroActions, cardPaper } from "@/components/site/chapters";
import { useState } from "react";
import { CTA } from "@/lib/ctaCopy";
import { useSEO } from "@/hooks/useSEO";

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
}

interface ChecklistCategory {
  name: string;
  icon: any;
  items: ChecklistItem[];
}

const checklistData: ChecklistCategory[] = [
  {
    name: "Access Control",
    icon: Lock,
    items: [
      { id: "ac1", title: "Multi-Factor Authentication (MFA)", description: "Enable MFA on all accounts, especially admin and privileged accounts", priority: "critical" },
      { id: "ac2", title: "Strong Password Policy", description: "Enforce minimum 12 characters with complexity requirements", priority: "critical" },
      { id: "ac3", title: "Principle of Least Privilege", description: "Users should only have access to resources they need", priority: "high" },
      { id: "ac4", title: "Regular Access Reviews", description: "Quarterly review of user access rights and permissions", priority: "medium" },
      { id: "ac5", title: "Offboarding Procedures", description: "Immediate account disabling when employees leave", priority: "critical" },
    ],
  },
  {
    name: "Endpoint Security",
    icon: Shield,
    items: [
      { id: "es1", title: "Endpoint Detection & Response (EDR)", description: "Deploy EDR on all workstations and servers", priority: "critical" },
      { id: "es2", title: "Operating System Updates", description: "Enable automatic updates for all operating systems", priority: "critical" },
      { id: "es3", title: "Application Updates", description: "Keep all applications patched and updated", priority: "high" },
      { id: "es4", title: "Full Disk Encryption", description: "Encrypt all laptops and removable storage devices", priority: "high" },
      { id: "es5", title: "USB Device Control", description: "Restrict unauthorized USB device usage", priority: "medium" },
    ],
  },
  {
    name: "Network Security",
    icon: Server,
    items: [
      { id: "ns1", title: "Next-Gen Firewall", description: "Deploy enterprise-grade firewall with intrusion prevention", priority: "critical" },
      { id: "ns2", title: "Network Segmentation", description: "Separate critical systems from general network traffic", priority: "high" },
      { id: "ns3", title: "Secure Wi-Fi", description: "Use WPA3 encryption with separate guest networks", priority: "high" },
      { id: "ns4", title: "VPN for Remote Access", description: "Require VPN for all remote connections", priority: "critical" },
      { id: "ns5", title: "DNS Filtering", description: "Block malicious domains at the DNS level", priority: "high" },
    ],
  },
  {
    name: "Data Protection",
    icon: AlertTriangle,
    items: [
      { id: "dp1", title: "Regular Backups", description: "Daily backups with offsite/cloud copies", priority: "critical" },
      { id: "dp2", title: "Backup Testing", description: "Monthly restoration tests to verify backup integrity", priority: "high" },
      { id: "dp3", title: "Data Classification", description: "Identify and label sensitive data", priority: "medium" },
      { id: "dp4", title: "Email Security", description: "Deploy email filtering and anti-phishing protection", priority: "critical" },
      { id: "dp5", title: "Data Loss Prevention", description: "Monitor and prevent unauthorized data transfers", priority: "high" },
    ],
  },
  {
    name: "User Training",
    icon: Users,
    items: [
      { id: "ut1", title: "Security Awareness Training", description: "Annual training for all employees", priority: "high" },
      { id: "ut2", title: "Phishing Simulations", description: "Monthly simulated phishing tests", priority: "high" },
      { id: "ut3", title: "Incident Reporting", description: "Clear process for reporting security concerns", priority: "medium" },
      { id: "ut4", title: "Role-Based Training", description: "Additional training for IT and admin staff", priority: "medium" },
      { id: "ut5", title: "Security Policies", description: "Documented and acknowledged security policies", priority: "high" },
    ],
  },
];

export default function SecurityChecklist() {
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());

  const toggleItem = (id: string) => {
    const newChecked = new Set(checkedItems);
    if (newChecked.has(id)) {
      newChecked.delete(id);
    } else {
      newChecked.add(id);
    }
    setCheckedItems(newChecked);
  };

  const totalItems = checklistData.reduce((acc, cat) => acc + cat.items.length, 0);
  const completedItems = checkedItems.size;
  const percentComplete = Math.round((completedItems / totalItems) * 100);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical":
        return "border border-red-300 bg-red-50 text-red-800";
      case "high":
        return "border border-[#A30E52]/50 bg-transparent text-[#A30E52]";
      case "medium":
        return "border border-[var(--de-paper-hairline)] bg-transparent text-[#3A3448]";
      default:
        return "border border-[var(--de-paper-hairline)] bg-transparent text-[#4A445A]";
    }
  };

  useSEO({
    title: "Business Security Checklist",
    description:
      "Interactive security checklist for Arizona businesses. Assess access control, endpoints, network, backups, and training before you talk to an MSP.",
    canonical: "/resources/security-checklist",
  });

  return (
    <PageTemplate
      title="Business Security Checklist"
      eyebrow="Interactive checklist"
      subtitle="Use this interactive checklist to assess your organization's security posture. Complete these essential items to strengthen your defenses."
      breadcrumbs={[{ label: "Resources", href: "/resources" }, { label: "Security Checklist" }]}
      layout="chapters"
      actions={
        <HeroActions primary={{ label: CTA.primary, href: "/book", testId: "button-get-assessment" }} />
      }
    >
      <Chapter tone="paper" seam={false}>
        <Container>
          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-14">
            <aside className="lg:col-span-4 lg:sticky lg:top-[calc(var(--de-nav-offset)+1rem)]">
              <div className={`${cardPaper} p-6`}>
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <h2 className="font-heading text-xl font-semibold text-[#1A1228]">Your Progress</h2>
                    <p className="mt-1 text-base text-[#3A3448]" aria-live="polite">
                      {completedItems} of {totalItems} items completed
                    </p>
                  </div>
                  <div className="font-mono text-4xl font-bold text-de-magenta-paper-ink">{percentComplete}%</div>
                </div>
                <div
                  className="h-3 w-full overflow-hidden rounded-full bg-[var(--de-paper)] ring-1 ring-inset ring-[var(--de-paper-hairline)]"
                  role="progressbar"
                  aria-label="Checklist progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={percentComplete}
                >
                  <div
                    className="h-3 rounded-full bg-[#D3126A] transition-all duration-500 motion-reduce:transition-none"
                    style={{ width: `${percentComplete}%` }}
                  />
                </div>
                <div className="mt-5">
                  <Button
                    asChild
                    variant="outline"
                    className="min-h-11 w-full border-[var(--de-paper-hairline)] bg-white text-[#1A1228] hover:bg-[var(--de-paper)] hover:text-[#1A1228]"
                    data-testid="button-request-checklist"
                  >
                    <a href="/book">Request a reviewed checklist</a>
                  </Button>
                </div>
              </div>
            </aside>

            <div className="space-y-10 lg:col-span-8">
              {checklistData.map((category) => (
                <section
                  key={category.name}
                  data-testid={`card-category-${category.name.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <h2 className="mb-2 flex items-center gap-3 font-heading text-xl font-semibold text-[#1A1228] md:text-2xl">
                    <category.icon className="h-6 w-6 text-de-magenta-paper-ink" aria-hidden="true" />
                    {category.name}
                  </h2>
                  <ul className="border-t border-[var(--de-paper-hairline)]">
                    {category.items.map((item) => {
                      const done = checkedItems.has(item.id);
                      return (
                        <li key={item.id} className="border-b border-[var(--de-paper-hairline)]">
                          <label
                            htmlFor={item.id}
                            className={`flex min-h-11 cursor-pointer items-start gap-4 px-2 py-4 transition-colors hover:bg-white/70 focus-within:bg-white md:px-3 ${
                              done ? "bg-white/60" : ""
                            }`}
                          >
                            <Checkbox
                              id={item.id}
                              checked={done}
                              onCheckedChange={() => toggleItem(item.id)}
                              className="mt-0 h-8 w-8 rounded-md border-[#6B6478] bg-white data-[state=checked]:border-[#D3126A] data-[state=checked]:bg-[#D3126A] focus-visible:ring-[#ec4899]"
                              data-testid={`checkbox-${item.id}`}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className={`font-medium ${done ? "text-[#4A445A] line-through" : "text-[#1A1228]"}`}>
                                  {item.title}
                                </span>
                                <Badge className={getPriorityColor(item.priority)}>{item.priority}</Badge>
                              </span>
                              <span className="block text-sm leading-relaxed text-[#3A3448]">{item.description}</span>
                            </span>
                            {done && (
                              <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-de-magenta-paper-ink" aria-hidden="true" />
                            )}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        </Container>
      </Chapter>

      <ClosingCta
        tone="surface"
        title="Need help completing your checklist?"
        lede="Our security experts can help you implement these controls. Start with a Cyber Risk Assessment."
        primary={{ label: CTA.primary, href: "/book", testId: "button-schedule-consultation" }}
      />
    </PageTemplate>
  );
}

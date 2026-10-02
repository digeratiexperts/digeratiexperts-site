import { AlertCircle, Check, Clock, Download, MessageSquare, Settings, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Callout, Panel, Token } from "@/components/portal/ui";

interface Agent {
  name: string;
  version: string;
  downloadUrl: string;
  description: string;
  features: string[];
  supportedOS: string[];
}

const agents: Agent[] = [
  {
    name: "Digerati Expert Desktop Agent",
    version: "1.0.0",
    downloadUrl: "/api/portal/agent/download",
    description: "Our native desktop agent for quick support access",
    features: [
      "Quick Ticket Submission",
      "Real-time Chat",
      "System Monitoring",
      "Auto-updates",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
  },
  {
    name: "DE Identity Agent",
    version: "2.5.1",
    downloadUrl: "#",
    description: "Device management and user authentication",
    features: ["User Management", "MDM", "MFA", "System Inventory"],
    supportedOS: ["Windows 10", "Windows 11", "macOS", "Linux"],
  },
  {
    name: "DE Endpoint Protection Agent",
    version: "3.2.0",
    downloadUrl: "#",
    description: "Endpoint Detection and Response (EDR)",
    features: [
      "Endpoint Detection",
      "Threat Response",
      "Threat Hunting",
      "Incident Response",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
  },
  {
    name: "DE MDR Agent",
    version: "1.8.5",
    downloadUrl: "#",
    description: "Behavioral analytics and anomaly detection",
    features: [
      "Behavioral Analysis",
      "Anomaly Detection",
      "Real-time Alerts",
      "Threat Response",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
  },
];

const digeratiFeatures = [
  {
    icon: MessageSquare,
    title: "Quick Ticket Submission",
    description: "Submit support tickets directly from the system tray without opening a browser",
  },
  {
    icon: Clock,
    title: "Real-time Chat",
    description: "Connect with support team instantly while working on your computer",
  },
  {
    icon: Zap,
    title: "Quick Access",
    description: "One-click access to ticket status and support chat from anywhere on your desktop",
  },
  {
    icon: AlertCircle,
    title: "Instant Notifications",
    description: "Get notified immediately when support responds to your tickets",
  },
];

const INSTALL_STEPS = [
  "Click the download button above - a secure token will be generated",
  'Run "DigeratiExpertsAgent-Setup.exe" with admin privileges',
  "The installer will automatically use your secure authentication token",
  "Complete the installation wizard (typical duration: 2-3 minutes)",
  "Look for the purple Digerati Experts icon in your notification area (system tray)",
];

const SECURITY_FEATURES = [
  "JWT token authentication (24-hour expiration)",
  "HTTPS encrypted communication",
  "End-to-end encrypted WebSocket chat",
  "Rate limiting to prevent abuse",
  "Secure credential storage in Windows Credential Manager",
];

const PREFERENCES = [
  "Enable desktop notifications for ticket updates",
  "Set auto-start on Windows startup (stays in system tray)",
  "Customize notification sounds and privacy settings",
  "View system status and support queue without opening portal",
];

export default function PortalAgent() {
  const systemRequirements = [
    { label: "OS", value: "Windows 10/11" },
    { label: "RAM", value: "512 MB minimum" },
    { label: "Disk Space", value: "50 MB" },
    { label: "Internet", value: "Required for live chat" },
  ];

  const handleDownload = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    alert(
      "Desktop Agent installer is not available yet.\n\nPlease use Portal Chat or Support Tickets for assistance, or contact support@digeratiexperts.com.",
    );
  };

  return (
    <PortalLayout
      title="Desktop Agent"
      eyebrow="Digerati Experts Desktop Agent"
      description="Submit tickets and chat with support directly from your desktop notification area."
    >
      <div className="space-y-4">
        <Panel id="agent-download" title="Download Desktop Agent" description="Windows 10/11 compatible">
          <div className="space-y-5">
            <div className="space-y-2">
              <Button variant="brand" size="lg" onClick={handleDownload} className="w-full" data-testid="button-download-agent">
                <Download aria-hidden="true" />
                Download Installer (v1.0.0) - Windows
              </Button>
              <p className="text-center text-xs text-muted-foreground">Safe & verified. No malware. HTTPS encrypted download.</p>
            </div>

            <div className="space-y-3 border-t border-border pt-4">
              <h3 className="text-sm font-semibold">Installation instructions</h3>
              <ol className="space-y-2 text-sm text-muted-foreground">
                {INSTALL_STEPS.map((step, i) => (
                  <li key={step} className="flex gap-3">
                    <span className="pt-num pt-ink pt-tone-brand w-5 shrink-0 font-semibold" aria-hidden="true">
                      {i + 1}.
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </Panel>

        <Panel id="agent-features" title="Digerati Expert Agent features">
          <ul className="grid gap-3 sm:grid-cols-2">
            {digeratiFeatures.map((feature) => {
              const Icon = feature.icon;
              return (
                <li key={feature.title} className="flex gap-3 rounded-lg border border-border bg-background p-3">
                  <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{feature.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{feature.description}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel id="system-requirements" title="System requirements">
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {systemRequirements.map((req) => (
              <div key={req.label} className="rounded-lg border border-border bg-background p-3">
                <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{req.label}</dt>
                <dd className="mt-1 text-sm font-semibold">{req.value}</dd>
              </div>
            ))}
          </dl>
        </Panel>

        <Callout tone="ok" title="Secure installation">
          <p className="font-medium text-foreground">Security features:</p>
          <ul className="mt-1.5 space-y-1.5">
            {SECURITY_FEATURES.map((item) => (
              <li key={item} className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Callout>

        <Panel
          id="after-install"
          title={
            <span className="inline-flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              After installation
            </span>
          }
          description="Configure your preferences"
        >
          <ul className="space-y-2 text-sm text-muted-foreground">
            {PREFERENCES.map((item) => (
              <li key={item} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel
          id="additional-agents"
          title="Additional agents available"
          description="Download and install these recommended agents for device management, endpoint detection, and security monitoring."
          flush
        >
          <ul className="divide-y divide-border">
            {agents.slice(1).map((agent) => (
              <li key={agent.name} className="space-y-4 px-4 py-4 md:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{agent.name}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{agent.description}</p>
                  </div>
                  <Token label={`v${agent.version}`} tone="neutral" className="pt-num normal-case tracking-normal" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Features</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {agent.features.map((feature) => (
                        <li key={feature} className="flex gap-1.5">
                          <span aria-hidden="true">•</span>
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Supported OS</p>
                    <ul className="mt-1 space-y-1 text-xs">
                      {agent.supportedOS.map((os) => (
                        <li key={os} className="flex gap-1.5">
                          <span aria-hidden="true">•</span>
                          <span>{os}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <Button asChild variant="outline" className="w-full border-border bg-card hover:bg-accent" data-testid={`button-download-agent-${agent.name}`}>
                  <a href={agent.downloadUrl} target="_blank" rel="noopener noreferrer">
                    <Download aria-hidden="true" />
                    Download v{agent.version}
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </Panel>

        <Callout
          tone="info"
          title="Need help?"
          action={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" data-testid="button-view-guide">
                View Installation Guide
              </Button>
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" data-testid="button-contact-support">
                Contact Support
              </Button>
            </div>
          }
        >
          Having trouble installing or using the desktop agent?
        </Callout>
      </div>
    </PortalLayout>
  );
}

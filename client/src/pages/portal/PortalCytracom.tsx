import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Headphones, Link2Off, Mic, Phone, PhoneCall, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { Callout, DataTable, EmptyState, Field, Panel, StatTile, Token, type DataColumn } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { usePortalIntegrations, type IntegrationStatus } from "@/lib/portalIntegrations";
import { IntegrationHiddenNotice, IntegrationNeedsCompanyNotice } from "@/components/portal/IntegrationNotices";

/**
 * PORTAL_PHONE_PROVIDER (server/portalIntegrations.ts) picks what this page shows:
 * "sample" keeps the sample page below unchanged; "hidden" shows the
 * not-available notice; "cytracom" reads GET /api/portal/phone
 * (server/integrations/phone/README.md). The softphone downloads and the
 * support callout stay in every mode.
 */
const PHONE_PATH = "/api/portal/phone";

/** Mirrors server/integrations/phone/types.ts. */
type PhoneExtension = { name: string; extension: string; assigned: boolean };
type PhoneData = {
  provider: "cytracom";
  extensions: PhoneExtension[];
  myExtension: PhoneExtension | null;
  unavailable: Array<"phoneStatus" | "recentCalls" | "voicemail">;
  fetchedAt: string;
};
type PhoneResponse = {
  success: boolean;
  status: IntegrationStatus;
  needsCompany?: boolean;
  notMapped?: boolean;
  data?: PhoneData;
};

interface CallHistory {
  id: string;
  type: "inbound" | "outbound" | "missed";
  number: string;
  contact: string;
  duration: string;
  time: string;
}

const recentCalls: CallHistory[] = [
  { id: "1", type: "outbound", number: "+1 (480) 555-1234", contact: "John Smith", duration: "5:32", time: "10 mins ago" },
  { id: "2", type: "inbound", number: "+1 (602) 555-5678", contact: "Sarah Johnson", duration: "12:15", time: "1 hour ago" },
  { id: "3", type: "missed", number: "+1 (480) 555-9012", contact: "Unknown", duration: "-", time: "2 hours ago" },
  { id: "4", type: "outbound", number: "+1 (623) 555-3456", contact: "Mike Wilson", duration: "3:45", time: "Yesterday" },
];

const SOFTPHONES = [
  { label: "Windows", hint: "Desktop App", icon: Headphones, testId: "button-download-windows" },
  { label: "macOS", hint: "Desktop App", icon: Headphones, testId: "button-download-mac" },
  { label: "iOS", hint: "App Store", icon: Phone, testId: "button-download-ios" },
  { label: "Android", hint: "Play Store", icon: Phone, testId: "button-download-android" },
];

const CALL_TYPE: Record<CallHistory["type"], { label: string; tone: "ok" | "info" | "bad" }> = {
  inbound: { label: "Inbound", tone: "ok" },
  outbound: { label: "Outbound", tone: "info" },
  missed: { label: "Missed", tone: "bad" },
};

const SAMPLE_DESCRIPTION = "Your softphone downloads, extension settings and recent call activity.";
const LIVE_DESCRIPTION = "Your softphone downloads and your company's phone extensions.";

function PhoneLayout({ children, description = SAMPLE_DESCRIPTION }: { children: ReactNode; description?: string }) {
  return (
    <PortalLayout title="Cytracom Phone" description={description}>
      <div className="space-y-4">{children}</div>
    </PortalLayout>
  );
}

function SoftphonePanel() {
  return (
    <Panel id="softphone" title="Download Cytracom softphone" description="Install the Cytracom app for desktop and mobile calling">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SOFTPHONES.map((s) => {
          const Icon = s.icon;
          return (
            <Button disabled key={s.testId} variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent" data-testid={s.testId}>
              <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium">{s.label}</span>
              <span className="text-xs text-muted-foreground">Download unavailable</span>
            </Button>
          );
        })}
      </div>
    </Panel>
  );
}

function PhoneSupportCallout() {
  return (
    <Callout tone="info" title="Cytracom phone support">
      For phone system issues, check our <Link href="/portal/kb">Knowledge Base</Link> or contact support at{" "}
      <strong className="text-foreground">support@digeratiexperts.com</strong>. For urgent issues, call{" "}
      <strong className="text-foreground">{PRIMARY_PHONE.display}</strong>.
    </Callout>
  );
}

function SamplePhonePage() {
  const [extension, setExtension] = useState("1001");
  const [voicemailPin, setVoicemailPin] = useState("");

  const columns: DataColumn<CallHistory>[] = [
    {
      key: "contact",
      header: "Contact",
      primary: true,
      cell: (call) => {
        const Icon = call.type === "missed" ? PhoneOff : PhoneCall;
        return (
          <span className="flex items-center gap-3">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate font-medium">{call.contact}</span>
              <span className="pt-num block text-xs text-muted-foreground">{call.number}</span>
            </span>
          </span>
        );
      },
    },
    { key: "type", header: "Type", primary: true, className: "w-32", cell: (call) => <Token label={CALL_TYPE[call.type].label} tone={CALL_TYPE[call.type].tone} dot /> },
    { key: "duration", header: "Duration", hideBelowMd: true, align: "right", className: "w-28", cell: (call) => <span className="pt-num text-muted-foreground">{call.type === "missed" ? "Missed" : call.duration}</span> },
    { key: "time", header: "When", primary: true, align: "right", className: "w-32 whitespace-nowrap", cell: (call) => <span className="text-muted-foreground">{call.time}</span> },
  ];

  return (
    <PhoneLayout>
      <Callout tone="info" title="Sample data">
        The status, extension and call history shown here are examples, not your account data. Downloads, voicemail and settings changes are unavailable until the phone service is connected.
      </Callout>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Phone figures">
        <StatTile label="Phone status" value="Online" tone="ok" hint="sample" />
        <StatTile label="Extension" value={<span>x{extension}</span>} hint="sample extension" />
        <StatTile label="Today's calls" value={12} hint="sample" />
        <StatTile label="Voicemails" value={3} suffix="new" hint="sample" />
      </section>

      <SoftphonePanel />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel id="phone-settings" title="Phone settings" description="Extension and voicemail">
          <div className="space-y-4">
            <Field label="Extension Number" htmlFor="extension">
              <Input disabled id="extension" value={extension} onChange={(e) => setExtension(e.target.value)} className="border-border bg-background" data-testid="input-extension" />
            </Field>
            <Field label="Voicemail PIN" htmlFor="voicemail-pin">
              <Input
                id="voicemail-pin"
                type="password"
                disabled
                value={voicemailPin}
                onChange={(e) => setVoicemailPin(e.target.value)}
                placeholder="Phone connection pending"
                className="border-border bg-background"
                data-testid="input-voicemail-pin"
              />
            </Field>
            <dl className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Mic className="h-4 w-4" aria-hidden="true" />
                <dt>Microphone:</dt>
                <dd className="text-foreground">Default</dd>
              </div>
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <dt>Speaker:</dt>
                <dd className="text-foreground">Default</dd>
              </div>
            </dl>
            <Button variant="brand" disabled className="w-full" data-testid="button-save-settings">
              Save Settings
            </Button>
          </div>
        </Panel>

        <Panel id="recent-calls" title="Example calls" description={`${recentCalls.length} sample calls; not your call history`} flush>
          <DataTable<CallHistory>
            columns={columns}
            rows={recentCalls}
            rowKey={(call) => call.id}
            rowTestId={(call) => `call-${call.id}`}
            caption="Recent calls"
            empty={<EmptyState compact icon={PhoneCall} title="No calls yet" description="Your call history appears here." />}
          />
        </Panel>
      </div>

      <Panel id="quick-actions" title="Quick actions">
        <div className="grid gap-3 sm:grid-cols-3">
          <Button disabled variant="outline" className="border-border bg-card hover:bg-accent" data-testid="button-check-voicemail">
            <Volume2 aria-hidden="true" />
            Check Voicemail
          </Button>
          <Button disabled variant="outline" className="border-border bg-card hover:bg-accent" data-testid="button-update-greeting">
            <Mic aria-hidden="true" />
            Update Greeting
          </Button>
          <Button disabled variant="outline" className="border-border bg-card hover:bg-accent" data-testid="button-call-forwarding">
            <Phone aria-hidden="true" />
            Call Forwarding
          </Button>
        </div>
      </Panel>

      <PhoneSupportCallout />
    </PhoneLayout>
  );
}

const EXTENSION_COLUMNS: DataColumn<PhoneExtension>[] = [
  {
    key: "name",
    header: "Name",
    primary: true,
    cell: (row) => <span className="block truncate font-medium">{row.name}</span>,
  },
  {
    key: "extension",
    header: "Extension",
    primary: true,
    align: "right",
    className: "w-32",
    cell: (row) => <span className="pt-num">x{row.extension}</span>,
  },
  {
    key: "assigned",
    header: "User",
    hideBelowMd: true,
    className: "w-36",
    cell: (row) => <Token label={row.assigned ? "Assigned" : "No user"} tone={row.assigned ? "ok" : "neutral"} dot />,
  },
];

function LivePhoneData({ data }: { data: PhoneData }) {
  const mine = data.myExtension;
  return (
    <>
      <section className="grid grid-cols-2 gap-3" aria-label="Phone figures">
        <StatTile
          label="Your extension"
          value={mine ? <span>x{mine.extension}</span> : "Not assigned"}
          hint={mine ? "your direct extension" : "no extension matches your sign-in email"}
          testId="stat-my-extension"
        />
        <StatTile label="Company extensions" value={data.extensions.length} testId="stat-extension-count" />
      </section>

      <SoftphonePanel />

      <Panel id="company-extensions" title="Company extensions" description={`${data.extensions.length} extensions`} flush>
        <DataTable<PhoneExtension>
          columns={EXTENSION_COLUMNS}
          rows={data.extensions}
          rowKey={(row) => row.extension}
          rowTestId={(row) => `extension-${row.extension}`}
          caption="Company extensions"
          empty={<EmptyState compact icon={Phone} title="No extensions found" description="Cytracom returned no extensions for your account." />}
        />
      </Panel>

      {data.unavailable.length > 0 && (
        <Callout tone="info" title="Not shown here yet" testId="callout-phone-gaps">
          Phone status, call history and voicemail counts aren't connected to the portal yet. Use the Cytracom app for those.
        </Callout>
      )}
    </>
  );
}

export default function PortalCytracom() {
  const integrations = usePortalIntegrations();
  const phone = useQuery<PhoneResponse>({
    queryKey: [PHONE_PATH],
    queryFn: () => portalGet<PhoneResponse>(PHONE_PATH),
    staleTime: 60 * 1000,
    retry: false,
  });
  // The page's own endpoint is authoritative; the shared status covers the
  // moment before it answers (and a failed request).
  const mode = phone.data?.status?.mode ?? integrations.phone.mode;

  if (mode === "sample") return <SamplePhonePage />;

  if (mode === "hidden") {
    return (
      <PhoneLayout description={LIVE_DESCRIPTION}>
        <IntegrationHiddenNotice what="Cytracom Phone" />
        <SoftphonePanel />
        <PhoneSupportCallout />
      </PhoneLayout>
    );
  }

  let body: ReactNode;
  if (phone.isLoading) {
    body = (
      <section className="grid grid-cols-2 gap-3" aria-label="Phone figures">
        <StatTile label="Your extension" value="" loading />
        <StatTile label="Company extensions" value="" loading />
      </section>
    );
  } else if (phone.isError || !phone.data || (!phone.data.needsCompany && !phone.data.notMapped && !phone.data.data)) {
    body = (
      <Callout
        tone="bad"
        title="Phone data isn't available right now"
        testId="callout-phone-error"
        action={
          <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => phone.refetch()} data-testid="button-phone-retry">
            Try again
          </Button>
        }
      >
        We couldn't read your phone system from Cytracom. If this keeps happening, contact support.
      </Callout>
    );
  } else if (phone.data.needsCompany) {
    body = <IntegrationNeedsCompanyNotice what="phone system" />;
  } else if (phone.data.notMapped) {
    body = (
      <Panel id="phone-not-linked" flush>
        <EmptyState
          icon={Link2Off}
          title="Your phone system isn't linked yet"
          description="Your company's Cytracom account hasn't been connected to the portal. Ask your DE account team if you expected to see your extensions here."
        />
      </Panel>
    );
  } else if (phone.data.data) {
    return (
      <PhoneLayout description={LIVE_DESCRIPTION}>
        <LivePhoneData data={phone.data.data} />
        <PhoneSupportCallout />
      </PhoneLayout>
    );
  }

  return (
    <PhoneLayout description={LIVE_DESCRIPTION}>
      {body}
      <SoftphonePanel />
      <PhoneSupportCallout />
    </PhoneLayout>
  );
}

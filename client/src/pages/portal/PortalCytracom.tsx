import { useState } from "react";
import { Link } from "wouter";
import { Headphones, Mic, Phone, PhoneCall, PhoneOff, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PortalLayout } from "./PortalLayout";
import { PRIMARY_PHONE } from "@/data/companyContact";
import { Callout, DataTable, EmptyState, Field, Panel, StatTile, Token, type DataColumn } from "@/components/portal/ui";

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

export default function PortalCytracom() {
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
    <PortalLayout title="Cytracom Phone" description="Your softphone downloads, extension settings and recent call activity.">
      <div className="space-y-4">
        <Callout tone="info" title="Sample data">
          The status, extension and call history shown here are examples, not your account data. Downloads, voicemail and settings changes are unavailable until the phone service is connected.
        </Callout>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Phone figures">
          <StatTile label="Phone status" value="Online" tone="ok" hint="sample" />
          <StatTile label="Extension" value={<span>x{extension}</span>} hint="sample extension" />
          <StatTile label="Today's calls" value={12} hint="sample" />
          <StatTile label="Voicemails" value={3} suffix="new" hint="sample" />
        </section>

        <Panel id="softphone" title="Download Cytracom softphone" description="Install the Cytracom app for desktop and mobile calling">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {SOFTPHONES.map((s) => {
              const Icon = s.icon;
              return (
                <Button key={s.testId} disabled variant="outline" className="h-auto flex-col gap-1.5 border-border bg-card py-4 hover:bg-accent" data-testid={s.testId}>
                  <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <span className="text-sm font-medium">{s.label}</span>
                  <span className="text-xs text-muted-foreground">Not connected</span>
                </Button>
              );
            })}
          </div>
        </Panel>

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel id="phone-settings" title="Phone settings" description="Example settings. Changes are unavailable until the phone service is connected.">
            <div className="space-y-4">
              <Field label="Extension Number" htmlFor="extension">
                <Input id="extension" disabled value={extension} onChange={(e) => setExtension(e.target.value)} className="border-border bg-background" data-testid="input-extension" />
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
            <Button variant="outline" disabled className="border-border bg-card hover:bg-accent" data-testid="button-check-voicemail">
              <Volume2 aria-hidden="true" />
              Check Voicemail
            </Button>
            <Button variant="outline" disabled className="border-border bg-card hover:bg-accent" data-testid="button-update-greeting">
              <Mic aria-hidden="true" />
              Update Greeting
            </Button>
            <Button variant="outline" disabled className="border-border bg-card hover:bg-accent" data-testid="button-call-forwarding">
              <Phone aria-hidden="true" />
              Call Forwarding
            </Button>
          </div>
        </Panel>

        <Callout tone="info" title="Cytracom phone support">
          For phone system issues, check our <Link href="/portal/kb">Knowledge Base</Link> or contact support at{" "}
          <strong className="text-foreground">support@digeratiexperts.com</strong>. For urgent issues, call{" "}
          <strong className="text-foreground">{PRIMARY_PHONE.display}</strong>.
        </Callout>
      </div>
    </PortalLayout>
  );
}

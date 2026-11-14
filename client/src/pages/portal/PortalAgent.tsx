import { Link } from "wouter";
import {
  AlertCircle,
  Bell,
  BookOpen,
  Check,
  Clock,
  FolderOpen,
  MessageSquare,
  Monitor,
  Shield,
  Ticket,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PortalLayout } from "./PortalLayout";

const availableActions = [
  {
    title: "DE Desk",
    description: "Start a secure support conversation from your portal session.",
    href: "/portal/chat",
    label: "Open DE Desk",
    icon: MessageSquare,
  },
  {
    title: "Support tickets",
    description: "Open a request, attach evidence, and follow its status.",
    href: "/portal/tickets/create",
    label: "Create a ticket",
    icon: Ticket,
  },
  {
    title: "Knowledge base",
    description: "Find approved guides and self-service instructions.",
    href: "/portal/kb",
    label: "Browse knowledge",
    icon: BookOpen,
  },
  {
    title: "Files & software",
    description: "Access installers and documents assigned to your company.",
    href: "/portal/files",
    label: "View assigned files",
    icon: FolderOpen,
  },
];

const platformStatus = [
  { platform: "Windows 10 / 11", status: "Private pilot", detail: "Unsigned test builds are not distributed to clients." },
  { platform: "macOS", status: "Planned", detail: "Signing, notarization, and permission design required." },
  { platform: "Linux", status: "Planned", detail: "Packaging and least-privilege service design required." },
];

const securityGates = [
  "Code-signed and independently verifiable installers",
  "Device and tenant binding with short-lived enrollment",
  "Least-privilege actions with explicit user consent",
  "Allowlisted commands and signed software packages",
  "Tamper-evident audit events, revocation, and rollback",
  "OS-protected secrets with no portal password stored locally",
];

export default function PortalAgent() {
  return (
    <PortalLayout title="Desktop Companion">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-2xl border border-[#D3126A]/25 bg-gradient-to-br from-[#D3126A]/10 via-white to-blue-500/5 p-5 dark:via-slate-950 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <span className="rounded-2xl bg-[#D3126A] p-3 text-white shadow-sm">
                <Monitor className="h-7 w-7" aria-hidden="true" />
              </span>
              <div>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-950 dark:text-white">DE Desktop Companion</h2>
                  <Badge variant="secondary">In development</Badge>
                </div>
                <p className="max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300 md:text-base">
                  A planned system-tray companion for fast portal access, approved notifications, and secure support workflows.
                  Client-ready installers are not available yet.
                </p>
              </div>
            </div>
            <Button asChild className="shrink-0 bg-[#D3126A] text-white hover:bg-[#b80f5d]">
              <Link href="/portal/tickets/create">
                <Ticket className="mr-2 h-4 w-4" />
                Request pilot access
              </Link>
            </Button>
          </div>
        </section>

        <Card className="border-amber-300/70 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="flex gap-3 pt-6 text-sm text-amber-950 dark:text-amber-100">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <p>
              We will not publish an installer until signing, update verification, tenant isolation, consent, audit logging,
              and rollback gates pass. Digerati Experts will never ask you to bypass an operating-system security warning.
            </p>
          </CardContent>
        </Card>

        <section aria-labelledby="available-now-heading">
          <div className="mb-4">
            <h3 id="available-now-heading" className="text-xl font-bold">Available in your portal now</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              These workflows work today without installing software on your computer.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {availableActions.map((action) => {
              const Icon = action.icon;
              return (
                <Card key={action.title} className="h-full">
                  <CardContent className="flex h-full flex-col pt-6">
                    <Icon className="mb-3 h-6 w-6 text-[#D3126A]" aria-hidden="true" />
                    <h4 className="font-semibold">{action.title}</h4>
                    <p className="mb-5 mt-1 flex-1 text-sm text-slate-600 dark:text-slate-400">{action.description}</p>
                    <Button asChild variant="outline" className="w-full sm:w-fit">
                      <Link href={action.href}>{action.label}</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]" aria-label="Desktop companion readiness">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Clock className="h-5 w-5 text-[#D3126A]" /> Platform readiness
              </CardTitle>
              <CardDescription>Release status by operating system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {platformStatus.map((entry) => (
                <div key={entry.platform} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{entry.platform}</p>
                    <Badge variant="outline">{entry.status}</Badge>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{entry.detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-[#D3126A]" /> Security release gates
              </CardTitle>
              <CardDescription>Required before native device actions reach production</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-3 sm:grid-cols-2">
                {securityGates.map((gate) => (
                  <li key={gate} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#D3126A]" aria-hidden="true" />
                    <span>{gate}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-[#D3126A]" /> Planned companion scope
            </CardTitle>
            <CardDescription>A convenience and consent layer—not an unrestricted remote-control tool</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-slate-700 dark:text-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">System-tray shortcuts to DE Desk, tickets, knowledge, files, and account access.</p>
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">Portal notifications with user-controlled privacy and delivery preferences.</p>
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">Approved software and paperwork workflows assigned to the authenticated company.</p>
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">Native dialogs only when a named workflow requires explicit local consent.</p>
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">Local file access limited to a user-selected file or an administratively approved policy.</p>
            <p className="rounded-xl bg-slate-50 p-3 dark:bg-slate-900">Privileged MSP actions isolated behind a separately reviewed, least-privilege broker.</p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

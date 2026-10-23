import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, PackageOpen, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, EmptyState, Panel } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { PortalLayout } from "./PortalLayout";

/**
 * Desktop agent: the DE endpoint agent's current release, offered only when
 * its signed release manifest verifies on the server (server/agentRelease.ts).
 * No release published means an honest empty state, never a made-up version.
 */

type Build = { target: string; sha256: string; size: number; downloadPath: string };
type ReleaseResponse = { available: false } | { available: true; version: string; issuedAt: string; artifacts: Build[] };

const TARGET_LABELS: Record<string, string> = {
  "windows/amd64": "Windows (64-bit)",
  "windows/arm64": "Windows on Arm",
  "darwin/arm64": "macOS (Apple silicon)",
  "darwin/amd64": "macOS (Intel)",
  "linux/amd64": "Linux (64-bit)",
};
const targetLabel = (t: string) => TARGET_LABELS[t] ?? t;
const mb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function PortalAgent() {
  const release = useQuery({
    queryKey: ["/api/portal/agent/release"],
    queryFn: () => portalGet<ReleaseResponse & { success: true }>("/api/portal/agent/release"),
  });
  const data = release.data;

  return (
    <PortalLayout
      title="Desktop Agent"
      description="The DE agent lets your DE team look after this computer: it reports the device's details to DE and runs maintenance DE has approved."
    >
      <div className="space-y-4">
        {release.isError && (
          <Callout tone="bad" title="The agent release couldn't be loaded">
            {release.error instanceof Error ? release.error.message : ""} <Link href="/portal/tickets/new">Ask DE for help</Link>.
          </Callout>
        )}

        {release.isPending ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : data && !data.available ? (
          <Panel id="agent-download">
            <EmptyState
              icon={PackageOpen}
              title="No agent release is published yet"
              description="DE installs the agent for you when your computers need it. If DE asked you to install it, open a ticket and we'll send it to you."
              action={
                <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
                  <Link href="/portal/tickets/new">Open a ticket</Link>
                </Button>
              }
            />
          </Panel>
        ) : data && data.available ? (
          <>
            <Panel
              id="agent-download"
              title={`DE agent ${data.version}`}
              description={data.issuedAt ? `Released ${new Date(data.issuedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}` : undefined}
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Install it only if DE asked you to. Installing needs administrator rights on the computer.</p>
                <ul className="space-y-3">
                  {data.artifacts.map((b) => (
                    <li key={b.target} className="flex flex-col gap-3 rounded-lg border border-border bg-background p-3 sm:flex-row sm:items-center" data-testid={`agent-build-${b.target}`}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{targetLabel(b.target)}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{mb(b.size)}</p>
                        <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
                          SHA-256 {b.sha256}
                        </p>
                      </div>
                      <Button asChild variant="brand" className="shrink-0">
                        {/* A plain link: the server checks sign-in, re-verifies the release, then redirects. */}
                        <a href={b.downloadPath} data-testid="button-download-agent">
                          <Download aria-hidden="true" />
                          Download
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>
            <Callout tone="ok" title="Signed by Digerati Experts">
              <span className="inline-flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                This release's signature was checked against DE's release key before it was offered here. After downloading, you can compare the file's SHA-256 with the one above.
              </span>
            </Callout>
          </>
        ) : null}
      </div>
    </PortalLayout>
  );
}

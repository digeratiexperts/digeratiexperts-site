import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Callout, Panel, Token } from "@/components/portal/ui";
import { portalGet } from "@/lib/portalApi";
import { PortalLayout } from "./PortalLayout";

/**
 * DE admin: the endpoint agent release clients are offered on /portal/agent,
 * and why not when nothing is offered. Releases are made with the Intelligence
 * Hub's de-release tool and verified here (server/agentRelease.ts); this page
 * changes nothing itself.
 */

type ReleaseStatus =
  | { state: "not_configured"; missing: string[] }
  | { state: "invalid"; reason: string }
  | { state: "ready"; release: { version: string; issuedAt: string; kid: string; artifacts: { target: string; url: string; sha256: string; size: number }[] } };

const mb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function AdminAgents() {
  const q = useQuery({
    queryKey: ["/api/portal/admin/agent-release"],
    queryFn: () => portalGet<{ status: ReleaseStatus }>("/api/portal/admin/agent-release"),
  });
  const status = q.data?.status;

  return (
    <PortalLayout
      title="Manage Agents"
      description="The DE endpoint agent release offered to clients on the Desktop agent page."
      actions={
        <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
          <Link href="/portal/agent">View client page</Link>
        </Button>
      }
    >
      <div className="space-y-4">
        {q.isError && (
          <Callout tone="bad" title="Release status couldn't be loaded">
            {q.error instanceof Error ? q.error.message : ""}
          </Callout>
        )}
        {q.isPending && <Skeleton className="h-32 rounded-xl" />}

        {status?.state === "ready" && (
          <Panel
            id="agent-release"
            title={`Offered to clients: ${status.release.version}`}
            description={`Signed with key ${status.release.kid}${status.release.issuedAt ? ` · issued ${new Date(status.release.issuedAt).toLocaleString()}` : ""}`}
            actions={<Token label="Verified" tone="ok" dot />}
            flush
          >
            <ul className="divide-y divide-border">
              {status.release.artifacts.map((a) => (
                <li key={a.target} className="px-4 py-3 md:px-5">
                  <p className="text-sm font-medium">
                    {a.target} · {mb(a.size)}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-muted-foreground">{a.url}</p>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">SHA-256 {a.sha256}</p>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {status?.state === "invalid" && (
          <Callout tone="bad" title="A release file is set, but clients are not offered it" testId="agent-release-invalid">
            {status.reason} Fix the file or the key, then reload this page.
          </Callout>
        )}

        {status?.state === "not_configured" && (
          <Callout tone="warn" title="No release is published to clients" testId="agent-release-not-configured">
            Set {status.missing.map((m, i) => (
              <span key={m}>
                {i > 0 && " and "}
                <code className="font-mono text-xs">{m}</code>
              </span>
            ))}{" "}
            on the portal server. Until then the Desktop agent page tells clients no release is published.
          </Callout>
        )}

        <Panel id="agent-release-how" title="How a release reaches clients">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
            <li>
              Build and sign the binaries with <code className="font-mono text-xs">agent/scripts/build-release.sh</code> in the Intelligence Hub repository.
            </li>
            <li>
              Make the signed envelope with <code className="font-mono text-xs">de-release manifest</code> and host the binaries at its https <code className="font-mono text-xs">-base-url</code>.
            </li>
            <li>
              Point <code className="font-mono text-xs">DE_AGENT_RELEASE_MANIFEST</code> at that envelope (the same file as the Hub's{" "}
              <code className="font-mono text-xs">ENDPOINT_AGENT_RELEASE_MANIFEST</code>) and put the public release key in{" "}
              <code className="font-mono text-xs">DE_AGENT_RELEASE_KEYS</code>.
            </li>
            <li>The portal verifies the signature on every request. Pre-releases, unsigned files and plain-http builds are never offered.</li>
          </ol>
        </Panel>
      </div>
    </PortalLayout>
  );
}

export default AdminAgents;

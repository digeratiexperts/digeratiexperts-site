import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Power, RefreshCw, Zap } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { queryClient } from "@/lib/queryClient";
import { portalFetch } from "@/lib/portalApi";
import { openAIControlResponseSchema, type OpenAIControlResponse } from "@shared/openaiControl";
import { cn } from "@/lib/utils";
import { Callout, Panel, Token } from "@/components/portal/ui";

const STATUS_KEY = ["/api/portal/admin/openai/status"] as const;

async function readResponse(response: Response): Promise<OpenAIControlResponse> {
  const parsed = openAIControlResponseSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok || !parsed.success) throw new Error("Couldn't confirm the OpenAI state. Refresh status before changing it.");
  return parsed.data;
}

const AFFECTED_FEATURES = [
  { name: "Assistant chat", detail: "Public and Portal assistant model requests" },
  { name: "Ticket classification and summaries", detail: "Provider-backed categorization and ticket summaries" },
  { name: "Speech generation", detail: "New read-aloud audio requests" },
];

export function AdminOpenAI() {
  const { toast } = useToast();
  const { data: statusData, isLoading: statusLoading, isFetching, isError: statusError, refetch } = useQuery<OpenAIControlResponse>({
    queryKey: STATUS_KEY,
    queryFn: async () => readResponse(await portalFetch(STATUS_KEY[0])),
  });
  const status = statusData?.status;
  const isEnabled = status?.enabled ?? false;
  const stateMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const confirmed = await readResponse(await portalFetch(`/api/portal/admin/openai/${enabled ? "enable" : "disable"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-DE-OpenAI-Control": "1" },
        body: "{}",
      }));
      if (confirmed.status.enabled !== enabled) throw new Error("Couldn't confirm the OpenAI state. Refresh status before changing it.");
      return confirmed;
    },
    onSuccess: (confirmed) => {
      queryClient.setQueryData(STATUS_KEY, confirmed);
      toast({ title: "State confirmed", description: `OpenAI ${confirmed.status.enabled ? "enabled" : "disabled"} for this server process.`, duration: 3000 });
    },
  });
  const unknownState = statusError || !status || stateMutation.isError;
  const anyLoading = statusLoading || isFetching || unknownState || stateMutation.isPending;
  const refreshStatus = async () => {
    const result = await refetch();
    if (result.isSuccess) stateMutation.reset();
  };

  return (
    <PortalLayout
      title="OpenAI Billing Control"
      description="Control new OpenAI requests from this server process."
      width="wide"
      actions={
        statusLoading ? (
          <Token label="Checking" tone="neutral" />
        ) : unknownState ? (
          <Token label="Unavailable" tone="warn" />
        ) : (
          <Token label={isEnabled ? "Enabled" : "Disabled"} tone={isEnabled ? "ok" : "bad"} dot />
        )
      }
    >
      <div className="space-y-4">
        <Callout
          tone={unknownState ? "info" : isEnabled ? "ok" : "bad"}
          title={statusLoading ? "Checking integration status…" : unknownState ? "Integration status is unavailable" : isEnabled ? "OpenAI integration is enabled" : "OpenAI integration is disabled"}
        >
          {unknownState ? "Refresh to confirm the current state before changing it." : "A runtime change affects this server process only."}
        </Callout>

        <Panel id="openai-config" title="Configuration" description="Current API settings">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium">API Status</dt>
              <dd className="mt-1 rounded-md border border-border bg-background p-3 font-mono text-sm">{status ? status.configured ? "Configured" : "Not configured" : "Unknown"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium">State after restart</dt>
              <dd className="mt-1 break-all rounded-md border border-border bg-background p-3 font-mono text-sm">{status ? status.restartEnabled ? "Enabled on restart" : "Disabled on restart" : "Unknown"}</dd>
            </div>
          </dl>
          <Callout tone="info" className="mt-4">
            Disabling blocks new provider requests from this process. Requests already sent may finish and incur charges. A restart restores the startup environment setting; other server processes are unaffected. An authorized operator must set ENABLE_OPENAI_INTEGRATION=false for disablement to survive restarts.
          </Callout>
        </Panel>

        <Panel id="openai-control" title="Control" description="Change the confirmed integration state">
          <div className="space-y-3">
            {stateMutation.isError && <Callout tone="bad" title="State not confirmed">Couldn't confirm the OpenAI state. Refresh status before changing it.</Callout>}
            {status && !status.configured && <Callout tone="info">No API credential is configured. Enabling is unavailable here.</Callout>}
            <Button
              onClick={() => stateMutation.mutate(!isEnabled)}
              disabled={anyLoading || (!isEnabled && !status?.configured)}
              variant={isEnabled ? "destructive" : "brand"}
              className="h-11 gap-2"
              data-testid="button-set-openai"
            >
              {stateMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
              {stateMutation.isPending ? "Saving…" : unknownState ? "Confirm status to change" : isEnabled ? "Disable OpenAI" : "Enable OpenAI"}
            </Button>

            <Button
              onClick={() => void refreshStatus()}
              disabled={isFetching || stateMutation.isPending}
              variant="ghost"
              className="h-11 w-full"
              data-testid="button-refresh-openai-status"
            >
              <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} aria-hidden="true" />
              {isFetching ? "Refreshing..." : "Refresh Status"}
            </Button>
          </div>
        </Panel>

        <Panel id="openai-features" title="Affected Features" description="These features depend on OpenAI integration" flush>
          <ul className="divide-y divide-border">
            {AFFECTED_FEATURES.map((f) => (
              <li key={f.name} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <Zap className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{f.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel id="openai-billing" title="Billing Information">
          <div className="space-y-3 text-sm">
            <p>
              <strong>When Enabled:</strong> Requests through this integration use the configured API provider. Review usage in that provider’s billing account.
            </p>
            <p>
              <strong>When Disabled:</strong> New requests through this integration are blocked. Disabling it does not change charges already incurred.
            </p>
            <p className="border-t border-border pt-3 text-xs text-muted-foreground">
              Use the configured provider’s billing dashboard for authoritative charges and usage.
            </p>
          </div>
        </Panel>
      </div>
    </PortalLayout>
  );
}

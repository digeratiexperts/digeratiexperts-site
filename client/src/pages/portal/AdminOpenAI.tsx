import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Power, RefreshCw, Zap } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { portalGet } from "@/lib/portalApi";
import { cn } from "@/lib/utils";
import { Callout, Panel, Token } from "@/components/portal/ui";

interface OpenAIStatus {
  status: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
  };
  message: string;
}

const AFFECTED_FEATURES = [
  { name: "Hybrid AI/Human Chat", detail: "AI-powered chat responses when enabled" },
  { name: "Ticket Classification", detail: "Automatic support ticket categorization" },
  { name: "Smart Recommendations", detail: "AI-suggested products and services" },
];

export function AdminOpenAI() {
  const { toast } = useToast();

  // Fetch OpenAI status
  const { data: statusData, isLoading: statusLoading, isError: statusError, refetch } = useQuery<OpenAIStatus>({
    queryKey: ["/api/portal/admin/openai/status"],
    queryFn: () => portalGet<OpenAIStatus>("/api/portal/admin/openai/status"),
  });

  const status = statusData?.status;
  const isEnabled = status?.enabled ?? false;

  // Enable OpenAI
  const enableMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/portal/admin/openai/enable", "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/openai/status"] });
      toast({
        title: "Success",
        description: "OpenAI integration enabled",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to enable OpenAI",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  // Disable OpenAI
  const disableMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/portal/admin/openai/disable", "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/openai/status"] });
      toast({
        title: "Success",
        description: "OpenAI integration disabled",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to disable OpenAI",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

  const anyLoading = statusLoading || statusError || !status || enableMutation.isPending || disableMutation.isPending;

  return (
    <PortalLayout
      title="OpenAI Billing Control"
      description="Manage OpenAI API usage and the billing kill switch."
      width="wide"
      actions={
        statusLoading ? (
          <Token label="Checking" tone="neutral" />
        ) : statusError || !status ? (
          <Token label="Unavailable" tone="warn" />
        ) : (
          <Token label={isEnabled ? "Enabled" : "Disabled"} tone={isEnabled ? "ok" : "bad"} dot />
        )
      }
    >
      <div className="space-y-4">
        <Callout
          tone={statusError || !status ? "info" : isEnabled ? "ok" : "bad"}
          title={statusLoading ? "Checking integration status…" : statusError || !status ? "Integration status is unavailable" : isEnabled ? "OpenAI integration is enabled" : "OpenAI integration is disabled"}
        >
          {statusError ? "Refresh to confirm the current state before changing it." : "Current state of OpenAI integration."}
        </Callout>

        <Panel id="openai-config" title="Configuration" description="Current API settings">
          <dl className="space-y-4">
            <div>
              <dt className="text-sm font-medium">API Status</dt>
              <dd className="mt-1 rounded-md border border-border bg-background p-3 font-mono text-sm">{status?.apiKey || "Not configured"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium">Base URL</dt>
              <dd className="mt-1 break-all rounded-md border border-border bg-background p-3 font-mono text-sm">{status?.baseUrl || "Not configured"}</dd>
            </div>
          </dl>
          <Callout tone="info" className="mt-4">
            Disabling OpenAI prevents new API calls from being made, saving on billing. Existing integrations will gracefully handle disabled state.
          </Callout>
        </Panel>

        <Panel id="openai-control" title="Control" description="Change the confirmed integration state">
          <div className="space-y-3">
            <Button
              onClick={() => isEnabled ? disableMutation.mutate() : enableMutation.mutate()}
              disabled={anyLoading}
              variant={isEnabled ? "destructive" : "brand"}
              className="h-11 gap-2"
              data-testid="button-set-openai"
            >
              {enableMutation.isPending || disableMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Power className="h-4 w-4" aria-hidden="true" />}
              {enableMutation.isPending ? "Enabling…" : disableMutation.isPending ? "Disabling…" : statusError || !status ? "Confirm status to change" : isEnabled ? "Disable OpenAI" : "Enable OpenAI"}
            </Button>

            <Button
              onClick={() => refetch()}
              disabled={statusLoading || enableMutation.isPending || disableMutation.isPending}
              variant="ghost"
              className="w-full"
              data-testid="button-refresh-openai-status"
            >
              <RefreshCw className={cn("h-4 w-4", statusLoading && "animate-spin")} aria-hidden="true" />
              {statusLoading ? "Refreshing..." : "Refresh Status"}
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

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, CheckCircle, Power, RefreshCw, Zap } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { portalGet } from "@/lib/portalApi";

interface OpenAIStatus {
  status: {
    enabled: boolean;
    apiKey: string;
    baseUrl: string;
  };
  message: string;
}

export function AdminOpenAI() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // Fetch OpenAI status
  const { data: statusData, isLoading: statusLoading, refetch } = useQuery<OpenAIStatus>({
    queryKey: ["/api/portal/admin/openai/status"],
    queryFn: () => portalGet<OpenAIStatus>("/api/portal/admin/openai/status"),
  });

  const status = statusData?.status;
  const isEnabled = status?.enabled ?? false;

  // Toggle OpenAI
  const toggleMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/portal/admin/openai/toggle", "POST", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/openai/status"] });
      toast({
        title: "Success",
        description: "OpenAI integration toggled",
        duration: 3000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to toggle OpenAI",
        variant: "destructive",
        duration: 3000,
      });
    },
  });

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

  const anyLoading = statusLoading || toggleMutation.isPending || enableMutation.isPending || disableMutation.isPending;

  return (
    <PortalLayout title="OpenAI Billing Control" description="Manage OpenAI API usage and the billing kill switch.">
      <div className="space-y-6">
        {/* Status Card */}
        <Card className="border-l-4" style={{ borderLeftColor: isEnabled ? "#10b981" : "#ef4444" }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEnabled ? "bg-green-100 dark:bg-green-900" : "bg-red-100 dark:bg-red-900"}`}>
                  {isEnabled ? (
                    <CheckCircle className={`w-6 h-6 ${isEnabled ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`} />
                  ) : (
                    <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div>
                  <CardTitle className="text-xl">Integration Status</CardTitle>
                  <CardDescription>Current state of OpenAI integration</CardDescription>
                </div>
              </div>
              <Badge variant={isEnabled ? "default" : "destructive"} className="text-lg px-4 py-2">
                {isEnabled ? "ENABLED" : "DISABLED"}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>Current API settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Status</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm">
                {status?.apiKey || "Not configured"}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Base URL</label>
              <div className="mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 font-mono text-sm">
                {status?.baseUrl || "Not configured"}
              </div>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                ℹ️ Disabling OpenAI prevents new API calls from being made, saving on billing. Existing integrations will gracefully handle disabled state.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Control Card */}
        <Card>
          <CardHeader>
            <CardTitle>Control</CardTitle>
            <CardDescription>Toggle OpenAI integration on/off</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                onClick={() => toggleMutation.mutate()}
                disabled={anyLoading}
                variant="outline"
                className="w-full h-12 gap-2"
                data-testid="button-toggle-openai"
              >
                {toggleMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Toggling...
                  </>
                ) : (
                  <>
                    <Power className="w-4 h-4" />
                    Toggle {isEnabled ? "OFF" : "ON"}
                  </>
                )}
              </Button>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => enableMutation.mutate()}
                  disabled={anyLoading || isEnabled}
                  className="gap-2 bg-green-600 hover:bg-green-700 text-white"
                  data-testid="button-enable-openai"
                >
                  {enableMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Enabling...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Enable
                    </>
                  )}
                </Button>

                <Button
                  onClick={() => disableMutation.mutate()}
                  disabled={anyLoading || !isEnabled}
                  variant="destructive"
                  className="gap-2"
                  data-testid="button-disable-openai"
                >
                  {disableMutation.isPending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Disabling...
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4" />
                      Disable
                    </>
                  )}
                </Button>
              </div>

              <Button
                onClick={() => refetch()}
                disabled={anyLoading}
                variant="ghost"
                className="w-full"
                data-testid="button-refresh-openai-status"
              >
                <RefreshCw className={`w-4 h-4 ${statusLoading ? "animate-spin" : ""}`} />
                {statusLoading ? "Refreshing..." : "Refresh Status"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Card */}
        <Card>
          <CardHeader>
            <CardTitle>Affected Features</CardTitle>
            <CardDescription>These features depend on OpenAI integration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Hybrid AI/Human Chat</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI-powered chat responses when enabled</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Ticket Classification</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Automatic support ticket categorization</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                <Zap className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Smart Recommendations</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">AI-suggested products and services</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing Info Card */}
        <Card className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              💰 Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>When Enabled:</strong> OpenAI API calls are made and billed to your Replit credits. Monitor usage and disable during off-peak hours if needed.
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              <strong>When Disabled:</strong> No OpenAI API calls are made. Features gracefully degrade without incurring charges. Fallback behaviors are in place.
            </p>
            <Separator className="my-3" />
            <p className="text-xs text-gray-600 dark:text-gray-400">
              ⓘ For detailed billing analytics and usage monitoring, check your Replit account dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

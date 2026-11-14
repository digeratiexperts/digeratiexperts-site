import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowRight, CreditCard, Download, ExternalLink, FileText, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { portalGet, portalPost } from "@/lib/portalApi";
import { Callout, DataTable, EmptyState, GenericStatus, Panel, type DataColumn } from "@/components/portal/ui";
import { COMPANY } from "@/data/companyContact";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  subscription_id: string;
  subscription_number: string;
  name: string;
  status: string;
  plan: {
    plan_code: string;
    name: string;
    price: number;
  };
  next_billing_at: string;
  current_term_ends_at: string;
  amount: number;
  zohoLink?: string;
}

interface Invoice {
  invoice_id: string;
  invoice_number: string;
  status: string;
  invoice_date: string;
  due_date: string;
  total: number;
  balance: number;
  currency_code: string;
  zohoLink?: string;
}

interface BillingData {
  subscription: Subscription | null;
  invoices: Invoice[];
  zohoConnected: boolean;
  autoRenewContractEnabled?: boolean;
}

interface HubSubscription {
  subscriptionId: string;
  status: string;
  plan?: string;
  skuIds?: string[];
  priceCents?: number;
  currency?: string;
  frequency?: string;
  termMonths?: number;
  terms?: string;
  termsVersion?: string;
  renewsAt?: string | null;
  currentTermEnd?: string | null;
}

interface HubSubscriptionsData {
  autoRenewContractEnabled: boolean;
  subscriptions: HubSubscription[];
  message?: string;
  error?: string;
}

const PAYMENT_METHOD_HELP = `Self-serve card updates are not available in the Client Portal yet. Email ${COMPANY.billingEmail} or pay an open invoice to use a card.`;

export default function PortalBilling() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<HubSubscription | null>(null);

  const { data, isLoading, error, refetch } = useQuery<BillingData>({
    queryKey: ["/api/portal/billing"],
    queryFn: () => portalGet<BillingData>("/api/portal/billing"),
    retry: 1,
  });

  const {
    data: hubData,
    isLoading: hubLoading,
    error: hubError,
    refetch: refetchHub,
  } = useQuery<HubSubscriptionsData>({
    queryKey: ["/api/portal/subscriptions"],
    queryFn: () => portalGet<HubSubscriptionsData>("/api/portal/subscriptions"),
    retry: 1,
  });

  const autoRenewEnabled = hubData?.autoRenewContractEnabled === true || data?.autoRenewContractEnabled === true;

  const cancelMutation = useMutation({
    mutationFn: (subscription: HubSubscription) =>
      portalPost(`/api/portal/subscriptions/${encodeURIComponent(subscription.subscriptionId)}/cancel`, {
        requestedAt: new Date().toISOString(),
      }),
    onSuccess: () => {
      setCancelTarget(null);
      void queryClient.invalidateQueries({ queryKey: ["/api/portal/subscriptions"] });
      void queryClient.invalidateQueries({ queryKey: ["/api/portal/billing"] });
      toast({ title: "Subscription canceled", description: "A confirmation will be emailed to you. Access continues through the date shown on the plan." });
    },
    onError: (err: Error) => {
      toast({
        title: "Couldn't cancel this subscription",
        description: err.message || `Try again, or email ${COMPANY.billingEmail}.`,
        variant: "destructive",
      });
    },
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "N/A";
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  };

  const subscription = data?.subscription;
  const recentInvoices = (data?.invoices || []).slice(0, 5);
  const hubSubscriptions = autoRenewEnabled ? hubData?.subscriptions || [] : [];

  const invoiceColumns: DataColumn<Invoice>[] = [
    {
      key: "number",
      header: "Invoice #",
      primary: true,
      cell: (invoice) => <span className="pt-num font-medium">{invoice.invoice_number}</span>,
    },
    {
      key: "date",
      header: "Date",
      primary: true,
      className: "w-36 whitespace-nowrap",
      cell: (invoice) => <span className="pt-num text-muted-foreground">{formatDate(invoice.invoice_date)}</span>,
    },
    {
      key: "amount",
      header: "Amount",
      primary: true,
      align: "right",
      className: "w-36 whitespace-nowrap",
      cell: (invoice) => (
        <div>
          <p className="pt-num font-medium">{formatCurrency(invoice.total, invoice.currency_code)}</p>
          {invoice.balance > 0 && (
            <p className="pt-num pt-ink pt-tone-bad text-xs">Balance: {formatCurrency(invoice.balance, invoice.currency_code)}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      primary: true,
      className: "w-32",
      cell: (invoice) => <GenericStatus status={invoice.status} />,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-28 whitespace-nowrap",
      cell: (invoice) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <Link
              href={invoice.invoice_id ? `/portal/invoices/${invoice.invoice_id}/pay` : "/portal/invoices"}
              title="View invoice"
              aria-label={`View invoice ${invoice.invoice_number}`}
              data-testid={`button-view-${invoice.invoice_id}`}
            >
              View
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label={`Download invoice ${invoice.invoice_number} is not available yet`}
            title="Invoice PDF download is not available in the Client Portal yet. Open the invoice to view the amount due."
            disabled
            data-testid={`button-download-${invoice.invoice_id}`}
          >
            <Download aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PortalLayout title="Billing & Subscription" description="Your current plan, recent invoices and payment method.">
      <div className="space-y-4">
        {error && (
          <Callout
            tone="bad"
            title="Billing data couldn't be loaded"
            action={
              <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => refetch()} data-testid="button-retry-billing">
                <RefreshCcw aria-hidden="true" />
                Retry
              </Button>
            }
          >
            Please try again.
          </Callout>
        )}

        {!data?.zohoConnected && !isLoading && (
          <Callout tone="info">Billing integration is being configured. Some features may be limited.</Callout>
        )}

        {autoRenewEnabled && (
          <Panel id="hub-subscriptions" title="Subscriptions" description="Plans, renewal dates and one-click cancellation">
            {hubError && (
              <Callout
                tone="bad"
                title="Subscriptions couldn't be loaded"
                action={
                  <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => refetchHub()} data-testid="button-retry-subscriptions">
                    <RefreshCcw aria-hidden="true" />
                    Retry
                  </Button>
                }
              >
                Please try again.
              </Callout>
            )}
            {hubLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-48" />
                <Skeleton className="h-20" />
              </div>
            ) : hubSubscriptions.length > 0 ? (
              <div className="space-y-4">
                {hubSubscriptions.map((sub) => (
                  <div key={sub.subscriptionId} className="space-y-3 rounded-lg border border-border bg-background p-4" data-testid={`hub-subscription-${sub.subscriptionId}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-heading text-lg font-semibold leading-tight">{sub.plan || "Subscription"}</h3>
                        <p className="pt-num mt-1 text-sm text-muted-foreground">#{sub.subscriptionId}</p>
                      </div>
                      <GenericStatus status={sub.status} />
                    </div>
                    <dl className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-lg border border-border bg-background p-3">
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Renews</dt>
                        <dd className="pt-num mt-1 text-lg font-semibold">{formatDate(sub.renewsAt)}</dd>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Terms version</dt>
                        <dd className="pt-num mt-1 text-lg font-semibold">{sub.termsVersion || "N/A"}</dd>
                      </div>
                      <div className="rounded-lg border border-border bg-background p-3">
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Term ends</dt>
                        <dd className="pt-num mt-1 text-lg font-semibold">{formatDate(sub.currentTermEnd)}</dd>
                      </div>
                    </dl>
                    {sub.terms && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{sub.terms}</p>}
                    {sub.status !== "cancelled" && sub.status !== "cancel_scheduled" && (
                      <Button
                        variant="outline"
                        className="border-border bg-card hover:bg-accent"
                        onClick={() => setCancelTarget(sub)}
                        data-testid={`button-cancel-${sub.subscriptionId}`}
                      >
                        Cancel subscription
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                compact
                icon={CreditCard}
                title="No subscriptions on file"
                description={hubData?.message || "Subscriptions appear here once a plan is linked to your account."}
              />
            )}
          </Panel>
        )}

        <Panel id="current-subscription" title="Current subscription" description="Your active service plan">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-20" />
                ))}
              </div>
            </div>
          ) : subscription ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-heading text-xl font-semibold leading-tight">{subscription.plan?.name || subscription.name}</h3>
                  <p className="pt-num mt-1 text-sm text-muted-foreground">Subscription #{subscription.subscription_number}</p>
                </div>
                <GenericStatus status={subscription.status} />
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Monthly amount</dt>
                  <dd className="pt-num mt-1 text-lg font-semibold">{formatCurrency(subscription.amount || subscription.plan?.price || 0)}</dd>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Next billing</dt>
                  <dd className="pt-num mt-1 text-lg font-semibold">{formatDate(subscription.next_billing_at)}</dd>
                </div>
                <div className="rounded-lg border border-border bg-background p-3">
                  <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Term ends</dt>
                  <dd className="pt-num mt-1 text-lg font-semibold">{formatDate(subscription.current_term_ends_at)}</dd>
                </div>
              </dl>

              <div className="flex flex-wrap gap-2">
                {subscription.zohoLink && (
                  <Button asChild variant="outline" className="border-border bg-card hover:bg-accent">
                    <a href={subscription.zohoLink} target="_blank" rel="noopener noreferrer" data-testid="button-manage-subscription">
                      <ExternalLink aria-hidden="true" />
                      Manage in Zoho
                    </a>
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="border-border bg-card hover:bg-accent"
                  disabled
                  title={PAYMENT_METHOD_HELP}
                  data-testid="button-update-payment"
                >
                  Update payment method
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_HELP}</p>
            </div>
          ) : (
            <EmptyState
              compact
              icon={CreditCard}
              title="No active subscription found"
              description="Your plan appears here once a subscription is linked to your account."
              action={
                <Button asChild variant="brand" data-testid="button-view-plans">
                  <Link href="/store">View plans</Link>
                </Button>
              }
            />
          )}
        </Panel>

        <Panel
          id="recent-invoices"
          title="Recent invoices"
          description="Your billing history"
          flush
          actions={
            <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
              <Link href="/portal/invoices" data-testid="button-view-all-invoices">
                View all
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        >
          <DataTable<Invoice>
            columns={invoiceColumns}
            rows={recentInvoices}
            rowKey={(invoice) => invoice.invoice_id}
            rowTestId={(invoice) => `invoice-row-${invoice.invoice_id}`}
            loading={isLoading}
            loadingRows={3}
            caption="Recent invoices"
            empty={
              <EmptyState
                compact
                icon={FileText}
                title="No invoices found"
                description="Invoices appear here as they are issued."
              />
            }
          />
        </Panel>

        <Panel id="payment-methods" title="Payment methods" description="Manage your payment options">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
            <div className="flex min-w-0 items-center gap-3">
              <CreditCard className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium">Card on file</p>
                <p className="text-xs text-muted-foreground">{PAYMENT_METHOD_HELP}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="border-border bg-card hover:bg-accent"
              disabled
              title={PAYMENT_METHOD_HELP}
              data-testid="button-update-card"
            >
              Update
            </Button>
          </div>
        </Panel>
      </div>

      <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && !cancelMutation.isPending && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget
                ? `This cancels ${cancelTarget.plan || "this plan"} in one step. You will keep access through ${formatDate(cancelTarget.currentTermEnd || cancelTarget.renewsAt)}. No phone call is required.`
                : "This cancels the plan in one step. No phone call is required."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelMutation.isPending} data-testid="button-cancel-subscription-back">
              Keep subscription
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={cancelMutation.isPending || !cancelTarget}
              onClick={(event) => {
                event.preventDefault();
                if (cancelTarget) cancelMutation.mutate(cancelTarget);
              }}
              data-testid="button-cancel-subscription-confirm"
            >
              {cancelMutation.isPending ? "Canceling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PortalLayout>
  );
}

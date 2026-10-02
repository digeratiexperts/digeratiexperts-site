import { useState, useMemo } from "react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Server, Shield, ClipboardCheck, Check, ChevronRight, FileText, Send, Calculator,
  Building2, User, Calendar, DollarSign, Loader2
} from "lucide-react";
import { coreDocuments } from "@/data/serviceCatalog";
import { pricing } from "@/data/pricing";
import {
  catalogUnitPrice,
  getPortalOrderItem,
  portalOrderDocumentKeys,
  PORTAL_ORDER_SELECTABLE,
  validatePortalOrderSelection,
  type PortalOrderCatalogItem,
} from "@shared/portalOrderCatalog";
import { useToast } from "@/hooks/use-toast";
import { portalPost } from "@/lib/portalApi";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Callout, Field, Panel, Token } from "@/components/portal/ui";

interface SelectedService {
  serviceId: string;
  quantity: number;
}

interface ClientInfo {
  legalName: string;
  dbaName: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  phone: string;
  website: string;
  signatoryName: string;
  signatoryTitle: string;
  signatoryEmail: string;
  signatoryPhone: string;
  techContactName: string;
  techContactEmail: string;
  billingContactName: string;
  billingContactEmail: string;
  numberOfSites: number;
  numberOfUsers: number;
  preferredStartDate: string;
  contractTerm: string;
  notes: string;
}

function formatServicePrice(service: PortalOrderCatalogItem): { primary: string; secondary?: string } {
  if (service.checkoutMode === "quote_after_review") {
    const published = service.tier ? pricing[service.tier] : null;
    return {
      primary: "Priced after review",
      secondary: published ? `starts at $${published.user.toLocaleString()}/user` : undefined,
    };
  }
  const price = catalogUnitPrice(service);
  return {
    primary: `$${price.toLocaleString()}`,
    secondary: "one-time catalog price",
  };
}

function formatLineAmount(service: PortalOrderCatalogItem): string {
  if (service.checkoutMode === "quote_after_review") return "Priced after review";
  return `$${catalogUnitPrice(service).toLocaleString()}`;
}

const fieldClass = "border-border bg-background";
const subPanelClass = "rounded-lg border border-border bg-background p-4";

export function OrderForm() {
  const { toast } = useToast();
  const [step, setStep] = useState<"services" | "details" | "review">("services");
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    legalName: "",
    dbaName: "",
    address: "",
    city: "",
    state: "AZ",
    zipCode: "",
    phone: "",
    website: "",
    signatoryName: "",
    signatoryTitle: "",
    signatoryEmail: "",
    signatoryPhone: "",
    techContactName: "",
    techContactEmail: "",
    billingContactName: "",
    billingContactEmail: "",
    numberOfSites: 1,
    numberOfUsers: 10,
    preferredStartDate: "",
    contractTerm: "12",
    notes: "",
  });

  const toggleService = (service: PortalOrderCatalogItem) => {
    setSelectedServices((prev) => {
      const existing = prev.find((s) => s.serviceId === service.id);
      if (existing) {
        return prev.filter((s) => s.serviceId !== service.id);
      }
      const next = service.exclusiveGroup
        ? prev.filter((s) => getPortalOrderItem(s.serviceId)?.exclusiveGroup !== service.exclusiveGroup)
        : prev;
      return [...next, { serviceId: service.id, quantity: service.minQuantity }];
    });
  };

  const getServiceFromCatalog = (serviceId: string): PortalOrderCatalogItem | undefined => {
    return getPortalOrderItem(serviceId);
  };

  const isServiceSelected = (serviceId: string) => {
    return selectedServices.some((s) => s.serviceId === serviceId);
  };

  const orderPricing = useMemo(() => {
    const validated = validatePortalOrderSelection(selectedServices);
    if (!validated.ok) {
      return {
        monthlyTotal: 0,
        oneTimeTotal: 0,
        annualTotal: 0,
        hasCustom: selectedServices.length > 0,
        payableCheckout: false,
        error: validated.error,
      };
    }
    return {
      monthlyTotal: validated.monthlyTotal,
      oneTimeTotal: validated.oneTimeTotal,
      annualTotal: 0,
      hasCustom: validated.hasQuoteItems,
      payableCheckout: validated.payableCheckout,
      error: null as string | null,
    };
  }, [selectedServices]);

  const requiredDocuments = useMemo(() => {
    const serviceIds = selectedServices.map((s) => s.serviceId);
    const docKeys = portalOrderDocumentKeys(serviceIds);

    const allDocs = [
      ...coreDocuments,
      ...docKeys.map((key) => ({
        key,
        name: `SOW - ${key.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}`,
        required: true,
      })),
    ];

    return allDocs;
  }, [selectedServices]);

  const [, navigate] = useLocation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!clientInfo.legalName || !clientInfo.signatoryEmail) {
      toast({
        title: "Missing Information",
        description: "Please complete all required fields",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const validated = validatePortalOrderSelection(selectedServices);
      if (!validated.ok) {
        toast({
          title: "Invalid service mix",
          description: validated.error,
          variant: "destructive",
        });
        return;
      }

      const serviceIds = selectedServices.map((s) => s.serviceId);
      const documentKeys = portalOrderDocumentKeys(serviceIds);

      const orderData = {
        serviceSelections: documentKeys,
        clientInfo: {
          legalName: clientInfo.legalName,
          dbaName: clientInfo.dbaName,
          address: clientInfo.address,
          city: clientInfo.city,
          state: clientInfo.state,
          zipCode: clientInfo.zipCode,
          phone: clientInfo.phone,
          website: clientInfo.website,
          signatoryName: clientInfo.signatoryName,
          signatoryTitle: clientInfo.signatoryTitle,
          signatoryEmail: clientInfo.signatoryEmail,
          signatoryPhone: clientInfo.signatoryPhone,
          techContactName: clientInfo.techContactName,
          techContactEmail: clientInfo.techContactEmail,
          billingContactName: clientInfo.billingContactName,
          billingContactEmail: clientInfo.billingContactEmail,
          numberOfSites: clientInfo.numberOfSites,
          numberOfUsers: clientInfo.numberOfUsers,
          preferredStartDate: clientInfo.preferredStartDate,
          contractTerm: clientInfo.contractTerm,
          notes: clientInfo.notes,
        },
        selectedServices: validated.lines.map((line) => ({
          serviceId: line.id,
          sku: line.sku,
          hubSku: line.hubSku,
          quantity: line.quantity,
          serviceName: line.name,
        })),
        pricing: {
          monthlyTotal: validated.monthlyTotal,
          oneTimeTotal: validated.oneTimeTotal,
          contractTerm: parseInt(clientInfo.contractTerm),
          hasCustom: validated.hasQuoteItems,
          payableCheckout: validated.payableCheckout,
        },
        name: `Service Order - ${clientInfo.legalName} - ${new Date().toLocaleDateString()}`,
      };

      await portalPost<{ success: boolean; packet: any; items: any[]; message: string }>(
        "/api/portal/order-form",
        orderData,
      );

      toast({
        title: "Order Submitted Successfully",
        description:
          "Your service order has been submitted. You can view your contract documents in the Contracts section.",
      });

      setTimeout(() => {
        navigate("/portal/contracts");
      }, 2000);
    } catch (error: any) {
      console.error("Order submission error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to submit order. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const steps = [
    { id: "services" as const, label: "Select Services" },
    { id: "details" as const, label: "Company Details" },
    { id: "review" as const, label: "Review & Submit" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);

  const SummaryPanel = ({ showDocs = true, continueLabel }: { showDocs?: boolean; continueLabel?: string }) => (
    <Panel
      id="order-summary"
      className="sticky top-6"
      title={
        <span className="inline-flex items-center gap-2">
          <Calculator className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          Order summary
        </span>
      }
    >
      <div className="space-y-4">
        {selectedServices.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted-foreground">Select services to see pricing</p>
        ) : (
          <>
            <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
              {selectedServices.map((selected) => {
                const service = getServiceFromCatalog(selected.serviceId);
                if (!service) return null;

                return (
                  <li key={selected.serviceId} className="flex justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate text-muted-foreground">
                      {service.shortName}
                      {selected.quantity > 1 && ` ×${selected.quantity}`}
                    </span>
                    <span className="pt-num whitespace-nowrap font-medium">
                      {formatLineAmount(service)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-border" />

            {orderPricing.monthlyTotal > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Monthly Total</span>
                <span className="pt-num text-lg font-semibold">
                  ${orderPricing.monthlyTotal.toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </span>
              </div>
            )}

            {orderPricing.oneTimeTotal > 0 && (
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">One-Time</span>
                <span className="pt-num text-lg font-semibold">
                  ${orderPricing.oneTimeTotal.toLocaleString()}
                </span>
              </div>
            )}

            {orderPricing.hasCustom && (
              <Callout tone="info">Includes custom-quoted services — final pricing after review.</Callout>
            )}

            {orderPricing.monthlyTotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Annual Value</span>
                <span className="pt-num text-muted-foreground">${orderPricing.annualTotal.toLocaleString()}/yr</span>
              </div>
            )}
          </>
        )}

        {showDocs && (
          <>
            <div className="border-t border-border" />
            <div>
              <h3 className="mb-2 flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Required Documents ({requiredDocuments.length})
              </h3>
              <ul className="max-h-36 space-y-1 overflow-y-auto">
                {requiredDocuments.map((doc) => (
                  <li key={doc.key} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="pt-ink pt-tone-brand h-3 w-3 shrink-0" aria-hidden="true" />
                    <span className="truncate">{doc.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {continueLabel && (
          <Button
            variant="brand"
            className="w-full"
            disabled={selectedServices.length === 0}
            onClick={() => setStep("details")}
            data-testid="continue-to-details"
          >
            {continueLabel}
            <ChevronRight aria-hidden="true" />
          </Button>
        )}
      </div>
    </Panel>
  );

  return (
    <PortalLayout
      title="Service Order Form"
      description="Pick your services, tell us about your company, then review and submit. We prepare the agreement documents for e-signature."
      width="wide"
    >
      <div className="space-y-4">
        {/* Step indicator */}
        <ol className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:gap-3" aria-label="Order steps">
          {steps.map((s, i) => {
            const active = step === s.id;
            const done = i < stepIndex;
            return (
              <li key={s.id} className="flex items-center gap-2 sm:gap-3" aria-current={active ? "step" : undefined}>
                {i > 0 && <ChevronRight className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />}
                <div className={cn("flex items-center gap-2", active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground")}>
                  <span
                    className={cn(
                      "pt-num flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "pt-token pt-tone-ok"
                          : "border-border bg-secondary text-muted-foreground",
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn("text-sm", active ? "font-semibold" : "font-medium")}>
                    {s.label}
                    {done && <span className="sr-only"> (completed)</span>}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {step === "services" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel
                id="select-services"
                title={
                  <span className="inline-flex items-center gap-2">
                    <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Select your services
                  </span>
                }
                description="Choose CSRA, one ProActive ecosystem package, or both. Security, Core IT, and BCDR are included inside the selected package — they cannot be stacked as separate checkouts."
              >
                <div className="space-y-6">
                  {(["assessment", "ecosystem"] as const).map((group) => {
                    const items = PORTAL_ORDER_SELECTABLE.filter((item) =>
                      group === "assessment" ? item.id === "csra-assessment" : item.id !== "csra-assessment",
                    );
                    return (
                      <div key={group} className="space-y-2">
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          {group === "assessment" ? (
                            <ClipboardCheck className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          ) : (
                            <Shield className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          )}
                          {group === "assessment" ? "Assessment" : "ProActive ecosystem (pick one)"}
                        </h3>
                        <div className="grid gap-2">
                          {items.map((service) => {
                            const isSelected = isServiceSelected(service.id);
                            const price = formatServicePrice(service);
                            return (
                              <div
                                key={service.id}
                                role="button"
                                tabIndex={0}
                                aria-pressed={isSelected}
                                className={cn(
                                  "relative cursor-pointer rounded-lg border px-3 py-2.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                  isSelected
                                    ? "border-primary bg-accent ring-1 ring-ring"
                                    : "border-border bg-background pt-hover-brand hover:bg-accent/60",
                                )}
                                onClick={() => toggleService(service)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    toggleService(service);
                                  }
                                }}
                                data-testid={`service-card-${service.id}`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-0.5 flex flex-wrap items-center gap-2">
                                      <h4 className="text-sm font-semibold leading-snug">
                                        {service.name}
                                      </h4>
                                      {service.tier && (
                                        <Token label={service.tier.charAt(0).toUpperCase() + service.tier.slice(1)} tone="neutral" className="normal-case tracking-normal" />
                                      )}
                                    </div>
                                    <p className="mb-1.5 line-clamp-2 text-xs text-muted-foreground">
                                      {service.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {service.features.slice(0, 3).map((feature) => (
                                        <span
                                          key={feature}
                                          className="rounded bg-secondary px-1.5 py-0.5 text-xs text-muted-foreground"
                                        >
                                          {feature}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="min-w-[6.5rem] shrink-0 text-right">
                                    <div
                                      className={cn(
                                        "pt-num font-semibold leading-tight",
                                        service.checkoutMode === "quote_after_review" ? "text-sm" : "text-lg",
                                      )}
                                    >
                                      {price.primary}
                                    </div>
                                    {price.secondary && (
                                      <div className="text-xs text-muted-foreground">{price.secondary}</div>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="pt-ink pt-tone-brand mt-2.5 flex items-center gap-1.5 border-t border-border pt-2.5">
                                    <Check className="h-4 w-4" aria-hidden="true" />
                                    <span className="text-sm font-medium">Selected</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {orderPricing.error && (
                    <Callout tone="bad">{orderPricing.error}</Callout>
                  )}
                </div>
              </Panel>
            </div>

            <div className="space-y-4">
              <SummaryPanel showDocs continueLabel="Continue to Details" />
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Panel
                id="company-info"
                title={
                  <span className="inline-flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Company information
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Legal Company Name" htmlFor="legalName" required>
                      <Input
                        id="legalName"
                        value={clientInfo.legalName}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, legalName: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-legal-name"
                      />
                    </Field>
                    <Field label="DBA / Trade Name" htmlFor="dbaName">
                      <Input
                        id="dbaName"
                        value={clientInfo.dbaName}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, dbaName: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-dba-name"
                      />
                    </Field>
                  </div>

                  <Field label="Street Address" htmlFor="address" required>
                    <Input
                      id="address"
                      value={clientInfo.address}
                      onChange={(e) => setClientInfo((prev) => ({ ...prev, address: e.target.value }))}
                      className={fieldClass}
                      data-testid="input-address"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <Field label="City" htmlFor="city" required className="col-span-2 md:col-span-1">
                      <Input
                        id="city"
                        value={clientInfo.city}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, city: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-city"
                      />
                    </Field>
                    <Field label="State" labelId="state-label" required>
                      <Select
                        value={clientInfo.state}
                        onValueChange={(v) => setClientInfo((prev) => ({ ...prev, state: v }))}
                      >
                        <SelectTrigger aria-labelledby="state-label" className={fieldClass} data-testid="select-state">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AZ">Arizona</SelectItem>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="NV">Nevada</SelectItem>
                          <SelectItem value="NM">New Mexico</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="ZIP Code" htmlFor="zipCode" required>
                      <Input
                        id="zipCode"
                        value={clientInfo.zipCode}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, zipCode: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-zip"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Phone" htmlFor="phone" required>
                      <Input
                        id="phone"
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, phone: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-phone"
                      />
                    </Field>
                    <Field label="Website" htmlFor="website">
                      <Input
                        id="website"
                        value={clientInfo.website}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, website: e.target.value }))}
                        className={fieldClass}
                        placeholder="https://"
                        data-testid="input-website"
                      />
                    </Field>
                  </div>
                </div>
              </Panel>

              <Panel
                id="signatory"
                title={
                  <span className="inline-flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Authorized signatory
                  </span>
                }
                description="The person authorized to sign contracts on behalf of the company"
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Full Name" htmlFor="signatoryName" required>
                      <Input
                        id="signatoryName"
                        value={clientInfo.signatoryName}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryName: e.target.value }))
                        }
                        className={fieldClass}
                        data-testid="input-signatory-name"
                      />
                    </Field>
                    <Field label="Title" htmlFor="signatoryTitle" required>
                      <Input
                        id="signatoryTitle"
                        value={clientInfo.signatoryTitle}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryTitle: e.target.value }))
                        }
                        className={fieldClass}
                        placeholder="e.g., CEO, Owner, President"
                        data-testid="input-signatory-title"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Email" htmlFor="signatoryEmail" required>
                      <Input
                        id="signatoryEmail"
                        type="email"
                        value={clientInfo.signatoryEmail}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryEmail: e.target.value }))
                        }
                        className={fieldClass}
                        data-testid="input-signatory-email"
                      />
                    </Field>
                    <Field label="Phone" htmlFor="signatoryPhone">
                      <Input
                        id="signatoryPhone"
                        value={clientInfo.signatoryPhone}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryPhone: e.target.value }))
                        }
                        className={fieldClass}
                        data-testid="input-signatory-phone"
                      />
                    </Field>
                  </div>
                </div>
              </Panel>

              <Panel
                id="service-config"
                title={
                  <span className="inline-flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Service configuration
                  </span>
                }
              >
                <div className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Number of Sites" htmlFor="numberOfSites">
                      <Input
                        id="numberOfSites"
                        type="number"
                        min="1"
                        value={clientInfo.numberOfSites}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setClientInfo((prev) => ({ ...prev, numberOfSites: "" as any }));
                            return;
                          }
                          const num = parseInt(val);
                          if (!isNaN(num)) setClientInfo((prev) => ({ ...prev, numberOfSites: num }));
                        }}
                        onBlur={() => {
                          if (!clientInfo.numberOfSites || clientInfo.numberOfSites < 1)
                            setClientInfo((prev) => ({ ...prev, numberOfSites: 1 }));
                        }}
                        className={fieldClass}
                        data-testid="input-sites"
                      />
                    </Field>
                    <Field label="Number of Users" htmlFor="numberOfUsers">
                      <Input
                        id="numberOfUsers"
                        type="number"
                        min="1"
                        value={clientInfo.numberOfUsers}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setClientInfo((prev) => ({ ...prev, numberOfUsers: "" as any }));
                            return;
                          }
                          const num = parseInt(val);
                          if (!isNaN(num)) setClientInfo((prev) => ({ ...prev, numberOfUsers: num }));
                        }}
                        onBlur={() => {
                          if (!clientInfo.numberOfUsers || clientInfo.numberOfUsers < 1)
                            setClientInfo((prev) => ({ ...prev, numberOfUsers: 1 }));
                        }}
                        className={fieldClass}
                        data-testid="input-users"
                      />
                    </Field>
                    <Field label="Contract Term" labelId="contractTerm-label">
                      <Select
                        value={clientInfo.contractTerm}
                        onValueChange={(v) => setClientInfo((prev) => ({ ...prev, contractTerm: v }))}
                      >
                        <SelectTrigger aria-labelledby="contractTerm-label" className={fieldClass} data-testid="select-term">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 Months</SelectItem>
                          <SelectItem value="24">24 Months</SelectItem>
                          <SelectItem value="36">36 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Preferred Start Date" htmlFor="preferredStartDate">
                    <Input
                      id="preferredStartDate"
                      type="date"
                      value={clientInfo.preferredStartDate}
                      onChange={(e) =>
                        setClientInfo((prev) => ({ ...prev, preferredStartDate: e.target.value }))
                      }
                      className={fieldClass}
                      data-testid="input-start-date"
                    />
                  </Field>

                  <Field label="Additional Notes" htmlFor="notes">
                    <Textarea
                      id="notes"
                      value={clientInfo.notes}
                      onChange={(e) => setClientInfo((prev) => ({ ...prev, notes: e.target.value }))}
                      className={fieldClass}
                      rows={3}
                      placeholder="Any special requirements or notes..."
                      data-testid="input-notes"
                    />
                  </Field>
                </div>
              </Panel>

              <div className="flex flex-wrap gap-3">
                <Button
                  variant="outline"
                  className="border-border bg-card hover:bg-accent"
                  onClick={() => setStep("services")}
                  data-testid="back-to-services"
                >
                  Back to Services
                </Button>
                <Button
                  variant="brand"
                  className="flex-1"
                  onClick={() => setStep("review")}
                  data-testid="continue-to-review"
                >
                  Review & Submit
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div>
              <Panel
                id="pricing-summary"
                className="sticky top-6"
                title={
                  <span className="inline-flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Pricing summary
                  </span>
                }
              >
                <div className="space-y-4">
                  <ul className="space-y-2">
                    {selectedServices.map((selected) => {
                      const service = getServiceFromCatalog(selected.serviceId);
                      if (!service) return null;

                      return (
                        <li key={selected.serviceId} className="flex justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{service.shortName}</span>
                          <span className="pt-num whitespace-nowrap font-medium">
                            {formatLineAmount(service)}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="border-t border-border" />

                  <div className="space-y-2">
                    {orderPricing.monthlyTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Monthly</span>
                        <span className="pt-num text-lg font-semibold">
                          ${orderPricing.monthlyTotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {orderPricing.oneTimeTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">One-Time</span>
                        <span className="pt-num font-medium">
                          ${orderPricing.oneTimeTotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {orderPricing.hasCustom && (
                      <Callout tone="info">Custom quote items included — priced after review.</Callout>
                    )}
                    {orderPricing.monthlyTotal === 0 &&
                      orderPricing.oneTimeTotal === 0 &&
                      orderPricing.hasCustom && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Pricing</span>
                          <span className="font-semibold">Custom quote</span>
                        </div>
                      )}
                  </div>
                </div>
              </Panel>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <Panel id="order-review" title="Order review" description="Please review your order before submitting">
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className={subPanelClass}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Company
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {clientInfo.legalName || "Not provided"}
                      </p>
                      {clientInfo.dbaName && (
                        <p className="text-muted-foreground">DBA: {clientInfo.dbaName}</p>
                      )}
                      <p className="text-muted-foreground">{clientInfo.address}</p>
                      <p className="text-muted-foreground">
                        {clientInfo.city}, {clientInfo.state} {clientInfo.zipCode}
                      </p>
                      <p className="text-muted-foreground">{clientInfo.phone}</p>
                    </div>
                  </div>

                  <div className={subPanelClass}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Authorized Signatory
                    </h3>
                    <div className="space-y-1 text-sm">
                      <p className="font-medium">
                        {clientInfo.signatoryName || "Not provided"}
                      </p>
                      <p className="text-muted-foreground">{clientInfo.signatoryTitle}</p>
                      <p className="text-muted-foreground">{clientInfo.signatoryEmail}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-border" />

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Server className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Selected Services
                  </h3>
                  <ul className="space-y-2">
                    {selectedServices.map((selected) => {
                      const service = getServiceFromCatalog(selected.serviceId);
                      if (!service) return null;

                      return (
                        <li
                          key={selected.serviceId}
                          className="flex justify-between gap-4 rounded-lg border border-border bg-background p-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{service.name}</p>
                            <p className="pt-num text-xs text-muted-foreground">
                              {service.checkoutMode === "quote_after_review"
                                ? `${service.hubSku} · priced after review`
                                : `${service.hubSku} · catalog price`}
                            </p>
                          </div>
                          <p
                            className={cn(
                              "pt-num whitespace-nowrap font-semibold",
                              service.checkoutMode === "quote_after_review" ? "text-sm" : "pt-ink pt-tone-brand text-lg",
                            )}
                          >
                            {formatLineAmount(service)}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="border-t border-border" />

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Documents to be Signed
                  </h3>
                  <ul className="grid grid-cols-2 gap-2 md:grid-cols-3">
                    {requiredDocuments.map((doc) => (
                      <li
                        key={doc.key}
                        className="flex items-center gap-2 rounded border border-border bg-background p-2 text-sm"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate">{doc.name}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-border" />

                <div className={subPanelClass}>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {orderPricing.payableCheckout ? "Catalog total" : "Pricing"}
                      </p>
                      {orderPricing.payableCheckout ? (
                        <p className="pt-num text-3xl font-semibold">
                          ${orderPricing.oneTimeTotal.toLocaleString()}
                          <span className="text-base font-normal text-muted-foreground"> one-time</span>
                        </p>
                      ) : (
                        <p className="text-2xl font-semibold">Priced after review</p>
                      )}
                      {orderPricing.hasCustom && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          Package lines are quoted after review. They are not a payable checkout total.
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Contract Term</p>
                      <p className="pt-num font-medium">{clientInfo.contractTerm} Months</p>
                    </div>
                  </div>
                </div>

                <Callout tone="info">
                  Upon submission, our team will prepare your service agreement documents. You will
                  receive an email at{" "}
                  <span className="font-medium text-foreground">
                    {clientInfo.signatoryEmail || "your email"}
                  </span>{" "}
                  with a link to review and digitally sign the documents.
                </Callout>

                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="outline"
                    className="border-border bg-card hover:bg-accent"
                    onClick={() => setStep("details")}
                    data-testid="back-to-details"
                  >
                    Back
                  </Button>
                  <Button
                    variant="brand"
                    className="flex-1"
                    onClick={handleSubmit}
                    disabled={isSubmitting || Boolean(orderPricing.error) || selectedServices.length === 0}
                    data-testid="submit-order"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" aria-hidden="true" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send aria-hidden="true" />
                        Submit Order
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Panel>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default OrderForm;

import { useState, useMemo } from "react";
import { PortalLayout } from "./PortalLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Server, Shield, ClipboardCheck, Check, ChevronRight, FileText, Send, Calculator,
  Building2, User, Calendar, DollarSign, Info
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

const fieldClass =
  "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#D3126A]/40";
const labelClass = "text-slate-700";
const cardClass = "bg-white border-slate-200 shadow-sm";

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
    <Card className={`${cardClass} sticky top-6`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
          <Calculator className="w-4 h-4 text-[#D3126A]" />
          Order Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selectedServices.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-3">Select services to see pricing</p>
        ) : (
          <>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {selectedServices.map((selected) => {
                const service = getServiceFromCatalog(selected.serviceId);
                if (!service) return null;

                return (
                  <div key={selected.serviceId} className="flex justify-between gap-3 text-sm">
                    <span className="text-slate-600 min-w-0 truncate">
                      {service.shortName}
                      {selected.quantity > 1 && ` ×${selected.quantity}`}
                    </span>
                    <span className="text-slate-900 font-medium whitespace-nowrap">
                      {formatLineAmount(service)}
                    </span>
                  </div>
                );
              })}
            </div>

            <Separator className="bg-slate-200" />

            {orderPricing.monthlyTotal > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500 text-sm">Monthly Total</span>
                <span className="text-lg font-semibold text-slate-900">
                  ${orderPricing.monthlyTotal.toLocaleString()}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </span>
              </div>
            )}

            {orderPricing.oneTimeTotal > 0 && (
              <div className="flex justify-between items-baseline">
                <span className="text-slate-500 text-sm">One-Time</span>
                <span className="text-lg font-semibold text-slate-900">
                  ${orderPricing.oneTimeTotal.toLocaleString()}
                </span>
              </div>
            )}

            {orderPricing.hasCustom && (
              <div className="rounded-md bg-de-paper border border-[var(--de-paper-hairline)] px-3 py-2 text-sm text-[#1A1228]">
                Includes custom-quoted services — final pricing after review.
              </div>
            )}

            {orderPricing.monthlyTotal > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-slate-600">Annual Value</span>
                <span className="text-slate-500">${orderPricing.annualTotal.toLocaleString()}/yr</span>
              </div>
            )}
          </>
        )}

        {showDocs && (
          <>
            <Separator className="bg-slate-200" />
            <div>
              <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#D3126A]" />
                Required Documents ({requiredDocuments.length})
              </h4>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {requiredDocuments.map((doc) => (
                  <div key={doc.key} className="flex items-center gap-2 text-xs text-slate-500">
                    <Check className="w-3 h-3 text-[#D3126A] shrink-0" />
                    <span className="truncate">{doc.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {continueLabel && (
          <Button
            className="w-full bg-[#D3126A] hover:bg-[#e01874] text-white"
            disabled={selectedServices.length === 0}
            onClick={() => setStep("details")}
            data-testid="continue-to-details"
          >
            {continueLabel}
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <PortalLayout title="Service Order Form">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Step indicator */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          {steps.map((s, i) => {
            const active = step === s.id;
            const done = i < stepIndex;
            return (
              <div key={s.id} className="flex items-center gap-2 sm:gap-3">
                {i > 0 && <ChevronRight className="w-4 h-4 text-slate-300 hidden sm:block" />}
                <div
                  className={`flex items-center gap-2 ${
                    active ? "text-[#D3126A]" : done ? "text-slate-700" : "text-slate-600"
                  }`}
                >
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                      active
                        ? "bg-[#D3126A] text-white"
                        : done
                          ? "bg-de-paper text-[#D3126A]"
                          : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                  </div>
                  <span className="font-medium text-sm">{s.label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {step === "services" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Card className={cardClass}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                    <Server className="w-5 h-5 text-[#D3126A]" />
                    Select Your Services
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    Choose CSRA, one ProActive ecosystem package, or both. Security, Core IT, and BCDR
                    are included inside the selected package — they cannot be stacked as separate checkouts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(["assessment", "ecosystem"] as const).map((group) => {
                    const items = PORTAL_ORDER_SELECTABLE.filter((item) =>
                      group === "assessment" ? item.id === "csra-assessment" : item.id !== "csra-assessment",
                    );
                    return (
                      <div key={group} className="space-y-2">
                        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                          {group === "assessment" ? (
                            <ClipboardCheck className="w-4 h-4 text-[#D3126A]" />
                          ) : (
                            <Shield className="w-4 h-4 text-[#D3126A]" />
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
                                className={`relative px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? "border-[#D3126A] bg-de-paper ring-1 ring-[#D3126A]/20"
                                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                                }`}
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
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                      <h4 className="font-semibold text-slate-900 text-sm leading-snug">
                                        {service.name}
                                      </h4>
                                      {service.tier && (
                                        <Badge
                                          variant="outline"
                                          className="text-xs h-5 border-slate-300 text-slate-600 bg-slate-50"
                                        >
                                          {service.tier.charAt(0).toUpperCase() + service.tier.slice(1)}
                                        </Badge>
                                      )}
                                    </div>
                                    <p className="text-slate-500 text-xs mb-1.5 line-clamp-2">
                                      {service.description}
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {service.features.slice(0, 3).map((feature) => (
                                        <span
                                          key={feature}
                                          className="text-sm bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded"
                                        >
                                          {feature}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0 min-w-[6.5rem]">
                                    <div
                                      className={`font-semibold leading-tight ${
                                        service.checkoutMode === "quote_after_review"
                                          ? "text-sm text-[#1A1228]"
                                          : "text-lg text-slate-900"
                                      }`}
                                    >
                                      {price.primary}
                                    </div>
                                    {price.secondary && (
                                      <div className="text-sm text-slate-600">{price.secondary}</div>
                                    )}
                                  </div>
                                </div>
                                {isSelected && (
                                  <div className="mt-2.5 pt-2.5 border-t border-[var(--de-paper-hairline)] flex items-center gap-1.5">
                                    <Check className="w-4 h-4 text-[#D3126A]" />
                                    <span className="text-[#D3126A] font-medium text-sm">Selected</span>
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
                    <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      {orderPricing.error}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-5">
              <SummaryPanel showDocs continueLabel="Continue to Details" />
            </div>
          </div>
        )}

        {step === "details" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2 space-y-5">
              <Card className={cardClass}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                    <Building2 className="w-5 h-5 text-[#D3126A]" />
                    Company Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="legalName" className={labelClass}>
                        Legal Company Name *
                      </Label>
                      <Input
                        id="legalName"
                        value={clientInfo.legalName}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, legalName: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-legal-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="dbaName" className={labelClass}>
                        DBA / Trade Name
                      </Label>
                      <Input
                        id="dbaName"
                        value={clientInfo.dbaName}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, dbaName: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-dba-name"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="address" className={labelClass}>
                      Street Address *
                    </Label>
                    <Input
                      id="address"
                      value={clientInfo.address}
                      onChange={(e) => setClientInfo((prev) => ({ ...prev, address: e.target.value }))}
                      className={fieldClass}
                      data-testid="input-address"
                    />
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="col-span-2 md:col-span-1">
                      <Label htmlFor="city" className={labelClass}>
                        City *
                      </Label>
                      <Input
                        id="city"
                        value={clientInfo.city}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, city: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-city"
                      />
                    </div>
                    <div>
                      <Label htmlFor="state" className={labelClass}>
                        State *
                      </Label>
                      <Select
                        value={clientInfo.state}
                        onValueChange={(v) => setClientInfo((prev) => ({ ...prev, state: v }))}
                      >
                        <SelectTrigger className={fieldClass} data-testid="select-state">
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
                    </div>
                    <div>
                      <Label htmlFor="zipCode" className={labelClass}>
                        ZIP Code *
                      </Label>
                      <Input
                        id="zipCode"
                        value={clientInfo.zipCode}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, zipCode: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-zip"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="phone" className={labelClass}>
                        Phone *
                      </Label>
                      <Input
                        id="phone"
                        value={clientInfo.phone}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, phone: e.target.value }))}
                        className={fieldClass}
                        data-testid="input-phone"
                      />
                    </div>
                    <div>
                      <Label htmlFor="website" className={labelClass}>
                        Website
                      </Label>
                      <Input
                        id="website"
                        value={clientInfo.website}
                        onChange={(e) => setClientInfo((prev) => ({ ...prev, website: e.target.value }))}
                        className={fieldClass}
                        placeholder="https://"
                        data-testid="input-website"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                    <User className="w-5 h-5 text-[#D3126A]" />
                    Authorized Signatory
                  </CardTitle>
                  <CardDescription className="text-slate-500">
                    The person authorized to sign contracts on behalf of the company
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signatoryName" className={labelClass}>
                        Full Name *
                      </Label>
                      <Input
                        id="signatoryName"
                        value={clientInfo.signatoryName}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryName: e.target.value }))
                        }
                        className={fieldClass}
                        data-testid="input-signatory-name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="signatoryTitle" className={labelClass}>
                        Title *
                      </Label>
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
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="signatoryEmail" className={labelClass}>
                        Email *
                      </Label>
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
                    </div>
                    <div>
                      <Label htmlFor="signatoryPhone" className={labelClass}>
                        Phone
                      </Label>
                      <Input
                        id="signatoryPhone"
                        value={clientInfo.signatoryPhone}
                        onChange={(e) =>
                          setClientInfo((prev) => ({ ...prev, signatoryPhone: e.target.value }))
                        }
                        className={fieldClass}
                        data-testid="input-signatory-phone"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={cardClass}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-lg">
                    <Calendar className="w-5 h-5 text-[#D3126A]" />
                    Service Configuration
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="numberOfSites" className={labelClass}>
                        Number of Sites
                      </Label>
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
                    </div>
                    <div>
                      <Label htmlFor="numberOfUsers" className={labelClass}>
                        Number of Users
                      </Label>
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
                    </div>
                    <div>
                      <Label htmlFor="contractTerm" className={labelClass}>
                        Contract Term
                      </Label>
                      <Select
                        value={clientInfo.contractTerm}
                        onValueChange={(v) => setClientInfo((prev) => ({ ...prev, contractTerm: v }))}
                      >
                        <SelectTrigger className={fieldClass} data-testid="select-term">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12">12 Months</SelectItem>
                          <SelectItem value="24">24 Months</SelectItem>
                          <SelectItem value="36">36 Months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="preferredStartDate" className={labelClass}>
                      Preferred Start Date
                    </Label>
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
                  </div>

                  <div>
                    <Label htmlFor="notes" className={labelClass}>
                      Additional Notes
                    </Label>
                    <Textarea
                      id="notes"
                      value={clientInfo.notes}
                      onChange={(e) => setClientInfo((prev) => ({ ...prev, notes: e.target.value }))}
                      className={fieldClass}
                      rows={3}
                      placeholder="Any special requirements or notes..."
                      data-testid="input-notes"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="border-slate-200 text-slate-700 hover:bg-slate-50"
                  onClick={() => setStep("services")}
                  data-testid="back-to-services"
                >
                  Back to Services
                </Button>
                <Button
                  className="flex-1 bg-[#D3126A] hover:bg-[#e01874] text-white"
                  onClick={() => setStep("review")}
                  data-testid="continue-to-review"
                >
                  Review & Submit
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>

            <div>
              <Card className={`${cardClass} sticky top-6`}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-slate-900 text-base">
                    <DollarSign className="w-4 h-4 text-[#D3126A]" />
                    Pricing Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {selectedServices.map((selected) => {
                      const service = getServiceFromCatalog(selected.serviceId);
                      if (!service) return null;

                      return (
                        <div key={selected.serviceId} className="flex justify-between gap-3 text-sm">
                          <span className="text-slate-600 truncate">{service.shortName}</span>
                          <span className="text-slate-900 font-medium whitespace-nowrap">
                            {formatLineAmount(service)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <Separator className="bg-slate-200" />

                  <div className="space-y-2">
                    {orderPricing.monthlyTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">Monthly</span>
                        <span className="text-lg font-semibold text-slate-900">
                          ${orderPricing.monthlyTotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {orderPricing.oneTimeTotal > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500 text-sm">One-Time</span>
                        <span className="text-slate-900 font-medium">
                          ${orderPricing.oneTimeTotal.toLocaleString()}
                        </span>
                      </div>
                    )}
                    {orderPricing.hasCustom && (
                      <p className="text-xs text-[#1A1228] bg-de-paper border border-[var(--de-paper-hairline)] rounded-md px-2 py-1.5">
                        Custom quote items included — priced after review.
                      </p>
                    )}
                    {orderPricing.monthlyTotal === 0 &&
                      orderPricing.oneTimeTotal === 0 &&
                      orderPricing.hasCustom && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 text-sm">Pricing</span>
                          <span className="text-[#1A1228] font-semibold">Custom quote</span>
                        </div>
                      )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="space-y-5">
            <Card className={cardClass}>
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-900 text-lg">Order Review</CardTitle>
                <CardDescription className="text-slate-500">
                  Please review your order before submitting
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                      <Building2 className="w-4 h-4 text-[#D3126A]" />
                      Company
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-900 font-medium">
                        {clientInfo.legalName || "Not provided"}
                      </p>
                      {clientInfo.dbaName && (
                        <p className="text-slate-500">DBA: {clientInfo.dbaName}</p>
                      )}
                      <p className="text-slate-500">{clientInfo.address}</p>
                      <p className="text-slate-500">
                        {clientInfo.city}, {clientInfo.state} {clientInfo.zipCode}
                      </p>
                      <p className="text-slate-500">{clientInfo.phone}</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
                    <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-[#D3126A]" />
                      Authorized Signatory
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p className="text-slate-900 font-medium">
                        {clientInfo.signatoryName || "Not provided"}
                      </p>
                      <p className="text-slate-500">{clientInfo.signatoryTitle}</p>
                      <p className="text-slate-500">{clientInfo.signatoryEmail}</p>
                    </div>
                  </div>
                </div>

                <Separator className="bg-slate-200" />

                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                    <Server className="w-4 h-4 text-[#D3126A]" />
                    Selected Services
                  </h4>
                  <div className="space-y-2">
                    {selectedServices.map((selected) => {
                      const service = getServiceFromCatalog(selected.serviceId);
                      if (!service) return null;

                      return (
                        <div
                          key={selected.serviceId}
                          className="flex justify-between gap-4 p-3 bg-slate-50 border border-slate-200 rounded-lg"
                        >
                          <div className="min-w-0">
                            <p className="text-slate-900 font-medium text-sm">{service.name}</p>
                            <p className="text-slate-500 text-xs">
                              {service.checkoutMode === "quote_after_review"
                                ? `${service.hubSku} · priced after review`
                                : `${service.hubSku} · catalog price`}
                            </p>
                          </div>
                          <p
                            className={`font-semibold whitespace-nowrap ${
                              service.checkoutMode === "quote_after_review"
                                ? "text-[#1A1228] text-sm"
                                : "text-[#D3126A] text-lg"
                            }`}
                          >
                            {formatLineAmount(service)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Separator className="bg-slate-200" />

                <div>
                  <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm">
                    <FileText className="w-4 h-4 text-[#D3126A]" />
                    Documents to be Signed
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {requiredDocuments.map((doc) => (
                      <div
                        key={doc.key}
                        className="flex items-center gap-2 text-sm text-slate-700 p-2 bg-slate-50 border border-slate-200 rounded"
                      >
                        <FileText className="w-4 h-4 text-[#D3126A] shrink-0" />
                        <span className="truncate">{doc.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator className="bg-slate-200" />

                <div className="bg-de-paper border border-[var(--de-paper-hairline)] rounded-lg p-4">
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div>
                      <p className="text-slate-500 text-sm">
                        {orderPricing.payableCheckout ? "Catalog total" : "Pricing"}
                      </p>
                      {orderPricing.payableCheckout ? (
                        <p className="text-3xl font-bold text-slate-900">
                          ${orderPricing.oneTimeTotal.toLocaleString()}
                          <span className="text-base font-normal text-slate-500"> one-time</span>
                        </p>
                      ) : (
                        <p className="text-2xl font-bold text-[#1A1228]">Priced after review</p>
                      )}
                      {orderPricing.hasCustom && (
                        <p className="text-[#1A1228] text-sm mt-1">
                          Package lines are quoted after review. They are not a payable checkout total.
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-slate-500 text-sm">Contract Term</p>
                      <p className="text-slate-900 font-medium">{clientInfo.contractTerm} Months</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <Info className="w-5 h-5 text-[#D3126A] flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-slate-500">
                    Upon submission, our team will prepare your service agreement documents. You will
                    receive an email at{" "}
                    <span className="text-slate-800 font-medium">
                      {clientInfo.signatoryEmail || "your email"}
                    </span>{" "}
                    with a link to review and digitally sign the documents.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                    onClick={() => setStep("details")}
                    data-testid="back-to-details"
                  >
                    Back
                  </Button>
                  <Button
                    className="flex-1 bg-[#D3126A] hover:bg-[#e01874] text-white"
                    onClick={handleSubmit}
                    disabled={isSubmitting || Boolean(orderPricing.error) || selectedServices.length === 0}
                    data-testid="submit-order"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Submit Order
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}

export default OrderForm;

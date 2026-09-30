import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { Building2, Users, Phone, Globe, MapPin, Mail, Calendar, RefreshCcw, ExternalLink } from "lucide-react";
import { portalGet } from "@/lib/portalApi";

interface CRMContact {
  id: string;
  Full_Name: string;
  First_Name: string;
  Last_Name: string;
  Email: string;
  Phone: string;
  Mobile: string;
  Title: string;
  Department: string;
  zohoLink?: string;
}

interface CRMAccount {
  id: string;
  Account_Name: string;
  Phone: string;
  Website: string;
  Industry: string;
  Billing_Street: string;
  Billing_City: string;
  Billing_State: string;
  Billing_Code: string;
  Description: string;
  Created_Time: string;
  zohoLink?: string;
}

interface CompanyData {
  account: CRMAccount | null;
  contacts: CRMContact[];
  zohoConnected: boolean;
}

export default function PortalCompany() {
  const { data, isLoading, error, refetch } = useQuery<CompanyData>({
    queryKey: ["/api/portal/company"],
    queryFn: () => portalGet<CompanyData>("/api/portal/company"),
    retry: 1,
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getAddress = (account: CRMAccount) => {
    const parts = [
      account.Billing_Street,
      account.Billing_City,
      account.Billing_State,
      account.Billing_Code,
    ].filter(Boolean);
    return parts.length > 0 ? parts.join(", ") : "Not provided";
  };

  return (
    <PortalLayout title="Company Profile">
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center justify-between">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load company data. Please try again.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-retry-company">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </div>
        )}

        {!data?.zohoConnected && !isLoading && (
          <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              CRM integration is being configured. Company data may be limited.
            </p>
          </div>
        )}

        {/* Company Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-[#D3126A]" />
                  Company Information
                </CardTitle>
                <CardDescription>Your organization details from our CRM</CardDescription>
              </div>
              {data?.account?.zohoLink && (
                <a href={data.account.zohoLink} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="border-[#D3126A]/30 text-[#1A1228] dark:text-de-magenta-ink" data-testid="button-edit-in-zoho">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Edit in Zoho
                  </Button>
                </a>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <div className="h-8 w-64 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
                <div className="h-4 w-56 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
              </div>
            ) : data?.account ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {data.account.Account_Name}
                  </h3>
                  {data.account.Industry && (
                    <Badge className="mt-2 bg-de-paper text-[#1A1228] dark:bg-[#D3126A]/10 dark:text-de-magenta-ink">
                      {data.account.Industry}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {data.account.Phone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Phone</p>
                        <p className="font-medium text-gray-900 dark:text-white">{data.account.Phone}</p>
                      </div>
                    </div>
                  )}

                  {data.account.Website && (
                    <div className="flex items-start gap-3">
                      <Globe className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Website</p>
                        <a
                          href={data.account.Website.startsWith("http") ? data.account.Website : `https://${data.account.Website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-[#D3126A] dark:text-de-magenta-ink hover:underline flex items-center gap-1"
                          data-testid="link-company-website"
                        >
                          {data.account.Website}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {getAddress(data.account)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Customer Since</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formatDate(data.account.Created_Time)}
                      </p>
                    </div>
                  </div>
                </div>

                {data.account.Description && (
                  <div className="pt-4 border-t dark:border-slate-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Description</p>
                    <p className="text-gray-700 dark:text-gray-300">{data.account.Description}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No company information found</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Contact support to link your account</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#D3126A]" />
              Team Members
            </CardTitle>
            <CardDescription>People at your organization with portal access</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-slate-800 rounded animate-pulse" />
                ))}
              </div>
            ) : data?.contacts && data.contacts.length > 0 ? (
              <div className="divide-y dark:divide-slate-700">
                {data.contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between py-4 first:pt-0 last:pb-0"
                    data-testid={`contact-row-${contact.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-de-paper dark:bg-[#D3126A]/10 flex items-center justify-center">
                        <span className="text-sm font-semibold text-[#1A1228] dark:text-de-magenta-ink">
                          {contact.First_Name?.[0]}{contact.Last_Name?.[0]}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {contact.Full_Name || `${contact.First_Name} ${contact.Last_Name}`}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {contact.Title || contact.Department || "Team Member"}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      {contact.Email && (
                        <a
                          href={`mailto:${contact.Email}`}
                          className="flex items-center gap-1 hover:text-[#D3126A] dark:hover:text-de-magenta-ink"
                          data-testid={`link-email-${contact.id}`}
                        >
                          <Mail className="h-4 w-4" />
                          <span className="hidden md:inline">{contact.Email}</span>
                        </a>
                      )}
                      {(contact.Phone || contact.Mobile) && (
                        <a
                          href={`tel:${contact.Phone || contact.Mobile}`}
                          className="flex items-center gap-1 hover:text-[#D3126A] dark:hover:text-de-magenta-ink"
                          data-testid={`link-phone-${contact.id}`}
                        >
                          <Phone className="h-4 w-4" />
                          <span className="hidden md:inline">{contact.Phone || contact.Mobile}</span>
                        </a>
                      )}
                      {contact.zohoLink && (
                        <a
                          href={contact.zohoLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-[#D3126A] dark:hover:text-de-magenta-ink"
                          title="View in Zoho"
                          data-testid={`link-zoho-${contact.id}`}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No team members found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

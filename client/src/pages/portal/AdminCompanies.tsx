import { useState, type ReactNode } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Building2, ShieldCheck, Users, Plus, Eye, Loader, Search, ArrowRight, Building, FileText, Upload, Trash2, BarChart3, Ticket, Activity } from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { PortalLayout } from "./PortalLayout";
import { ACCOUNT_MANAGERS, DEFAULT_ACCOUNT_MANAGER_ID, resolveAccountManager } from "@shared/accountManagers";
import { DataTable, EmptyState, Field, GenericStatus, Panel, StatTile, Token, type DataColumn } from "@/components/portal/ui";

interface Company {
  id: string;
  companyName: string;
  contactEmail: string;
  status: string;
  /** prospect | managed | comanaged */
  serviceType?: string;
  /** shared/accountManagers.ts profile id (server resolves unassigned to the default). */
  accountManager?: string;
  userCount: number;
  createdAt: string;
}

interface CompanyDetail {
  company: {
    id: string;
    companyName: string;
    contactEmail: string;
    contactPhone?: string;
    industry?: string;
    primaryContact?: string;
    accountManager?: string | null;
    status: string;
  };
  users: Array<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    isActive: boolean;
  }>;
}

interface TenantFile {
  id: string;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  fileUrl: string;
  createdAt: string;
}

interface CompanyMetrics {
  company: { id: string; name: string; status: string; createdAt: string };
  tickets: { total: number; open: number; inProgress: number; resolved: number; avgResolutionHours: number | null };
  users: { total: number; activeUsers: number; admins: number };
  files: { total: number; agents: number; documents: number };
  /** null = no authoritative source is connected for this figure (never a placeholder). */
  services: { activeServices: number | null; monthlyValue: string | null; tier: string | null };
  billing: { pendingInvoices: number | null; totalOwed: string | null; lastPayment: string | null };
  activity: { lastLogin: string | null; ticketsThisMonth: number; filesUploadedThisMonth: number };
}

const NOT_CONNECTED = "Not connected";

const fieldClass = "border-border bg-background";

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

export function AdminCompanies() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState("overview");
  const [newFile, setNewFile] = useState({ fileName: "", category: "documents", description: "" });
  const { uploadFile, isUploading, progress } = useUpload({
    onSuccess: (response) => {
      if (selectedCompanyId) {
        uploadFileMutation.mutate({
          companyId: selectedCompanyId,
          fileName: newFile.fileName || "Uploaded File",
          category: newFile.category,
          description: newFile.description,
          objectPath: response.objectPath,
        });
      }
    },
    onError: (error) => {
      toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
    },
  });
  const [newCompany, setNewCompany] = useState({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    industry: "",
    primaryContact: "",
    accountManager: DEFAULT_ACCOUNT_MANAGER_ID,
  });

  const { data: companiesData, isLoading } = useQuery<{ companies: Company[] }>({
    queryKey: ["/api/portal/admin/companies"],
    queryFn: () => portalGet<{ companies: Company[] }>("/api/portal/admin/companies"),
  });

  const { data: companyDetail, isLoading: detailLoading } = useQuery<CompanyDetail>({
    queryKey: ["/api/portal/admin/companies", selectedCompanyId],
    queryFn: () => portalGet<CompanyDetail>(`/api/portal/admin/companies/${selectedCompanyId}`),
    enabled: !!selectedCompanyId,
  });

  const { data: companyFiles, isLoading: filesLoading } = useQuery<{ files: TenantFile[] }>({
    queryKey: ["/api/portal/admin/companies", selectedCompanyId, "files"],
    queryFn: () => portalGet<{ files: TenantFile[] }>(`/api/portal/admin/companies/${selectedCompanyId}/files`),
    enabled: !!selectedCompanyId && detailTab === "files",
  });

  const { data: companyMetrics, isLoading: metricsLoading } = useQuery<CompanyMetrics>({
    queryKey: ["/api/portal/admin/companies", selectedCompanyId, "metrics"],
    queryFn: () => portalGet<CompanyMetrics>(`/api/portal/admin/companies/${selectedCompanyId}/metrics`),
    enabled: !!selectedCompanyId && detailTab === "metrics",
  });

  const uploadFileMutation = useMutation({
    mutationFn: async (data: { companyId: string; fileName: string; category: string; description: string; objectPath: string }) => {
      return await apiRequest(`/api/portal/admin/companies/${data.companyId}/files`, "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies", selectedCompanyId, "files"] });
      setNewFile({ fileName: "", category: "documents", description: "" });
      toast({ title: "Success", description: "File uploaded successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save file", variant: "destructive" });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest(`/api/portal/admin/companies/${selectedCompanyId}/files/${fileId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies", selectedCompanyId, "files"] });
      toast({ title: "Success", description: "File deleted successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to delete file", variant: "destructive" });
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (data: typeof newCompany) => {
      return await apiRequest("/api/portal/admin/companies", "POST", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies"] });
      setShowAddDialog(false);
      setNewCompany({ companyName: "", contactEmail: "", contactPhone: "", industry: "", primaryContact: "", accountManager: DEFAULT_ACCOUNT_MANAGER_ID });
      toast({ title: "Success", description: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create company", variant: "destructive" });
    },
  });

  const assignManagerMutation = useMutation({
    mutationFn: async ({ companyId, accountManager }: { companyId: string; accountManager: string }) => {
      return await apiRequest(`/api/portal/admin/companies/${companyId}`, "PUT", { accountManager });
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/portal/admin/companies"] });
      toast({ title: "Account manager assigned", description: resolveAccountManager(vars.accountManager).name });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to assign account manager", variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (companyId: string) => {
      // apiRequest resolves to the Response; the token and company are in its body.
      const response = await apiRequest("/api/portal/admin/impersonate", "POST", { companyId });
      return response.json();
    },
    onSuccess: (data: any) => {
      localStorage.setItem("portalToken", data.token);
      localStorage.setItem("impersonatingCompany", JSON.stringify(data.company));
      toast({ title: "Impersonation Active", description: `Now viewing as ${data.company.companyName}` });
      window.location.href = "/portal/dashboard";
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to impersonate", variant: "destructive" });
    },
  });

  const companies = companiesData?.companies || [];
  const filteredCompanies = companies.filter(c =>
    c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.contactEmail.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateCompany = () => {
    if (!newCompany.companyName || !newCompany.contactEmail) {
      toast({ title: "Error", description: "Company name and email are required", variant: "destructive" });
      return;
    }
    createCompanyMutation.mutate(newCompany);
  };

  const closeDetail = () => {
    setSelectedCompanyId(null);
    setDetailTab("overview");
  };

  const companyColumns: DataColumn<Company>[] = [
    {
      key: "company",
      header: "Company",
      primary: true,
      cell: (company) => (
        <div className="flex min-w-0 items-center gap-3">
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0">
            <p className="truncate font-medium">{company.companyName}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{company.contactEmail}</p>
          </div>
        </div>
      ),
    },
    { key: "status", header: "Status", primary: true, className: "w-32", cell: (company) => <GenericStatus status={company.status} /> },
    {
      key: "accountManager",
      header: "Account manager",
      primary: true,
      className: "w-56",
      cell: (company) => (
        <div className="min-w-0">
          <label className="sr-only" htmlFor={`am-${company.id}`}>Account manager for {company.companyName}</label>
          <select
            id={`am-${company.id}`}
            value={company.accountManager || DEFAULT_ACCOUNT_MANAGER_ID}
            onChange={(e) => assignManagerMutation.mutate({ companyId: company.id, accountManager: e.target.value })}
            disabled={assignManagerMutation.isPending}
            className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid={`select-account-manager-${company.id}`}
          >
            {ACCOUNT_MANAGERS.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs capitalize text-muted-foreground">{company.serviceType || "prospect"}</p>
        </div>
      ),
    },
    {
      key: "users",
      header: "Users",
      primary: true,
      className: "w-28 whitespace-nowrap",
      cell: (company) => (
        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="pt-num">{company.userCount}</span> user{company.userCount !== 1 ? "s" : ""}
        </span>
      ),
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-80",
      cell: (company) => (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-card hover:bg-accent"
            onClick={() => setSelectedCompanyId(company.id)}
            data-testid={`button-view-${company.id}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            Details
          </Button>
          <Button asChild variant="outline" size="sm" className="border-border bg-card hover:bg-accent">
            <Link href={`/portal/admin/clients/${encodeURIComponent(company.id)}`} data-testid={`button-administer-${company.id}`}>
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Administer
            </Link>
          </Button>
          <Button
            size="sm"
            variant="brand"
            onClick={() => impersonateMutation.mutate(company.id)}
            disabled={impersonateMutation.isPending}
            data-testid={`button-impersonate-${company.id}`}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            View Portal
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PortalLayout
      title="Manage Companies"
      description="View and manage every client company in the portal, and open any of them as that company."
      titleTestId="text-page-title"
      width="wide"
      actions={
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button variant="brand" data-testid="button-add-company">
              <Plus aria-hidden="true" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <Field label="Company Name" htmlFor="companyName" required>
                <Input
                  id="companyName"
                  value={newCompany.companyName}
                  onChange={(e) => setNewCompany({ ...newCompany, companyName: e.target.value })}
                  placeholder="Acme Corporation"
                  className={fieldClass}
                  data-testid="input-company-name"
                />
              </Field>
              <Field label="Contact Email" htmlFor="contactEmail" required>
                <Input
                  id="contactEmail"
                  type="email"
                  value={newCompany.contactEmail}
                  onChange={(e) => setNewCompany({ ...newCompany, contactEmail: e.target.value })}
                  placeholder="contact@company.com"
                  className={fieldClass}
                  data-testid="input-contact-email"
                />
              </Field>
              <Field label="Phone" htmlFor="contactPhone">
                <Input
                  id="contactPhone"
                  value={newCompany.contactPhone}
                  onChange={(e) => setNewCompany({ ...newCompany, contactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                  className={fieldClass}
                  data-testid="input-contact-phone"
                />
              </Field>
              <Field label="Industry" htmlFor="industry">
                <Input
                  id="industry"
                  value={newCompany.industry}
                  onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                  placeholder="Healthcare, Finance, etc."
                  className={fieldClass}
                  data-testid="input-industry"
                />
              </Field>
              <Field label="Primary Contact" htmlFor="primaryContact">
                <Input
                  id="primaryContact"
                  value={newCompany.primaryContact}
                  onChange={(e) => setNewCompany({ ...newCompany, primaryContact: e.target.value })}
                  placeholder="John Smith"
                  className={fieldClass}
                  data-testid="input-primary-contact"
                />
              </Field>
              <Field label="Account Manager" htmlFor="accountManager">
                <select
                  id="accountManager"
                  value={newCompany.accountManager}
                  onChange={(e) => setNewCompany({ ...newCompany, accountManager: e.target.value })}
                  className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid="select-new-account-manager"
                >
                  {ACCOUNT_MANAGERS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name} — {m.title}</option>
                  ))}
                </select>
              </Field>
              <Button
                variant="brand"
                onClick={handleCreateCompany}
                className="w-full"
                disabled={createCompanyMutation.isPending}
                data-testid="button-submit-company"
              >
                {createCompanyMutation.isPending ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Creating...
                  </>
                ) : (
                  "Create Company"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
    <div className="space-y-4">
      <div className="relative lg:w-96">
        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          type="search"
          placeholder="Search companies..."
          aria-label="Search companies"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 border-border bg-card pl-9"
          data-testid="input-search-companies"
        />
      </div>

      <Panel
        id="companies-list"
        title="Companies"
        description={isLoading ? "Loading…" : `${filteredCompanies.length} compan${filteredCompanies.length === 1 ? "y" : "ies"}`}
        flush
      >
        <DataTable<Company>
          columns={companyColumns}
          rows={filteredCompanies}
          rowKey={(c) => c.id}
          rowTestId={(c) => `card-company-${c.id}`}
          loading={isLoading}
          caption="Client companies"
          empty={
            <EmptyState
              icon={Building}
              title="No companies found"
              description={searchQuery ? "Try a different search term" : "Add your first company to get started"}
              action={
                searchQuery ? (
                  <Button variant="outline" size="sm" className="border-border bg-card hover:bg-accent" onClick={() => setSearchQuery("")}>
                    Clear search
                  </Button>
                ) : (
                  <Button variant="brand" size="sm" onClick={() => setShowAddDialog(true)}>
                    Add a company
                  </Button>
                )
              }
            />
          }
        />
      </Panel>

      <Dialog open={!!selectedCompanyId} onOpenChange={closeDetail}>
        <DialogContent className="max-h-[80vh] overflow-y-auto border-border bg-card sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              {companyDetail?.company.companyName || "Company Details"}
            </DialogTitle>
          </DialogHeader>

          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Users className="mr-2 h-4 w-4" aria-hidden="true" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">
                <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                Files
              </TabsTrigger>
              <TabsTrigger value="metrics" data-testid="tab-metrics">
                <BarChart3 className="mr-2 h-4 w-4" aria-hidden="true" />
                Metrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              {detailLoading ? (
                <div className="space-y-3" aria-busy="true" aria-live="polite">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-24" />
                </div>
              ) : companyDetail ? (
                <div className="space-y-4">
                  <dl className="grid gap-4 sm:grid-cols-2">
                    {[
                      ["Contact Email", companyDetail.company.contactEmail],
                      ["Phone", companyDetail.company.contactPhone || "—"],
                      ["Industry", companyDetail.company.industry || "—"],
                      ["Primary Contact", companyDetail.company.primaryContact || "—"],
                      ["Account Manager", resolveAccountManager(companyDetail.company.accountManager).name],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 text-sm">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  <Panel
                    id="company-users"
                    title={
                      <span className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        Users ({companyDetail.users.length})
                      </span>
                    }
                    flush
                  >
                    <div className="max-h-48 overflow-y-auto">
                      {companyDetail.users.length === 0 ? (
                        <EmptyState compact icon={Users} title="No users yet" />
                      ) : (
                        <ul className="divide-y divide-border">
                          {companyDetail.users.map((user) => (
                            <li
                              key={user.id}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                              data-testid={`user-row-${user.id}`}
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium">{user.fullName}</p>
                                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <Token label={user.role} tone="neutral" />
                                <Token label={user.isActive ? "Active" : "Inactive"} tone={user.isActive ? "ok" : "neutral"} dot />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Panel>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <div className="space-y-4">
                <Panel
                  id="company-upload"
                  title={
                    <span className="inline-flex items-center gap-2">
                      <Upload className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Upload New File
                    </span>
                  }
                >
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="File Name" htmlFor="fileName">
                        <Input
                          id="fileName"
                          value={newFile.fileName}
                          onChange={(e) => setNewFile({ ...newFile, fileName: e.target.value })}
                          placeholder="JumpCloud Agent.msi"
                          className={fieldClass}
                          data-testid="input-file-name"
                        />
                      </Field>
                      <Field label="Category" htmlFor="category">
                        <select
                          id="category"
                          value={newFile.category}
                          onChange={(e) => setNewFile({ ...newFile, category: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          data-testid="select-category"
                        >
                          <option value="documents">Documents</option>
                          <option value="agents">Agents/Software</option>
                          <option value="configs">Configurations</option>
                          <option value="other">Other</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Description" htmlFor="description">
                      <Input
                        id="description"
                        value={newFile.description}
                        onChange={(e) => setNewFile({ ...newFile, description: e.target.value })}
                        placeholder="Custom agent for secure access"
                        className={fieldClass}
                        data-testid="input-file-description"
                      />
                    </Field>
                    <div>
                      <input
                        type="file"
                        id="fileUpload"
                        className="hidden"
                        aria-label="Choose a file to upload"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (!newFile.fileName) setNewFile(prev => ({ ...prev, fileName: file.name }));
                            uploadFile(file);
                          }
                        }}
                        data-testid="input-file-upload"
                      />
                      <Button
                        variant="brand"
                        onClick={() => document.getElementById('fileUpload')?.click()}
                        disabled={isUploading || uploadFileMutation.isPending}
                        className="w-full"
                        data-testid="button-upload-file"
                      >
                        {isUploading || uploadFileMutation.isPending ? (
                          <>
                            <Loader className="h-4 w-4 animate-spin" aria-hidden="true" />
                            {isUploading ? `Uploading... ${progress}%` : "Saving..."}
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4" aria-hidden="true" />
                            Choose & Upload File
                          </>
                        )}
                      </Button>
                      {isUploading && (
                        <Progress value={progress} className="mt-2" aria-label="Upload progress" />
                      )}
                    </div>
                  </div>
                </Panel>

                <Panel
                  id="company-files"
                  title={
                    <span className="inline-flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Tenant Files
                    </span>
                  }
                  flush
                >
                  {filesLoading ? (
                    <div className="space-y-3 p-4" aria-busy="true" aria-live="polite">
                      <Skeleton className="h-10" />
                      <Skeleton className="h-10" />
                    </div>
                  ) : !companyFiles?.files || companyFiles.files.length === 0 ? (
                    <EmptyState compact icon={FileText} title="No files uploaded yet" description="Files uploaded above appear here for this tenant." />
                  ) : (
                    <ul className="divide-y divide-border">
                      {companyFiles.files.map((file) => (
                        <li
                          key={file.id}
                          className="flex items-center justify-between gap-3 px-4 py-3"
                          data-testid={`file-row-${file.id}`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{file.fileName}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {file.category} · {file.description || "No description"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="pt-ink pt-tone-bad shrink-0"
                            aria-label={`Delete ${file.fileName}`}
                            onClick={() => deleteFileMutation.mutate(file.id)}
                            disabled={deleteFileMutation.isPending}
                            data-testid={`button-delete-file-${file.id}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              {metricsLoading ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-busy="true" aria-live="polite">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : companyMetrics ? (
                <div className="space-y-4">
                  <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Company figures">
                    <StatTile label="Open Tickets" value={companyMetrics.tickets.open} tone={companyMetrics.tickets.open > 0 ? "warn" : "neutral"} />
                    <StatTile label="Active Users" value={companyMetrics.users.activeUsers} tone="info" />
                    <StatTile label="Monthly Value" value={companyMetrics.services.monthlyValue ?? NOT_CONNECTED} tone="neutral" />
                    <StatTile label="Files" value={companyMetrics.files.total} />
                  </section>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Panel
                      id="metrics-tickets"
                      title={
                        <span className="inline-flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          Ticket Summary
                        </span>
                      }
                    >
                      <dl className="space-y-2">
                        <DetailRow label="Total Tickets" value={<span className="pt-num">{companyMetrics.tickets.total}</span>} />
                        <DetailRow label="In Progress" value={<span className="pt-num">{companyMetrics.tickets.inProgress}</span>} />
                        <DetailRow label="Resolved" value={<span className="pt-num pt-ink pt-tone-ok">{companyMetrics.tickets.resolved}</span>} />
                        <DetailRow label="Avg. Resolution" value={companyMetrics.tickets.avgResolutionHours == null ? "No resolved tickets" : `${companyMetrics.tickets.avgResolutionHours} hours`} />
                      </dl>
                    </Panel>

                    <Panel
                      id="metrics-activity"
                      title={
                        <span className="inline-flex items-center gap-2">
                          <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                          Recent Activity
                        </span>
                      }
                    >
                      <dl className="space-y-2">
                        <DetailRow label="Service Tier" value={companyMetrics.services.tier ? <Token label={companyMetrics.services.tier} tone="brand" /> : NOT_CONNECTED} />
                        <DetailRow label="Active Services" value={companyMetrics.services.activeServices == null ? NOT_CONNECTED : <span className="pt-num">{companyMetrics.services.activeServices}</span>} />
                        <DetailRow label="Tickets This Month" value={<span className="pt-num">{companyMetrics.activity.ticketsThisMonth}</span>} />
                        <DetailRow label="Pending Invoices" value={companyMetrics.billing.pendingInvoices == null ? NOT_CONNECTED : <span className="pt-num pt-ink pt-tone-bad">{companyMetrics.billing.pendingInvoices}</span>} />
                      </dl>
                    </Panel>
                  </div>
                </div>
              ) : (
                <EmptyState compact icon={BarChart3} title="No metrics available" />
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="brand"
              className="flex-1"
              onClick={() => {
                setSelectedCompanyId(null);
                setDetailTab("overview");
                if (companyDetail) impersonateMutation.mutate(companyDetail.company.id);
              }}
              disabled={impersonateMutation.isPending}
              data-testid="button-view-portal-detail"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
              View Company Portal
            </Button>
            <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={closeDetail} data-testid="button-close-detail">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PortalLayout>
  );
}

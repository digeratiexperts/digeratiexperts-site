import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Building2, Users, Plus, Eye, Loader, Search, ArrowRight, Building, FileText, Upload, Trash2, BarChart3, Ticket, DollarSign, Activity, Clock } from "lucide-react";
import { portalGet } from "@/lib/portalApi";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { PortalLayout } from "./PortalLayout";

interface Company {
  id: string;
  companyName: string;
  contactEmail: string;
  status: string;
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
  tickets: { total: number; open: number; inProgress: number; resolved: number; avgResolutionTime: string };
  users: { total: number; activeUsers: number; admins: number };
  files: { total: number; agents: number; documents: number };
  services: { activeServices: number; monthlyValue: string; tier: string };
  billing: { pendingInvoices: number; totalOwed: string; lastPayment: string };
  activity: { lastLogin: string; ticketsThisMonth: number; filesUploadedThisMonth: number };
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
      setNewCompany({ companyName: "", contactEmail: "", contactPhone: "", industry: "", primaryContact: "" });
      toast({ title: "Success", description: "Company created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to create company", variant: "destructive" });
    },
  });

  const impersonateMutation = useMutation({
    mutationFn: async (companyId: string) => {
      return await apiRequest("/api/portal/admin/impersonate", "POST", { companyId });
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

  return (
    <PortalLayout title="Manage Companies">
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white" data-testid="text-page-title">Manage Companies</h2>
          <p className="text-slate-600 dark:text-slate-400">View and manage all client companies in the portal</p>
        </div>
        
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-company">
              <Plus className="w-4 h-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Company</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={newCompany.companyName}
                  onChange={(e) => setNewCompany({ ...newCompany, companyName: e.target.value })}
                  placeholder="Acme Corporation"
                  data-testid="input-company-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={newCompany.contactEmail}
                  onChange={(e) => setNewCompany({ ...newCompany, contactEmail: e.target.value })}
                  placeholder="contact@company.com"
                  data-testid="input-contact-email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Phone</Label>
                <Input
                  id="contactPhone"
                  value={newCompany.contactPhone}
                  onChange={(e) => setNewCompany({ ...newCompany, contactPhone: e.target.value })}
                  placeholder="(555) 123-4567"
                  data-testid="input-contact-phone"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="industry">Industry</Label>
                <Input
                  id="industry"
                  value={newCompany.industry}
                  onChange={(e) => setNewCompany({ ...newCompany, industry: e.target.value })}
                  placeholder="Healthcare, Finance, etc."
                  data-testid="input-industry"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="primaryContact">Primary Contact</Label>
                <Input
                  id="primaryContact"
                  value={newCompany.primaryContact}
                  onChange={(e) => setNewCompany({ ...newCompany, primaryContact: e.target.value })}
                  placeholder="John Smith"
                  data-testid="input-primary-contact"
                />
              </div>
              <Button 
                onClick={handleCreateCompany} 
                className="w-full"
                disabled={createCompanyMutation.isPending}
                data-testid="button-submit-company"
              >
                {createCompanyMutation.isPending ? (
                  <>
                    <Loader className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Company"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search companies..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="input-search-companies"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompanies.map((company) => (
            <Card key={company.id} className="hover:shadow-lg transition-shadow" data-testid={`card-company-${company.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{company.companyName}</CardTitle>
                      <p className="text-sm text-slate-500 dark:text-slate-400">{company.contactEmail}</p>
                    </div>
                  </div>
                  <Badge 
                    variant={company.status === "active" ? "default" : "secondary"}
                    className={company.status === "active" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
                  >
                    {company.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <Users className="w-4 h-4" />
                  <span>{company.userCount} user{company.userCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    onClick={() => setSelectedCompanyId(company.id)}
                    data-testid={`button-view-${company.id}`}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Details
                  </Button>
                  <Button 
                    size="sm" 
                    className="flex-1"
                    onClick={() => impersonateMutation.mutate(company.id)}
                    disabled={impersonateMutation.isPending}
                    data-testid={`button-impersonate-${company.id}`}
                  >
                    <ArrowRight className="w-4 h-4 mr-1" />
                    View Portal
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {filteredCompanies.length === 0 && (
            <div className="col-span-full text-center py-12">
              <Building className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">No companies found</h3>
              <p className="text-slate-500 dark:text-slate-500">
                {searchQuery ? "Try a different search term" : "Add your first company to get started"}
              </p>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!selectedCompanyId} onOpenChange={() => { setSelectedCompanyId(null); setDetailTab("overview"); }}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {companyDetail?.company.companyName || "Company Details"}
            </DialogTitle>
          </DialogHeader>
          
          <Tabs value={detailTab} onValueChange={setDetailTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">
                <Users className="w-4 h-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">
                <FileText className="w-4 h-4 mr-2" />
                Files
              </TabsTrigger>
              <TabsTrigger value="metrics" data-testid="tab-metrics">
                <BarChart3 className="w-4 h-4 mr-2" />
                Metrics
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              {detailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : companyDetail ? (
                <div className="space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Contact Email</p>
                      <p className="text-slate-900 dark:text-white">{companyDetail.company.contactEmail}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Phone</p>
                      <p className="text-slate-900 dark:text-white">{companyDetail.company.contactPhone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Industry</p>
                      <p className="text-slate-900 dark:text-white">{companyDetail.company.industry || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Primary Contact</p>
                      <p className="text-slate-900 dark:text-white">{companyDetail.company.primaryContact || "—"}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Users ({companyDetail.users.length})
                    </h4>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {companyDetail.users.map((user) => (
                        <div 
                          key={user.id} 
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                          data-testid={`user-row-${user.id}`}
                        >
                          <div>
                            <p className="font-medium text-slate-900 dark:text-white">{user.fullName}</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{user.email}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{user.role}</Badge>
                            <Badge variant={user.isActive ? "default" : "secondary"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                      {companyDetail.users.length === 0 && (
                        <p className="text-center py-4 text-slate-500 dark:text-slate-400">No users yet</p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload New File
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="fileName">File Name</Label>
                        <Input
                          id="fileName"
                          value={newFile.fileName}
                          onChange={(e) => setNewFile({ ...newFile, fileName: e.target.value })}
                          placeholder="JumpCloud Agent.msi"
                          data-testid="input-file-name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="category">Category</Label>
                        <select
                          id="category"
                          value={newFile.category}
                          onChange={(e) => setNewFile({ ...newFile, category: e.target.value })}
                          className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                          data-testid="select-category"
                        >
                          <option value="documents">Documents</option>
                          <option value="agents">Agents/Software</option>
                          <option value="configs">Configurations</option>
                          <option value="other">Other</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Input
                        id="description"
                        value={newFile.description}
                        onChange={(e) => setNewFile({ ...newFile, description: e.target.value })}
                        placeholder="Custom agent for secure access"
                        data-testid="input-file-description"
                      />
                    </div>
                    <div>
                      <input
                        type="file"
                        id="fileUpload"
                        className="hidden"
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
                        onClick={() => document.getElementById('fileUpload')?.click()}
                        disabled={isUploading || uploadFileMutation.isPending}
                        className="w-full"
                        data-testid="button-upload-file"
                      >
                        {isUploading || uploadFileMutation.isPending ? (
                          <>
                            <Loader className="w-4 h-4 mr-2 animate-spin" />
                            {isUploading ? `Uploading... ${progress}%` : "Saving..."}
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Choose & Upload File
                          </>
                        )}
                      </Button>
                      {isUploading && (
                        <Progress value={progress} className="mt-2" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Tenant Files
                  </h4>
                  {filesLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader className="w-6 h-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(companyFiles?.files || []).map((file) => (
                        <div 
                          key={file.id}
                          className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800"
                          data-testid={`file-row-${file.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-primary" />
                            <div>
                              <p className="font-medium text-slate-900 dark:text-white">{file.fileName}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                {file.category} • {file.description || "No description"}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteFileMutation.mutate(file.id)}
                            disabled={deleteFileMutation.isPending}
                            data-testid={`button-delete-file-${file.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      ))}
                      {(!companyFiles?.files || companyFiles.files.length === 0) && (
                        <p className="text-center py-8 text-slate-500 dark:text-slate-400">No files uploaded yet</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="mt-4">
              {metricsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-primary" />
                </div>
              ) : companyMetrics ? (
                <div className="space-y-4">
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <Ticket className="w-4 h-4 text-orange-500" />
                          <span className="text-sm text-slate-500">Open Tickets</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{companyMetrics.tickets.open}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-500">Active Users</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{companyMetrics.users.activeUsers}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-slate-500">Monthly Value</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{companyMetrics.services.monthlyValue}</p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4 text-purple-500" />
                          <span className="text-sm text-slate-500">Files</span>
                        </div>
                        <p className="text-2xl font-bold mt-1">{companyMetrics.files.total}</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Ticket className="w-4 h-4" />
                          Ticket Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Total Tickets</span>
                          <span className="font-medium">{companyMetrics.tickets.total}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">In Progress</span>
                          <span className="font-medium">{companyMetrics.tickets.inProgress}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Resolved</span>
                          <span className="font-medium text-green-600">{companyMetrics.tickets.resolved}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Avg. Resolution</span>
                          <span className="font-medium">{companyMetrics.tickets.avgResolutionTime}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Activity className="w-4 h-4" />
                          Recent Activity
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Service Tier</span>
                          <Badge>{companyMetrics.services.tier}</Badge>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Active Services</span>
                          <span className="font-medium">{companyMetrics.services.activeServices}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Tickets This Month</span>
                          <span className="font-medium">{companyMetrics.activity.ticketsThisMonth}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Pending Invoices</span>
                          <span className="font-medium text-red-600">{companyMetrics.billing.pendingInvoices}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ) : (
                <p className="text-center py-8 text-slate-500">No metrics available</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex gap-2 mt-4 pt-4 border-t">
            <Button 
              className="flex-1"
              onClick={() => {
                setSelectedCompanyId(null);
                setDetailTab("overview");
                if (companyDetail) impersonateMutation.mutate(companyDetail.company.id);
              }}
              disabled={impersonateMutation.isPending}
              data-testid="button-view-portal-detail"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              View Company Portal
            </Button>
            <Button variant="outline" onClick={() => { setSelectedCompanyId(null); setDetailTab("overview"); }} data-testid="button-close-detail">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PortalLayout>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileText, Plus, Search, Send, Eye, XCircle, Loader, Building2, FileSignature, Filter
} from "lucide-react";
import { portalGet, portalPost } from "@/lib/portalApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { PortalLayout } from "./PortalLayout";
import { SignatureCapture } from "@/components/portal/SignatureCapture";
import { PDFViewer } from "@/components/portal/PDFViewer";
import { DataTable, EmptyState, Field, Panel, Token, type DataColumn, type TokenTone } from "@/components/portal/ui";

interface ContractTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  version: string;
  requiresCountersign: boolean;
  expirationDays: number;
  isActive: boolean;
  createdAt: string;
}

interface Contract {
  id: string;
  templateId: string | null;
  clientId: string;
  contractNumber: string;
  title: string;
  description: string;
  status: 'draft' | 'pending' | 'signed' | 'countersigned' | 'expired' | 'declined' | 'cancelled';
  sentAt: string | null;
  expiresAt: string | null;
  signedAt: string | null;
  countersignedAt: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  companyName: string;
  contactEmail: string;
}

const statusConfig: Record<string, { label: string; tone: TokenTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  pending: { label: 'Pending Signature', tone: 'warn' },
  signed: { label: 'Signed', tone: 'info' },
  countersigned: { label: 'Completed', tone: 'ok' },
  expired: { label: 'Expired', tone: 'bad' },
  declined: { label: 'Declined', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'neutral' }
};

function ContractStatus({ status }: { status: string | undefined }) {
  const cfg = statusConfig[status || 'draft'] ?? statusConfig.draft;
  return <Token label={cfg.label} tone={cfg.tone} dot />;
}

const dialogField = "border-border bg-background";

export function AdminContracts() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("contracts");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showContractDetail, setShowContractDetail] = useState(false);
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);
  const [showCountersignDialog, setShowCountersignDialog] = useState(false);
  const [countersignData, setCountersignData] = useState<{ signature: string | null; name: string; title: string }>({
    signature: null,
    name: '',
    title: 'Administrator'
  });

  const [newContract, setNewContract] = useState({
    templateId: '',
    clientId: '',
    title: '',
    description: ''
  });

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    category: 'msa',
    version: '1.0',
    requiresCountersign: false,
    expirationDays: 30
  });

  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['/api/admin/contracts'],
    queryFn: () => portalGet('/api/admin/contracts')
  });

  const { data: templatesData, isLoading: templatesLoading } = useQuery({
    queryKey: ['/api/admin/contract-templates'],
    queryFn: () => portalGet('/api/admin/contract-templates')
  });

  const { data: clientsData } = useQuery({
    queryKey: ['/api/admin/clients'],
    queryFn: () => portalGet('/api/admin/clients')
  });

  const createTemplateMutation = useMutation({
    mutationFn: (data: typeof newTemplate) => portalPost('/api/admin/contract-templates', data),
    onSuccess: () => {
      toast({ title: "Template created", description: "Contract template has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contract-templates'] });
      setShowTemplateDialog(false);
      setNewTemplate({ name: '', description: '', category: 'msa', version: '1.0', requiresCountersign: false, expirationDays: 30 });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template.", variant: "destructive" });
    }
  });

  const createContractMutation = useMutation({
    mutationFn: (data: typeof newContract) => portalPost('/api/admin/contracts', data),
    onSuccess: () => {
      toast({ title: "Contract created", description: "Contract has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contracts'] });
      setShowCreateDialog(false);
      setNewContract({ templateId: '', clientId: '', title: '', description: '' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create contract.", variant: "destructive" });
    }
  });

  const sendContractMutation = useMutation({
    mutationFn: (contractId: string) => portalPost(`/api/admin/contracts/${contractId}/send`, {}),
    onSuccess: () => {
      toast({ title: "Contract sent", description: "Contract has been sent to the client for signature." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contracts'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send contract.", variant: "destructive" });
    }
  });

  const cancelContractMutation = useMutation({
    mutationFn: (contractId: string) => portalPost(`/api/admin/contracts/${contractId}/cancel`, {}),
    onSuccess: () => {
      toast({ title: "Contract cancelled", description: "Contract has been cancelled." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contracts'] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to cancel contract.", variant: "destructive" });
    }
  });

  const countersignMutation = useMutation({
    mutationFn: ({ contractId, data }: { contractId: string; data: any }) =>
      portalPost(`/api/admin/contracts/${contractId}/countersign`, data),
    onSuccess: () => {
      toast({ title: "Contract countersigned", description: "Contract is now fully executed." });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/contracts'] });
      setShowCountersignDialog(false);
      setCountersignData({ signature: null, name: '', title: 'Administrator' });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to countersign contract.", variant: "destructive" });
    }
  });

  const contracts: Contract[] = (contractsData as any)?.contracts || [];
  const templates: ContractTemplate[] = (templatesData as any)?.templates || [];
  const clients: Client[] = (clientsData as any)?.clients || [];

  const filteredContracts = contracts.filter(contract => {
    const matchesSearch = contract.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          contract.contractNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || contract.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.companyName || 'Unknown Client';
  };

  const handleCountersign = () => {
    if (!selectedContract || !countersignData.signature || !countersignData.name) {
      toast({ title: "Error", description: "Please provide signature and name.", variant: "destructive" });
      return;
    }
    countersignMutation.mutate({
      contractId: selectedContract.id,
      data: {
        signatureData: countersignData.signature,
        signerName: countersignData.name,
        signerTitle: countersignData.title
      }
    });
  };

  const contractColumns: DataColumn<Contract>[] = [
    {
      key: "contract",
      header: "Contract",
      primary: true,
      cell: (contract) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{contract.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Building2 className="h-3 w-3" aria-hidden="true" />
              {getClientName(contract.clientId)}
            </span>
            <span className="pt-num">#{contract.contractNumber}</span>
          </p>
        </div>
      ),
    },
    { key: "status", header: "Status", primary: true, className: "w-44", cell: (contract) => <ContractStatus status={contract.status} /> },
    {
      key: "created",
      header: "Created",
      className: "w-36 whitespace-nowrap",
      hideBelowMd: true,
      cell: (contract) => <span className="pt-num text-muted-foreground">{format(new Date(contract.createdAt), 'MMM d, yyyy')}</span>,
    },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      primary: true,
      align: "right",
      className: "w-40",
      cell: (contract) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={`View ${contract.title}`}
            onClick={() => {
              setSelectedContract(contract);
              setShowContractDetail(true);
            }}
            data-testid={`button-view-contract-${contract.id}`}
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
          </Button>
          {contract.status === 'draft' && (
            <Button
              variant="ghost"
              size="icon"
              className="pt-ink pt-tone-brand"
              aria-label={`Send ${contract.title} for signature`}
              onClick={() => sendContractMutation.mutate(contract.id)}
              disabled={sendContractMutation.isPending}
              data-testid={`button-send-contract-${contract.id}`}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {contract.status === 'signed' && (
            <Button
              variant="ghost"
              size="icon"
              className="pt-ink pt-tone-ok"
              aria-label={`Countersign ${contract.title}`}
              onClick={() => {
                setSelectedContract(contract);
                setShowCountersignDialog(true);
              }}
              data-testid={`button-countersign-${contract.id}`}
            >
              <FileSignature className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
          {['draft', 'pending'].includes(contract.status) && (
            <Button
              variant="ghost"
              size="icon"
              className="pt-ink pt-tone-bad"
              aria-label={`Cancel ${contract.title}`}
              onClick={() => cancelContractMutation.mutate(contract.id)}
              disabled={cancelContractMutation.isPending}
              data-testid={`button-cancel-contract-${contract.id}`}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const templateColumns: DataColumn<ContractTemplate>[] = [
    {
      key: "template",
      header: "Template",
      primary: true,
      cell: (template) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{template.name}</p>
          {template.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{template.description}</p>}
        </div>
      ),
    },
    { key: "category", header: "Category", primary: true, className: "w-28", cell: (template) => <span className="uppercase text-muted-foreground">{template.category}</span> },
    { key: "version", header: "Version", className: "w-24", cell: (template) => <Token label={`v${template.version}`} tone="brand" /> },
    { key: "expiration", header: "Days to sign", className: "w-32 whitespace-nowrap", hideBelowMd: true, cell: (template) => <span className="pt-num text-muted-foreground">{template.expirationDays} days</span> },
    {
      key: "countersign",
      header: "Countersign",
      primary: true,
      className: "w-44",
      cell: (template) => template.requiresCountersign ? <Token label="Requires Countersign" tone="warn" /> : <span className="text-muted-foreground">—</span>,
    },
  ];

  return (
    <PortalLayout
      title="Contract Management"
      description="Create, send, and manage client contracts and agreements"
      width="wide"
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-card hover:bg-accent"
            onClick={() => setShowTemplateDialog(true)}
            data-testid="button-create-template"
          >
            <Plus aria-hidden="true" />
            New Template
          </Button>
          <Button
            variant="brand"
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-contract"
          >
            <Plus aria-hidden="true" />
            Create Contract
          </Button>
        </>
      }
    >
    <div className="space-y-4" data-testid="admin-contracts-page">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="contracts">
            <FileSignature className="mr-2 h-4 w-4" aria-hidden="true" />
            Contracts
          </TabsTrigger>
          <TabsTrigger value="templates">
            <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
            Templates
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contracts" className="mt-4 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                placeholder="Search contracts..."
                aria-label="Search contracts"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 border-border bg-card pl-9"
                data-testid="input-search-contracts"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 border-border bg-card sm:w-[180px]" aria-label="Filter by status" data-testid="select-status-filter">
                <Filter className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="signed">Signed</SelectItem>
                <SelectItem value="countersigned">Completed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="declined">Declined</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Panel
            id="contracts-list"
            title="Contracts"
            description={contractsLoading ? "Loading…" : `${filteredContracts.length} contract${filteredContracts.length === 1 ? "" : "s"}`}
            flush
          >
            <DataTable<Contract>
              columns={contractColumns}
              rows={filteredContracts}
              rowKey={(c) => c.id}
              loading={contractsLoading}
              caption="Client contracts"
              empty={
                <EmptyState
                  icon={FileText}
                  title="No contracts found"
                  description={contracts.length === 0 ? "Create a contract and send it to a client for signature." : "Try another status or clear the search."}
                  action={
                    <Button variant="brand" size="sm" onClick={() => setShowCreateDialog(true)}>
                      Create your first contract
                    </Button>
                  }
                />
              }
            />
          </Panel>
        </TabsContent>

        <TabsContent value="templates" className="mt-4 space-y-4">
          <Panel
            id="templates-list"
            title="Templates"
            description={templatesLoading ? "Loading…" : `${templates.length} template${templates.length === 1 ? "" : "s"}`}
            flush
          >
            <DataTable<ContractTemplate>
              columns={templateColumns}
              rows={templates}
              rowKey={(t) => t.id}
              loading={templatesLoading}
              caption="Contract templates"
              empty={
                <EmptyState
                  icon={FileText}
                  title="No templates found"
                  description="Define a reusable template to speed up contract creation."
                  action={
                    <Button variant="brand" size="sm" onClick={() => setShowTemplateDialog(true)}>
                      Create your first template
                    </Button>
                  }
                />
              }
            />
          </Panel>
        </TabsContent>
      </Tabs>

      {/* Create Contract Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle>Create New Contract</DialogTitle>
            <DialogDescription>Assign a contract to a client for signature</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Client" labelId="new-contract-client-label">
              <Select value={newContract.clientId} onValueChange={(v) => setNewContract({ ...newContract, clientId: v })}>
                <SelectTrigger className={dialogField} aria-labelledby="new-contract-client-label" data-testid="select-client">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Template (Optional)" labelId="new-contract-template-label">
              <Select value={newContract.templateId} onValueChange={(v) => setNewContract({ ...newContract, templateId: v })}>
                <SelectTrigger className={dialogField} aria-labelledby="new-contract-template-label" data-testid="select-template">
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contract Title" htmlFor="new-contract-title">
              <Input
                id="new-contract-title"
                placeholder="e.g., Master Service Agreement"
                value={newContract.title}
                onChange={(e) => setNewContract({ ...newContract, title: e.target.value })}
                className={dialogField}
                data-testid="input-contract-title"
              />
            </Field>
            <Field label="Description (Optional)" htmlFor="new-contract-description">
              <Textarea
                id="new-contract-description"
                placeholder="Brief description of the contract..."
                value={newContract.description}
                onChange={(e) => setNewContract({ ...newContract, description: e.target.value })}
                className={dialogField}
                data-testid="input-contract-description"
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => createContractMutation.mutate(newContract)}
              disabled={!newContract.clientId || !newContract.title || createContractMutation.isPending}
              data-testid="button-submit-contract"
            >
              {createContractMutation.isPending ? <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Create Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Template Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg border-border bg-card">
          <DialogHeader>
            <DialogTitle>Create Contract Template</DialogTitle>
            <DialogDescription>Define a reusable contract template</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Template Name" htmlFor="new-template-name">
              <Input
                id="new-template-name"
                placeholder="e.g., Master Service Agreement"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                className={dialogField}
                data-testid="input-template-name"
              />
            </Field>
            <Field label="Description" htmlFor="new-template-description">
              <Textarea
                id="new-template-description"
                placeholder="Brief description..."
                value={newTemplate.description}
                onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                className={dialogField}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category" labelId="new-template-category-label">
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate({ ...newTemplate, category: v })}>
                  <SelectTrigger className={dialogField} aria-labelledby="new-template-category-label">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="msa">MSA</SelectItem>
                    <SelectItem value="sow">Statement of Work</SelectItem>
                    <SelectItem value="nda">NDA</SelectItem>
                    <SelectItem value="sla">SLA</SelectItem>
                    <SelectItem value="addendum">Addendum</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Days to Sign" htmlFor="new-template-expiration">
                <Input
                  id="new-template-expiration"
                  type="number"
                  value={newTemplate.expirationDays}
                  onChange={(e) => setNewTemplate({ ...newTemplate, expirationDays: parseInt(e.target.value) || 30 })}
                  className={dialogField}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="requiresCountersign"
                checked={newTemplate.requiresCountersign}
                onChange={(e) => setNewTemplate({ ...newTemplate, requiresCountersign: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              <label htmlFor="requiresCountersign" className="text-sm font-medium">Requires admin countersign after client signs</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => setShowTemplateDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={() => createTemplateMutation.mutate(newTemplate)}
              disabled={!newTemplate.name || createTemplateMutation.isPending}
              data-testid="button-submit-template"
            >
              {createTemplateMutation.isPending ? <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Countersign Dialog */}
      <Dialog open={showCountersignDialog} onOpenChange={setShowCountersignDialog}>
        <DialogContent className="max-w-2xl border-border bg-card">
          <DialogHeader>
            <DialogTitle>Countersign Contract</DialogTitle>
            <DialogDescription>
              Add your signature to complete the contract for "{selectedContract?.title}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Your Name" htmlFor="countersign-name">
                <Input
                  id="countersign-name"
                  placeholder="Full legal name"
                  value={countersignData.name}
                  onChange={(e) => setCountersignData({ ...countersignData, name: e.target.value })}
                  className={dialogField}
                  data-testid="input-countersign-name"
                />
              </Field>
              <Field label="Title" htmlFor="countersign-title">
                <Input
                  id="countersign-title"
                  placeholder="e.g., CEO, Account Manager"
                  value={countersignData.title}
                  onChange={(e) => setCountersignData({ ...countersignData, title: e.target.value })}
                  className={dialogField}
                  data-testid="input-countersign-title"
                />
              </Field>
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Your Signature</p>
              <SignatureCapture
                signerName={countersignData.name}
                onSignatureChange={(sig) => setCountersignData({ ...countersignData, signature: sig })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-border bg-card hover:bg-accent" onClick={() => setShowCountersignDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="brand"
              onClick={handleCountersign}
              disabled={!countersignData.signature || !countersignData.name || countersignMutation.isPending}
              data-testid="button-submit-countersign"
            >
              {countersignMutation.isPending ? <Loader className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSignature className="h-4 w-4" aria-hidden="true" />}
              Countersign Contract
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contract Detail Dialog */}
      <Dialog open={showContractDetail} onOpenChange={setShowContractDetail}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-border bg-card">
          <DialogHeader>
            <DialogTitle>{selectedContract?.title}</DialogTitle>
            <DialogDescription>
              Contract #{selectedContract?.contractNumber} - {getClientName(selectedContract?.clientId || '')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <PDFViewer
              title={selectedContract?.title}
              className="h-[500px]"
            />
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="mt-1"><ContractStatus status={selectedContract?.status} /></dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Created</dt>
                <dd className="pt-num mt-1 font-medium">
                  {selectedContract?.createdAt ? format(new Date(selectedContract.createdAt), 'PPP') : '-'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="pt-num mt-1 font-medium">
                  {selectedContract?.expiresAt ? format(new Date(selectedContract.expiresAt), 'PPP') : 'Not sent'}
                </dd>
              </div>
            </dl>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </PortalLayout>
  );
}

export default AdminContracts;

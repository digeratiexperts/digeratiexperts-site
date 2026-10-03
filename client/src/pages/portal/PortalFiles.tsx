import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Download, File, FileText, FolderOpen, Package, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PortalLayout } from "./PortalLayout";
import { portalGet } from "@/lib/portalApi";
import { Callout, DataTable, EmptyState, Panel, Token, type DataColumn } from "@/components/portal/ui";

interface TenantFile {
  id: string;
  fileName: string;
  fileType: string;
  category: string;
  description: string;
  fileUrl: string;
  createdAt: string;
}

interface FilesResponse {
  files: TenantFile[];
  companyName: string;
}

const categoryIcons: Record<string, typeof FileText> = {
  agents: Package,
  documents: FileText,
  configs: Settings,
  other: File,
};

const categoryLabels: Record<string, string> = {
  agents: "Software & Agents",
  documents: "Documents",
  configs: "Configurations",
  other: "Other Files",
};

export default function PortalFiles() {
  const { data, isLoading, isError, error } = useQuery<FilesResponse>({
    queryKey: ["/api/portal/my-files"],
    queryFn: () => portalGet<FilesResponse>("/api/portal/my-files"),
  });

  const files = data?.files || [];
  const companyName = data?.companyName || "Your Company";

  const columns: DataColumn<TenantFile>[] = [
    {
      key: "file",
      header: "File",
      primary: true,
      cell: (file) => {
        const Icon = categoryIcons[file.category || "other"] || File;
        return (
          <div className="flex min-w-0 items-start gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate font-medium">{file.fileName}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{file.description || "No description"}</p>
            </div>
          </div>
        );
      },
    },
    {
      key: "category",
      header: "Category",
      hideBelowMd: true,
      className: "w-44",
      cell: (file) => <span className="text-muted-foreground">{categoryLabels[file.category || "other"] || categoryLabels.other}</span>,
    },
    {
      key: "type",
      header: "Type",
      primary: true,
      className: "w-32",
      cell: (file) => <Token label={file.fileType || file.category || "file"} />,
    },
    {
      key: "added",
      header: "Added",
      primary: true,
      className: "w-36 whitespace-nowrap",
      cell: (file) => <span className="pt-num text-muted-foreground">{new Date(file.createdAt).toLocaleDateString()}</span>,
    },
    {
      key: "download",
      header: <span className="sr-only">Download</span>,
      primary: true,
      align: "right",
      className: "w-36",
      cell: (file) => (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-border bg-card hover:bg-accent"
          onClick={() => window.open(file.fileUrl, "_blank")}
          aria-label={`Download ${file.fileName}`}
          data-testid={`button-download-${file.id}`}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download
        </Button>
      ),
    },
  ];

  return (
    <PortalLayout title="Files & Downloads" description={`Software, agents and documents DE prepared for ${companyName}.`} titleTestId="text-files-title" width="wide">
      <div className="space-y-4">
        {isError && (
          <Callout tone="bad" title="Failed to load files">
            {error instanceof Error ? error.message : "Unknown error"}
          </Callout>
        )}

        <Panel
          id="files-list"
          title="Available files"
          description={isLoading ? "Loading…" : `${files.length} file${files.length === 1 ? "" : "s"}`}
          flush
        >
          <DataTable<TenantFile>
            columns={columns}
            rows={files}
            rowKey={(file) => file.id}
            rowTestId={(file) => `card-file-${file.id}`}
            loading={isLoading}
            loadingRows={3}
            caption="Files and downloads"
            empty={
              <EmptyState
                icon={FolderOpen}
                title="No files available"
                description="Your IT administrator hasn't uploaded any files for your organization yet."
              />
            }
          />
        </Panel>

        <Callout tone="info" title="Need something else?">
          If you need additional software, documentation, or configuration files, please contact your IT administrator or{" "}
          <Link href="/portal/tickets/create">submit a support ticket</Link>.
        </Callout>
      </div>
    </PortalLayout>
  );
}

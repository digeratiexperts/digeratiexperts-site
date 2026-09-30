import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PortalLayout } from "./PortalLayout";
import { FileText, Download, FolderOpen, Package, File, Settings } from "lucide-react";
import { portalGet } from "@/lib/portalApi";

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

const categoryColors: Record<string, string> = {
  agents: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  documents: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  configs: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

export default function PortalFiles() {
  const { data, isLoading, isError, error } = useQuery<FilesResponse>({
    queryKey: ["/api/portal/my-files"],
    queryFn: () => portalGet<FilesResponse>("/api/portal/my-files"),
  });

  const files = data?.files || [];
  const companyName = data?.companyName || "Your Company";

  const groupedFiles = files.reduce((acc, file) => {
    const category = file.category || "other";
    if (!acc[category]) acc[category] = [];
    acc[category].push(file);
    return acc;
  }, {} as Record<string, TenantFile[]>);

  return (
    <PortalLayout title="Files & Downloads" description={`Software, agents and documents DE prepared for ${companyName}.`} titleTestId="text-files-title">
      <div className="space-y-6">
        {isError && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-300">
              Failed to load files: {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-3">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-4"></div>
                  <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-full"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : files.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <FolderOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400">No files available</h3>
              <p className="text-slate-500 dark:text-slate-500 mt-2">
                Your IT administrator hasn't uploaded any files for your organization yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedFiles).map(([category, categoryFiles]) => {
              const IconComponent = categoryIcons[category] || File;
              return (
                <div key={category}>
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <IconComponent className="w-4 h-4" />
                    {category === "agents" ? "Software & Agents" : 
                     category === "configs" ? "Configurations" :
                     category === "documents" ? "Documents" : "Other Files"}
                    <Badge variant="secondary" className="ml-2">{categoryFiles.length}</Badge>
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryFiles.map((file) => (
                      <Card key={file.id} className="hover:shadow-lg transition-shadow" data-testid={`card-file-${file.id}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <IconComponent className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <CardTitle className="text-base">{file.fileName}</CardTitle>
                                <CardDescription className="text-sm">
                                  {file.description || "No description"}
                                </CardDescription>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center justify-between">
                            <Badge className={categoryColors[category] || categoryColors.other}>
                              {file.fileType || category}
                            </Badge>
                            <Button 
                              size="sm" 
                              onClick={() => window.open(file.fileUrl, '_blank')}
                              data-testid={`button-download-${file.id}`}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </Button>
                          </div>
                          <p className="text-xs text-slate-400 mt-3">
                            Added: {new Date(file.createdAt).toLocaleDateString()}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <Card className="bg-slate-50 dark:bg-slate-800/50 border-dashed">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <FileText className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Need something else?</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  If you need additional software, documentation, or configuration files, please contact your IT administrator 
                  or submit a support ticket.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  );
}

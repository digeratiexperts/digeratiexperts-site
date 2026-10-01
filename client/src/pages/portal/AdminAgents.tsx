import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, Edit, CheckCircle } from "lucide-react";
import { PortalLayout } from "./PortalLayout";

interface Agent {
  id: string;
  name: string;
  type: "jumpcloud" | "coro" | "blackpoint" | "custom";
  version: string;
  downloadUrl: string;
  features: string[];
  supportedOS: string[];
  uploadedBy: string;
  uploadedDate: string;
  active: boolean;
}

const sampleAgents: Agent[] = [
  {
    id: "1",
    name: "Digerati Expert Desktop Agent",
    type: "custom",
    version: "1.0.0",
    downloadUrl: "https://agents.digerati.com/digerati-agent-1.0.0.exe",
    features: [
      "Quick ticket submission",
      "Real-time chat",
      "System monitoring",
      "Auto-updates",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
    uploadedBy: "Admin",
    uploadedDate: "2025-01-15",
    active: true,
  },
  {
    id: "2",
    name: "JumpCloud Agent",
    type: "jumpcloud",
    version: "2.5.1",
    downloadUrl: "https://agents.jumpcloud.com/windows-installer.exe",
    features: [
      "User management",
      "MDM",
      "MFA",
      "System inventory",
    ],
    supportedOS: ["Windows 10", "Windows 11", "macOS", "Linux"],
    uploadedBy: "Admin",
    uploadedDate: "2025-01-10",
    active: true,
  },
  {
    id: "3",
    name: "Coro.net EDR Agent",
    type: "coro",
    version: "3.2.0",
    downloadUrl: "https://agents.coro.net/edr-windows.exe",
    features: [
      "Endpoint detection",
      "Response",
      "Threat hunting",
      "Incident response",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
    uploadedBy: "Security Team",
    uploadedDate: "2025-01-08",
    active: true,
  },
  {
    id: "4",
    name: "BlackPoint Cyber Agent",
    type: "blackpoint",
    version: "1.8.5",
    downloadUrl: "https://agents.blackpointcyber.com/bpcy-agent.exe",
    features: [
      "Behavioral analysis",
      "Anomaly detection",
      "Real-time alerts",
      "Threat response",
    ],
    supportedOS: ["Windows 10", "Windows 11"],
    uploadedBy: "SOC Team",
    uploadedDate: "2024-12-20",
    active: true,
  },
];

export function AdminAgents() {
  const [agents, setAgents] = useState<Agent[]>(sampleAgents);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "custom",
    version: "",
    downloadUrl: "",
    features: "",
    supportedOS: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      type: "custom",
      version: "",
      downloadUrl: "",
      features: "",
      supportedOS: "",
    });
    setEditingId(null);
    setShowUploadForm(false);
  };

  const handleUploadAgent = () => {
    if (
      !formData.name ||
      !formData.version ||
      !formData.downloadUrl
    ) {
      alert("Please fill in required fields");
      return;
    }

    const features = formData.features
      .split("\n")
      .filter((f) => f.trim())
      .map((f) => f.trim());
    const supportedOS = formData.supportedOS
      .split(",")
      .filter((os) => os.trim())
      .map((os) => os.trim());

    if (editingId) {
      setAgents((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                name: formData.name,
                type: formData.type as Agent["type"],
                version: formData.version,
                downloadUrl: formData.downloadUrl,
                features,
                supportedOS,
              }
            : a
        )
      );
      resetForm();
      alert("Agent updated successfully!");
      return;
    }

    const newAgent: Agent = {
      id: Date.now().toString(),
      name: formData.name,
      type: formData.type as Agent["type"],
      version: formData.version,
      downloadUrl: formData.downloadUrl,
      features,
      supportedOS,
      uploadedBy: "Current User",
      uploadedDate: new Date().toISOString().split("T")[0],
      active: true,
    };

    setAgents([...agents, newAgent]);
    resetForm();
    alert("Agent uploaded successfully!");
  };

  const handleDeleteAgent = (id: string) => {
    if (confirm("Are you sure you want to delete this agent?")) {
      setAgents(agents.filter((a) => a.id !== id));
    }
  };

  const handleToggleAgent = (id: string) => {
    setAgents(
      agents.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );
  };

  const handleEditAgent = (agent: Agent) => {
    setEditingId(agent.id);
    setFormData({
      name: agent.name,
      type: agent.type,
      version: agent.version,
      downloadUrl: agent.downloadUrl,
      features: agent.features.join("\n"),
      supportedOS: agent.supportedOS.join(", "),
    });
    setShowUploadForm(true);
  };

  const getAgentBadgeColor = (type: Agent["type"]) => {
    switch (type) {
      case "jumpcloud":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "coro":
        return "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200";
      case "blackpoint":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      default:
        return "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200";
    }
  };

  return (
    <PortalLayout title="Manage Agents" description="Upload and manage the desktop agents offered in the portal.">
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div />
        <Button
          onClick={() => setShowUploadForm(!showUploadForm)}
          className="bg-[#D3126A] text-white hover:bg-[#e01874] hover:text-white"
          data-testid="button-upload-agent"
        >
          <Upload className="h-4 w-4 mr-2" />
          Upload Agent
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <Card className="border-[#D3126A]/50">
          <CardHeader>
            <CardTitle>{editingId ? "Edit Agent" : "Add New Agent"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Agent Name *
                </label>
                <Input
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., JumpCloud Agent"
                  data-testid="input-agent-name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  data-testid="select-agent-type"
                >
                  <option value="custom">Custom</option>
                  <option value="jumpcloud">JumpCloud</option>
                  <option value="coro">Coro.net</option>
                  <option value="blackpoint">BlackPoint</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Version *</label>
              <Input
                value={formData.version}
                onChange={(e) =>
                  setFormData({ ...formData, version: e.target.value })
                }
                placeholder="e.g., 1.0.0"
                data-testid="input-agent-version"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Download URL *
              </label>
              <Input
                value={formData.downloadUrl}
                onChange={(e) =>
                  setFormData({ ...formData, downloadUrl: e.target.value })
                }
                placeholder="https://..."
                data-testid="input-agent-url"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Features (one per line)
              </label>
              <Textarea
                value={formData.features}
                onChange={(e) =>
                  setFormData({ ...formData, features: e.target.value })
                }
                placeholder="System monitoring&#10;Auto-updates&#10;..."
                className="min-h-20"
                data-testid="textarea-agent-features"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Supported OS (comma-separated)
              </label>
              <Input
                value={formData.supportedOS}
                onChange={(e) =>
                  setFormData({ ...formData, supportedOS: e.target.value })
                }
                placeholder="Windows 10, Windows 11, macOS"
                data-testid="input-agent-os"
              />
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button
                onClick={handleUploadAgent}
                className="flex-1 bg-[#D3126A] text-white hover:bg-[#e01874] hover:text-white"
                data-testid="button-save-agent"
              >
                {editingId ? "Update Agent" : "Save Agent"}
              </Button>
              <Button
                variant="outline"
                onClick={resetForm}
                className="flex-1 hover:!bg-slate-100 hover:!text-slate-900 dark:hover:!bg-slate-800 dark:hover:!text-white hover:!border-slate-300"
                data-testid="button-cancel-upload"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agents List */}
      <div className="space-y-3">
        {agents.map((agent) => (
          <Card
            key={agent.id}
            className={agent.active ? "" : "opacity-60"}
            data-testid={`card-agent-${agent.id}`}
          >
            <CardContent className="pt-6">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{agent.name}</h3>
                    <Badge className={getAgentBadgeColor(agent.type)}>
                      {agent.type.toUpperCase()}
                    </Badge>
                    {agent.active && (
                      <Badge className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    v{agent.version} • Uploaded by {agent.uploadedBy} on{" "}
                    {agent.uploadedDate}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 my-3 pb-3 border-b dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Features
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {agent.features.slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                    {agent.features.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{agent.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Supported OS
                  </p>
                  <p className="text-sm">
                    {agent.supportedOS.join(", ")}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:!bg-slate-100 hover:!text-slate-900 dark:hover:!bg-slate-800 dark:hover:!text-white hover:!border-slate-300"
                  onClick={() => handleToggleAgent(agent.id)}
                  data-testid={`button-toggle-agent-${agent.id}`}
                >
                  {agent.active ? "Disable" : "Enable"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="hover:!bg-slate-100 hover:!text-slate-900 dark:hover:!bg-slate-800 dark:hover:!text-white hover:!border-slate-300"
                  onClick={() => handleEditAgent(agent)}
                  data-testid={`button-edit-agent-${agent.id}`}
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:!bg-red-50 hover:!text-red-700 hover:!border-red-300 dark:hover:!bg-red-950/40"
                  onClick={() => handleDeleteAgent(agent.id)}
                  data-testid={`button-delete-agent-${agent.id}`}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
    </PortalLayout>
  );
}

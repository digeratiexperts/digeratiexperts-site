import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Trash2, Edit, Package } from "lucide-react";
import { PortalLayout } from "./PortalLayout";
import { cn } from "@/lib/utils";
import { EmptyState, Field, Panel, Token, type TokenTone } from "@/components/portal/ui";

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

const TYPE_TONE: Record<Agent["type"], TokenTone> = {
  jumpcloud: "info",
  coro: "brand",
  blackpoint: "bad",
  custom: "neutral",
};

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

  return (
    <PortalLayout
      title="Manage Agents"
      description="Upload and manage the desktop agents offered in the portal."
      actions={
        <Button
          variant="brand"
          onClick={() => setShowUploadForm(!showUploadForm)}
          aria-expanded={showUploadForm}
          data-testid="button-upload-agent"
        >
          <Upload aria-hidden="true" />
          Upload Agent
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Upload Form */}
        {showUploadForm && (
          <Panel id="agent-form" title={editingId ? "Edit Agent" : "Add New Agent"}>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Agent Name" htmlFor="agent-name" required>
                  <Input
                    id="agent-name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="e.g., JumpCloud Agent"
                    className="border-border bg-background"
                    data-testid="input-agent-name"
                  />
                </Field>
                <Field label="Type" htmlFor="agent-type">
                  <select
                    id="agent-type"
                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                </Field>
              </div>

              <Field label="Version" htmlFor="agent-version" required>
                <Input
                  id="agent-version"
                  value={formData.version}
                  onChange={(e) =>
                    setFormData({ ...formData, version: e.target.value })
                  }
                  placeholder="e.g., 1.0.0"
                  className="border-border bg-background"
                  data-testid="input-agent-version"
                />
              </Field>

              <Field label="Download URL" htmlFor="agent-url" required>
                <Input
                  id="agent-url"
                  value={formData.downloadUrl}
                  onChange={(e) =>
                    setFormData({ ...formData, downloadUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="border-border bg-background"
                  data-testid="input-agent-url"
                />
              </Field>

              <Field label="Features (one per line)" htmlFor="agent-features">
                <Textarea
                  id="agent-features"
                  value={formData.features}
                  onChange={(e) =>
                    setFormData({ ...formData, features: e.target.value })
                  }
                  placeholder="System monitoring&#10;Auto-updates&#10;..."
                  className="min-h-20 border-border bg-background"
                  data-testid="textarea-agent-features"
                />
              </Field>

              <Field label="Supported OS (comma-separated)" htmlFor="agent-os">
                <Input
                  id="agent-os"
                  value={formData.supportedOS}
                  onChange={(e) =>
                    setFormData({ ...formData, supportedOS: e.target.value })
                  }
                  placeholder="Windows 10, Windows 11, macOS"
                  className="border-border bg-background"
                  data-testid="input-agent-os"
                />
              </Field>

              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="brand" onClick={handleUploadAgent} data-testid="button-save-agent">
                  {editingId ? "Update Agent" : "Save Agent"}
                </Button>
                <Button
                  variant="outline"
                  className="border-border bg-card hover:bg-accent"
                  onClick={resetForm}
                  data-testid="button-cancel-upload"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Agents List */}
        <Panel id="agents-list" title="Agents" description={`${agents.length} agent${agents.length === 1 ? "" : "s"}`} flush>
          {agents.length === 0 ? (
            <EmptyState compact icon={Package} title="No agents yet" description="Upload an agent to offer it in the portal." />
          ) : (
            <ul className="divide-y divide-border">
              {agents.map((agent) => (
                <li
                  key={agent.id}
                  className={cn("px-4 py-4 md:px-5", !agent.active && "opacity-60")}
                  data-testid={`card-agent-${agent.id}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold">{agent.name}</h3>
                    <Token label={agent.type} tone={TYPE_TONE[agent.type]} />
                    {agent.active && <Token label="Active" tone="ok" dot />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    v{agent.version} · Uploaded by {agent.uploadedBy} on{" "}
                    <span className="pt-num">{agent.uploadedDate}</span>
                  </p>

                  <dl className="my-3 grid gap-4 border-b border-border pb-3 sm:grid-cols-2">
                    <div>
                      <dt className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Features</dt>
                      <dd className="flex flex-wrap gap-1">
                        {agent.features.slice(0, 3).map((feature, idx) => (
                          <Token key={idx} label={feature} tone="neutral" className="normal-case tracking-normal" />
                        ))}
                        {agent.features.length > 3 && (
                          <Token label={`+${agent.features.length - 3} more`} tone="neutral" className="normal-case tracking-normal" />
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Supported OS</dt>
                      <dd className="text-sm">{agent.supportedOS.join(", ")}</dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border bg-card hover:bg-accent"
                      onClick={() => handleToggleAgent(agent.id)}
                      data-testid={`button-toggle-agent-${agent.id}`}
                    >
                      {agent.active ? "Disable" : "Enable"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border bg-card hover:bg-accent"
                      onClick={() => handleEditAgent(agent)}
                      data-testid={`button-edit-agent-${agent.id}`}
                    >
                      <Edit className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border bg-card pt-ink pt-tone-bad hover:bg-accent"
                      onClick={() => handleDeleteAgent(agent.id)}
                      data-testid={`button-delete-agent-${agent.id}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </PortalLayout>
  );
}

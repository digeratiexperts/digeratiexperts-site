import { useRef, useState } from "react";
import { useParams } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, MessageCircle, Paperclip, Send, ShieldCheck, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PortalLayout } from "./PortalLayout";
import { queryClient } from "@/lib/queryClient";
import { portalGet, portalPost } from "@/lib/portalApi";
import { formatDeskTimestamp } from "@/lib/deskTimestamp";
import {
  PORTAL_TICKET_ACCEPT,
  PORTAL_TICKET_MAX_FILES,
  uploadPortalTicketAttachment,
  validatePortalTicketFile,
} from "@/lib/portalTicketAttach";
import { Callout, EmptyState, Panel, Priority, TicketStatus, Token } from "@/components/portal/ui";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  author: string;
  role: string;
  content: string;
  timestamp: string;
  isInternal: boolean;
}

interface Ticket {
  id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string;
  companyName?: string;
  isInternal?: boolean;
  comments: Comment[];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function PortalTicketDetail() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [commentText, setCommentText] = useState("");
  const [attachError, setAttachError] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: ticketData, isLoading, error } = useQuery<{ ticket: Ticket }>({
    queryKey: ["/api/portal/tickets", ticketId],
    queryFn: () => portalGet<{ ticket: Ticket }>(`/api/portal/tickets/${ticketId}`),
    enabled: !!ticketId,
  });

  const ticket = ticketData?.ticket;

  const addCommentMutation = useMutation({
    mutationFn: async (content: string) => portalPost<{ success: boolean }>(`/api/portal/tickets/${ticketId}/comments`, { content }),
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets", ticketId] });
    },
  });

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    addCommentMutation.mutate(commentText);
  };

  const queueDetailFiles = (incoming: FileList | File[]) => {
    const next = [...pendingFiles];
    const problems: string[] = [];
    for (const file of Array.from(incoming)) {
      if (next.length >= PORTAL_TICKET_MAX_FILES) {
        problems.push(`You can attach up to ${PORTAL_TICKET_MAX_FILES} files at a time.`);
        break;
      }
      const invalid = validatePortalTicketFile(file);
      if (invalid) {
        problems.push(invalid);
        continue;
      }
      next.push(file);
    }
    setPendingFiles(next);
    setAttachError(problems[0] || "");
  };

  const handleAttachFiles = async () => {
    if (!ticketId || pendingFiles.length === 0) return;
    setAttaching(true);
    setAttachError("");
    const failed: string[] = [];
    for (const file of pendingFiles) {
      try {
        await uploadPortalTicketAttachment(ticketId, file);
      } catch (err) {
        failed.push(err instanceof Error ? err.message : `Could not attach ${file.name}.`);
      }
    }
    setAttaching(false);
    if (failed.length) {
      setAttachError(failed[0]);
      return;
    }
    setPendingFiles([]);
    queryClient.invalidateQueries({ queryKey: ["/api/portal/tickets", ticketId] });
  };

  if (isLoading) {
    return (
      <PortalLayout title="Ticket" backHref="/portal/tickets" backLabel="Back to tickets" hideHeader>
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40" />
        </div>
      </PortalLayout>
    );
  }

  if (error || !ticket) {
    return (
      <PortalLayout title="Ticket not found" backHref="/portal/tickets" backLabel="Back to tickets" width="narrow">
        <Callout tone="bad" title="This ticket isn't available">
          It may not exist, or your account doesn't have permission to view it.
        </Callout>
      </PortalLayout>
    );
  }

  const context = ticket.isInternal ? "Internal" : ticket.companyName || "";

  return (
    <PortalLayout
      title={ticket.subject}
      eyebrow={
        <span className="pt-num">
          {ticket.ticketNumber}
          {context ? ` · ${context}` : ""}
          {ticket.category ? ` · ${ticket.category}` : ""}
        </span>
      }
      backHref="/portal/tickets"
      backLabel="Back to tickets"
      actions={
        <>
          <Priority priority={ticket.priority} />
          <TicketStatus status={ticket.status} />
        </>
      }
      width="wide"
    >
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <Panel id="ticket-description" title="What you reported">
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{ticket.description}</p>
          </Panel>

          <Panel
            id="conversation"
            title={
              <span className="inline-flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                Conversation
              </span>
            }
            description={`${ticket.comments.length} message${ticket.comments.length === 1 ? "" : "s"}`}
            flush
          >
            {ticket.comments.length === 0 ? (
              <EmptyState compact icon={MessageCircle} title="No replies yet" description="A DE engineer replies here. You'll also get an email." />
            ) : (
              <ol className="divide-y divide-border">
                {ticket.comments.map((comment) => {
                  const fromDe = /support|agent|admin|engineer|de/i.test(comment.role);
                  return (
                    <li key={comment.id} className={cn("flex gap-3 px-4 py-4 md:px-5", comment.isInternal && "pt-note-internal")} data-testid={`comment-${comment.id}`}>
                      <span
                        className={cn(
                          "grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                          fromDe ? "pt-avatar-de" : "border-border bg-secondary",
                        )}
                        aria-hidden="true"
                      >
                        {initials(comment.author)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                          <span className="font-semibold">{comment.author}</span>
                          <span className="text-xs text-muted-foreground">{fromDe ? "Digerati Experts" : comment.role}</span>
                          {comment.isInternal && <Token label="Internal note" tone="warn" className="px-1.5 py-0 text-[9px]" />}
                          <time className="pt-num ml-auto text-xs text-muted-foreground" dateTime={comment.timestamp}>
                            {formatDeskTimestamp(comment.timestamp)}
                          </time>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}

            <form onSubmit={handleAddComment} className="space-y-3 border-t border-border bg-background/40 px-4 py-4 md:px-5">
              <div>
                <label htmlFor="ticket-reply" className="mb-1.5 block text-sm font-medium">
                  Reply
                </label>
                <Textarea
                  id="ticket-reply"
                  placeholder="Type your reply. Attach screenshots or logs below."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-24 border-border bg-card"
                  data-testid="textarea-comment"
                />
              </div>
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={PORTAL_TICKET_ACCEPT}
                  className="sr-only"
                  aria-label="Attach files to this ticket"
                  data-testid="input-ticket-detail-files"
                  onChange={(event) => {
                    if (event.target.files) queueDetailFiles(event.target.files);
                    event.target.value = "";
                  }}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-2 border-border bg-card hover:bg-accent" onClick={() => fileInputRef.current?.click()} data-testid="button-choose-detail-files">
                    <Paperclip className="h-4 w-4" aria-hidden="true" />
                    Choose files
                  </Button>
                  <span className="text-xs text-muted-foreground">PNG, JPG, PDF, TXT or LOG, 10 MB each</span>
                </div>
                {pendingFiles.length > 0 && (
                  <ul className="space-y-1.5">
                    {pendingFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate">{file.name}</span>
                        <button type="button" className="shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`Remove ${file.name}`} onClick={() => setPendingFiles((prev) => prev.filter((item) => item !== file))}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {attachError && (
                  <p className="text-sm pt-ink pt-tone-bad" role="alert">
                    {attachError}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" variant="brand" disabled={!commentText || addCommentMutation.isPending} data-testid="button-send-comment">
                  {addCommentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                  {addCommentMutation.isPending ? "Sending…" : "Send reply"}
                </Button>
                <Button type="button" variant="outline" className="border-border bg-card hover:bg-accent" disabled={pendingFiles.length === 0 || attaching} onClick={() => void handleAttachFiles()} data-testid="button-upload-attachments">
                  {attaching ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                  {attaching ? "Uploading…" : "Upload attachments"}
                </Button>
              </div>
              {addCommentMutation.isError && (
                <Callout tone="bad" title="Your reply wasn't sent">
                  {addCommentMutation.error instanceof Error ? addCommentMutation.error.message : "Please try again."}
                </Callout>
              )}
            </form>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel id="ticket-details" title="Details">
            <dl className="space-y-3 text-sm">
              {[
                ["Status", <TicketStatus key="s" status={ticket.status} />],
                ["Priority", <Priority key="p" priority={ticket.priority} />],
                ["Category", <span key="c" className="capitalize">{ticket.category || "—"}</span>],
                ["Engineer", ticket.assignedTo && !ticket.assignedTo.startsWith("zoho:") ? ticket.assignedTo : "Not yet assigned"],
                ["Opened", <span key="o" className="pt-num">{formatDeskTimestamp(ticket.createdAt)}</span>],
                ["Last update", <span key="u" className="pt-num">{formatDeskTimestamp(ticket.updatedAt)}</span>],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </Panel>
          <Callout tone="info">
            <span className="inline-flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Only you and DE support engineers can see this ticket. Internal notes are marked.</span>
            </span>
          </Callout>
        </aside>
      </div>
    </PortalLayout>
  );
}

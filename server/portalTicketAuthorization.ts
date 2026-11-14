import { canViewClientWide, isDeAdmin, type OrgUserFields } from "./portalOrg";

export type PortalTicketAuthorizationSubject = {
  clientId: string;
  createdBy: string;
};

export type PortalTicketAuthorizationComment = {
  userId: string;
  isInternal?: boolean | null;
};

export type PortalTicketAuthorizationResult =
  | { ok: true }
  | { ok: false; status: 404; error: "Ticket not found" };

export type PortalTicketPresentationSubject = {
  id: string;
  ticketNumber?: string | null;
  subject: string;
  description: string;
  status?: string | null;
  priority?: string | null;
  category?: string | null;
  assignedTo?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  resolvedAt?: Date | string | null;
};

const ticketNotFound = (): PortalTicketAuthorizationResult => ({
  ok: false,
  status: 404,
  error: "Ticket not found",
});

export function authorizePortalTicketAccess(
  user: OrgUserFields,
  ticket: PortalTicketAuthorizationSubject,
  comments: PortalTicketAuthorizationComment[] = [],
): PortalTicketAuthorizationResult {
  if (isDeAdmin(user)) return { ok: true };
  if (!user.clientId || user.clientId !== ticket.clientId) return ticketNotFound();
  if (canViewClientWide(user) || ticket.createdBy === user.id) return { ok: true };

  const isPublicCommentParticipant = comments.some(
    (comment) => comment.isInternal === false && comment.userId === user.id,
  );
  return isPublicCommentParticipant ? { ok: true } : ticketNotFound();
}

export function visiblePortalTicketComments<T extends PortalTicketAuthorizationComment>(
  user: OrgUserFields,
  comments: T[],
): T[] {
  return isDeAdmin(user)
    ? comments
    : comments.filter((comment) => comment.isInternal === false);
}

export function portalTicketClientView(
  user: OrgUserFields,
  ticket: PortalTicketPresentationSubject,
) {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber || `#TK${String(ticket.id).padStart(3, "0")}`,
    subject: ticket.subject,
    description: ticket.description,
    status: ticket.status,
    priority: ticket.priority,
    category: ticket.category || "General",
    assignedTo: isDeAdmin(user)
      ? ticket.assignedTo || null
      : ticket.assignedTo
        ? "Digerati Experts Support"
        : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt || null,
  };
}

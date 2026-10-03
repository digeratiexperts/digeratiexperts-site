/**
 * Who may read, comment on, or attach to a portal support ticket.
 *
 * Before this (issue #256) the ticket detail, comment and attachment routes
 * checked only that the ticket belonged to the caller's company
 * (ticket.clientId === req.user.clientId). So any ordinary staffer could read
 * or act on a coworker's ticket just by knowing its id. A ticket is scoped to
 * the person who opened it; a Company IT Contact oversees the whole company's
 * tickets, and a DE admin sees everything. (Whether a department IT contact
 * should see their department's tickets is a product decision left open; the
 * safe default here does not grant it.)
 */

export interface TicketActor {
  id?: string | null;
  role?: string | null;
  clientId?: string | null;
  orgRole?: string | null;
  isCompanyItContact?: boolean | null;
}

export interface TicketOwnership {
  clientId?: string | null;
  createdBy?: string | null;
}

export function canAccessPortalTicket(actor: TicketActor | undefined, ticket: TicketOwnership): boolean {
  if (!actor) return false;
  if (actor.role === "admin") return true;
  // Must be the caller's own company before anything else is considered.
  if (!actor.clientId || ticket.clientId !== actor.clientId) return false;
  // The person who opened the ticket.
  if (ticket.createdBy && actor.id && ticket.createdBy === actor.id) return true;
  // A Company IT Contact oversees their own company's tickets.
  if (actor.isCompanyItContact === true || actor.orgRole === "company_it_contact") return true;
  return false;
}

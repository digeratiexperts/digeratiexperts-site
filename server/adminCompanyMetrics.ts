/**
 * Admin company metrics built only from systems this server actually has (#234).
 * Anything without an authoritative source is null with a "not_connected" source
 * marker. It is never a plausible-looking placeholder.
 */

export type MetricSource = "portal" | "not_connected";

type TicketLike = { status?: string | null; createdAt?: Date | string | null; resolvedAt?: Date | string | null };
type UserLike = { isActive?: boolean | null; role?: string | null; lastLogin?: Date | string | null };
type FileLike = { category?: string | null; createdAt?: Date | string | null };

export function averageResolutionHours(tickets: TicketLike[]): number | null {
  const durations: number[] = [];
  for (const t of tickets) {
    if (!t.resolvedAt || !t.createdAt) continue;
    const ms = new Date(t.resolvedAt).getTime() - new Date(t.createdAt).getTime();
    if (Number.isFinite(ms) && ms >= 0) durations.push(ms);
  }
  if (durations.length === 0) return null;
  return durations.reduce((a, b) => a + b, 0) / durations.length / 3_600_000;
}

function sameMonth(value: Date | string | null | undefined, now: Date): boolean {
  if (!value) return false;
  const d = new Date(value);
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export function buildCompanyMetrics(input: {
  company: { id: string; companyName: string; status?: string | null; createdAt?: Date | string | null };
  tickets: TicketLike[];
  users: UserLike[];
  files: FileLike[];
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const { company, tickets, users, files } = input;
  const avgHours = averageResolutionHours(tickets);
  const lastLoginMs = users
    .map((u) => (u.lastLogin ? new Date(u.lastLogin).getTime() : NaN))
    .filter((n) => Number.isFinite(n));
  return {
    company: { id: company.id, name: company.companyName, status: company.status, createdAt: company.createdAt },
    tickets: {
      total: tickets.length,
      open: tickets.filter((t) => t.status === "open").length,
      inProgress: tickets.filter((t) => t.status === "in_progress").length,
      resolved: tickets.filter((t) => t.status === "resolved").length,
      avgResolutionHours: avgHours === null ? null : Math.round(avgHours * 10) / 10,
    },
    users: {
      total: users.length,
      activeUsers: users.filter((u) => u.isActive).length,
      admins: users.filter((u) => u.role === "admin").length,
    },
    files: {
      total: files.length,
      agents: files.filter((f) => f.category === "agents").length,
      documents: files.filter((f) => f.category === "documents").length,
    },
    // No authoritative service or billing source is wired to this endpoint yet.
    services: { activeServices: null, monthlyValue: null, tier: null },
    billing: { pendingInvoices: null, totalOwed: null, lastPayment: null },
    activity: {
      lastLogin: lastLoginMs.length ? new Date(Math.max(...lastLoginMs)).toISOString() : null,
      ticketsThisMonth: tickets.filter((t) => sameMonth(t.createdAt, now)).length,
      filesUploadedThisMonth: files.filter((f) => sameMonth(f.createdAt, now)).length,
    },
    sources: {
      tickets: "portal" as MetricSource,
      users: "portal" as MetricSource,
      files: "portal" as MetricSource,
      services: "not_connected" as MetricSource,
      billing: "not_connected" as MetricSource,
    },
  };
}

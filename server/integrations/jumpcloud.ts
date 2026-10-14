/**
 * JumpCloud Directory API — onboard/offboard helpers.
 * Auth: x-api-key header (JUMPCLOUD_API_KEY). Optional JUMPCLOUD_ORG_ID → x-org-id.
 * Docs: https://docs.jumpcloud.com/
 */

const JC_BASE = (process.env.JUMPCLOUD_API_BASE || "https://console.jumpcloud.com/api").replace(/\/$/, "");

export type JcUser = {
  id: string;
  email?: string;
  username?: string;
  firstname?: string;
  lastname?: string;
  suspended?: boolean;
  activated?: boolean;
};

function jcHeaders(orgId?: string | null): Record<string, string> | null {
  const key = (process.env.JUMPCLOUD_API_KEY || "").trim();
  if (!key) return null;
  const h: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-api-key": key,
  };
  const org = (orgId || process.env.JUMPCLOUD_ORG_ID || "").trim();
  if (org) h["x-org-id"] = org;
  return h;
}

export function jumpcloudConfigured(): boolean {
  return !!jcHeaders();
}

async function jcFetch<T>(
  path: string,
  init?: RequestInit,
  orgId?: string | null,
): Promise<{ ok: boolean; status: number; data?: T; error?: string }> {
  const headers = jcHeaders(orgId);
  if (!headers) return { ok: false, status: 0, error: "JUMPCLOUD_API_KEY not configured" };
  try {
    const res = await fetch(`${JC_BASE}${path}`, {
      ...init,
      headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
    });
    const text = await res.text();
    let data: any = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || text.slice(0, 300) || res.statusText,
        data,
      };
    }
    return { ok: true, status: res.status, data: data as T };
  } catch (err: any) {
    return { ok: false, status: 0, error: err?.message || "JumpCloud request failed" };
  }
}

export async function jumpcloudTestConnection(): Promise<{ success: boolean; message: string }> {
  const r = await jcFetch<{ results?: JcUser[]; totalCount?: number }>("/systemusers?limit=1");
  if (!r.ok) return { success: false, message: r.error || "JumpCloud unreachable" };
  return { success: true, message: "JumpCloud API connected" };
}

export async function jumpcloudFindUserByEmail(email: string): Promise<JcUser | null> {
  const q = encodeURIComponent(email.trim().toLowerCase());
  const r = await jcFetch<{ results?: JcUser[] }>(`/systemusers?filter=email:eq:${q}&limit=5`);
  if (!r.ok || !r.data?.results?.length) {
    // fallback search
    const r2 = await jcFetch<{ results?: JcUser[] }>(`/systemusers?search=${q}&limit=10`);
    const hit = r2.data?.results?.find((u) => (u.email || "").toLowerCase() === email.trim().toLowerCase());
    return hit || null;
  }
  return r.data.results[0];
}

export async function jumpcloudOnboardUser(input: {
  email: string;
  firstName?: string;
  lastName?: string;
  username?: string;
}): Promise<{ success: boolean; userId?: string; created?: boolean; message: string; user?: JcUser }> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { success: false, message: "email required" };
  if (!jumpcloudConfigured()) return { success: false, message: "JUMPCLOUD_API_KEY not configured" };

  const existing = await jumpcloudFindUserByEmail(email);
  if (existing?.id) {
    if (existing.suspended) {
      const unsuspend = await jcFetch<JcUser>(`/systemusers/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({ suspended: false }),
      });
      if (!unsuspend.ok) return { success: false, message: unsuspend.error || "Failed to unsuspend user" };
      return {
        success: true,
        userId: existing.id,
        created: false,
        message: "Existing JumpCloud user unsuspended (re-onboard)",
        user: unsuspend.data || existing,
      };
    }
    return {
      success: true,
      userId: existing.id,
      created: false,
      message: "JumpCloud user already exists",
      user: existing,
    };
  }

  const username =
    (input.username || email.split("@")[0] || "user")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .slice(0, 30) || "user";

  const body = {
    email,
    username,
    firstname: input.firstName || "",
    lastname: input.lastName || "",
    activated: true,
    password_never_expires: false,
  };

  const created = await jcFetch<JcUser>("/systemusers", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!created.ok) {
    return { success: false, message: created.error || "JumpCloud create user failed" };
  }
  return {
    success: true,
    userId: created.data?.id,
    created: true,
    message: "JumpCloud user created",
    user: created.data,
  };
}

export async function jumpcloudOffboardUser(input: {
  email: string;
  deleteUser?: boolean;
}): Promise<{ success: boolean; userId?: string; action?: string; message: string }> {
  const email = input.email.trim().toLowerCase();
  if (!email) return { success: false, message: "email required" };
  if (!jumpcloudConfigured()) return { success: false, message: "JUMPCLOUD_API_KEY not configured" };

  const existing = await jumpcloudFindUserByEmail(email);
  if (!existing?.id) {
    return { success: true, action: "noop", message: "No JumpCloud user found for email (already offboarded)" };
  }

  if (input.deleteUser) {
    const del = await jcFetch(`/systemusers/${existing.id}`, { method: "DELETE" });
    if (!del.ok) return { success: false, userId: existing.id, message: del.error || "Delete failed" };
    return { success: true, userId: existing.id, action: "deleted", message: "JumpCloud user deleted" };
  }

  const suspend = await jcFetch<JcUser>(`/systemusers/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify({ suspended: true }),
  });
  if (!suspend.ok) return { success: false, userId: existing.id, message: suspend.error || "Suspend failed" };
  return { success: true, userId: existing.id, action: "suspended", message: "JumpCloud user suspended" };
}

/* ------------------------------------------------------------------
 * Software Management (License Patch Bay). JumpCloud installs Windows apps
 * through Chocolatey: a software app names the package, and is bound to
 * machines or machine groups. `orgId` targets one client org from DE's MSP
 * key; null uses JUMPCLOUD_ORG_ID / the key's own org.
 * ------------------------------------------------------------------ */

type JcSoftwareApp = { id: string; displayName?: string; settings?: Array<{ packageId?: string; packageManager?: string }> };

/** The org's Chocolatey software app for a package, created if it does not exist yet. */
export async function jumpcloudEnsureChocoApp(
  displayName: string,
  packageId: string,
  orgId: string | null,
): Promise<{ ok: boolean; id?: string; error?: string; created?: boolean }> {
  const list = await jcFetch<JcSoftwareApp[]>("/v2/softwareapps?limit=100", undefined, orgId);
  if (!list.ok) return { ok: false, error: list.error };
  const found = (Array.isArray(list.data) ? list.data : []).find((app) =>
    (app.settings || []).some(
      (s) => (s.packageId || "").toLowerCase() === packageId.toLowerCase() && (s.packageManager || "").toUpperCase() === "CHOCOLATEY",
    ),
  );
  if (found) return { ok: true, id: found.id, created: false };
  const created = await jcFetch<JcSoftwareApp>(
    "/v2/softwareapps",
    {
      method: "POST",
      body: JSON.stringify({ displayName, settings: [{ packageId, packageManager: "CHOCOLATEY", autoUpdate: false }] }),
    },
    orgId,
  );
  if (!created.ok || !created.data?.id) return { ok: false, error: created.error || "JumpCloud did not return an app id" };
  return { ok: true, id: created.data.id, created: true };
}

/** Bind a software app to a machine group or a single machine (an existing binding is not an error). */
export async function jumpcloudAssociateSoftware(
  appId: string,
  target: { type: "system_group" | "system"; id: string },
  orgId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const r = await jcFetch(
    `/v2/softwareapps/${encodeURIComponent(appId)}/associations`,
    { method: "POST", body: JSON.stringify({ op: "add", type: target.type, id: target.id }) },
    orgId,
  );
  if (r.ok || r.status === 409) return { ok: true };
  return { ok: false, error: r.error };
}

/** A JumpCloud machine by hostname (or display name), within the org. */
export async function jumpcloudFindSystem(name: string, orgId: string | null): Promise<{ ok: boolean; id?: string; error?: string }> {
  for (const field of ["hostname", "displayName"]) {
    const r = await jcFetch<{ results?: Array<{ _id?: string; id?: string }> }>(
      `/systems?limit=2&filter=${encodeURIComponent(`${field}:$eq:${name}`)}`,
      undefined,
      orgId,
    );
    if (!r.ok) return { ok: false, error: r.error };
    const hit = r.data?.results?.[0];
    const id = hit?._id || hit?.id;
    if (id) return { ok: true, id };
  }
  return { ok: false, error: `No JumpCloud machine named ${name}` };
}


/**
 * Unified onboard / offboard orchestration for JumpCloud + Blackpoint Cyber.
 * Records each run for portal admin visibility.
 */
import { randomBytes } from "crypto";
import { sql } from "drizzle-orm";
import { db, dbReady, initPromise } from "./db";
import {
  jumpcloudConfigured,
  jumpcloudOffboardUser,
  jumpcloudOnboardUser,
  jumpcloudTestConnection,
} from "./integrations/jumpcloud";
import {
  blackpointConfigured,
  blackpointOffboardPackage,
  blackpointOnboardPackage,
  blackpointTestConnection,
} from "./integrations/blackpoint";

export type LifecycleAction = "onboard" | "offboard";

export type LifecycleEvent = {
  id: string;
  action: LifecycleAction;
  email: string;
  companyName: string | null;
  firstName: string | null;
  lastName: string | null;
  jumpcloud: Record<string, unknown>;
  blackpoint: Record<string, unknown>;
  success: boolean;
  requestedBy: string | null;
  createdAt: string;
};

const memory: LifecycleEvent[] = [];
let schemaReady = false;

function newId(): string {
  return randomBytes(12).toString("hex");
}

async function ensureSchema(): Promise<void> {
  if (schemaReady || !dbReady || !db) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS portal_lifecycle_events (
        id varchar PRIMARY KEY,
        action text NOT NULL,
        email text NOT NULL,
        company_name text,
        first_name text,
        last_name text,
        jumpcloud jsonb DEFAULT '{}'::jsonb,
        blackpoint jsonb DEFAULT '{}'::jsonb,
        success boolean DEFAULT false,
        requested_by text,
        created_at timestamptz DEFAULT now() NOT NULL
      )
    `);
    schemaReady = true;
  } catch (err: any) {
    console.warn("[lifecycle] schema ensure:", err?.message);
  }
}

export async function initLifecycleOrchestrator(): Promise<void> {
  await initPromise;
  await ensureSchema();
}

export async function lifecycleIntegrationStatus() {
  const [jc, bp] = await Promise.all([
    jumpcloudConfigured()
      ? jumpcloudTestConnection()
      : Promise.resolve({ success: false, message: "JUMPCLOUD_API_KEY not configured" }),
    blackpointConfigured()
      ? blackpointTestConnection()
      : Promise.resolve({ success: false, message: "BLACKPOINT_API_KEY not configured" }),
  ]);
  return {
    jumpcloud: { configured: jumpcloudConfigured(), ...jc },
    blackpoint: { configured: blackpointConfigured(), ...bp },
  };
}

export async function runLifecycle(input: {
  action: LifecycleAction;
  email: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  deleteJumpCloudUser?: boolean;
  requestedBy?: string | null;
}): Promise<LifecycleEvent> {
  await ensureSchema();
  const email = input.email.trim().toLowerCase();
  const companyName = (input.companyName || "").trim() || null;

  let jumpcloud: Record<string, unknown> = {};
  let blackpoint: Record<string, unknown> = {};

  if (input.action === "onboard") {
    jumpcloud = await jumpcloudOnboardUser({
      email,
      firstName: input.firstName,
      lastName: input.lastName,
    });
    blackpoint = await blackpointOnboardPackage({
      companyName: companyName || "Unknown",
      email,
      firstName: input.firstName,
      lastName: input.lastName,
    });
  } else {
    jumpcloud = await jumpcloudOffboardUser({
      email,
      deleteUser: !!input.deleteJumpCloudUser,
    });
    blackpoint = await blackpointOffboardPackage({
      companyName: companyName || "Unknown",
      email,
    });
  }

  const jcOk = jumpcloud.success !== false || !jumpcloudConfigured();
  const bpOk = blackpoint.success !== false || !blackpointConfigured();
  // Fail only if a configured integration hard-failed
  const success =
    (jumpcloudConfigured() ? !!jumpcloud.success : true) &&
    (blackpointConfigured() ? !!blackpoint.success : true);

  const event: LifecycleEvent = {
    id: newId(),
    action: input.action,
    email,
    companyName,
    firstName: input.firstName || null,
    lastName: input.lastName || null,
    jumpcloud,
    blackpoint,
    success,
    requestedBy: input.requestedBy || null,
    createdAt: new Date().toISOString(),
  };

  memory.unshift(event);
  if (memory.length > 500) memory.length = 500;

  if (dbReady && db && schemaReady) {
    try {
      await db.execute(sql`
        INSERT INTO portal_lifecycle_events
          (id, action, email, company_name, first_name, last_name, jumpcloud, blackpoint, success, requested_by, created_at)
        VALUES (
          ${event.id},
          ${event.action},
          ${event.email},
          ${event.companyName},
          ${event.firstName},
          ${event.lastName},
          ${JSON.stringify(event.jumpcloud)}::jsonb,
          ${JSON.stringify(event.blackpoint)}::jsonb,
          ${event.success},
          ${event.requestedBy},
          ${event.createdAt}::timestamptz
        )
      `);
    } catch (err: any) {
      console.warn("[lifecycle] insert failed:", err?.message);
    }
  }

  void jcOk;
  void bpOk;
  return event;
}

export async function listLifecycleEvents(limit = 50): Promise<LifecycleEvent[]> {
  await ensureSchema();
  if (dbReady && db && schemaReady) {
    try {
      const rows = await db.execute(sql`
        SELECT * FROM portal_lifecycle_events
        ORDER BY created_at DESC
        LIMIT ${Math.min(limit, 200)}
      `);
      const list = (rows as any).rows || rows;
      return (list as any[]).map((r) => ({
        id: r.id,
        action: r.action,
        email: r.email,
        companyName: r.company_name,
        firstName: r.first_name,
        lastName: r.last_name,
        jumpcloud: typeof r.jumpcloud === "string" ? JSON.parse(r.jumpcloud) : r.jumpcloud || {},
        blackpoint: typeof r.blackpoint === "string" ? JSON.parse(r.blackpoint) : r.blackpoint || {},
        success: !!r.success,
        requestedBy: r.requested_by,
        createdAt: new Date(r.created_at).toISOString(),
      }));
    } catch (err: any) {
      console.warn("[lifecycle] list failed:", err?.message);
    }
  }
  return memory.slice(0, limit);
}

/** Latest lifecycle run per email (lower-cased), for profile provisioning status. */
export async function latestLifecycleByEmail(emails: string[]): Promise<Map<string, LifecycleEvent>> {
  const wanted = Array.from(new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))).slice(0, 500);
  const out = new Map<string, LifecycleEvent>();
  if (!wanted.length) return out;
  await ensureSchema();
  if (dbReady && db && schemaReady) {
    try {
      const rows = await db.execute(sql`
        SELECT DISTINCT ON (email) * FROM portal_lifecycle_events
        WHERE email IN (${sql.join(wanted.map((e) => sql`${e}`), sql`, `)})
        ORDER BY email, created_at DESC
      `);
      const list = (rows as any).rows || rows;
      for (const r of list as any[]) {
        out.set(r.email, {
          id: r.id,
          action: r.action,
          email: r.email,
          companyName: r.company_name,
          firstName: r.first_name,
          lastName: r.last_name,
          jumpcloud: typeof r.jumpcloud === "string" ? JSON.parse(r.jumpcloud) : r.jumpcloud || {},
          blackpoint: typeof r.blackpoint === "string" ? JSON.parse(r.blackpoint) : r.blackpoint || {},
          success: !!r.success,
          requestedBy: r.requested_by,
          createdAt: new Date(r.created_at).toISOString(),
        });
      }
      return out;
    } catch (err: any) {
      console.warn("[lifecycle] latest-by-email failed:", err?.message);
    }
  }
  // memory is newest first, so the first hit per email is the latest
  for (const ev of memory) {
    if (wanted.includes(ev.email) && !out.has(ev.email)) out.set(ev.email, ev);
  }
  return out;
}

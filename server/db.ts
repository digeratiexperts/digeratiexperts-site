import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";
import { poolOptions } from "./dbPoolOptions";

neonConfig.webSocketConstructor = ws;

let pool: NeonPool | PgPool | null = null;
let db: any = null;
let dbReady = false;
let initAttempted = false;
let dbType: 'neon' | 'postgresql' | 'memory' = 'memory';
/** The connect attempt in flight (boot or reconnect), so nothing else touches the pool it is building. */
let initInFlight: Promise<boolean> | null = null;

process.on('unhandledRejection', (reason) => {
  if (String(reason).includes('endpoint has been disabled') || 
      String(reason).includes('Connection terminated') ||
      String(reason).includes('connection to server')) {
    console.log('⚠️ Database connection error handled (non-fatal)');
    return;
  }
});

function isNeonDatabase(url: string): boolean {
  return url.includes('neon.tech') || url.includes('neon.com');
}

async function initDb(): Promise<boolean> {
  if (initAttempted) return dbReady;
  initAttempted = true;
  const attempt = connectAtStart();
  initInFlight = attempt;
  try {
    return await attempt;
  } finally {
    if (initInFlight === attempt) initInFlight = null;
  }
}

async function connectAtStart(): Promise<boolean> {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log("⚠️ DATABASE_URL not set - running in memory-only mode");
    dbType = 'memory';
    return false;
  }

  const isNeon = isNeonDatabase(databaseUrl);
  
  return new Promise((resolve) => {
    // Every step below checks that the module still holds the pool this
    // attempt created. The 8 s timer, markDatabaseDown() and a later attempt
    // can all replace or drop `pool` while connect() is pending; a late
    // success must not build `db` on someone else's pool (or on null) and
    // flip dbReady for a connection nobody keeps.
    let created: NeonPool | PgPool | null = null;
    const stillOurs = () => created !== null && pool === created;

    const timeout = setTimeout(() => {
      console.log("⚠️ Database connection timeout - using in-memory storage");
      if (stillOurs()) {
        pool!.end().catch(() => {});
        pool = null;
      }
      dbType = 'memory';
      resolve(false);
    }, 8000);

    try {
      if (isNeon) {
        created = new NeonPool(poolOptions(databaseUrl, "neon"));
      } else {
        created = new PgPool(poolOptions(databaseUrl, "postgresql"));
      }
      pool = created;
      
      (created as any).on('error', (err: Error) => {
        const errMsg = String(err.message);
        if (!errMsg.includes('endpoint has been disabled') && 
            !errMsg.includes('Connection terminated')) {
          console.log('⚠️ Database pool error:', err.message);
        }
      });
      
      created.connect()
        .then((client: any) => {
          return client.query('SELECT 1').then(() => {
            client.release();
            clearTimeout(timeout);

            if (!stillOurs()) {
              console.log("⚠️ Database connected after this attempt was abandoned; discarding that pool");
              created!.end().catch(() => {});
              resolve(false);
              return;
            }
            
            if (isNeon) {
              db = drizzleNeon({ client: created as NeonPool, schema });
              dbType = 'neon';
            } else {
              db = drizzlePg({ client: created as PgPool, schema });
              dbType = 'postgresql';
            }
            
            dbReady = true;
            console.log(`✅ Database connected successfully (${dbType})`);
            resolve(true);
          });
        })
        .catch((error: Error) => {
          clearTimeout(timeout);
          console.log("⚠️ Database connection failed:", error.message);
          if (stillOurs()) {
            pool!.end().catch(() => {});
            pool = null;
          }
          dbType = 'memory';
          resolve(false);
        });
    } catch (error: any) {
      clearTimeout(timeout);
      console.log("⚠️ Database initialization error:", error.message);
      dbType = 'memory';
      resolve(false);
    }
  });
}

export function getDatabaseStatus(): { connected: boolean; type: string } {
  return {
    connected: dbReady,
    type: dbType
  };
}

const initPromise = initDb();

let reconnecting: Promise<boolean> | null = null;
let lastReconnectAt = 0;
const RECONNECT_COOLDOWN_MS = 10_000;

/**
 * Re-attempt the database connection after a failed boot or a dropped pool (#248),
 * so durable storage can recover without a process restart. Throttled; callers
 * share one in-flight attempt. The exported `db`/`dbReady` bindings are live.
 */
export async function reconnectDatabase(): Promise<boolean> {
  if (dbReady) return true;
  if (!process.env.DATABASE_URL) return false;
  if (reconnecting) return reconnecting;
  // The boot-time connect is still running: join it rather than start a
  // second pool beside it.
  if (initInFlight) return initInFlight;
  if (Date.now() - lastReconnectAt < RECONNECT_COOLDOWN_MS) return false;
  lastReconnectAt = Date.now();
  initAttempted = false;
  reconnecting = initDb().finally(() => {
    reconnecting = null;
  });
  return reconnecting;
}

/**
 * A pool that connected at boot and then lost Postgres (Neon compute gone,
 * network dropped, "endpoint has been disabled") kept dbReady = true for the
 * life of the process, so reconnectDatabase() answered true without doing
 * anything and nothing ever rebuilt the pool. /healthz sat at 503 and
 * /api/health hung on the dead pool for nine hours on 2026-10-20 until a
 * deploy restarted the process. This drops the dead pool and returns the
 * module to its boot-failure state, which storage already handles, so the
 * next throttled reconnectDatabase() rebuilds it.
 */
export function markDatabaseDown(reason: string): void {
  if (initInFlight) {
    // A connect attempt is building the pool right now (boot, or the probe's
    // reconnect). Ending it here would leave that attempt to finish on a
    // dropped pool: dbReady true, pool null, db bound to nothing (the state
    // the 2026-10-20 review traced). The attempt settles the state itself.
    console.log(`⚠️ Database reported down (${reason}) while a connect is in flight; leaving that attempt to settle`);
    return;
  }
  if (!pool && !dbReady) return;
  console.log(`⚠️ Database marked down (${reason}); will reconnect`);
  const dead = pool;
  pool = null;
  db = null;
  dbReady = false;
  dbType = 'memory';
  initAttempted = false;
  dead?.end().catch(() => {});
}

export { pool, db, dbReady, initPromise, initAttempted, dbType };

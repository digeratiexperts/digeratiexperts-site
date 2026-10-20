import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

let pool: NeonPool | PgPool | null = null;
let db: any = null;
let dbReady = false;
let initAttempted = false;
let dbType: 'neon' | 'postgresql' | 'memory' = 'memory';

/**
 * Every statement gets a deadline, client-side (pg `query_timeout`) and
 * server-side (`statement_timeout`). Without one, a query on a socket the
 * database has silently dropped waits forever, and so does every request
 * behind it: on 2026-10-20 /api/health and /api/zoho/desk/status hung for
 * hours while /healthz answered 503 (#657).
 */
export const DB_QUERY_TIMEOUT_MS = 15_000;

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
  
  const databaseUrl = process.env.DATABASE_URL;
  
  if (!databaseUrl) {
    console.log("⚠️ DATABASE_URL not set - running in memory-only mode");
    dbType = 'memory';
    return false;
  }

  const isNeon = isNeonDatabase(databaseUrl);
  
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      console.log("⚠️ Database connection timeout - using in-memory storage");
      if (pool) {
        pool.end().catch(() => {});
        pool = null;
      }
      dbType = 'memory';
      resolve(false);
    }, 8000);

    try {
      if (isNeon) {
        pool = new NeonPool({
          connectionString: databaseUrl,
          connectionTimeoutMillis: 10000,
          query_timeout: DB_QUERY_TIMEOUT_MS,
          statement_timeout: DB_QUERY_TIMEOUT_MS,
          max: 5,
        });
      } else {
        pool = new PgPool({
          connectionString: databaseUrl,
          connectionTimeoutMillis: 10000,
          query_timeout: DB_QUERY_TIMEOUT_MS,
          statement_timeout: DB_QUERY_TIMEOUT_MS,
          max: 5,
          idleTimeoutMillis: 30000,
        });
      }
      
      (pool as any).on('error', (err: Error) => {
        const errMsg = String(err.message);
        if (!errMsg.includes('endpoint has been disabled') && 
            !errMsg.includes('Connection terminated')) {
          console.log('⚠️ Database pool error:', err.message);
        }
      });
      
      pool.connect()
        .then((client: any) => {
          return client.query('SELECT 1').then(() => {
            client.release();
            clearTimeout(timeout);
            
            if (isNeon) {
              db = drizzleNeon({ client: pool as NeonPool, schema });
              dbType = 'neon';
            } else {
              db = drizzlePg({ client: pool as PgPool, schema });
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
          if (pool) {
            pool.end().catch(() => {});
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

/**
 * Forget a pool that exists but no longer answers, so the next health probe
 * opens a fresh connection (reconnectDatabase, throttled) instead of trusting
 * dead sockets. `dbReady` is only ever set at a successful connect, so before
 * this a database that dropped out from under a running process left the
 * process believing it was connected: token-store reads hung on the dead
 * pool while /healthz reported 503 for good (#657, 2026-10-20). Callers that
 * observed the failure (the health probe, the Zoho token store) invoke it;
 * routine idle-connection errors from the pool do not, because the pool
 * already discards those clients on its own.
 */
export function markDatabaseDown(reason: string): void {
  if (!pool && !dbReady) return;
  console.warn(`⚠️ Database marked unavailable (${reason}); will reconnect on the next probe`);
  const dead = pool;
  pool = null;
  dbReady = false;
  dbType = 'memory';
  if (dead) dead.end().catch(() => {});
}

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
  if (Date.now() - lastReconnectAt < RECONNECT_COOLDOWN_MS) return false;
  lastReconnectAt = Date.now();
  initAttempted = false;
  reconnecting = initDb().finally(() => {
    reconnecting = null;
  });
  return reconnecting;
}

export { pool, db, dbReady, initPromise, initAttempted, dbType };

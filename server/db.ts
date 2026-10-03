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
          max: 5,
        });
      } else {
        pool = new PgPool({ 
          connectionString: databaseUrl,
          connectionTimeoutMillis: 10000,
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

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("DATABASE_URL is required to run migrations");

const directory = path.resolve(process.cwd(), "migrations");
const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
const client = new pg.Client({ connectionString: databaseUrl });

await client.connect();
try {
  await client.query("SELECT pg_advisory_lock($1)", [1939745471]);
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);

  for (const name of files) {
    const sql = await readFile(path.join(directory, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM schema_migrations WHERE name = $1", [name]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration ${name} has changed; refusing to continue`);
      }
      console.log(`[migrate] already applied: ${name}`);
      continue;
    }

    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)", [name, checksum]);
      await client.query("COMMIT");
      console.log(`[migrate] applied: ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.query("SELECT pg_advisory_unlock($1)", [1939745471]).catch(() => undefined);
  await client.end();
}

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  assertAppliedChecksum,
  buildMigrationPlan,
  migrationChecksum,
  orderedMigrationNames,
} from "./migration-plan.mjs";

const { Client } = pg;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDirectory = path.join(root, "migrations");
const databaseUrl = String(process.env.DATABASE_URL || "").trim();
const planOnly = process.argv.includes("--plan");
const reportPath = String(process.env.MIGRATION_REPORT_PATH || "").trim();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to apply production migrations");
}

const client = new Client({ connectionString: databaseUrl });
const lockName = "digeratiexperts-site:production-migrations";

async function main() {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const names = orderedMigrationNames(await readdir(migrationsDirectory));
    if (names.length === 0) throw new Error("No numbered SQL migrations were found");

    const appliedRows = await client.query(
      "SELECT name, checksum FROM app_schema_migrations ORDER BY name",
    );
    const appliedChecksums = new Map(
      appliedRows.rows.map((row) => [String(row.name), String(row.checksum)]),
    );
    for (const name of names) {
      const sqlText = await readFile(path.join(migrationsDirectory, name), "utf8");
      assertAppliedChecksum(name, migrationChecksum(sqlText), appliedChecksums.get(name) || null);
    }

    const plan = buildMigrationPlan(names, [...appliedChecksums.keys()]);
    const report = {
      ...plan,
      mode: planOnly ? "plan" : "apply",
      appliedDuringRun: [],
      generatedAt: new Date().toISOString(),
    };
    const writeReport = async () => {
      if (reportPath) await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    };

    await writeReport();
    console.log(`[migration] pending ${plan.pending.length}; forward-only ${plan.forwardOnlyPending.length}`);
    if (planOnly) return;

    for (const name of plan.pending) {
      const sqlText = await readFile(path.join(migrationsDirectory, name), "utf8");
      const checksum = migrationChecksum(sqlText);

      console.log(`[migration] applying ${name}`);
      await client.query("BEGIN");
      try {
        await client.query("SET LOCAL lock_timeout = '15s'");
        await client.query("SET LOCAL statement_timeout = '5min'");
        await client.query(sqlText);
        await client.query(
          "INSERT INTO app_schema_migrations (name, checksum) VALUES ($1, $2)",
          [name, checksum],
        );
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK").catch(() => undefined);
        throw error;
      }
      report.appliedDuringRun.push(name);
      await writeReport();
      console.log(`[migration] applied ${name}`);
    }

    const applied = await client.query(
      "SELECT name FROM app_schema_migrations ORDER BY name",
    );
    const appliedNames = new Set(applied.rows.map((row) => String(row.name)));
    const missing = names.filter((name) => !appliedNames.has(name));
    if (missing.length) throw new Error(`Migration verification failed: ${missing.join(", ")}`);
    report.mode = "applied";
    await writeReport();
    console.log(`[migration] verified ${names.length} migration(s)`);
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]).catch(() => undefined);
    await client.end();
  }
}

main().catch((error) => {
  console.error("[migration] failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

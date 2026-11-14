import { createHash } from "node:crypto";

const MIGRATION_NAME = /^\d{4}_[a-z0-9][a-z0-9_-]*\.sql$/;
const FORWARD_ONLY_MIGRATIONS = new Set([
  "0003_zoho_payment_integrity.sql",
]);

export function migrationChecksum(sqlText) {
  return createHash("sha256").update(sqlText, "utf8").digest("hex");
}

export function orderedMigrationNames(names) {
  const migrations = names.filter((name) => name.endsWith(".sql"));
  const invalid = migrations.filter((name) => !MIGRATION_NAME.test(name));
  if (invalid.length) {
    throw new Error(`Invalid migration filename(s): ${invalid.join(", ")}`);
  }

  const ordered = [...migrations].sort((left, right) => left.localeCompare(right));
  const prefixes = new Set();
  for (const name of ordered) {
    const prefix = name.slice(0, 4);
    if (prefixes.has(prefix)) throw new Error(`Duplicate migration sequence: ${prefix}`);
    prefixes.add(prefix);
  }
  return ordered;
}

export function assertAppliedChecksum(name, expectedChecksum, appliedChecksum) {
  if (appliedChecksum && appliedChecksum !== expectedChecksum) {
    throw new Error(
      `Applied migration ${name} has changed (database=${appliedChecksum}, release=${expectedChecksum})`,
    );
  }
}

export function buildMigrationPlan(names, appliedNames) {
  const ordered = orderedMigrationNames(names);
  const applied = new Set(appliedNames);
  const pending = ordered.filter((name) => !applied.has(name));
  const forwardOnlyPending = pending.filter((name) => FORWARD_ONLY_MIGRATIONS.has(name));

  return {
    migrations: ordered,
    pending,
    forwardOnlyPending,
    requiresMaintenance: forwardOnlyPending.length > 0,
  };
}

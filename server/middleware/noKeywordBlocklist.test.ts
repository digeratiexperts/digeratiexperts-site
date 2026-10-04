import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import * as security from "./security";

/**
 * A keyword blocklist once sat in this module, unused: a `validateInput` that
 * rejected any request body containing "and", "or", ";" or "--". Wired into a
 * route it would have refused "Smith and Sons", "backup or recovery" and most
 * sentences a client types, while adding nothing over parameterised queries.
 * It was removed; these tests keep it from coming back.
 */
const SERVER = resolve(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules") return [];
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : [];
  });
}

describe("no plain-English keyword blocklist on request bodies", () => {
  it("the security middleware no longer exports the keyword validateInput", () => {
    expect("validateInput" in security).toBe(false);
  });

  it("no server code matches request text against AND / OR / SELECT word lists", () => {
    const offenders = sourceFiles(SERVER).filter((file) =>
      /\\bOR\\b|\\bAND\\b|\\bSELECT\\b|\\bUNION\\b/.test(readFileSync(file, "utf8")),
    );
    expect(offenders.map((f) => relative(SERVER, f))).toEqual([]);
  });
});

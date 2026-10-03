import { useEffect, useState } from "react";
import { readSolutionDraft, SOLUTION_DRAFT_EVENT } from "@/lib/solutionDraft";
import { parseEnvironment, type EnvironmentCounts } from "./V4EnvironmentMap";

const EMPTY: EnvironmentCounts = { users: 0, devices: 0, sites: 0 };

/**
 * The visitor's environment as the store's own draft holds it.
 *
 * Chapter 02 writes the draft through client/src/lib/solutionDraft.ts and
 * announces each change on SOLUTION_DRAFT_EVENT. Later chapters (the
 * assessment scope in 03, the return in 10) read it here so the numbers typed
 * once follow the reader down the page — and across tabs, via `storage`.
 */
export function useEnvironmentDraft(): EnvironmentCounts {
  const [env, setEnv] = useState<EnvironmentCounts>(EMPTY);

  useEffect(() => {
    const sync = () => {
      try {
        const d = readSolutionDraft();
        setEnv(
          parseEnvironment(
            d.environment.userCount,
            d.environment.workstationCount,
            d.environment.siteCount,
          ),
        );
      } catch {
        // No storage: the chapters fall back to their unsized wording.
      }
    };
    sync();
    window.addEventListener(SOLUTION_DRAFT_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(SOLUTION_DRAFT_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return env;
}

export function environmentStarted(env: EnvironmentCounts): boolean {
  return env.users > 0 || env.devices > 0 || env.sites > 0;
}

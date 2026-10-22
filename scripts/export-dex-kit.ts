// Writes the Dex kit (presence rules, emotions, holiday schedule, geometry) to dex/kit/dex-kit.json for apps
// that cannot import the TypeScript directly. Run after changing anything under client/src/components/mascots/:
//   npx tsx scripts/export-dex-kit.ts
import { writeFileSync } from "node:fs";
import { buildKit } from "../client/src/components/mascots/dexKit";

const out = new URL("../dex/kit/dex-kit.json", import.meta.url);
writeFileSync(out, JSON.stringify(buildKit([2026, 2027, 2028]), null, 2) + "\n");
console.log("wrote dex/kit/dex-kit.json");

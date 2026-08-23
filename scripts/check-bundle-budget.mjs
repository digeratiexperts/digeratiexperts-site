import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const assetsDir = fileURLToPath(new URL("../dist/public/assets/", import.meta.url));
const limits = {
  js: 400 * 1024,
  css: 300 * 1024,
};

const files = readdirSync(assetsDir)
  .filter((name) => name.endsWith(".js") || name.endsWith(".css"))
  .map((name) => ({ name, bytes: statSync(join(assetsDir, name)).size }))
  .sort((a, b) => b.bytes - a.bytes);

const violations = files.filter((file) => {
  const limit = file.name.endsWith(".css") ? limits.css : limits.js;
  return file.bytes > limit;
});

for (const file of files.slice(0, 8)) {
  console.log(`${file.name}: ${(file.bytes / 1024).toFixed(1)} KiB`);
}

if (violations.length) {
  console.error("Bundle budget exceeded:");
  for (const file of violations) {
    const limit = file.name.endsWith(".css") ? limits.css : limits.js;
    console.error(`- ${file.name}: ${(file.bytes / 1024).toFixed(1)} KiB > ${limit / 1024} KiB`);
  }
  process.exit(1);
}

console.log("Bundle budget passed.");

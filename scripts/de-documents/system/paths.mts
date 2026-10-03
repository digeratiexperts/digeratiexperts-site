import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const SYSTEM_ROOT = path.resolve(here, "..");
export const REPO_ROOT = path.resolve(SYSTEM_ROOT, "../..");
export const FONTS_DIR = path.join(SYSTEM_ROOT, "fonts");
export const BRAND_DIR = path.join(REPO_ROOT, "brand");
export const PUBLIC_RESOURCES = path.join(REPO_ROOT, "client/public/assets/resources");

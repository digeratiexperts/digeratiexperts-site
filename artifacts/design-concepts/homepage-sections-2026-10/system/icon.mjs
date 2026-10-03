#!/usr/bin/env node
// Print a Lucide icon as inline SVG from the project's lucide-react package.
//   node system/icon.mjs shield-check            -> <svg ...>...</svg>
//   node system/icon.mjs shield-check 20 "cls"   -> size + class attribute
import fs from 'node:fs';
const [name, size = '24', cls = ''] = process.argv.slice(2);
if (!name) { console.error('usage: icon.mjs <kebab-name> [size] [class]'); process.exit(2); }
const file = `/home/user/digeratiexperts-site/node_modules/lucide-react/dist/esm/icons/${name}.js`;
if (!fs.existsSync(file)) { console.error(`no lucide icon named "${name}"`); process.exit(1); }
const src = fs.readFileSync(file, 'utf8');
const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*?\])\s*\);/);
if (!m) { console.error('could not parse icon file'); process.exit(1); }
const json = m[1].replace(/(\w+):\s/g, '"$1": ');
const nodes = JSON.parse(json);
const body = nodes.map(([tag, attrs]) => `<${tag} ${Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
console.log(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${body}</svg>`);

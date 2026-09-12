import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DE_LOGO_PRIMARY, DE_LOGO_REVERSE, DE_MARK, DE_MARK_TILE } from '@/lib/brandAssets';

const LEGACY_LOGO = 'DE-Logo-new_1762461524794.webp';
const SOURCE_ROOT = path.resolve(process.cwd(), 'client/src');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

describe('Digerati Experts runtime logo authority', () => {
  it('resolves the canonical brand assets from the vector master set', () => {
    for (const asset of [DE_LOGO_PRIMARY, DE_LOGO_REVERSE, DE_MARK, DE_MARK_TILE]) {
      expect(typeof asset).toBe('string');
      expect(asset.length).toBeGreaterThan(0);
    }
  });

  it('does not use the legacy raster logo on current runtime source', () => {
    const offenders = sourceFiles(SOURCE_ROOT)
      .filter((file) => !file.includes(`${path.sep}pages${path.sep}versions${path.sep}`))
      .filter((file) => fs.readFileSync(file, 'utf8').includes(LEGACY_LOGO))
      .map((file) => path.relative(process.cwd(), file));

    expect(offenders).toEqual([]);
  });
});

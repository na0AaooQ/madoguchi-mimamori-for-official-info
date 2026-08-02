import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';

export const repoRoot = path.resolve(import.meta.dirname, '../..');

export async function loadInputs() {
  const inputs = await loadSiteInputs(repoRoot);
  if (inputs.results.length > 0) throw new Error(JSON.stringify(inputs.results));
  return inputs;
}

export async function createSiteRepositoryCopy(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-site-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const relative of [
    'contracts/public/navigation.schema.json',
    'dist/public-data/preview',
    'dist/site/preview',
    'site'
  ]) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await cp(path.join(repoRoot, relative), path.join(root, relative), { recursive: true });
  }
  return root;
}

export async function readJson(root, relative) {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8'));
}

export async function writeJson(root, relative, value) {
  await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
  await writeFile(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);
}

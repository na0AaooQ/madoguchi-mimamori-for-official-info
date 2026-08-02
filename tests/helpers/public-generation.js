import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ARTIFACT_TYPES } from '../../scripts/publication/public-constants.js';
import { loadPreviewInput } from '../../scripts/publication/public-input-loader.js';
import { buildPublicNavigation } from '../../scripts/publication/public-navigation-builder.js';

export const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

export async function createPreviewInput() {
  const loaded = await loadPreviewInput(repoRoot);
  if (loaded.results.length > 0) throw new Error(JSON.stringify(loaded.results));
  return structuredClone(loaded.input);
}

export async function createPreviewArtifacts() {
  const input = await createPreviewInput();
  return Object.fromEntries(
    ['ja', 'en'].map((locale) => {
      const built = buildPublicNavigation(input, {
        locale,
        artifactType: ARTIFACT_TYPES.preview,
        asOf: '2026-08-02'
      });
      if (built.results.length > 0) throw new Error(JSON.stringify(built.results));
      return [locale, built.artifact];
    })
  );
}

export function makeProductionArtifact(artifact) {
  const output = structuredClone(artifact);
  output.artifact_type = 'production';
  output.site.contact_url = 'https://public.example/contact/';
  for (const section of output.sections) {
    for (const card of section.cards) {
      for (const link of card.links) link.destination.url = 'https://public.example/guide/';
    }
  }
  return output;
}

export async function createPublicRepositoryCopy(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-public-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['data', 'schemas', 'contracts']) {
    await cp(path.join(repoRoot, directory), path.join(root, directory), { recursive: true });
  }
  await mkdir(path.join(root, 'tests', 'fixtures', 'public-generation'), { recursive: true });
  await cp(
    path.join(repoRoot, 'tests', 'fixtures', 'public-generation', 'preview'),
    path.join(root, 'tests', 'fixtures', 'public-generation', 'preview'),
    { recursive: true }
  );
  await cp(
    path.join(repoRoot, 'dist', 'public-data', 'preview'),
    path.join(root, 'dist', 'public-data', 'preview'),
    { recursive: true }
  );
  return root;
}

export async function readJson(root, file) {
  return JSON.parse(await readFile(path.join(root, file), 'utf8'));
}

export async function writeJson(root, file, value) {
  await mkdir(path.dirname(path.join(root, file)), { recursive: true });
  await writeFile(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

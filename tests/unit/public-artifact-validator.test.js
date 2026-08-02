import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadPublicSchema,
  validatePublicArtifact,
  validatePublicUrl
} from '../../scripts/publication/public-artifact-validator.js';
import {
  createPreviewArtifacts,
  makeProductionArtifact,
  repoRoot
} from '../helpers/public-generation.js';

const { validate } = await loadPublicSchema(repoRoot);
const previews = await createPreviewArtifacts();

function validateArtifact(artifact, mode = 'preview', locale = artifact.locale) {
  return validatePublicArtifact(artifact, {
    validateSchema: validate,
    file: `dist/public-data/${mode}/${locale}/navigation.json`,
    expectedMode: mode,
    expectedLocale: locale
  });
}

test('accepts Japanese, English, and production public artifacts', () => {
  assert.deepEqual(validateArtifact(previews.ja), []);
  assert.deepEqual(validateArtifact(previews.en), []);
  assert.deepEqual(validateArtifact(makeProductionArtifact(previews.ja), 'production', 'ja'), []);
});

test('accepts empty-card sections and omitted optional fields', () => {
  const artifact = structuredClone(previews.ja);
  delete artifact.sections[0].short_description;
  delete artifact.sections[0].cards[0].region_label;
  delete artifact.sections[0].cards[0].details_label;
  delete artifact.sections[0].cards[0].links[0].public_note;
  delete artifact.sections[0].cards[0].links[0].destination.public_note;
  delete artifact.sections[0].cards[0].links[0].destination.organization.summary;
  assert.deepEqual(validateArtifact(artifact), []);
});

test('accepts a social account with required platform and account ID', () => {
  const artifact = structuredClone(previews.ja);
  const destination = artifact.sections[0].cards[0].links[0].destination;
  Object.assign(destination, {
    source_type: 'social-account',
    content_format: 'social-profile',
    platform: 'x',
    account_id: 'fictional-account'
  });
  assert.deepEqual(validateArtifact(artifact), []);
});

test('Schema and forbidden-key inspection reject management fields and unknown fields', async (t) => {
  const cases = [
    ['unknown', (artifact) => (artifact.unexpected = true), 'PUB-E004'],
    ['display order', (artifact) => (artifact.sections[0].display_order = 1), 'PUB-E004'],
    ['evidence', (artifact) => (artifact.sections[0].cards[0].evidence = []), 'PUB-E004'],
    [
      'publication status',
      (artifact) => (artifact.site.publication_status = 'published'),
      'PUB-E004'
    ],
    [
      'internal note',
      (artifact) => (artifact.sections[0].cards[0].internal_note = 'secret'),
      'PUB-E004'
    ],
    [
      'destination status',
      (artifact) =>
        (artifact.sections[0].cards[0].links[0].destination.destination_status = 'confirmed'),
      'PUB-E004'
    ]
  ];
  for (const [name, mutate, expected] of cases) {
    await t.test(name, () => {
      const artifact = structuredClone(previews.ja);
      mutate(artifact);
      const results = validateArtifact(artifact);
      assert.ok(results.some(({ code }) => code === expected));
      if (name !== 'unknown') assert.ok(results.some(({ code }) => code === 'PUB-E005'));
    });
  }
});

test('Schema rejects invalid IDs, enums, dates, missing fields, and primary absence', async (t) => {
  const cases = [
    ['ID', (artifact) => (artifact.sections[0].id = 'invalid')],
    ['locale', (artifact) => (artifact.locale = 'fr')],
    ['artifact type', (artifact) => (artifact.artifact_type = 'preview')],
    ['date', (artifact) => (artifact.generated_for_date = '2026-02-30')],
    ['required site field', (artifact) => delete artifact.site.site_name],
    ['required card field', (artifact) => delete artifact.sections[0].cards[0].summary],
    ['primary', (artifact) => (artifact.sections[0].cards[0].links[0].role = 'secondary')]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const artifact = structuredClone(previews.ja);
      mutate(artifact);
      assert.ok(validateArtifact(artifact).some(({ code }) => code === 'PUB-E004'));
    });
  }
});

test('English Japanese-only destinations require destination_language_note', () => {
  const artifact = structuredClone(previews.en);
  delete artifact.sections[0].cards[0].links[0].destination.destination_language_note;
  assert.ok(validateArtifact(artifact).some(({ code }) => code === 'PUB-E004'));
});

test('validates URL safety without network or DNS access', async (t) => {
  assert.equal(
    validatePublicUrl('https://example.invalid/path?needed=yes', {
      artifactType: 'fictional-preview'
    }),
    undefined
  );
  const cases = [
    ['HTTP', 'http://public.example/'],
    ['credentials', 'https://user:pass@public.example/'],
    ['fragment', 'https://public.example/path#fragment'],
    ['localhost', 'https://localhost/'],
    ['loopback IPv4', 'https://127.0.0.1/'],
    ['private 10/8', 'https://10.1.2.3/'],
    ['private 172/12', 'https://172.16.0.1/'],
    ['private 192.168/16', 'https://192.168.1.1/'],
    ['link local IPv4', 'https://169.254.1.1/'],
    ['loopback IPv6', 'https://[::1]/'],
    ['private IPv6', 'https://[fc00::1]/'],
    ['link local IPv6', 'https://[fe80::1]/']
  ];
  for (const [name, url] of cases) {
    await t.test(name, () =>
      assert.notEqual(validatePublicUrl(url, { artifactType: 'fictional-preview' }), undefined)
    );
  }
  assert.notEqual(
    validatePublicUrl('https://example.invalid/', { artifactType: 'production' }),
    undefined
  );
});

test('detects artifact type and locale path mismatches', () => {
  assert.ok(
    validateArtifact(previews.ja, 'production', 'ja').some(({ code }) => code === 'PUB-E004')
  );
  assert.ok(validateArtifact(previews.ja, 'preview', 'en').some(({ code }) => code === 'PUB-E004'));
});

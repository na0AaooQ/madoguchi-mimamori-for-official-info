import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { MANAGEMENT_UNITS } from '../../scripts/import/management-tsv/config.js';
import { createEnvelope, serializeJson } from '../../scripts/import/management-tsv/converter.js';
import { validateCandidateRepository } from '../../scripts/import/management-tsv/repository-validator.js';
import { createPublishedNavigationCardData } from '../helpers/navigation-card-data.js';
import { createRepositoryCopy } from '../helpers/management-tsv.js';

const inputKeys = {
  regions: 'regions',
  organizations: 'organizations',
  sources: 'sources',
  evidence: 'evidence',
  cards: 'cards',
  'card-source-links': 'cardSourceLinks'
};

async function candidatesFrom(input) {
  const candidates = new Map();
  for (const unit of MANAGEMENT_UNITS) {
    const key = inputKeys[unit.key];
    for (const scope of ['core', 'ja', 'en']) {
      const records = scope === 'core' ? input.core[key] : input.locales[scope][key];
      candidates.set(
        unit.outputPaths[scope],
        await serializeJson(createEnvelope(records, '2026-08-04'))
      );
    }
  }
  return candidates;
}

async function preparePublishedSections(root, input) {
  for (const [scope, records] of [
    ['core', input.core.sections],
    ['ja', input.locales.ja.sections],
    ['en', input.locales.en.sections]
  ]) {
    const relativePath =
      scope === 'core' ? 'data/core/sections.json' : `data/locales/${scope}/sections.json`;
    await writeFile(
      path.join(root, relativePath),
      await serializeJson(createEnvelope(records, '2026-08-04'))
    );
  }
}

async function validateInput(root, input) {
  return validateCandidateRepository({
    repoRoot: root,
    candidates: await candidatesFrom(input),
    locationsByUnit: new Map()
  });
}

function hasCode(execution, code) {
  return execution.results.some((result) => result.code === code);
}

test('reuses the complete existing repository validation for published candidates', async (t) => {
  const root = await createRepositoryCopy(t);
  const input = createPublishedNavigationCardData();
  await preparePublishedSections(root, input);
  const execution = await validateInput(root, input);
  assert.equal(execution.runtimeFailure, false);
  assert.equal(
    execution.results.some(({ severity }) => severity === 'error'),
    false
  );
});

test('surfaces existing Schema and semantic failures from candidate JSON', async (t) => {
  const cases = [
    [
      'Schema violation',
      (input) => (input.core.organizations[0].organization_type = 'unknown'),
      'E002'
    ],
    ['Core and locale ID mismatch', (input) => (input.locales.ja.organizations = []), 'E012'],
    ['broken reference', (input) => (input.core.cards[0].section_id = 'section-missing'), 'E005'],
    [
      'published Core with draft locale',
      (input) => (input.locales.en.regions[0].locale_status = 'draft'),
      'E014'
    ],
    [
      'published locale without content_reviewed_on',
      (input) => delete input.locales.en.cards[0].content_reviewed_on,
      'E002'
    ],
    [
      'English revision mismatch',
      (input) => (input.locales.en.cards[0].based_on_ja_revision = 2),
      'E004'
    ],
    [
      'published evidence not confirmed',
      (input) => (input.core.evidence[0].status = 'needs-review'),
      'E002'
    ],
    [
      'published source lacks confirmation state',
      (input) => (input.core.sources[0].destination_status = 'needs-review'),
      'E002'
    ],
    [
      'official organization evidence missing',
      (input) =>
        (input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-organization-official'
        )),
      'E015'
    ],
    [
      'official Japanese name evidence missing',
      (input) =>
        (input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-organization-name-ja'
        )),
      'E015'
    ],
    [
      'official source evidence missing',
      (input) =>
        (input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-source-official-page'
        )),
      'E015'
    ],
    [
      'official English name evidence missing',
      (input) => {
        input.locales.en.organizations[0].official_name = 'Example Prefecture Office';
        input.locales.en.organizations[0].name_kind = 'official-en';
      },
      'E015'
    ],
    [
      'published card has no primary destination',
      (input) => (input.core.cardSourceLinks = []),
      'E019'
    ]
  ];

  for (const [name, mutate, code] of cases) {
    await t.test(name, async (t) => {
      const root = await createRepositoryCopy(t);
      const input = createPublishedNavigationCardData();
      await preparePublishedSections(root, input);
      mutate(input);
      const execution = await validateInput(root, input);
      assert.ok(hasCode(execution, code), JSON.stringify(execution.results, null, 2));
    });
  }
});

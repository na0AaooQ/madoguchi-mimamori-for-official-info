import assert from 'node:assert/strict';
import test from 'node:test';

import { validateOfficialSourceData } from '../../scripts/validation/official-source-semantic-validator.js';
import {
  createDraftOfficialSourceData,
  createPublishedOfficialSourceData
} from '../helpers/official-source-data.js';

function hasResult(results, code, itemId, field) {
  return results.some(
    (result) =>
      result.code === code &&
      (itemId === undefined || result.item_id === itemId) &&
      (field === undefined || result.field === field)
  );
}

function validateMutation(mutate, { draft = false } = {}) {
  const input = draft ? createDraftOfficialSourceData() : createPublishedOfficialSourceData();
  mutate(input);
  return validateOfficialSourceData(input);
}

test('accepts the complete fictional draft slice without item Info results', () => {
  assert.deepEqual(validateOfficialSourceData(createDraftOfficialSourceData()), []);
});

test('accepts a complete published slice with fallback naming and a Japanese-only destination', () => {
  assert.deepEqual(validateOfficialSourceData(createPublishedOfficialSourceData()), []);
});

test('does not mutate the validation input', () => {
  const input = createPublishedOfficialSourceData();
  const before = structuredClone(input);
  validateOfficialSourceData(input);
  assert.deepEqual(input, before);
});

test('collects duplicate IDs for every implemented management unit', async (t) => {
  for (const unit of ['regions', 'organizations', 'sources', 'evidence']) {
    await t.test(unit, () => {
      const results = validateMutation((input) => {
        input.core[unit].push(structuredClone(input.core[unit][0]));
      });
      assert.ok(hasResult(results, 'E011', inputIdForUnit(unit)));
    });
  }
});

function inputIdForUnit(unit) {
  return {
    regions: 'region-example-country',
    organizations: 'org-example-prefecture-disaster-office',
    sources: 'src-example-prefecture-official-home',
    evidence: 'evidence-example-organization-official'
  }[unit];
}

test('detects broken core references with E005', async (t) => {
  const cases = [
    [
      'region parent',
      (input) => (input.core.regions[1].parent_region_id = 'region-missing'),
      'region-example-prefecture',
      'parent_region_id'
    ],
    [
      'organization region',
      (input) => (input.core.organizations[0].region_ids = ['region-missing']),
      'org-example-prefecture-disaster-office',
      'region_ids'
    ],
    [
      'organization parent',
      (input) => (input.core.organizations[0].parent_organization_id = 'org-missing'),
      'org-example-prefecture-disaster-office',
      'parent_organization_id'
    ],
    [
      'source publisher',
      (input) => (input.core.sources[0].publisher_organization_id = 'org-missing'),
      'src-example-prefecture-official-home',
      'publisher_organization_id'
    ],
    [
      'source related organization',
      (input) => (input.core.sources[0].related_organization_ids = ['org-missing']),
      'src-example-prefecture-official-home',
      'related_organization_ids'
    ],
    [
      'evidence organization target',
      (input) => (input.core.evidence[0].target_id = 'org-missing'),
      'evidence-example-organization-official',
      'target_id'
    ],
    [
      'evidence source target',
      (input) => (input.core.evidence[2].target_id = 'src-missing'),
      'evidence-example-source-official-page',
      'target_id'
    ],
    [
      'evidence disaster target',
      (input) => {
        input.core.evidence[0].target_type = 'disaster';
        input.core.evidence[0].target_id = 'disaster-missing';
        input.core.evidence[0].target_aspect = 'official-name';
        input.core.evidence[0].target_locale = 'ja';
      },
      'evidence-example-organization-official',
      'target_id'
    ],
    [
      'evidence source reference',
      (input) => (input.core.evidence[0].evidence_source_id = 'src-missing'),
      'evidence-example-organization-official',
      'evidence_source_id'
    ]
  ];

  for (const [name, mutate, itemId, field] of cases) {
    await t.test(name, () => {
      const results = validateMutation(mutate);
      assert.ok(hasResult(results, 'E005', itemId, field));
    });
  }
});

test('detects hierarchy self references and region cycles with E016', async (t) => {
  await t.test('region self reference', () => {
    const results = validateMutation(
      (input) => (input.core.regions[1].parent_region_id = 'region-example-prefecture')
    );
    assert.ok(hasResult(results, 'E016', 'region-example-prefecture', 'parent_region_id'));
  });
  await t.test('region cycle', () => {
    const results = validateMutation(
      (input) => (input.core.regions[0].parent_region_id = 'region-example-prefecture')
    );
    assert.ok(results.some(({ code, message }) => code === 'E016' && message.includes('循環')));
  });
  await t.test('organization self reference', () => {
    const results = validateMutation(
      (input) =>
        (input.core.organizations[0].parent_organization_id =
          'org-example-prefecture-disaster-office')
    );
    assert.ok(
      hasResult(results, 'E016', 'org-example-prefecture-disaster-office', 'parent_organization_id')
    );
  });
});

test('enforces core and locale correspondence', async (t) => {
  const cases = [
    [
      'missing Japanese locale',
      (input) => (input.locales.ja.sources = []),
      'E012',
      'src-example-prefecture-official-home'
    ],
    [
      'missing English locale for published core',
      (input) => (input.locales.en.sources = []),
      'E003',
      'src-example-prefecture-official-home'
    ],
    [
      'orphan Japanese locale',
      (input) =>
        input.locales.ja.regions.push({
          id: 'region-orphan',
          name: '孤立',
          locale_status: 'draft',
          content_revision: 1
        }),
      'E012',
      'region-orphan'
    ],
    [
      'orphan English locale',
      (input) =>
        input.locales.en.regions.push({
          id: 'region-orphan',
          name: 'Orphan',
          locale_status: 'draft',
          content_revision: 1,
          based_on_ja_revision: 1
        }),
      'E012',
      'region-orphan'
    ]
  ];

  for (const [name, mutate, code, itemId] of cases) {
    await t.test(name, () => {
      assert.ok(hasResult(validateMutation(mutate), code, itemId));
    });
  }

  await t.test('draft core may omit English locale', () => {
    const results = validateMutation((input) => (input.locales.en.sources = []), { draft: true });
    assert.equal(hasResult(results, 'E003', 'src-example-prefecture-official-home'), false);
    assert.equal(hasResult(results, 'E012', 'src-example-prefecture-official-home'), false);
  });
});

test('enforces locale-specific revision and organization name rules', async (t) => {
  const cases = [
    [
      'Japanese based_on_ja_revision',
      (input) => (input.locales.ja.regions[0].based_on_ja_revision = 1),
      'E013',
      'region-example-country'
    ],
    [
      'missing English based_on_ja_revision',
      (input) => delete input.locales.en.regions[0].based_on_ja_revision,
      'E013',
      'region-example-country'
    ],
    [
      'English revision mismatch',
      (input) => (input.locales.en.regions[0].based_on_ja_revision = 2),
      'E004',
      'region-example-country'
    ],
    [
      'invalid Japanese organization name kind',
      (input) => (input.locales.ja.organizations[0].name_kind = 'official-en'),
      'E013',
      'org-example-prefecture-disaster-office'
    ],
    [
      'invalid English organization name kind',
      (input) => (input.locales.en.organizations[0].name_kind = 'official-ja'),
      'E013',
      'org-example-prefecture-disaster-office'
    ],
    [
      'fallback name mismatch',
      (input) => (input.locales.en.organizations[0].official_name = 'Different Name'),
      'E013',
      'org-example-prefecture-disaster-office'
    ]
  ];
  for (const [name, mutate, code, itemId] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), code, itemId)));
  }
});

test('requires published official name and official source evidence', async (t) => {
  const cases = [
    [
      'official English name evidence',
      (input) => {
        input.locales.en.organizations[0].name_kind = 'official-en';
        input.locales.en.organizations[0].official_name = 'Official Fictional English Name';
      },
      'org-example-prefecture-disaster-office'
    ],
    [
      'fallback Japanese name evidence',
      (input) => {
        input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-organization-name-ja'
        );
      },
      'org-example-prefecture-disaster-office'
    ],
    [
      'official organization evidence',
      (input) => {
        input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-organization-official'
        );
      },
      'org-example-prefecture-disaster-office'
    ],
    [
      'official page evidence',
      (input) => {
        input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-source-official-page'
        );
      },
      'src-example-prefecture-official-home'
    ]
  ];
  for (const [name, mutate, itemId] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), 'E015', itemId)));
  }
});

test('counts evidence_source_id only when its source is published and confirmed', async (t) => {
  await t.test('accepts a confirmed published evidence source', () => {
    const input = createPublishedOfficialSourceData();
    input.core.evidence[0].evidence_source_id = 'src-example-prefecture-official-home';
    delete input.core.evidence[0].evidence_url;
    assert.deepEqual(validateOfficialSourceData(input), []);
  });
  await t.test('rejects an unconfirmed evidence source', () => {
    const results = validateMutation((input) => {
      input.core.evidence[0].evidence_source_id = 'src-example-prefecture-official-home';
      delete input.core.evidence[0].evidence_url;
      input.core.sources[0].destination_status = 'needs-review';
    });
    assert.ok(
      hasResult(results, 'E015', 'org-example-prefecture-disaster-office', 'publication_status')
    );
  });
});

test('enforces published reference states and destination locale consistency', async (t) => {
  const cases = [
    [
      'published region with draft parent',
      (input) => (input.core.regions[0].publication_status = 'draft'),
      'region-example-prefecture'
    ],
    [
      'published organization with draft region',
      (input) => (input.core.regions[1].publication_status = 'draft'),
      'org-example-prefecture-disaster-office'
    ],
    [
      'published source with draft publisher',
      (input) => (input.core.organizations[0].publication_status = 'draft'),
      'src-example-prefecture-official-home'
    ],
    [
      'published evidence with draft target',
      (input) => (input.core.sources[0].publication_status = 'draft'),
      'evidence-example-source-official-page'
    ],
    [
      'published core with draft locale',
      (input) => (input.locales.en.regions[0].locale_status = 'draft'),
      'region-example-country'
    ],
    [
      'published source with archived publisher',
      (input) => (input.core.organizations[0].publication_status = 'archived'),
      'src-example-prefecture-official-home'
    ]
  ];
  for (const [name, mutate, itemId] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), 'E014', itemId)));
  }

  await t.test('primary home locale must be available at the destination', () => {
    const results = validateMutation(
      (input) => (input.core.sources[0].primary_official_home_for_locales = ['en'])
    );
    assert.ok(
      hasResult(
        results,
        'E014',
        'src-example-prefecture-official-home',
        'primary_official_home_for_locales'
      )
    );
  });
});

test('requires an English note for a published Japanese-only destination', () => {
  const results = validateMutation(
    (input) => delete input.locales.en.sources[0].destination_language_note
  );
  assert.ok(
    hasResult(results, 'E013', 'src-example-prefecture-official-home', 'destination_language_note')
  );
});

test('draft Japanese-only destinations do not require the English note', () => {
  const results = validateMutation(
    (input) => delete input.locales.en.sources[0].destination_language_note,
    { draft: true }
  );
  assert.equal(hasResult(results, 'E013', 'src-example-prefecture-official-home'), false);
});

test('collects multiple problems deterministically and tolerates partial invalid data', () => {
  const input = createPublishedOfficialSourceData();
  input.core.regions[1].parent_region_id = 'region-missing';
  input.core.sources[0].publisher_organization_id = 'org-missing';
  input.locales.en.organizations[0].based_on_ja_revision = 2;
  const first = validateOfficialSourceData(input);
  const second = validateOfficialSourceData(input);
  assert.ok(first.filter(({ severity }) => severity === 'error').length >= 3);
  assert.deepEqual(first, second);
  assert.doesNotThrow(() =>
    validateOfficialSourceData({
      core: { regions: [null, { id: 1 }], organizations: 'invalid' },
      locales: { ja: null, en: { regions: [{ id: 1 }] } }
    })
  );
});

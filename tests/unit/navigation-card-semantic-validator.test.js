import assert from 'node:assert/strict';
import test from 'node:test';

import { validateNavigationCardData } from '../../scripts/validation/navigation-card-semantic-validator.js';
import {
  createDraftNavigationCardData,
  createPublishedNavigationCardData
} from '../helpers/navigation-card-data.js';

function hasResult(results, code, itemId, field) {
  return results.some(
    (result) =>
      result.code === code &&
      (itemId === undefined || result.item_id === itemId) &&
      (field === undefined || result.field === field)
  );
}

function validateMutation(mutate, { draft = false } = {}) {
  const input = draft ? createDraftNavigationCardData() : createPublishedNavigationCardData();
  mutate(input);
  return validateNavigationCardData(input);
}

test('accepts the complete fictional draft and published navigation slices', () => {
  assert.deepEqual(validateNavigationCardData(createDraftNavigationCardData()), []);
  assert.deepEqual(validateNavigationCardData(createPublishedNavigationCardData()), []);
  const withoutCardRegions = createPublishedNavigationCardData();
  delete withoutCardRegions.core.cards[0].region_ids;
  assert.ok(
    hasResult(validateNavigationCardData(withoutCardRegions), 'E020', undefined, 'region_ids')
  );
});

test('validates prefecture URL fields and locale navigation labels', async (t) => {
  const cases = [
    ['uppercase slug', (input) => (input.core.regions[1].region_slug = 'Example'), 'region_slug'],
    [
      'duplicate slug',
      (input) =>
        input.core.regions.push({
          ...input.core.regions[1],
          id: 'region-example-second-prefecture'
        }),
      'region_slug'
    ],
    [
      'non-prefecture slug',
      (input) => (input.core.regions[0].region_slug = 'country'),
      'region_slug'
    ],
    [
      'missing display order',
      (input) => delete input.core.regions[1].display_order,
      'display_order'
    ],
    [
      'missing English navigation label',
      (input) => delete input.locales.en.regions[1].navigation_label,
      'navigation_label'
    ]
  ];
  for (const [name, mutate, field] of cases) {
    await t.test(name, () => {
      const results = validateMutation(mutate);
      assert.ok(hasResult(results, 'E020', undefined, field));
    });
  }
});

test('does not mutate navigation validation input', () => {
  const input = createPublishedNavigationCardData();
  const before = structuredClone(input);
  validateNavigationCardData(input);
  assert.deepEqual(input, before);
});

test('detects duplicate IDs in core and locale navigation units', async (t) => {
  const ids = {
    sections: 'section-public-institutions-disaster',
    cards: 'card-example-disaster-information',
    cardSourceLinks: 'card-source-example-disaster-information-primary'
  };
  for (const unit of ['sections', 'cards', 'cardSourceLinks']) {
    await t.test(`core ${unit}`, () => {
      const results = validateMutation((input) => {
        input.core[unit].push(structuredClone(input.core[unit][0]));
      });
      assert.ok(hasResult(results, 'E011', ids[unit]));
    });
    for (const locale of ['ja', 'en']) {
      await t.test(`${locale} ${unit}`, () => {
        const input = createPublishedNavigationCardData();
        const id = input.locales[locale][unit][0].id;
        input.locales[locale][unit].push(structuredClone(input.locales[locale][unit][0]));
        assert.ok(hasResult(validateNavigationCardData(input), 'E011', id));
      });
    }
  }
});

test('detects broken navigation references with E005', async (t) => {
  const cases = [
    [
      'card section',
      (input) => (input.core.cards[0].section_id = 'section-missing'),
      'card-example-disaster-information',
      'section_id'
    ],
    [
      'card region',
      (input) => (input.core.cards[0].region_ids = ['region-missing']),
      'card-example-disaster-information',
      'region_ids'
    ],
    [
      'link card',
      (input) => (input.core.cardSourceLinks[0].card_id = 'card-missing'),
      'card-source-example-disaster-information-primary',
      'card_id'
    ],
    [
      'link source',
      (input) => (input.core.cardSourceLinks[0].source_id = 'src-missing'),
      'card-source-example-disaster-information-primary',
      'source_id'
    ]
  ];
  for (const [name, mutate, itemId, field] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), 'E005', itemId, field)));
  }
});

test('enforces unique anchors and display order with E017', async (t) => {
  const cases = [
    [
      'section anchor',
      (input) => (input.core.sections[1].anchor_id = input.core.sections[0].anchor_id),
      'anchor_id'
    ],
    [
      'section display order',
      (input) => (input.core.sections[1].display_order = input.core.sections[0].display_order),
      'display_order'
    ],
    [
      'card order in a section',
      (input) => input.core.cards.push({ ...input.core.cards[0], id: 'card-second' }),
      'display_order'
    ],
    [
      'link order on a card',
      (input) =>
        input.core.cardSourceLinks.push({
          ...input.core.cardSourceLinks[0],
          id: 'card-source-second',
          source_id: 'src-second'
        }),
      'display_order'
    ]
  ];
  for (const [name, mutate, field] of cases) {
    await t.test(name, () =>
      assert.ok(hasResult(validateMutation(mutate), 'E017', undefined, field))
    );
  }

  await t.test('archived records may reuse display order', () => {
    const input = createDraftNavigationCardData();
    input.core.sections.push({
      ...input.core.sections[0],
      id: 'section-archived',
      anchor_id: 'archived',
      publication_status: 'archived'
    });
    input.core.cards.push({
      ...input.core.cards[0],
      id: 'card-archived',
      publication_status: 'archived'
    });
    input.core.cardSourceLinks.push({
      ...input.core.cardSourceLinks[0],
      id: 'card-source-archived',
      source_id: 'src-archived',
      publication_status: 'archived'
    });
    assert.equal(hasResult(validateNavigationCardData(input), 'E017'), false);
  });

  await t.test('different sections and cards may reuse display order', () => {
    const input = createDraftNavigationCardData();
    input.core.cards.push({
      ...input.core.cards[0],
      id: 'card-second',
      section_id: input.core.sections[1].id
    });
    input.core.cardSourceLinks.push({
      ...input.core.cardSourceLinks[0],
      id: 'card-source-second',
      card_id: 'card-second',
      source_id: 'src-second'
    });
    assert.equal(hasResult(validateNavigationCardData(input), 'E017'), false);
  });
});

test('detects duplicate card-source pairs and contradictory periods with E018', async (t) => {
  await t.test('duplicate pair', () => {
    const results = validateMutation((input) => {
      input.core.cardSourceLinks.push({
        ...input.core.cardSourceLinks[0],
        id: 'card-source-duplicate',
        display_order: 2
      });
    });
    assert.ok(hasResult(results, 'E018', undefined, 'source_id'));
  });
  for (const field of ['role', 'visibility_context']) {
    await t.test(`duplicate pair with different ${field}`, () => {
      const results = validateMutation((input) => {
        input.core.cardSourceLinks.push({
          ...input.core.cardSourceLinks[0],
          id: `card-source-duplicate-${field.replace('_', '-')}`,
          [field]: field === 'role' ? 'secondary' : 'normal',
          display_order: 2
        });
      });
      assert.ok(hasResult(results, 'E018', undefined, 'source_id'));
    });
  }
  await t.test('end before start', () => {
    const results = validateMutation((input) => {
      Object.assign(input.core.cardSourceLinks[0], {
        site_display_start_on: '2026-08-03',
        site_display_end_on: '2026-08-02'
      });
    });
    assert.ok(hasResult(results, 'E018', undefined, 'site_display_end_on'));
  });
  for (const [name, start, end] of [
    ['start only', '2026-08-02', undefined],
    ['ordered dates', '2026-08-02', '2026-08-03'],
    ['same date', '2026-08-02', '2026-08-02']
  ]) {
    await t.test(name, () => {
      const input = createDraftNavigationCardData();
      input.core.cardSourceLinks[0].site_display_start_on = start;
      if (end) input.core.cardSourceLinks[0].site_display_end_on = end;
      assert.equal(hasResult(validateNavigationCardData(input), 'E018'), false);
    });
  }
  await t.test('invalid dates are left to Schema validation', () => {
    const input = createPublishedNavigationCardData();
    input.core.cardSourceLinks[0].site_display_start_on = 'invalid';
    input.core.cardSourceLinks[0].site_display_end_on = '2026-08-01';
    assert.equal(hasResult(validateNavigationCardData(input), 'E018'), false);
  });
});

test('enforces navigation core and locale correspondence', async (t) => {
  const cases = [
    ['missing Japanese section', (input) => (input.locales.ja.sections = []), 'E012'],
    ['missing English card', (input) => (input.locales.en.cards = []), 'E003'],
    [
      'orphan Japanese card',
      (input) => input.locales.ja.cards.push({ ...input.locales.ja.cards[0], id: 'card-orphan' }),
      'E012'
    ],
    [
      'orphan English link',
      (input) =>
        input.locales.en.cardSourceLinks.push({
          ...input.locales.en.cardSourceLinks[0],
          id: 'card-source-orphan'
        }),
      'E012'
    ],
    [
      'missing required Japanese link locale',
      (input) => (input.locales.ja.cardSourceLinks = []),
      'E012'
    ],
    [
      'missing required English link locale',
      (input) => (input.locales.en.cardSourceLinks = []),
      'E003'
    ]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), code)));
  }
  await t.test('English-only link does not require Japanese link locale', () => {
    const input = createDraftNavigationCardData();
    input.core.cardSourceLinks[0].display_locales = ['en'];
    input.locales.ja.cardSourceLinks = [];
    assert.equal(hasResult(validateNavigationCardData(input), 'E012'), false);
  });
  await t.test('draft core may omit English section and card locales', () => {
    const input = createDraftNavigationCardData();
    input.locales.en.sections = [];
    input.locales.en.cards = [];
    input.core.cardSourceLinks[0].display_locales = ['ja'];
    assert.equal(hasResult(validateNavigationCardData(input), 'E003'), false);
  });
});

test('enforces navigation locale-specific revision rules', async (t) => {
  const cases = [
    [
      'Japanese based_on_ja_revision',
      (input) => (input.locales.ja.sections[0].based_on_ja_revision = 1),
      'E013'
    ],
    [
      'missing English based_on_ja_revision',
      (input) => delete input.locales.en.cards[0].based_on_ja_revision,
      'E013'
    ],
    [
      'English revision mismatch',
      (input) => (input.locales.en.cardSourceLinks[0].based_on_ja_revision = 2),
      'E004'
    ],
    [
      'published link locale without button label',
      (input) => delete input.locales.en.cardSourceLinks[0].button_label,
      'E013'
    ]
  ];
  for (const [name, mutate, code] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), code)));
  }
});

test('enforces published navigation references with E014', async (t) => {
  const cases = [
    ['card section', (input) => (input.core.sections[0].publication_status = 'draft')],
    ['card region', (input) => (input.core.regions[1].publication_status = 'draft')],
    ['link card', (input) => (input.core.cards[0].publication_status = 'draft')],
    ['link source', (input) => (input.core.sources[0].publication_status = 'draft')],
    ['hidden source', (input) => (input.core.sources[0].publication_status = 'hidden')],
    ['archived card', (input) => (input.core.cards[0].publication_status = 'archived')],
    ['draft card locale', (input) => (input.locales.en.cards[0].locale_status = 'draft')],
    ['unsupported locale', (input) => input.core.cardSourceLinks[0].display_locales.push('fr')]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () => assert.ok(hasResult(validateMutation(mutate), 'E014')));
  }
});

test('requires a structurally publishable primary link with E019', async (t) => {
  const cases = [
    ['no links', (input) => (input.core.cardSourceLinks = [])],
    ['secondary only', (input) => (input.core.cardSourceLinks[0].role = 'secondary')],
    [
      'temporary highlight only',
      (input) => (input.core.cardSourceLinks[0].role = 'temporary-highlight')
    ],
    ['draft primary', (input) => (input.core.cardSourceLinks[0].publication_status = 'draft')],
    ['draft source', (input) => (input.core.sources[0].publication_status = 'draft')],
    [
      'unconfirmed source',
      (input) => (input.core.sources[0].official_information_status = 'unconfirmed')
    ],
    [
      'unconfirmed destination',
      (input) => (input.core.sources[0].destination_status = 'needs-review')
    ],
    [
      'missing destination check date',
      (input) => delete input.core.sources[0].destination_checked_on
    ],
    [
      'missing official information check date',
      (input) => delete input.core.sources[0].official_information_checked_on
    ],
    [
      'missing source evidence',
      (input) =>
        (input.core.evidence = input.core.evidence.filter(
          ({ id }) => id !== 'evidence-example-source-official-page'
        ))
    ],
    ['draft publisher', (input) => (input.core.organizations[0].publication_status = 'draft')],
    ['draft organization region', (input) => (input.core.regions[1].publication_status = 'draft')],
    ['draft required card locale', (input) => (input.locales.en.cards[0].locale_status = 'draft')],
    [
      'draft required source locale',
      (input) => (input.locales.en.sources[0].locale_status = 'draft')
    ],
    [
      'draft required link locale',
      (input) => (input.locales.en.cardSourceLinks[0].locale_status = 'draft')
    ],
    ['missing button label', (input) => delete input.locales.en.cardSourceLinks[0].button_label],
    [
      'missing Japanese-only destination note',
      (input) => delete input.locales.en.sources[0].destination_language_note
    ],
    [
      'contradictory display period',
      (input) =>
        Object.assign(input.core.cardSourceLinks[0], {
          site_display_start_on: '2026-08-03',
          site_display_end_on: '2026-08-02'
        })
    ]
  ];
  for (const [name, mutate] of cases) {
    await t.test(name, () =>
      assert.ok(hasResult(validateMutation(mutate), 'E019', 'card-example-disaster-information'))
    );
  }

  await t.test('a broken primary source reference does not add derived E019', () => {
    const results = validateMutation(
      (input) => (input.core.cardSourceLinks[0].source_id = 'src-missing')
    );
    assert.ok(hasResult(results, 'E005'));
    assert.equal(hasResult(results, 'E019'), false);
  });

  await t.test('a Schema-invalid primary does not add derived E019', () => {
    const results = validateMutation((input) => delete input.core.cardSourceLinks[0].display_order);
    assert.equal(hasResult(results, 'E019'), false);
  });
});

test('collects multiple navigation errors deterministically and tolerates partial input', () => {
  const input = createPublishedNavigationCardData();
  input.core.cards[0].section_id = 'section-missing';
  input.core.sections[1].anchor_id = input.core.sections[0].anchor_id;
  input.locales.en.cards[0].based_on_ja_revision = 2;
  const first = validateNavigationCardData(input);
  const second = validateNavigationCardData(input);
  assert.ok(first.filter(({ severity }) => severity === 'error').length >= 3);
  assert.deepEqual(first, second);
  assert.doesNotThrow(() =>
    validateNavigationCardData({
      core: { sections: [null, { id: 1 }], cards: 'invalid' },
      locales: { ja: null, en: { sections: [{ id: 1 }] } }
    })
  );
});

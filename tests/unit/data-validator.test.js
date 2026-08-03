import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { DATA_LAYOUT, SCHEMA_LAYOUT } from '../../scripts/validation/data-layout.js';
import { validateDataRepository } from '../../scripts/validation/data-validator.js';

const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

async function createRepositoryCopy(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-data-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await cp(path.join(repoRoot, 'data'), path.join(directory, 'data'), { recursive: true });
  await cp(path.join(repoRoot, 'schemas'), path.join(directory, 'schemas'), { recursive: true });
  return directory;
}

async function readJson(root, relativePath) {
  return JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));
}

async function writeJson(root, relativePath, value) {
  await writeFile(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

async function updateJson(root, relativePath, update) {
  const value = await readJson(root, relativePath);
  update(value);
  await writeJson(root, relativePath, value);
}

function codes(execution) {
  return {
    validation: execution.results.map(({ code }) => code),
    runtime: execution.runtimeResults.map(({ code }) => code)
  };
}

async function repositoryDigest(root) {
  const hash = createHash('sha256');
  const paths = [
    ...DATA_LAYOUT.map(({ dataPath }) => dataPath),
    ...SCHEMA_LAYOUT.map(({ schemaPath }) => schemaPath)
  ].sort();
  for (const relativePath of paths) {
    hash.update(relativePath);
    hash.update(await readFile(path.join(root, relativePath)));
  }
  return hash.digest('hex');
}

test('validates the production data foundation successfully', async () => {
  const execution = await validateDataRepository(repoRoot);
  assert.deepEqual(execution.runtimeResults, []);
  assert.equal(
    execution.results.some(({ severity }) => severity === 'error'),
    false
  );
  assert.deepEqual(execution.results, []);
});

test('runs the official-source semantic validator for production data files', async (t) => {
  const root = await createRepositoryCopy(t);
  let regionId;
  await updateJson(root, 'data/core/regions.json', (value) => {
    const region = value.items.find(({ parent_region_id: parentRegionId }) => parentRegionId);
    assert.ok(region);
    regionId = region.id;
    region.parent_region_id = 'region-missing';
  });
  const execution = await validateDataRepository(root);
  assert.deepEqual(execution.runtimeResults, []);
  assert.ok(
    execution.results.some(
      ({ code, file, item_id: itemId, field }) =>
        code === 'E005' &&
        file === 'data/core/regions.json' &&
        itemId === regionId &&
        field === 'parent_region_id'
    )
  );
});

test('runs the navigation-card semantic validator for production data files', async (t) => {
  const root = await createRepositoryCopy(t);
  let cardId;
  await updateJson(root, 'data/core/cards.json', (value) => {
    assert.ok(value.items[0]);
    cardId = value.items[0].id;
    value.items[0].section_id = 'section-missing';
  });
  const execution = await validateDataRepository(root);
  assert.deepEqual(execution.runtimeResults, []);
  assert.ok(
    execution.results.some(
      ({ code, file, item_id: itemId, field }) =>
        code === 'E005' &&
        file === 'data/core/cards.json' &&
        itemId === cardId &&
        field === 'section_id'
    )
  );
});

test('detects required and unexpected data layout problems', async (t) => {
  const cases = [
    {
      name: 'missing core file',
      expected: 'E006',
      mutate: (root) => rm(path.join(root, 'data/core/regions.json'))
    },
    {
      name: 'missing Japanese locale file',
      expected: 'E006',
      mutate: (root) => rm(path.join(root, 'data/locales/ja/regions.json'))
    },
    {
      name: 'missing English locale file',
      expected: 'E006',
      mutate: (root) => rm(path.join(root, 'data/locales/en/regions.json'))
    },
    {
      name: 'extra core JSON',
      expected: 'E007',
      mutate: (root) => writeJson(root, 'data/core/extra.json', {})
    },
    {
      name: 'extra locale JSON',
      expected: 'E007',
      mutate: (root) => writeJson(root, 'data/locales/ja/extra.json', {})
    },
    {
      name: 'unsupported locale directory',
      expected: 'E008',
      mutate: async (root) => {
        await mkdir(path.join(root, 'data/locales/fr'));
        await writeJson(root, 'data/locales/fr/site.json', {});
      }
    },
    {
      name: 'Japanese locale check-history',
      expected: 'E009',
      mutate: (root) => writeJson(root, 'data/locales/ja/check-history.json', {})
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (t) => {
      const root = await createRepositoryCopy(t);
      await fixture.mutate(root);
      const execution = await validateDataRepository(root);
      assert.ok(codes(execution).validation.includes(fixture.expected));
    });
  }
});

test('classifies Schema layout problems as runtime failures', async (t) => {
  const cases = [
    {
      name: 'missing core Schema',
      mutate: (root) => rm(path.join(root, 'schemas/core/regions.schema.json'))
    },
    {
      name: 'missing locale Schema',
      mutate: (root) => rm(path.join(root, 'schemas/locales/regions.schema.json'))
    },
    {
      name: 'extra core Schema',
      mutate: (root) => writeJson(root, 'schemas/core/extra.schema.json', {})
    },
    {
      name: 'extra locale Schema',
      mutate: (root) => writeJson(root, 'schemas/locales/extra.schema.json', {})
    },
    {
      name: 'forbidden locale check-history Schema',
      mutate: (root) => writeJson(root, 'schemas/locales/check-history.schema.json', {})
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (t) => {
      const root = await createRepositoryCopy(t);
      await fixture.mutate(root);
      const execution = await validateDataRepository(root);
      assert.ok(codes(execution).runtime.includes('RUN-E001'));
    });
  }
});

test('detects malformed JSON and common Schema violations', async (t) => {
  const cases = [
    {
      name: 'malformed data JSON',
      expected: 'E001',
      mutate: (root) => writeFile(path.join(root, 'data/core/regions.json'), '{ invalid')
    },
    {
      name: 'invalid schema_version',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/regions.json', (value) => {
          value.schema_version = '2.0.0';
        })
    },
    {
      name: 'invalid data_updated_on',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/regions.json', (value) => {
          value.data_updated_on = '2026-99-99';
        })
    },
    {
      name: 'additional property',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/regions.json', (value) => {
          value.extra = true;
        })
    },
    {
      name: 'invalid region item',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/regions.json', (value) => {
          value.items = [{ id: 'fictional-region' }];
        })
    },
    {
      name: 'missing core site property',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/site.json', (value) => {
          delete value.site_id;
        })
    },
    {
      name: 'missing locale site property',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/locales/ja/site.json', (value) => {
          delete value.site_name;
        })
    },
    {
      name: 'invalid site publication status',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/site.json', (value) => {
          value.site_publication_status = 'unknown';
        })
    },
    {
      name: 'invalid locale status',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/locales/en/site.json', (value) => {
          value.locale_status = 'unknown';
        })
    },
    {
      name: 'invalid contact URL',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/site.json', (value) => {
          value.contact_url = 'not a URI';
        })
    },
    {
      name: 'published core site without conditional properties',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/core/site.json', (value) => {
          value.site_publication_status = 'published';
          delete value.site_last_checked_on;
          delete value.contact_url;
        })
    },
    {
      name: 'published locale site without review date',
      expected: 'E002',
      mutate: (root) =>
        updateJson(root, 'data/locales/en/site.json', (value) => {
          value.locale_status = 'published';
          delete value.content_reviewed_on;
        })
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (t) => {
      const root = await createRepositoryCopy(t);
      await fixture.mutate(root);
      const execution = await validateDataRepository(root);
      assert.ok(codes(execution).validation.includes(fixture.expected));
    });
  }
});

test('enforces published contact requirements and HTTPS-only contact URLs', async (t) => {
  const cases = [
    {
      name: 'draft without contact URL succeeds',
      expectedError: false,
      mutate: () => undefined
    },
    {
      name: 'published without contact URL fails',
      expectedError: true,
      mutate: (value) => {
        value.site_publication_status = 'published';
      }
    },
    {
      name: 'HTTP contact URL fails',
      expectedError: true,
      mutate: (value) => {
        value.contact_url = 'http://example.invalid/contact';
      }
    },
    {
      name: 'FTP contact URL fails',
      expectedError: true,
      mutate: (value) => {
        value.contact_url = 'ftp://example.invalid/contact';
      }
    },
    {
      name: 'mailto contact URI fails',
      expectedError: true,
      mutate: (value) => {
        value.contact_url = 'mailto:contact@example.invalid';
      }
    },
    {
      name: 'HTTPS contact URL succeeds',
      expectedError: false,
      mutate: (value) => {
        value.contact_url = 'https://example.invalid/contact';
      }
    },
    {
      name: 'published with HTTPS contact URL and review date succeeds',
      expectedError: false,
      mutate: (value) => {
        value.site_publication_status = 'published';
        value.site_last_checked_on = '2026-08-02';
        value.contact_url = 'https://example.invalid/contact';
      }
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (t) => {
      const root = await createRepositoryCopy(t);
      await updateJson(root, 'data/core/site.json', (value) => {
        value.site_publication_status = 'draft';
        delete value.site_last_checked_on;
        delete value.contact_url;
        fixture.mutate(value);
      });
      const execution = await validateDataRepository(root);
      const hasSiteSchemaError = execution.results.some(
        ({ code, file }) => code === 'E002' && file === 'data/core/site.json'
      );
      assert.equal(hasSiteSchemaError, fixture.expectedError);
    });
  }
});

test('detects duplicate Schema identifiers and Schema compilation failures', async (t) => {
  await t.test('duplicate $id', async (t) => {
    const root = await createRepositoryCopy(t);
    const first = await readJson(root, 'schemas/core/regions.schema.json');
    await updateJson(root, 'schemas/core/organizations.schema.json', (schema) => {
      schema.$id = first.$id;
    });
    const execution = await validateDataRepository(root);
    assert.ok(codes(execution).runtime.includes('RUN-E003'));
  });

  await t.test('Schema compilation failure', async (t) => {
    const root = await createRepositoryCopy(t);
    await updateJson(root, 'schemas/core/regions.schema.json', (schema) => {
      schema.type = 'not-a-type';
    });
    const execution = await validateDataRepository(root);
    assert.ok(codes(execution).runtime.includes('RUN-E004'));
  });

  await t.test('malformed Schema JSON', async (t) => {
    const root = await createRepositoryCopy(t);
    await writeFile(path.join(root, 'schemas/core/regions.schema.json'), '{ invalid');
    const execution = await validateDataRepository(root);
    assert.ok(codes(execution).runtime.includes('RUN-E002'));
  });
});

test('collects multiple Errors in deterministic order', async (t) => {
  const root = await createRepositoryCopy(t);
  await rm(path.join(root, 'data/core/regions.json'));
  await rm(path.join(root, 'data/locales/en/regions.json'));
  await writeJson(root, 'data/core/extra.json', {});
  const first = await validateDataRepository(root);
  const second = await validateDataRepository(root);
  assert.ok(first.results.filter(({ severity }) => severity === 'error').length >= 3);
  assert.deepEqual(first, second);
});

test('detects nested unexpected JSON regardless of directory name', async (t) => {
  const cases = [
    {
      name: 'temporary directory under data',
      relativePath: 'data/core/tmp/unexpected.json',
      resultGroup: 'validation',
      expected: 'E007'
    },
    {
      name: 'generated directory under data',
      relativePath: 'data/core/dist/unexpected.json',
      resultGroup: 'validation',
      expected: 'E007'
    },
    {
      name: 'temporary directory under schemas',
      relativePath: 'schemas/core/tmp/unexpected.json',
      resultGroup: 'runtime',
      expected: 'RUN-E001'
    },
    {
      name: 'deeply nested unexpected JSON',
      relativePath: 'data/core/nested/deeper/unexpected.json',
      resultGroup: 'validation',
      expected: 'E007'
    }
  ];

  for (const fixture of cases) {
    await t.test(fixture.name, async (t) => {
      const root = await createRepositoryCopy(t);
      await mkdir(path.dirname(path.join(root, fixture.relativePath)), { recursive: true });
      await writeJson(root, fixture.relativePath, {});
      const execution = await validateDataRepository(root);
      assert.ok(codes(execution)[fixture.resultGroup].includes(fixture.expected));
    });
  }
});

test('does not mutate data or Schema files and does not access the network', async (t) => {
  const root = await createRepositoryCopy(t);
  const before = await repositoryDigest(root);
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error('network access is forbidden');
  };
  try {
    await validateDataRepository(root);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const after = await repositoryDigest(root);
  assert.equal(after, before);
  assert.equal(fetchCalls, 0);
});

test('temporary test repositories can be removed after validation', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-cleanup-'));
  await cp(path.join(repoRoot, 'data'), path.join(directory, 'data'), { recursive: true });
  await cp(path.join(repoRoot, 'schemas'), path.join(directory, 'schemas'), { recursive: true });
  await validateDataRepository(directory);
  await rm(directory, { recursive: true });
  await assert.rejects(stat(directory), { code: 'ENOENT' });
});

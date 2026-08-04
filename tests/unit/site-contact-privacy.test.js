import assert from 'node:assert/strict';
import test from 'node:test';

import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';
import { createSiteRepositoryCopy, readJson, writeJson } from '../helpers/site-generation.js';

async function mutateLocale(t, { mode = 'preview', locale = 'ja', mutate }) {
  const root = await createSiteRepositoryCopy(t);
  const relative = `site/locales/${mode === 'production' ? 'production/' : ''}${locale}.json`;
  const value = await readJson(root, relative);
  mutate(value);
  await writeJson(root, relative, value);
  return loadSiteInputs(root, mode);
}

function hasField(results, field) {
  return results.some((result) => result.field === field || result.field === `$.${field}`);
}

test('accepts the approved preview and production Locale contracts', async () => {
  for (const mode of ['preview', 'production']) {
    const inputs = await loadSiteInputs(new URL('../..', import.meta.url).pathname, mode);
    assert.deepEqual(inputs.results, []);
    assert.equal(
      inputs.uiLocales.ja.footer.contact_url,
      'https://portfolio.na0aaooq.com/contact.html'
    );
    assert.equal(
      inputs.uiLocales.en.footer.contact_url,
      'https://portfolio.na0aaooq.com/en/contact.html'
    );
  }
});

test('requires the new footer and privacy keys and rejects removed or unexpected keys', async (t) => {
  for (const { name, mutate, field } of [
    {
      name: 'missing footer.contact_url',
      mutate: (value) => delete value.footer.contact_url,
      field: 'footer.contact_url'
    },
    {
      name: 'missing footer.contact_link_label',
      mutate: (value) => delete value.footer.contact_link_label,
      field: 'footer.contact_link_label'
    },
    {
      name: 'missing privacy.last_revised',
      mutate: (value) => delete value.privacy.last_revised,
      field: 'privacy.last_revised'
    },
    {
      name: 'removed footer.contact_prefix',
      mutate: (value) => (value.footer.contact_prefix = '廃止済み'),
      field: '$.footer'
    },
    {
      name: 'unexpected footer key',
      mutate: (value) => (value.footer.unexpected = 'unexpected'),
      field: '$.footer'
    }
  ]) {
    await t.test(name, async (t) => {
      const inputs = await mutateLocale(t, { mutate });
      assert.ok(hasField(inputs.results, field), JSON.stringify(inputs.results));
    });
  }
});

test('rejects every non-approved Japanese contact URL without network access', async (t) => {
  for (const value of [
    '',
    'https://portfolio.na0aaooq.com/en/contact.html',
    'http://portfolio.na0aaooq.com/contact.html',
    'https://example.com/contact.html',
    'https://portfolio.na0aaooq.com/contact.html?from=footer',
    'https://portfolio.na0aaooq.com/contact.html#form',
    'https://portfolio.na0aaooq.com/about.html'
  ]) {
    await t.test(value || 'empty URL', async (t) => {
      const inputs = await mutateLocale(t, {
        mutate: (locale) => (locale.footer.contact_url = value)
      });
      assert.ok(hasField(inputs.results, 'footer.contact_url'), JSON.stringify(inputs.results));
    });
  }
});

test('rejects language-swapped English contact URL', async (t) => {
  const inputs = await mutateLocale(t, {
    locale: 'en',
    mutate: (locale) => (locale.footer.contact_url = 'https://portfolio.na0aaooq.com/contact.html')
  });
  assert.ok(hasField(inputs.results, 'footer.contact_url'));
});

test('requires production contact URL parity but keeps preview navigation fictional', async (t) => {
  const previewRoot = await createSiteRepositoryCopy(t);
  const preview = await loadSiteInputs(previewRoot, 'preview');
  assert.deepEqual(preview.results, []);
  assert.equal(preview.navigations.ja.site.contact_url, 'https://example.invalid/contact/');
  assert.notEqual(preview.navigations.ja.site.contact_url, preview.uiLocales.ja.footer.contact_url);

  const productionRoot = await createSiteRepositoryCopy(t);
  const relative = 'dist/public-data/production/ja/navigation.json';
  const navigation = await readJson(productionRoot, relative);
  navigation.site.contact_url = 'https://portfolio.na0aaooq.com/en/contact.html';
  await writeJson(productionRoot, relative, navigation);
  const production = await loadSiteInputs(productionRoot, 'production');
  assert.ok(
    production.results.some(
      ({ field, message }) =>
        field === 'footer.contact_url' && message.includes('公開ナビゲーションと一致しません')
    ),
    JSON.stringify(production.results)
  );
});

test('requires Japanese and English last-revised values to represent the same date', async (t) => {
  const inputs = await mutateLocale(t, {
    locale: 'en',
    mutate: (locale) => (locale.privacy.last_revised = 'Last revised: August 6, 2026')
  });
  assert.ok(
    inputs.results.some(
      ({ field, message }) =>
        field === 'privacy.last_revised' && message.includes('同じ日付を表していません')
    )
  );
});

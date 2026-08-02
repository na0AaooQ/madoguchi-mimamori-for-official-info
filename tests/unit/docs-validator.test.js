import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  validateAdrDirectory,
  validateHeadingHierarchy,
  validateRelativeLinks
} from '../../scripts/validation/docs-validator.js';

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'madoguchi-docs-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

function adr(number, { missingReason = false } = {}) {
  return `# ${number}: テスト\n\n## 状況\n\n状況です。\n\n## 決定\n\n決定です。\n\n${
    missingReason ? '' : '## 理由\n\n理由です。\n\n'
  }## 状態\n\n採用\n\n## 決定日\n\n2026年8月2日\n`;
}

async function writeAdrSet(directory, fileNames) {
  await mkdir(directory, { recursive: true });
  const rows = fileNames
    .map((fileName) => {
      const number = fileName.slice(0, 4);
      return `| [${number}](${fileName}) | 採用 | 2026年8月2日 | テスト |`;
    })
    .join('\n');
  await writeFile(
    path.join(directory, 'README.md'),
    `# 設計判断記録\n\n| 番号 | 状態 | 決定日 | 概要 |\n| --- | --- | --- | --- |\n${rows}\n`
  );
  for (const fileName of fileNames) {
    await writeFile(path.join(directory, fileName), adr(fileName.slice(0, 4)));
  }
}

test('accepts an existing relative link', async (t) => {
  const root = await temporaryDirectory(t);
  await writeFile(path.join(root, 'target.md'), '# Target\n');
  const source = path.join(root, 'source.md');
  await writeFile(source, '# Source\n\n[Target](target.md?x=1#section)\n');
  assert.deepEqual(await validateRelativeLinks(source, { repoRoot: root }), []);
});

test('detects a missing relative link', async (t) => {
  const root = await temporaryDirectory(t);
  const source = path.join(root, 'source.md');
  await writeFile(source, '# Source\n\n[Missing](missing.md)\n');
  assert.ok(
    (await validateRelativeLinks(source, { repoRoot: root })).some(
      ({ code }) => code === 'DOC-E001'
    )
  );
});

test('skips external URLs without network access', async (t) => {
  const root = await temporaryDirectory(t);
  const source = path.join(root, 'source.md');
  await writeFile(source, '# Source\n\n[External](https://example.invalid/path)\n');
  assert.deepEqual(await validateRelativeLinks(source, { repoRoot: root }), []);
});

test('accepts contiguous ADR numbers and matching index', async (t) => {
  const root = await temporaryDirectory(t);
  const decisions = path.join(root, 'decisions');
  await writeAdrSet(decisions, ['0001-first.md', '0002-second.md']);
  assert.deepEqual(await validateAdrDirectory(decisions, { repoRoot: root }), []);
});

test('detects duplicate ADR numbers', async (t) => {
  const root = await temporaryDirectory(t);
  const decisions = path.join(root, 'decisions');
  await writeAdrSet(decisions, ['0001-first.md', '0001-second.md']);
  assert.ok(
    (await validateAdrDirectory(decisions, { repoRoot: root })).some(
      ({ code }) => code === 'DOC-E004'
    )
  );
});

test('detects a missing ADR number', async (t) => {
  const root = await temporaryDirectory(t);
  const decisions = path.join(root, 'decisions');
  await writeAdrSet(decisions, ['0001-first.md', '0003-third.md']);
  assert.ok(
    (await validateAdrDirectory(decisions, { repoRoot: root })).some(
      ({ code }) => code === 'DOC-E005'
    )
  );
});

test('detects a missing required ADR heading', async (t) => {
  const root = await temporaryDirectory(t);
  const decisions = path.join(root, 'decisions');
  await writeAdrSet(decisions, ['0001-first.md']);
  await writeFile(path.join(decisions, '0001-first.md'), adr('0001', { missingReason: true }));
  assert.ok(
    (await validateAdrDirectory(decisions, { repoRoot: root })).some(
      ({ code }) => code === 'DOC-E007'
    )
  );
});

test('accepts a normal heading hierarchy', () => {
  assert.deepEqual(
    validateHeadingHierarchy('# Title\n\n## Section\n\n### Detail\n', { file: 'test.md' }),
    []
  );
});

test('detects a skipped heading level', () => {
  assert.ok(
    validateHeadingHierarchy('# Title\n\n### Detail\n', { file: 'test.md' }).some(
      ({ code }) => code === 'DOC-E003'
    )
  );
});

test('does not treat heading markers inside a code fence as headings', () => {
  const source = '# Title\n\n```text\n#### Not a heading\n```\n\n## Section\n';
  assert.deepEqual(validateHeadingHierarchy(source, { file: 'test.md' }), []);
});

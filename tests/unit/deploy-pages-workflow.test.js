import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const workflow = await readFile(path.join(repoRoot, '.github/workflows/deploy-pages.yml'), 'utf8');

test('Pages workflow is manual-only and has least required permissions', () => {
  assert.match(workflow, /^on:\n {2}workflow_dispatch:\s*$/m);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|pull_request|schedule|repository_dispatch):/m);
  assert.match(workflow, /contents: read/);
  assert.match(workflow, /pages: write/);
  assert.match(workflow, /id-token: write/);
});

test('Pages workflow uses only the requested official action majors and artifact path', () => {
  assert.deepEqual(
    [...workflow.matchAll(/uses: ([^\s]+)/g)].map((match) => match[1]),
    [
      'actions/checkout@v6',
      'actions/setup-node@v6',
      'actions/configure-pages@v6',
      'actions/upload-pages-artifact@v4',
      'actions/deploy-pages@v4'
    ]
  );
  assert.match(workflow, /node-version: 24\.18\.0/);
  assert.match(workflow, /path: dist\/site\/production/);
  assert.doesNotMatch(workflow, /path: (?:\.|data|schemas|tests|docs)\s*$/m);
});

test('Pages workflow checks base URL before upload and deploys after build', () => {
  const configure = workflow.indexOf('actions/configure-pages@v6');
  const compare = workflow.indexOf('check:site:base-url');
  const upload = workflow.indexOf('actions/upload-pages-artifact@v4');
  const deploy = workflow.indexOf('actions/deploy-pages@v4');
  assert.ok(configure < compare && compare < upload && upload < deploy);
  assert.match(workflow, /deploy:\n {4}needs: build/);
  assert.match(workflow, /name: github-pages/);
  assert.match(workflow, /url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
});

test('Pages workflow fetches full Git history for baseline checks', () => {
  assert.match(
    workflow,
    /- name: Checkout\n {8}uses: actions\/checkout@v6\n {8}with:\n {10}fetch-depth: 0/
  );
});

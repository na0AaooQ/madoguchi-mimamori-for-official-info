import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const workflow = await readFile(path.join(repoRoot, '.github/workflows/deploy-pages.yml'), 'utf8');
const steps = [
  ...workflow.matchAll(/^ {6}- name: (.+)\n([\s\S]*?)(?=^ {6}- name:|^ {2}deploy:|$(?![\s\S]))/gm)
].map((match) => ({ name: match[1], body: match[2] }));
const step = (name) => {
  const selected = steps.find((item) => item.name === name);
  assert.ok(selected, `Missing step: ${name}`);
  return selected.body;
};

test('Pages workflow is manual-only with conditional SHA input and least required permissions', () => {
  assert.match(workflow, /^on:\n {2}workflow_dispatch:\n {4}inputs:/m);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|pull_request|schedule|repository_dispatch):/m);
  assert.match(
    workflow,
    /deploy_mode:\n[\s\S]*?type: choice\n {8}required: true\n {8}default: production\n {8}options:\n {10}- production\n {10}- maintenance/
  );
  assert.match(
    workflow,
    /production_sha:\n[\s\S]*?type: string\n {8}required: false\n {8}default: ''/
  );
  assert.match(workflow, /permissions:\n {2}contents: read\n {2}pages: write\n {2}id-token: write/);
  assert.match(workflow, /concurrency:\n {2}group: pages\n {2}cancel-in-progress: false/);
});

test('Pages workflow preserves official action majors and pinned Node.js', () => {
  assert.deepEqual(
    [...workflow.matchAll(/uses: ([^\s]+)/g)].map((match) => match[1]),
    [
      'actions/checkout@v6',
      'actions/setup-node@v6',
      'actions/checkout@v6',
      'actions/configure-pages@v6',
      'actions/upload-pages-artifact@v4',
      'actions/deploy-pages@v4'
    ]
  );
  assert.match(step('Setup Node.js'), /node-version: 24\.22\.3/);
  assert.doesNotMatch(step('Setup Node.js'), /cache:/);
});

test('DP-01, PR-03/04: main-only control and selected SHA are isolated with full history', () => {
  assert.match(step('Require main branch'), /run: test "\$GITHUB_REF" = refs\/heads\/main/);
  assert.equal(steps[0].name, 'Require main branch');
  assert.match(
    step('Checkout control main'),
    /ref: \$\{\{ github\.sha \}\}\n {10}path: control\n {10}fetch-depth: 0/
  );
  assert.match(
    step('Checkout selected production commit'),
    /ref: \$\{\{ steps\.inputs\.outputs\.content_sha \}\}\n {10}path: production-source\n {10}fetch-depth: 0/
  );
  assert.match(
    step('Validate deployment inputs and ancestry'),
    /run: node control\/scripts\/maintenance\/prepare-pages.js validate-inputs/
  );
  assert.ok(
    steps.findIndex((item) => item.name === 'Validate deployment inputs and ancestry') <
      steps.findIndex((item) => item.name === 'Checkout selected production commit')
  );
  assert.match(workflow, /DEPLOY_MODE: \$\{\{ inputs\.deploy_mode \}\}/);
  assert.match(workflow, /PRODUCTION_SHA: \$\{\{ inputs\.production_sha \}\}/);
  for (const item of steps)
    assert.doesNotMatch(item.body.match(/run:[\s\S]*/)?.[0] ?? '', /\$\{\{ inputs\./);
});

test('PR-05: only production executes selected-SHA npm ci and check; maintenance is independent', () => {
  for (const name of [
    'Checkout selected production commit',
    'Install production dependencies',
    'Validate tracked production artifacts'
  ]) {
    assert.match(step(name), /if: steps\.inputs\.outputs\.mode == 'production'/);
  }
  assert.match(
    step('Install production dependencies'),
    /working-directory: production-source\n {8}run: npm ci/
  );
  assert.match(
    step('Validate tracked production artifacts'),
    /working-directory: production-source\n {8}run: npm run check/
  );
  assert.match(
    step('Prepare and validate maintenance artifacts'),
    /if: steps\.inputs\.outputs\.mode == 'maintenance'/
  );
  assert.match(
    step('Prepare and validate maintenance artifacts'),
    /run: node control\/scripts\/maintenance\/prepare-pages.js prepare-maintenance/
  );
  assert.doesNotMatch(
    workflow,
    /generate:site|generate:public|continue-on-error|git reset|git checkout/
  );
});

test('MT-08, DP-04/05: URL and artifact validation gate upload and deploy', () => {
  const configure = workflow.indexOf('actions/configure-pages@v6');
  const compare = workflow.indexOf(
    'run: node control/scripts/maintenance/prepare-pages.js validate-artifact'
  );
  const upload = workflow.indexOf('actions/upload-pages-artifact@v4');
  const deploy = workflow.indexOf('actions/deploy-pages@v4');
  assert.ok(configure < compare && compare < upload && upload < deploy);
  assert.match(
    step('Confirm base URL and permitted artifact'),
    /ACTUAL_BASE_URL: \$\{\{ steps\.pages\.outputs\.base_url \}\}/
  );
  assert.match(
    step('Confirm base URL and permitted artifact'),
    /'production-source\/dist\/site\/production' \|\| 'control\/dist\/site\/maintenance'/
  );
  assert.match(
    step('Upload validated site'),
    /if: success\(\) && steps\.artifact\.outputs\.validated == 'true'/
  );
  assert.match(
    step('Upload validated site'),
    /path: \$\{\{ steps\.artifact\.outputs\.artifact_path \}\}/
  );
  assert.match(
    workflow,
    /deploy:\n {4}needs: build\n {4}if: needs\.build\.result == 'success' && needs\.build\.outputs\.validated == 'true'/
  );
  assert.match(workflow, /name: github-pages/);
  assert.match(workflow, /url: \$\{\{ steps\.deployment\.outputs\.page_url \}\}/);
  assert.equal([...workflow.matchAll(/uses: actions\/upload-pages-artifact/g)].length, 1);
});

test('summaries always report actual validation and deployment outcomes with both SHAs', () => {
  for (const name of ['Build summary', 'Deployment summary']) {
    const body = step(name);
    assert.match(body, /if: always\(\)/);
    for (const label of ['Mode', 'Control SHA', 'Content SHA', 'Artifact directory'])
      assert.ok(body.includes(`| ${label} |`));
    assert.match(body, /tee -a "\$GITHUB_STEP_SUMMARY"/);
  }
  assert.match(step('Build summary'), /steps\.artifact\.outcome/);
  assert.match(step('Build summary'), /deployment has not completed/);
  assert.match(step('Deployment summary'), /DEPLOY_RESULT: \$\{\{ steps\.deployment\.outcome \}\}/);
  assert.match(step('Deployment summary'), /printf '\| Deployment \| %s \|/);
});

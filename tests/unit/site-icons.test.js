import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import {
  validateAppleTouchIcon,
  validateIcoIcon,
  validateOgpImage,
  validateSvgIcon
} from '../../scripts/site/site-icon-validator.js';
import { loadSiteInputs } from '../../scripts/site/site-input-loader.js';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const approvedHashes = Object.freeze({
  'favicon.svg': '09b6094c4bf85a7180178d8123a199ee7180156e06d30a1533ea36b043cebfad',
  'favicon.ico': '4cf0156751a05980c1fcc525b630f6045743bd6fb9ab6170063234ec3744c9c8',
  'apple-touch-icon.png': '6ce051f59966f83abdd175ca3e43753aba16cd6f4c5502f9f4b995260cd0c008'
});

async function readIcon(file) {
  return readFile(path.join(repoRoot, 'site/assets', file));
}

test('loads approved canonical icons with their exact SHA-256 values', async () => {
  for (const [file, expected] of Object.entries(approvedHashes)) {
    const source = await readIcon(file);
    assert.equal(createHash('sha256').update(source).digest('hex'), expected, file);
  }
});

test('loads SVG as text and ICO and PNG as byte buffers for both modes', async () => {
  const preview = await loadSiteInputs(repoRoot, 'preview');
  const production = await loadSiteInputs(repoRoot, 'production');
  assert.deepEqual(preview.results, []);
  assert.deepEqual(production.results, []);
  for (const inputs of [preview, production]) {
    assert.equal(typeof inputs.assets['assets/styles.css'], 'string');
    assert.equal(typeof inputs.assets['assets/font-size.js'], 'string');
    assert.equal(typeof inputs.assets['favicon.svg'], 'string');
    assert.equal(Buffer.isBuffer(inputs.assets['favicon.ico']), true);
    assert.equal(Buffer.isBuffer(inputs.assets['apple-touch-icon.png']), true);
  }
  assert.equal('ogp-image.png' in preview.assets, false);
  assert.equal(Buffer.isBuffer(production.assets['ogp-image.png']), true);
  assert.equal(preview.assets['favicon.ico'].equals(production.assets['favicon.ico']), true);
  assert.equal(preview.assets['favicon.svg'], production.assets['favicon.svg']);
  assert.equal(
    preview.assets['apple-touch-icon.png'].equals(production.assets['apple-touch-icon.png']),
    true
  );
});

test('loads and validates the approved production-only OGP image', async () => {
  const source = await readIcon('ogp-image.png');
  assert.equal(source.length, 564_713);
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    '7a87da512d851cbb38226b833f5f34b34525c191902b01acb0f203cfcdd61f84'
  );
  assert.deepEqual(validateOgpImage(source), []);

  const wrongDimensions = Buffer.from(source);
  wrongDimensions.writeUInt32BE(1199, 16);
  assert.match(validateOgpImage(wrongDimensions).join('\n'), /1200x630px/);

  const transparent = Buffer.from(source);
  transparent[25] = 6;
  assert.match(validateOgpImage(transparent).join('\n'), /透明チャンネルのないRGB/);

  const idat = source.indexOf(Buffer.from('IDAT'));
  const badCrc = Buffer.from(source);
  badCrc[idat + 4] ^= 0xff;
  assert.match(validateOgpImage(badCrc).join('\n'), /IDATチャンクのCRC/);

  const forbiddenChunk = Buffer.from(source);
  const profile = forbiddenChunk.indexOf(Buffer.from('iCCP'));
  forbiddenChunk.write('pHYs', profile, 'ascii');
  assert.match(validateOgpImage(forbiddenChunk).join('\n'), /許可されていないPNGチャンク/);

  const trailing = Buffer.concat([source, Buffer.from([0])]);
  assert.match(validateOgpImage(trailing).join('\n'), /IEND後/);

  const truncated = source.subarray(0, source.length - 4);
  assert.match(validateOgpImage(truncated).join('\n'), /途中で切れています|IEND/);
});

test('validates the approved SVG safety and square viewBox contract', async () => {
  const source = await readFile(path.join(repoRoot, 'site/assets/favicon.svg'), 'utf8');
  assert.deepEqual(validateSvgIcon(source), []);

  const unsafe = `<svg viewBox="0 0 10 20" onload="alert(1)">
  <script href="https://example.invalid/script.js"></script>
  <foreignObject></foreignObject>
  <image href="data:image/png;base64,AAAA"></image>
</svg>`;
  const messages = validateSvgIcon(unsafe).join('\n');
  assert.match(messages, /viewBoxは正の正方形/);
  assert.match(messages, /script要素/);
  assert.match(messages, /foreignObject/);
  assert.match(messages, /イベントハンドラー/);
  assert.match(messages, /data URL/);
  assert.match(messages, /外部スクリプト、画像、またはURL/);
  assert.match(
    validateSvgIcon(
      '<svg viewBox="0 0 10 10"><use href=https://example.invalid/icon.svg></use></svg>'
    ).join('\n'),
    /外部スクリプト、画像、またはURL/
  );
});

test('validates ICO directory entries and exactly the approved three dimensions', async () => {
  const source = await readIcon('favicon.ico');
  assert.deepEqual(validateIcoIcon(source), []);

  const unexpectedSize = Buffer.from(source);
  unexpectedSize[6] = 64;
  assert.match(validateIcoIcon(unexpectedSize).join('\n'), /想定外のサイズ/);
  assert.match(validateIcoIcon(unexpectedSize).join('\n'), /48x48がありません/);

  const truncated = source.subarray(0, 40);
  assert.match(validateIcoIcon(truncated).join('\n'), /途中で切れています/);
});

test('validates PNG signature, 180x180 IHDR, and complete chunks', async () => {
  const source = await readIcon('apple-touch-icon.png');
  assert.deepEqual(validateAppleTouchIcon(source), []);

  const wrongSize = Buffer.from(source);
  wrongSize.writeUInt32BE(179, 16);
  assert.match(validateAppleTouchIcon(wrongSize).join('\n'), /180x180px/);

  const badSignature = Buffer.from(source);
  badSignature[0] = 0;
  assert.match(validateAppleTouchIcon(badSignature).join('\n'), /PNGシグネチャー/);

  const truncated = source.subarray(0, source.length - 4);
  assert.match(validateAppleTouchIcon(truncated).join('\n'), /途中で切れています|IEND/);
});

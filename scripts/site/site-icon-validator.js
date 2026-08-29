import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import { SITE_OGP_IMAGE_SHA256 } from './site-constants.js';

const ICO_SIZES = Object.freeze([16, 32, 48]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_CRC_TABLE = Object.freeze(
  Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    return crc >>> 0;
  })
);

function pngCrc32(source) {
  let crc = 0xffffffff;
  for (const value of source) crc = PNG_CRC_TABLE[(crc ^ value) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function inspectPng(source, file, { validateCrc = false } = {}) {
  if (!Buffer.isBuffer(source)) return { messages: [`${file}はBufferとして読み込んでください。`] };
  if (source.length < PNG_SIGNATURE.length || !source.subarray(0, 8).equals(PNG_SIGNATURE))
    return { messages: [`${file}のPNGシグネチャーが不正です。`] };

  const messages = [];
  const chunks = [];
  let offset = 8;
  let ihdr;
  let sawIend = false;
  while (offset < source.length) {
    if (offset + 12 > source.length) {
      messages.push(`${file}のチャンクが途中で切れています。`);
      break;
    }
    const length = source.readUInt32BE(offset);
    const type = source.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const end = dataEnd + 4;
    if (end > source.length) {
      messages.push(`${file}のチャンクデータが途中で切れています。`);
      break;
    }
    const expectedCrc = source.readUInt32BE(dataEnd);
    const actualCrc = pngCrc32(source.subarray(offset + 4, dataEnd));
    if (validateCrc && actualCrc !== expectedCrc)
      messages.push(`${file}の${type}チャンクのCRCが不正です。`);
    chunks.push({ type, length, data: source.subarray(dataStart, dataEnd) });
    if (type === 'IHDR') {
      if (length !== 13) messages.push(`${file}のIHDR長が不正です。`);
      else if (!ihdr) {
        ihdr = {
          width: source.readUInt32BE(dataStart),
          height: source.readUInt32BE(dataStart + 4),
          bitDepth: source[dataStart + 8],
          colorType: source[dataStart + 9],
          compression: source[dataStart + 10],
          filter: source[dataStart + 11],
          interlace: source[dataStart + 12]
        };
      }
    }
    offset = end;
    if (type === 'IEND') {
      sawIend = true;
      if (length !== 0) messages.push(`${file}のIEND長が不正です。`);
      if (offset !== source.length) messages.push(`${file}のIEND後に想定外のデータがあります。`);
      break;
    }
  }
  if (!ihdr) messages.push(`${file}にIHDRチャンクがありません。`);
  if (!sawIend) messages.push(`${file}に完全なIENDチャンクがありません。`);
  return { messages, chunks, ihdr, sawIend };
}

export function validateSvgIcon(source) {
  const messages = [];
  if (typeof source !== 'string' || source.trim() === '') {
    return ['favicon.svgは空でないUTF-8テキストにしてください。'];
  }
  if (source.includes('\uFFFD')) messages.push('favicon.svgを正しいUTF-8として読み込めません。');

  const root = source.match(/^\s*(?:<\?xml\b[^?]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b([^>]*)>/i);
  if (!root) {
    messages.push('favicon.svgにsvgルート要素がありません。');
  } else {
    const viewBox = root[1].match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
    if (!viewBox) {
      messages.push('favicon.svgのsvgルート要素にviewBoxがありません。');
    } else {
      const values = viewBox[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (
        values.length !== 4 ||
        values.some((value) => !Number.isFinite(value)) ||
        values[2] <= 0 ||
        values[2] !== values[3]
      ) {
        messages.push('favicon.svgのviewBoxは正の正方形にしてください。');
      }
    }
  }

  if (/<script\b/i.test(source)) messages.push('favicon.svgにscript要素を含められません。');
  if (/<foreignObject\b/i.test(source))
    messages.push('favicon.svgにforeignObject要素を含められません。');
  if (/\son[a-z0-9:_-]+\s*=/i.test(source))
    messages.push('favicon.svgにイベントハンドラー属性を含められません。');
  if (/\bdata\s*:/i.test(source)) messages.push('favicon.svgにdata URLを含められません。');
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(source))
    messages.push('favicon.svgにDOCTYPEまたは外部実体を含められません。');
  if (/<link\b/i.test(source) || /<\?xml-stylesheet\b/i.test(source) || /@import\b/i.test(source))
    messages.push('favicon.svgから外部スタイルを読み込めません。');

  for (const match of source.matchAll(
    /\b(?:href|xlink:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi
  )) {
    const value = match[1] ?? match[2] ?? match[3];
    if (value && !value.startsWith('#')) {
      messages.push('favicon.svgから外部スクリプト、画像、またはURLを参照できません。');
      break;
    }
  }
  for (const match of source.matchAll(/url\(\s*["']?([^"')\s]+)["']?\s*\)/gi)) {
    if (!match[1].startsWith('#')) {
      messages.push('favicon.svgのスタイルから外部URLを参照できません。');
      break;
    }
  }
  return messages;
}

export function validateIcoIcon(source) {
  if (!Buffer.isBuffer(source)) return ['favicon.icoはBufferとして読み込んでください。'];
  if (source.length < 6) return ['favicon.icoのヘッダーが途中で切れています。'];

  const messages = [];
  const reserved = source.readUInt16LE(0);
  const type = source.readUInt16LE(2);
  const count = source.readUInt16LE(4);
  if (reserved !== 0) messages.push('favicon.icoのreservedは0にしてください。');
  if (type !== 1) messages.push('favicon.icoのtypeは1にしてください。');
  if (count !== 3) messages.push('favicon.icoのimage countは3にしてください。');

  const directoryEnd = 6 + count * 16;
  if (source.length < directoryEnd) {
    messages.push('favicon.icoのディレクトリが途中で切れています。');
    return messages;
  }

  const dimensions = [];
  for (let index = 0; index < count; index += 1) {
    const entry = 6 + index * 16;
    const width = source[entry] || 256;
    const height = source[entry + 1] || 256;
    const size = source.readUInt32LE(entry + 8);
    const offset = source.readUInt32LE(entry + 12);
    dimensions.push(`${width}x${height}`);
    if (width !== height || !ICO_SIZES.includes(width))
      messages.push(`favicon.icoに想定外のサイズがあります: ${width}x${height}`);
    if (size === 0 || offset < directoryEnd || offset + size > source.length)
      messages.push(`favicon.icoのエントリー${index + 1}がファイル範囲外です。`);
  }
  for (const size of ICO_SIZES) {
    if (!dimensions.includes(`${size}x${size}`))
      messages.push(`favicon.icoに${size}x${size}がありません。`);
  }
  return messages;
}

export function validateAppleTouchIcon(source) {
  const { messages, ihdr } = inspectPng(source, 'apple-touch-icon.png');
  if (ihdr && (ihdr.width !== 180 || ihdr.height !== 180))
    messages.push(
      `apple-touch-icon.pngは180x180pxにしてください（実際: ${ihdr.width}x${ihdr.height}）。`
    );
  return messages;
}

export function validateOgpImage(source) {
  const file = 'ogp-image.png';
  const inspection = inspectPng(source, file, { validateCrc: true });
  const messages = inspection.messages;
  if (!Buffer.isBuffer(source)) return messages;

  if (source.length !== 658_573)
    messages.push(`${file}は658573 bytesにしてください（実際: ${source.length}）。`);
  const actualHash = createHash('sha256').update(source).digest('hex');
  if (actualHash !== SITE_OGP_IMAGE_SHA256)
    messages.push(`${file}のSHA-256が正式採用値と一致しません。`);

  const { chunks = [], ihdr } = inspection;
  if (ihdr) {
    if (ihdr.width !== 1200 || ihdr.height !== 630)
      messages.push(`${file}は1200x630pxにしてください（実際: ${ihdr.width}x${ihdr.height}）。`);
    if (ihdr.bitDepth !== 8) messages.push(`${file}のbit depthは8にしてください。`);
    if (ihdr.colorType !== 2)
      messages.push(`${file}のcolor typeは透明チャンネルのないRGB（2）にしてください。`);
    if (ihdr.compression !== 0 || ihdr.filter !== 0 || ihdr.interlace !== 0)
      messages.push(`${file}の圧縮・フィルター・インターレース方式が想定外です。`);
  }

  const types = chunks.map(({ type }) => type);
  const allowedTypes = new Set(['IHDR', 'iCCP', 'IDAT', 'IEND']);
  if (types.some((type) => !allowedTypes.has(type)))
    messages.push(`${file}に許可されていないPNGチャンクがあります。`);
  if (types[0] !== 'IHDR' || types.filter((type) => type === 'IHDR').length !== 1)
    messages.push(`${file}の先頭にはIHDRチャンクが1件必要です。`);
  if (types.at(-1) !== 'IEND' || types.filter((type) => type === 'IEND').length !== 1)
    messages.push(`${file}の末尾にはIENDチャンクが1件必要です。`);
  if (types.filter((type) => type === 'IDAT').length === 0)
    messages.push(`${file}にIDATチャンクがありません。`);
  const firstIdat = types.indexOf('IDAT');
  const lastIdat = types.lastIndexOf('IDAT');
  if (firstIdat >= 0 && types.slice(firstIdat, lastIdat + 1).some((type) => type !== 'IDAT'))
    messages.push(`${file}のIDATチャンクは連続して配置してください。`);

  const profiles = chunks.filter(({ type }) => type === 'iCCP');
  if (profiles.length !== 1) messages.push(`${file}にはiCCPチャンクが1件必要です。`);
  else {
    const data = profiles[0].data;
    const separator = data.indexOf(0);
    if (separator < 1 || data[separator + 1] !== 0) {
      messages.push(`${file}のiCCPチャンクが不正です。`);
    } else {
      try {
        const profile = inflateSync(data.subarray(separator + 2));
        if (!profile.includes(Buffer.from('sRGB IEC61966-2.1', 'latin1')))
          messages.push(`${file}のICCプロファイルはsRGB IEC61966-2.1にしてください。`);
      } catch {
        messages.push(`${file}のiCCPプロファイルを展開できません。`);
      }
    }
  }
  return messages;
}

export function validateSiteIcon(file, source) {
  if (file === 'favicon.svg') return validateSvgIcon(source);
  if (file === 'favicon.ico') return validateIcoIcon(source);
  if (file === 'apple-touch-icon.png') return validateAppleTouchIcon(source);
  return [];
}

const ICO_SIZES = Object.freeze([16, 32, 48]);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  if (!Buffer.isBuffer(source)) return ['apple-touch-icon.pngはBufferとして読み込んでください。'];
  if (source.length < PNG_SIGNATURE.length || !source.subarray(0, 8).equals(PNG_SIGNATURE))
    return ['apple-touch-icon.pngのPNGシグネチャーが不正です。'];

  const messages = [];
  let offset = 8;
  let ihdr;
  let sawIend = false;
  while (offset < source.length) {
    if (offset + 12 > source.length) {
      messages.push('apple-touch-icon.pngのチャンクが途中で切れています。');
      break;
    }
    const length = source.readUInt32BE(offset);
    const type = source.toString('ascii', offset + 4, offset + 8);
    const end = offset + 12 + length;
    if (end > source.length) {
      messages.push('apple-touch-icon.pngのチャンクデータが途中で切れています。');
      break;
    }
    if (type === 'IHDR') {
      if (length !== 13) messages.push('apple-touch-icon.pngのIHDR長が不正です。');
      else if (!ihdr) {
        ihdr = {
          width: source.readUInt32BE(offset + 8),
          height: source.readUInt32BE(offset + 12)
        };
      }
    }
    offset = end;
    if (type === 'IEND') {
      sawIend = true;
      if (length !== 0) messages.push('apple-touch-icon.pngのIEND長が不正です。');
      if (offset !== source.length)
        messages.push('apple-touch-icon.pngのIEND後に想定外のデータがあります。');
      break;
    }
  }

  if (!ihdr) messages.push('apple-touch-icon.pngにIHDRチャンクがありません。');
  else if (ihdr.width !== 180 || ihdr.height !== 180)
    messages.push(
      `apple-touch-icon.pngは180x180pxにしてください（実際: ${ihdr.width}x${ihdr.height}）。`
    );
  if (!sawIend) messages.push('apple-touch-icon.pngに完全なIENDチャンクがありません。');
  return messages;
}

export function validateSiteIcon(file, source) {
  if (file === 'favicon.svg') return validateSvgIcon(source);
  if (file === 'favicon.ico') return validateIcoIcon(source);
  if (file === 'apple-touch-icon.png') return validateAppleTouchIcon(source);
  return [];
}

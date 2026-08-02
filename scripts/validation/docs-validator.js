import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createResult, exitCodeForResults, formatResults, sortResults } from './result.js';

export const REQUIRED_ADR_HEADINGS = Object.freeze(['状況', '決定', '理由', '状態', '決定日']);
const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  'coverage',
  '.nyc_output',
  'dist',
  'tmp',
  'temp'
]);

function relativeDisplayPath(repoRoot, filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

function markdownLinesOutsideFences(source) {
  const lines = [];
  let fence = null;
  for (const [index, line] of source.split(/\r?\n/).entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/);
    if (marker) {
      const character = marker[1][0];
      if (!fence) {
        fence = { character, length: marker[1].length };
      } else if (character === fence.character && marker[1].length >= fence.length) {
        fence = null;
      }
      continue;
    }
    if (!fence) lines.push({ number: index + 1, text: line });
  }
  return lines;
}

function linkTargets(source) {
  const targets = [];
  const pattern = /!?\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+['"][^'"]*['"])?\s*\)/g;
  const searchable = markdownLinesOutsideFences(source)
    .map(({ text }) => text)
    .join('\n');
  for (const match of searchable.matchAll(pattern)) {
    targets.push(match[1].replace(/^<|>$/g, ''));
  }
  return targets;
}

function isRelativeFileLink(target) {
  return (
    target !== '' &&
    !target.startsWith('#') &&
    !target.startsWith('/') &&
    !target.startsWith('//') &&
    !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(target)
  );
}

export async function validateRelativeLinks(filePath, { repoRoot = path.dirname(filePath) } = {}) {
  const source = await readFile(filePath, 'utf8');
  const file = relativeDisplayPath(repoRoot, filePath);
  const results = [];

  for (const target of linkTargets(source)) {
    if (!isRelativeFileLink(target)) continue;
    const withoutFragment = target.split(/[?#]/, 1)[0];
    if (!withoutFragment) continue;
    let decoded;
    try {
      decoded = decodeURIComponent(withoutFragment);
    } catch {
      decoded = withoutFragment;
    }
    const resolved = path.resolve(path.dirname(filePath), decoded);
    try {
      await stat(resolved);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      results.push(
        createResult({
          severity: 'error',
          code: 'DOC-E001',
          file,
          message: `相対リンク先が存在しません: ${target}`,
          suggested_action: 'リンク先パスまたは対象ファイルを確認してください。'
        })
      );
    }
  }

  return results;
}

export function parseHeadings(source) {
  return markdownLinesOutsideFences(source)
    .map(({ number, text }) => {
      const match = text.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
      if (!match) return null;
      return { level: match[1].length, text: match[2], line: number };
    })
    .filter(Boolean);
}

export function validateHeadingHierarchy(source, { file = '<markdown>' } = {}) {
  const headings = parseHeadings(source);
  const results = [];
  const h1Count = headings.filter(({ level }) => level === 1).length;

  if (headings.length === 0 || headings[0].level !== 1 || h1Count !== 1) {
    results.push(
      createResult({
        severity: 'error',
        code: 'DOC-E002',
        file,
        message: '文書は先頭の見出しを唯一のH1として構成してください。'
      })
    );
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];
    if (current.level > previous.level + 1) {
      results.push(
        createResult({
          severity: 'error',
          code: 'DOC-E003',
          file,
          field: `line:${current.line}`,
          message: `見出しレベルがH${previous.level}からH${current.level}へ飛んでいます。`
        })
      );
    }
  }

  return results;
}

function indexedAdrs(source) {
  const entries = new Map();
  const pattern = /\[(\d{4})\]\(([^)]+\.md)(?:[?#][^)]*)?\)/g;
  for (const match of source.matchAll(pattern)) {
    const number = Number(match[1]);
    if (!entries.has(number)) entries.set(number, []);
    entries.get(number).push(match[2]);
  }
  return entries;
}

export async function validateAdrDirectory(
  decisionsDirectory,
  { repoRoot = path.dirname(decisionsDirectory), requiredHeadings = REQUIRED_ADR_HEADINGS } = {}
) {
  const directoryEntries = await readdir(decisionsDirectory, { withFileTypes: true });
  const adrFiles = directoryEntries
    .filter((entry) => entry.isFile() && /^\d{4}-.*\.md$/.test(entry.name))
    .map(({ name }) => name)
    .sort();
  const byNumber = new Map();
  const results = [];

  for (const fileName of adrFiles) {
    const number = Number(fileName.slice(0, 4));
    if (!byNumber.has(number)) byNumber.set(number, []);
    byNumber.get(number).push(fileName);
  }

  for (const [number, files] of byNumber) {
    if (files.length > 1) {
      results.push(
        createResult({
          severity: 'error',
          code: 'DOC-E004',
          file: relativeDisplayPath(repoRoot, decisionsDirectory),
          message: `ADR番号${String(number).padStart(4, '0')}が重複しています: ${files.join(', ')}`
        })
      );
    }
  }

  const numbers = [...byNumber.keys()].sort((left, right) => left - right);
  const maximum = numbers.at(-1) ?? 0;
  for (let number = 1; number <= maximum; number += 1) {
    if (!byNumber.has(number)) {
      results.push(
        createResult({
          severity: 'error',
          code: 'DOC-E005',
          file: relativeDisplayPath(repoRoot, decisionsDirectory),
          message: `ADR番号${String(number).padStart(4, '0')}が欠番です。`
        })
      );
    }
  }

  const indexPath = path.join(decisionsDirectory, 'README.md');
  const indexSource = await readFile(indexPath, 'utf8');
  const indexEntries = indexedAdrs(indexSource);
  for (const [number, files] of byNumber) {
    const indexedPaths = indexEntries.get(number) ?? [];
    for (const fileName of files) {
      if (!indexedPaths.includes(fileName)) {
        results.push(
          createResult({
            severity: 'error',
            code: 'DOC-E006',
            file: relativeDisplayPath(repoRoot, indexPath),
            message: `ADR ${String(number).padStart(4, '0')}の実ファイルが索引と一致しません: ${fileName}`
          })
        );
      }
    }
  }
  for (const [number, indexedPaths] of indexEntries) {
    if (indexedPaths.length !== 1) {
      results.push(
        createResult({
          severity: 'error',
          code: 'DOC-E006',
          file: relativeDisplayPath(repoRoot, indexPath),
          message: `ADR ${String(number).padStart(4, '0')}は索引へ1回だけ登録してください。`
        })
      );
    }
    const actual = new Set(byNumber.get(number) ?? []);
    for (const indexedPath of indexedPaths) {
      if (!actual.has(indexedPath)) {
        results.push(
          createResult({
            severity: 'error',
            code: 'DOC-E006',
            file: relativeDisplayPath(repoRoot, indexPath),
            message: `ADR索引のリンク先が実ファイルと一致しません: ${indexedPath}`
          })
        );
      }
    }
  }

  for (const fileName of adrFiles) {
    const source = await readFile(path.join(decisionsDirectory, fileName), 'utf8');
    const headings = new Set(
      parseHeadings(source)
        .filter(({ level }) => level === 2)
        .map(({ text }) => text)
    );
    for (const requiredHeading of requiredHeadings) {
      if (!headings.has(requiredHeading)) {
        results.push(
          createResult({
            severity: 'error',
            code: 'DOC-E007',
            file: relativeDisplayPath(repoRoot, path.join(decisionsDirectory, fileName)),
            field: requiredHeading,
            message: `ADR必須見出し「${requiredHeading}」がありません。`
          })
        );
      }
    }
  }

  return sortResults(results);
}

async function collectMarkdownFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        files.push(...(await collectMarkdownFiles(path.join(directory, entry.name))));
      }
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files.sort();
}

export async function validateDocumentation(repoRoot) {
  const results = [];
  for (const filePath of await collectMarkdownFiles(repoRoot)) {
    const source = await readFile(filePath, 'utf8');
    const file = relativeDisplayPath(repoRoot, filePath);
    results.push(...(await validateRelativeLinks(filePath, { repoRoot })));
    results.push(...validateHeadingHierarchy(source, { file }));
  }
  results.push(
    ...(await validateAdrDirectory(path.join(repoRoot, 'docs', 'decisions'), { repoRoot }))
  );
  return sortResults(results);
}

export async function main() {
  try {
    const results = await validateDocumentation(process.cwd());
    console.log(formatResults(results));
    return exitCodeForResults(results);
  } catch (error) {
    console.error(`Documentation validation error: ${error.message}`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) process.exitCode = await main();

import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';

import { MANAGEMENT_UNITS } from './config.js';
import { createImportResult } from './result.js';

function inputResult({ code, file, message, suggestedAction }) {
  return createImportResult({
    severity: 'error',
    code,
    file,
    message,
    suggestedAction
  });
}

export async function loadManagementInputs({ repoRoot, inputDir }) {
  const absoluteInputDir = path.isAbsolute(inputDir)
    ? path.normalize(inputDir)
    : path.resolve(repoRoot, inputDir);
  let directoryState;
  try {
    directoryState = await lstat(absoluteInputDir);
  } catch (error) {
    return {
      absoluteInputDir,
      buffers: new Map(),
      results: [
        inputResult({
          code: 'INPUT-E001',
          file: inputDir,
          message:
            error.code === 'ENOENT'
              ? '入力ディレクトリが存在しません。'
              : `入力ディレクトリを確認できません: ${error.message}`,
          suggestedAction: '指定パスを確認し、6個のTSVを配置してください。'
        })
      ]
    };
  }
  if (!directoryState.isDirectory() || directoryState.isSymbolicLink()) {
    return {
      absoluteInputDir,
      buffers: new Map(),
      results: [
        inputResult({
          code: 'INPUT-E001',
          file: inputDir,
          message: '入力パスが通常のディレクトリではありません。',
          suggestedAction: 'シンボリックリンクではないディレクトリを指定してください。'
        })
      ]
    };
  }

  const buffers = new Map();
  const results = [];
  for (const unit of MANAGEMENT_UNITS) {
    const filePath = path.join(absoluteInputDir, unit.fileName);
    let fileState;
    try {
      fileState = await lstat(filePath);
    } catch (error) {
      results.push(
        inputResult({
          code: error.code === 'ENOENT' ? 'INPUT-E002' : 'INPUT-E004',
          file: unit.fileName,
          message:
            error.code === 'ENOENT'
              ? '必須TSVがありません。'
              : `必須TSVを確認できません: ${error.message}`,
          suggestedAction: `対象シートを ${unit.fileName} という名前で配置してください。`
        })
      );
      continue;
    }
    if (!fileState.isFile() || fileState.isSymbolicLink()) {
      results.push(
        inputResult({
          code: 'INPUT-E003',
          file: unit.fileName,
          message: '必須TSVのパスが通常ファイルではないか、同名衝突の可能性があります。',
          suggestedAction:
            'シンボリックリンクやディレクトリを除き、通常のTSVファイルを配置してください。'
        })
      );
      continue;
    }
    try {
      buffers.set(unit.fileName, await readFile(filePath));
    } catch (error) {
      results.push(
        inputResult({
          code: 'INPUT-E004',
          file: unit.fileName,
          message: `TSVを読み込めません: ${error.message}`,
          suggestedAction: 'ファイル権限とファイルの状態を確認し、TSVを再配置してください。'
        })
      );
    }
  }
  return { absoluteInputDir, buffers, results };
}

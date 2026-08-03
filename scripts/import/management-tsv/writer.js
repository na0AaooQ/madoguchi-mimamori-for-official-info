import { lstat, open, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export class TransactionalWriteError extends Error {
  constructor(message, { cause, rollbackErrors = [], postValidation } = {}) {
    super(message, { cause });
    this.name = 'TransactionalWriteError';
    this.code = 'IMPORT-RUN-E004';
    this.rollbackErrors = rollbackErrors;
    this.postValidation = postValidation;
  }
}

async function stageFile(target, source, token) {
  const state = await lstat(target);
  if (!state.isFile() || state.isSymbolicLink()) {
    throw new Error(`書込み対象が通常ファイルではありません: ${target}`);
  }
  const temporaryPath = `${target}.tmp-${token}`;
  let handle;
  try {
    handle = await open(temporaryPath, 'wx', state.mode);
    await handle.writeFile(source, 'utf8');
    await handle.sync();
    await handle.close();
  } catch (error) {
    try {
      await handle?.close();
    } catch {
      // The original staging error is more useful than a secondary close failure.
    }
    await rm(temporaryPath, { force: true });
    throw error;
  }
  return {
    target,
    temporaryPath,
    backupPath: `${target}.backup-${token}`,
    relativePath: undefined
  };
}

async function rollbackFiles(entries, replaced, backedUp) {
  const rollbackErrors = [];
  for (const entry of [...replaced].reverse()) {
    try {
      await rm(entry.target, { force: true });
    } catch (error) {
      rollbackErrors.push(`新規ファイルを除去できません (${entry.target}): ${error.message}`);
    }
  }
  for (const entry of [...backedUp].reverse()) {
    try {
      await rename(entry.backupPath, entry.target);
    } catch (error) {
      rollbackErrors.push(`バックアップを復元できません (${entry.backupPath}): ${error.message}`);
    }
  }
  for (const entry of entries) {
    try {
      await rm(entry.temporaryPath, { force: true });
    } catch (error) {
      rollbackErrors.push(
        `一時ファイルを削除できません (${entry.temporaryPath}): ${error.message}`
      );
    }
  }
  return rollbackErrors;
}

export async function writeCandidateFiles({
  repoRoot,
  candidates,
  validateAfterWrite,
  afterReplace,
  token = randomUUID()
}) {
  const entries = [];
  const backedUp = [];
  const replaced = [];
  let postValidation;

  try {
    for (const [relativePath, source] of [...candidates.entries()].sort()) {
      const entry = await stageFile(path.join(repoRoot, relativePath), source, token);
      entry.relativePath = relativePath;
      entries.push(entry);
    }

    for (const entry of entries) {
      await rename(entry.target, entry.backupPath);
      backedUp.push(entry);
    }
    for (const entry of entries) {
      await rename(entry.temporaryPath, entry.target);
      replaced.push(entry);
      await afterReplace?.({ count: replaced.length, relativePath: entry.relativePath });
    }

    postValidation = await validateAfterWrite();
    if (!postValidation.ok) {
      throw new TransactionalWriteError('書込み後の管理データ検証に失敗しました。', {
        postValidation
      });
    }
  } catch (error) {
    const rollbackErrors = await rollbackFiles(entries, replaced, backedUp);
    if (error instanceof TransactionalWriteError) {
      error.rollbackErrors.push(...rollbackErrors);
      throw error;
    }
    throw new TransactionalWriteError('18ファイルの安全な置換に失敗しました。', {
      cause: error,
      rollbackErrors,
      postValidation
    });
  }

  const cleanupErrors = [];
  for (const entry of entries) {
    try {
      await rm(entry.backupPath, { force: true });
    } catch (error) {
      cleanupErrors.push(`バックアップを削除できません (${entry.backupPath}): ${error.message}`);
    }
    try {
      await rm(entry.temporaryPath, { force: true });
    } catch (error) {
      cleanupErrors.push(`一時ファイルを削除できません (${entry.temporaryPath}): ${error.message}`);
    }
  }
  if (cleanupErrors.length > 0) {
    throw new TransactionalWriteError(
      '書込みは完了しましたが、一時ファイルの清掃に失敗しました。',
      {
        rollbackErrors: cleanupErrors,
        postValidation
      }
    );
  }
  return { writtenPaths: entries.map(({ relativePath }) => relativePath), postValidation };
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateDataRepository } from './data-validator.js';
import { createResult, exitCodeForResults, formatResults, sortResults } from './result.js';
import { SchemaCompilationError, validateWithSchema } from './schema-validator.js';
import { validateSemanticData } from './semantic-validator.js';

class CliUsageError extends Error {}
class RuntimeValidationError extends Error {}

function parseArguments(args) {
  if (args.length === 1 && args[0] === '--fixtures') return { mode: 'fixtures' };
  if (args.length === 1 && args[0] === '--data') return { mode: 'data' };
  if (args.length === 4) {
    const values = new Map();
    for (let index = 0; index < args.length; index += 2) {
      if (!['--schema', '--data'].includes(args[index]) || !args[index + 1]) {
        throw new CliUsageError(
          'Usage: cli.js --fixtures | --data | --schema <path> --data <path>'
        );
      }
      if (values.has(args[index])) throw new CliUsageError(`Duplicate argument: ${args[index]}`);
      values.set(args[index], args[index + 1]);
    }
    if (values.has('--schema') && values.has('--data')) {
      return { mode: 'schema', schemaPath: values.get('--schema'), dataPath: values.get('--data') };
    }
  }
  throw new CliUsageError('Usage: cli.js --fixtures | --data | --schema <path> --data <path>');
}

async function readJsonTarget(filePath, displayPath) {
  let source;
  try {
    source = await readFile(filePath, 'utf8');
  } catch (error) {
    throw new RuntimeValidationError(`Unable to read ${displayPath}: ${error.message}`, {
      cause: error
    });
  }
  try {
    return { value: JSON.parse(source), results: [] };
  } catch (error) {
    return {
      value: undefined,
      results: [
        createResult({
          severity: 'error',
          code: 'E001',
          file: displayPath,
          message: `JSON構文が不正です: ${error.message}`,
          suggested_action: 'JSON構文を修正してください。'
        })
      ]
    };
  }
}

async function runSchemaValidation({ schemaPath, dataPath }, cwd) {
  const absoluteSchema = path.resolve(cwd, schemaPath);
  const absoluteData = path.resolve(cwd, dataPath);
  const [schemaRead, dataRead] = await Promise.all([
    readJsonTarget(absoluteSchema, schemaPath),
    readJsonTarget(absoluteData, dataPath)
  ]);
  const parseResults = [...schemaRead.results, ...dataRead.results];
  if (parseResults.length > 0) return sortResults(parseResults);
  return validateWithSchema(schemaRead.value, dataRead.value, {
    schemaFile: schemaPath,
    file: dataPath,
    itemId: dataRead.value?.id
  });
}

function resultCounts(results) {
  const counts = {};
  for (const result of results) counts[result.code] = (counts[result.code] ?? 0) + 1;
  return counts;
}

function compareExpected(caseName, results, expectedCounts) {
  const actual = resultCounts(results);
  const normalizedActual = Object.fromEntries(Object.entries(actual).sort());
  const normalizedExpected = Object.fromEntries(Object.entries(expectedCounts).sort());
  if (JSON.stringify(normalizedActual) !== JSON.stringify(normalizedExpected)) {
    return createResult({
      severity: 'error',
      code: 'FIXTURE-E001',
      file: 'tests/fixtures/manifest.json',
      item_id: caseName,
      message: `期待結果 ${JSON.stringify(expectedCounts)} に対し、実際は ${JSON.stringify(actual)} でした。`
    });
  }
  return null;
}

async function runFixtures(cwd) {
  const fixturesRoot = path.join(cwd, 'tests', 'fixtures');
  const manifestPath = path.join(fixturesRoot, 'manifest.json');
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    throw new RuntimeValidationError(`Unable to load fixture manifest: ${error.message}`, {
      cause: error
    });
  }
  if (!Array.isArray(manifest.cases)) {
    throw new RuntimeValidationError('Fixture manifest cases must be an array.');
  }

  const mismatches = [];
  for (const fixtureCase of manifest.cases) {
    let results;
    if (fixtureCase.type === 'schema') {
      results = await runSchemaValidation(
        {
          schemaPath: path.join('tests', 'fixtures', fixtureCase.schema),
          dataPath: path.join('tests', 'fixtures', fixtureCase.data)
        },
        cwd
      );
    } else if (fixtureCase.type === 'semantic') {
      const dataPath = path.join(fixturesRoot, fixtureCase.data);
      const read = await readJsonTarget(
        dataPath,
        path.join('tests', 'fixtures', fixtureCase.data).split(path.sep).join('/')
      );
      if (read.results.length > 0) results = read.results;
      else results = validateSemanticData(read.value, { file: fixtureCase.data });
    } else {
      throw new RuntimeValidationError(`Unknown fixture type: ${fixtureCase.type}`);
    }
    const mismatch = compareExpected(fixtureCase.name, results, fixtureCase.expected_counts ?? {});
    if (mismatch) mismatches.push(mismatch);
  }
  return sortResults(mismatches);
}

export async function runCli(
  args,
  { cwd = process.cwd(), stdout = console.log, stderr = console.error } = {}
) {
  try {
    const options = parseArguments(args);
    if (options.mode === 'data') {
      const { results, runtimeResults } = await validateDataRepository(cwd);
      stdout(formatResults([...results, ...runtimeResults]));
      return runtimeResults.length > 0 ? 2 : exitCodeForResults(results);
    }
    const results =
      options.mode === 'fixtures'
        ? await runFixtures(cwd)
        : await runSchemaValidation(options, cwd);
    stdout(formatResults(results));
    return exitCodeForResults(results);
  } catch (error) {
    if (
      error instanceof CliUsageError ||
      error instanceof RuntimeValidationError ||
      error instanceof SchemaCompilationError
    ) {
      stderr(`Validation runtime error: ${error.message}`);
      return 2;
    }
    stderr(`Unexpected validation error: ${error.stack ?? error.message}`);
    return 2;
  }
}

const isDirectExecution =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isDirectExecution) process.exitCode = await runCli(process.argv.slice(2));

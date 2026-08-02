import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import { createResult, sortResults } from './result.js';

export class SchemaCompilationError extends Error {
  constructor(schemaFile, cause) {
    super(`Schema compilation failed for ${schemaFile}: ${cause.message}`, { cause });
    this.name = 'SchemaCompilationError';
    this.schemaFile = schemaFile;
  }
}

export function compileSchema(schema, { schemaFile = '<schema>' } = {}) {
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);

  try {
    return ajv.compile(schema);
  } catch (error) {
    throw new SchemaCompilationError(schemaFile, error);
  }
}

function fieldFromAjvError(error) {
  if (error.keyword === 'required') return error.params.missingProperty;
  return error.instancePath.replace(/^\//, '').replaceAll('/', '.');
}

export function normalizeAjvErrors(errors, { file, itemId } = {}) {
  return sortResults(
    (errors ?? []).map((error) => {
      const field = fieldFromAjvError(error);
      return createResult({
        severity: 'error',
        code: 'E002',
        file,
        message: `${error.instancePath || '/'} [${error.keyword}] ${error.message}`,
        ...(itemId ? { item_id: itemId } : {}),
        ...(field ? { field } : {}),
        suggested_action: `JSON Schema rule '${error.keyword}'を確認してください。`
      });
    })
  );
}

export function validateWithSchema(schema, data, options = {}) {
  const validate = compileSchema(schema, options);
  const valid = validate(data);
  if (valid) return [];
  return normalizeAjvErrors(validate.errors, options);
}

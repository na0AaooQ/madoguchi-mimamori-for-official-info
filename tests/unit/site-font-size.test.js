import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  path.resolve(import.meta.dirname, '../../site/assets/font-size.js'),
  'utf8'
);

function execute({ stored = null, storageThrows = false } = {}) {
  const listeners = new Map();
  const buttons = ['standard', 'large'].map((value) => ({
    dataset: { textSize: value },
    attributes: new Map(),
    addEventListener(name, listener) {
      listeners.set(value, listener);
    },
    setAttribute(name, value) {
      this.attributes.set(name, value);
    }
  }));
  const control = { hidden: true, querySelectorAll: () => buttons };
  const root = { dataset: {} };
  const writes = [];
  const context = {
    document: { documentElement: root, querySelector: () => control },
    sessionStorage: {
      getItem() {
        if (storageThrows) throw new Error('blocked');
        return stored;
      },
      setItem(key, value) {
        if (storageThrows) throw new Error('blocked');
        writes.push([key, value]);
      }
    },
    Set
  };
  vm.runInNewContext(source, context);
  return { root, control, buttons, listeners, writes };
}

test('starts at standard and reveals the enhancement only after initialization', () => {
  const result = execute();
  assert.equal(result.root.dataset.textSize, 'standard');
  assert.equal(result.control.hidden, false);
  assert.equal(result.buttons[0].attributes.get('aria-pressed'), 'true');
});

test('selects large, returns to standard, and saves only allowed values', () => {
  const result = execute();
  result.listeners.get('large')();
  assert.equal(result.root.dataset.textSize, 'large');
  assert.deepEqual(result.writes.at(-1), ['madoguchi-text-size', 'large']);
  result.listeners.get('standard')();
  assert.equal(result.root.dataset.textSize, 'standard');
  assert.deepEqual(result.writes.at(-1), ['madoguchi-text-size', 'standard']);
});

test('restores a valid value and treats invalid or unavailable storage as standard', () => {
  assert.equal(execute({ stored: 'large' }).root.dataset.textSize, 'large');
  assert.equal(execute({ stored: 'unexpected' }).root.dataset.textSize, 'standard');
  assert.doesNotThrow(() => execute({ storageThrows: true }));
  assert.doesNotMatch(source, /localStorage|document\.cookie|fetch\(|XMLHttpRequest/);
});

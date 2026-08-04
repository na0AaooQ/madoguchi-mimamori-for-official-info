(() => {
  'use strict';

  const storageKey = 'madoguchi-text-size';
  const allowedValues = new Set(['standard', 'large']);
  const root = document.documentElement;
  const control = document.querySelector('[data-font-size-control]');

  if (!control) return;

  const buttons = [...control.querySelectorAll('button[data-text-size]')];

  function readStoredValue() {
    try {
      const value = sessionStorage.getItem(storageKey);
      return allowedValues.has(value) ? value : 'standard';
    } catch {
      return 'standard';
    }
  }

  function storeValue(value) {
    try {
      sessionStorage.setItem(storageKey, value);
    } catch {
      // The selected size still applies to the current page.
    }
  }

  function applyValue(value, persist) {
    const safeValue = allowedValues.has(value) ? value : 'standard';
    root.dataset.textSize = safeValue;
    for (const button of buttons) {
      button.setAttribute('aria-pressed', String(button.dataset.textSize === safeValue));
    }
    if (persist) storeValue(safeValue);
  }

  for (const button of buttons) {
    button.addEventListener('click', () => applyValue(button.dataset.textSize, true));
  }

  applyValue(readStoredValue(), false);
  control.hidden = false;
})();

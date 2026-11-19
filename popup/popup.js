(function () {
  'use strict';
  const DEFAULTS = McMasterMetric.DEFAULT_OPTIONS;
  const $enabled = document.getElementById('enabled');
  const $modes = document.querySelectorAll('input[name=mode]');
  const $scopes = document.querySelectorAll('input[name=scope]');
  const $cats = document.querySelectorAll('input[data-cat]');
  const $presets = document.querySelectorAll('input[data-preset]');
  const $custom = document.getElementById('custom');

  let state = null;

  function render() {
    $enabled.checked = state.enabled;
    document.body.classList.toggle('off', !state.enabled);
    document.body.classList.toggle('scope-all', state.scope.mode !== 'selected');
    $modes.forEach((r) => { r.checked = r.value === state.mode; });
    $scopes.forEach((r) => { r.checked = r.value === state.scope.mode; });
    $cats.forEach((c) => { c.checked = !!state.categories[c.dataset.cat]; });
    $presets.forEach((c) => { c.checked = !!state.scope.presets[c.dataset.preset]; });
    if (document.activeElement !== $custom) $custom.value = state.scope.custom || '';
  }

  function save() {
    chrome.storage.sync.set(state);
  }

  chrome.storage.sync.get(DEFAULTS, (saved) => {
    state = Object.assign({}, DEFAULTS, saved);
    state.categories = Object.assign({}, DEFAULTS.categories, saved.categories);
    state.scope = Object.assign({}, DEFAULTS.scope, saved.scope);
    state.scope.presets = Object.assign({}, DEFAULTS.scope.presets, state.scope.presets);
    render();
  });

  $enabled.addEventListener('change', () => { state.enabled = $enabled.checked; render(); save(); });
  $modes.forEach((r) => r.addEventListener('change', () => { if (r.checked) { state.mode = r.value; save(); } }));
  $scopes.forEach((r) => r.addEventListener('change', () => { if (r.checked) { state.scope.mode = r.value; render(); save(); } }));
  $cats.forEach((c) => c.addEventListener('change', () => { state.categories[c.dataset.cat] = c.checked; save(); }));
  $presets.forEach((c) => c.addEventListener('change', () => { state.scope.presets[c.dataset.preset] = c.checked; save(); }));
  let debounce = null;
  $custom.addEventListener('input', () => {
    state.scope.custom = $custom.value;
    clearTimeout(debounce);
    debounce = setTimeout(save, 300);
  });
})();

// Content script: wires saved settings + page scope to the DOM engine.
(function () {
  'use strict';
  const conv = globalThis.McMasterMetric;
  const engine = globalThis.McMasterMetricDom.createEngine(document, conv);
  const DEFAULTS = conv.DEFAULT_OPTIONS;

  let settings = null;
  let active = null; // whether the engine is currently converting
  let signature = '';

  function pageInfo() {
    const h1 = document.querySelector('h1');
    const crumbs = document.querySelectorAll('nav[aria-label="Breadcrumbs"] li');
    return {
      path: location.pathname,
      title: document.title,
      h1: h1 ? h1.textContent : '',
      crumbs: Array.from(crumbs, (li) => li.textContent).join(' | ')
    };
  }

  // Re-evaluate scope; only touch the engine when the answer (or settings) changed.
  function evaluate(force) {
    if (!settings) return;
    const info = pageInfo();
    const sig = [info.path, info.title, info.h1, info.crumbs].join('\u0001');
    if (!force && sig === signature) return;
    signature = sig;
    const want = settings.enabled && conv.pageInScope(settings.scope, info);
    if (!force && want === active) return;
    active = want;
    engine.setOptions(Object.assign({}, settings, { enabled: want }));
  }

  function load() {
    chrome.storage.sync.get(DEFAULTS, (saved) => {
      // merge nested objects so newly added options default sensibly
      saved.categories = Object.assign({}, DEFAULTS.categories, saved.categories);
      saved.scope = Object.assign({}, DEFAULTS.scope, saved.scope);
      saved.scope.presets = Object.assign({}, DEFAULTS.scope.presets, saved.scope.presets);
      settings = saved;
      evaluate(true);
    });
  }

  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'sync') load();
  });

  // McMaster is a single-page app: title / heading / breadcrumb change as you navigate.
  let t = null;
  new MutationObserver(() => {
    if (t === null) t = setTimeout(() => { t = null; evaluate(false); }, 250);
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  load();
})();

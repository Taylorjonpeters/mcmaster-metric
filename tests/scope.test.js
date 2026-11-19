const test = require('node:test');
const assert = require('node:assert/strict');
const { pageInScope } = require('../src/converter.js');

const raw = { mode: 'selected', presets: { raw: true, fasteners: false, pipe: false }, custom: '' };

test('"all" mode is always in scope', () => {
  assert.equal(pageInScope({ mode: 'all' }, { title: 'anything' }), true);
});

test('raw materials preset matches stock pages, not fasteners', () => {
  assert.equal(pageInScope(raw, { title: 'Easy-to-Machine 6061 Aluminum Rectangular Bar, 1/2" Thick' }), true);
  assert.equal(pageInScope(raw, { path: '/products/aluminum-sheets/', title: 'McMaster-Carr' }), true);
  assert.equal(pageInScope(raw, { crumbs: '...Square Tubing91251' }), true);
  assert.equal(pageInScope(raw, { title: 'Black-Oxide Alloy Steel Socket Head Screw, US Origin, 1/4 -20 Thread Size', h1: 'Black-Oxide Alloy Steel Socket Head Screw' }), false);
  assert.equal(pageInScope(raw, { title: 'McMaster-Carr' }), false);
});

test('material-only titles count as raw stock, unless the page is another section', () => {
  assert.equal(pageInScope(raw, { title: 'aluminum | McMaster-Carr', path: '/products/aluminum/' }), true);
  assert.equal(pageInScope(raw, { title: 'brass | McMaster-Carr' }), true);
  assert.equal(pageInScope(raw, { title: 'Black-Oxide Alloy Steel Socket Head Screw' }), false);
  assert.equal(pageInScope(raw, { title: 'Stainless Steel Hex Nuts' }), false);
  assert.equal(pageInScope(raw, { title: 'Steel Pipe Fittings' }), false);
  // once fasteners are selected, those pages are in scope on their own keywords
  const both = { mode: 'selected', presets: { raw: true, fasteners: true, pipe: false }, custom: '' };
  assert.equal(pageInScope(both, { title: 'Black-Oxide Alloy Steel Socket Head Screw' }), true);
});

test('keywords match whole words only', () => {
  assert.equal(pageInScope(raw, { title: 'Barbed Hose Fitting' }), false);
  assert.equal(pageInScope(raw, { title: 'Bars' }), true);
});

test('presets combine and custom keywords extend', () => {
  const s = { mode: 'selected', presets: { raw: true, fasteners: true, pipe: false }, custom: 'o-ring, gasket' };
  assert.equal(pageInScope(s, { title: 'Socket Head Screw' }), true);
  assert.equal(pageInScope(s, { title: 'Buna-N O-Ring' }), true);
  assert.equal(pageInScope(s, { path: '/products/gaskets/' }), true);
  assert.equal(pageInScope(s, { title: 'Ball Bearing' }), false);
});

test('selected mode with nothing chosen converts nowhere', () => {
  assert.equal(pageInScope({ mode: 'selected', presets: {}, custom: '' }, { title: 'Bar' }), false);
});

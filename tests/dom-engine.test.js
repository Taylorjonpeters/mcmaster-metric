const test = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const conv = require('../src/converter.js');
const { createEngine } = require('../src/dom-engine.js');

function setup(html, options) {
  const dom = new JSDOM('<!doctype html><body>' + html + '</body>');
  const engine = createEngine(dom.window.document, conv);
  engine.setOptions(Object.assign({}, conv.DEFAULT_OPTIONS, options));
  engine.flushNow();
  return { dom, doc: dom.window.document, engine };
}
const tick = (win) => new Promise((r) => win.setTimeout(r, 60));

test('converts a value split across a fraction element and a sibling quote node', () => {
  const { doc } = setup('<p id="a"><span class="frac">3/4</span>"</p>');
  assert.equal(doc.getElementById('a').textContent, '19.05 mm');
});

test('thread size split across nodes stays intact; length converts', () => {
  const { doc } = setup('<h3 id="h">US Origin, <span>1/4</span>"-20 Thread Size, <span>3/4</span>" Long</h3>');
  assert.equal(doc.getElementById('h').textContent, 'US Origin, 1/4"-20 Thread Size, 19.05 mm Long');
});

test('"both" mode keeps original nodes and appends metric', () => {
  const { doc } = setup('<p id="a"><span>3/4</span>"</p>', { mode: 'both' });
  const p = doc.getElementById('a');
  assert.equal(p.textContent, '3/4" (19.05 mm)');
  assert.equal(p.querySelector('span').textContent, '3/4'); // styling element untouched
});

test('skips script/style/textarea', () => {
  const { doc } = setup('<script id="s">var x = "3/4\\"";</script><textarea id="t">3/4"</textarea><p id="p">3/4"</p>');
  assert.equal(doc.getElementById('t').value, '3/4"');
  assert.match(doc.getElementById('s').textContent, /3\/4/);
  assert.equal(doc.getElementById('p').textContent, '19.05 mm');
});

test('converts dynamically added content and does not loop', async () => {
  const { doc, dom } = setup('<div id="root"></div>');
  const el = doc.createElement('p');
  el.innerHTML = '<span>1</span> <span>1/2</span>"';
  doc.getElementById('root').appendChild(el);
  await tick(dom.window);
  assert.equal(el.textContent, '38.1 mm');
});

test('reconverts when the site rewrites a text node', async () => {
  const { doc, dom } = setup('<p id="p">3/4"</p>');
  const node = doc.getElementById('p').firstChild;
  node.nodeValue = '1/2"';
  await tick(dom.window);
  assert.equal(doc.getElementById('p').textContent, '12.7 mm');
});

test('disabling restores the original text', () => {
  const { doc, engine } = setup('<p id="p"><span>3/4</span>" and 170,000 psi</p>');
  assert.equal(doc.getElementById('p').textContent, '19.05 mm and 1,172 MPa');
  engine.setOptions(Object.assign({}, conv.DEFAULT_OPTIONS, { enabled: false }));
  assert.equal(doc.getElementById('p').textContent, '3/4" and 170,000 psi');
});

test('switching mode re-renders from the original text', () => {
  const { doc, engine } = setup('<p id="p">3/4" Long</p>');
  engine.setOptions(Object.assign({}, conv.DEFAULT_OPTIONS, { mode: 'both' }));
  engine.flushNow();
  assert.equal(doc.getElementById('p').textContent, '3/4" (19.05 mm) Long');
});

test('separate cells are not glued together', () => {
  const { doc } = setup('<div><a id="a">3/4</a><a id="b">"</a></div><div id="c">5 lbs.</div>');
  assert.equal(doc.getElementById('a').textContent, '3/4'); // <a> boundaries respected
  assert.equal(doc.getElementById('c').textContent, '2.27 kg');
});

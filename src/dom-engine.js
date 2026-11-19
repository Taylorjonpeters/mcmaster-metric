/*
 * DOM side of the converter. Works on "blocks" (nearest non-inline ancestor
 * of a text node) and matches across ALL text nodes in the block, because
 * McMaster renders values like 3/4" as separate nodes (fraction element + a
 * sibling text node holding the quote mark).
 *
 * Exposes globalThis.McMasterMetricDom.createEngine(doc, converter).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.McMasterMetricDom = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // Elements that don't start a new "line" of text. <a> deliberately absent:
  // separate links/chips shouldn't be glued together.
  const INLINE = new Set(['SPAN', 'B', 'I', 'EM', 'STRONG', 'SUP', 'SUB', 'SMALL', 'U', 'FONT', 'ABBR', 'MARK', 'S', 'TT', 'BDI', 'BDO']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE', 'SVG', 'CANVAS', 'TEMPLATE']);

  const FILTER_ACCEPT = 1, FILTER_REJECT = 2, FILTER_SKIP = 3;
  const SHOW_ELEMENT_TEXT = 1 | 4;
  const BUDGET_MS = 12;

  const isSkippedEl = (el) =>
    SKIP.has(String(el.nodeName).toUpperCase()) || el.isContentEditable === true;

  function blockOf(textNode) {
    let el = textNode.parentElement;
    while (el && el.parentElement && INLINE.has(el.tagName)) el = el.parentElement;
    return el;
  }

  function inSkipped(node) {
    for (let el = node.nodeType === 1 ? node : node.parentElement; el; el = el.parentElement) {
      if (isSkippedEl(el)) return true;
    }
    return false;
  }

  function createEngine(doc, conv) {
    const win = doc.defaultView;
    let opts = Object.assign({}, conv.DEFAULT_OPTIONS);
    let observer = null;
    let timer = null;
    const queue = new Set();
    const originals = new Map(); // text node -> text before we touched it
    const lastOut = new WeakMap(); // text node -> text we last wrote

    function textNodesIn(rootNode) {
      const nodes = [];
      if (rootNode.nodeType === 3) {
        if (!inSkipped(rootNode)) nodes.push(rootNode);
        return nodes;
      }
      if (rootNode.nodeType !== 1 || inSkipped(rootNode)) return nodes;
      const walker = doc.createTreeWalker(rootNode, SHOW_ELEMENT_TEXT, {
        acceptNode(n) {
          if (n.nodeType === 1) return isSkippedEl(n) ? FILTER_REJECT : FILTER_SKIP;
          return FILTER_ACCEPT;
        }
      });
      let n;
      while ((n = walker.nextNode())) nodes.push(n);
      return nodes;
    }

    function enqueue(node) {
      for (const t of textNodesIn(node)) {
        if (!t.nodeValue || !t.nodeValue.trim()) continue;
        const b = blockOf(t);
        if (b) queue.add(b);
      }
      schedule();
    }

    function schedule() {
      if (timer !== null || !queue.size) return;
      timer = win.setTimeout(flush, 30);
    }

    function applyEdits(nodes, text, edits) {
      let a = 0;
      for (const node of nodes) {
        const b = a + node.nodeValue.length;
        let out = '';
        let cur = a;
        for (const e of edits) {
          if (e.start === e.end) {
            // pure insertion (append mode): goes at the end of the node holding e.start
            if (e.start > a && e.start <= b) {
              out += text.slice(cur, e.start) + e.text;
              cur = e.start;
            }
            continue;
          }
          if (e.end <= a || e.start >= b) continue;
          out += text.slice(cur, Math.max(e.start, a));
          if (e.start >= a) out += e.text; // replacement lives in the first node of the match
          cur = Math.min(e.end, b);
        }
        out += text.slice(cur, b);
        const prev = node.nodeValue;
        if (out !== prev) {
          if (prev !== lastOut.get(node)) originals.set(node, prev); // fresh text from the site
          node.nodeValue = out;
          lastOut.set(node, out);
        }
        a = b;
      }
    }

    function processBlock(block) {
      const nodes = textNodesIn(block).filter((t) => blockOf(t) === block);
      if (!nodes.length) return;
      const text = nodes.map((n) => n.nodeValue).join('');
      if (!/[\d½¼¾⅛⅜⅝⅞⅓⅔]/.test(text)) return;
      const matches = conv.findMatches(text, opts);
      if (!matches.length) return;
      const edits = matches.map((m) =>
        opts.mode === 'both'
          ? { start: m.end, end: m.end, text: ' (' + m.metric + ')' }
          : { start: m.start, end: m.end, text: m.metric }
      );
      applyEdits(nodes, text, edits);
    }

    function flush() {
      timer = null;
      const t0 = Date.now();
      for (const b of queue) {
        queue.delete(b);
        if (b.isConnected) processBlock(b);
        if (Date.now() - t0 > BUDGET_MS) break;
      }
      if (observer) observer.takeRecords(); // discard our own mutations
      if (originals.size > 3000) {
        for (const n of originals.keys()) if (!n.isConnected) originals.delete(n);
      }
      schedule();
    }

    function onMutations(records) {
      for (const r of records) {
        if (r.type === 'characterData') enqueue(r.target);
        else r.addedNodes.forEach(enqueue);
      }
    }

    function restoreAll() {
      for (const [n, orig] of originals) {
        if (n.isConnected && n.nodeValue === lastOut.get(n)) n.nodeValue = orig;
      }
      originals.clear();
    }

    function stop() {
      if (observer) { observer.disconnect(); observer = null; }
      if (timer !== null) { win.clearTimeout(timer); timer = null; }
      queue.clear();
      restoreAll();
    }

    function start() {
      if (observer) return;
      observer = new win.MutationObserver(onMutations);
      observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
      enqueue(doc.body || doc.documentElement);
    }

    function setOptions(next) {
      opts = Object.assign({}, conv.DEFAULT_OPTIONS, next);
      stop();
      if (opts.enabled) start();
    }

    return { setOptions, start, stop, flushNow: () => { if (timer !== null) { win.clearTimeout(timer); } flush(); } };
  }

  return { createEngine };
});

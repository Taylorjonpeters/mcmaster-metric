/*
 * Imperial -> metric text converter. Pure functions, no DOM access.
 * Loaded as a content script (exposes globalThis.McMasterMetric) and
 * required directly by the Node tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.McMasterMetric = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_OPTIONS = {
    enabled: true,
    mode: 'replace', // 'replace' => "19.05 mm"   |   'both' => '3/4" (19.05 mm)'
    categories: {
      length: true,
      area: true,
      volume: true,
      mass: true,
      pressure: true,
      temperature: true,
      other: true // torque, speed, flow, power, force
    },
    // Which McMaster pages to convert on. McMaster doesn't expose its top-level
    // catalog family in the DOM, so "selected" matches keywords against the
    // page title / heading / breadcrumb / URL.
    scope: {
      mode: 'selected', // 'all' | 'selected'  (default: raw materials & stock only)
      presets: { raw: true, fasteners: false, pipe: false },
      custom: '' // extra comma/newline separated keywords
    }
  };

  const PRESETS = {
    raw: {
      label: 'Raw materials & stock',
      keywords: ['stock', 'bar', 'rod', 'sheet', 'plate', 'strip', 'foil', 'shim', 'tube', 'tubing',
        'beam', 'extrusion', 'extruded', 'billet', 'slab', 'film', 'mesh']
    },
    fasteners: {
      label: 'Fasteners',
      keywords: ['screw', 'bolt', 'nut', 'washer', 'rivet', 'stud', 'anchor', 'pin', 'nail', 'retaining ring', 'threaded insert']
    },
    pipe: {
      label: 'Pipe, tubing & fittings',
      keywords: ['pipe', 'tube', 'tubing', 'hose', 'fitting', 'coupling', 'elbow', 'nipple', 'valve', 'flange']
    }
  };

  function keywordRegex(words) {
    const alts = words
      .map((w) => w.trim())
      .filter(Boolean)
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '[\\s-]+'));
    return alts.length ? new RegExp('\\b(?:' + alts.join('|') + ')(?:s|es)?(?![A-Za-z])', 'i') : null;
  }

  /** info = { path, title, h1, crumbs }. 'all' mode is always in scope. */
  function pageInScope(scope, info) {
    if (!scope || scope.mode !== 'selected') return true;
    const words = [];
    for (const k of Object.keys(PRESETS)) if (scope.presets && scope.presets[k]) words.push(...PRESETS[k].keywords);
    words.push(...String(scope.custom || '').split(/[,\n]/));
    const re = keywordRegex(words);
    if (!re) return false;
    const hay = [info.title, info.h1, info.crumbs, String(info.path || '').replace(/[-_/]+/g, ' ')].join(' | ');
    return re.test(hay);
  }

  // ---------------------------------------------------------------- numbers
  const UNI_FRAC = {
    '½': 1 / 2, '¼': 1 / 4, '¾': 3 / 4,
    '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8,
    '⅓': 1 / 3, '⅔': 2 / 3
  };
  const UNI_CLASS = '[½¼¾⅛⅜⅝⅞⅓⅔]';

  // Order matters: most specific first.
  const NUM =
    '(?:\\d+[\\s-]+\\d+\\/\\d+' + //   1 1/2   or   1-1/2
    '|\\d+\\/\\d+' + //                3/4
    '|\\d*' + UNI_CLASS + //           ½   1½
    '|\\d{1,3}(?:,\\d{3})+(?:\\.\\d+)?' + // 170,000
    '|\\d*\\.\\d+' + //                0.25   .5
    '|\\d+)'; //                       12

  function parseNum(raw) {
    const s = raw.trim();
    let m;
    if ((m = s.match(new RegExp('^(\\d*)(' + UNI_CLASS + ')$')))) return (+m[1] || 0) + UNI_FRAC[m[2]];
    if ((m = s.match(/^(\d+)[\s-]+(\d+)\/(\d+)$/))) return +m[3] ? +m[1] + +m[2] / +m[3] : NaN;
    if ((m = s.match(/^(\d+)\/(\d+)$/))) return +m[2] ? +m[1] / +m[2] : NaN;
    return parseFloat(s.replace(/,/g, ''));
  }

  // Number of decimals depends on magnitude so 19.05 mm keeps its precision
  // while 3,048 mm doesn't get silly.
  function fmt(v) {
    const a = Math.abs(v);
    const d = a >= 1000 ? 0 : a >= 100 ? 1 : a >= 1 ? 2 : a >= 0.1 ? 3 : 4;
    let s = v.toFixed(d);
    if (s.indexOf('.') !== -1) s = s.replace(/\.?0+$/, '');
    if (s === '-0' || s === '') s = '0';
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // ------------------------------------------------------------ unit tables
  // Each converter takes the imperial value and returns [value, metricUnit].
  const IN = 25.4;
  const length = (mm) => (Math.abs(mm) >= 10000 ? [mm / 1000, 'm'] : [mm, 'mm']);
  const mass = (g) => (Math.abs(g) >= 1000 ? [g / 1000, 'kg'] : [g, 'g']);
  const pressure = (kpa) => (Math.abs(kpa) >= 1000 ? [kpa / 1000, 'MPa'] : [kpa, 'kPa']);
  const area = (cm2) => (Math.abs(cm2) >= 10000 ? [cm2 / 10000, 'm²'] : [cm2, 'cm²']);
  const volume = (ml) =>
    Math.abs(ml) >= 1e6 ? [ml / 1e6, 'm³'] : Math.abs(ml) >= 1000 ? [ml / 1000, 'L'] : [ml, 'mL'];
  const scale = (k, unit) => (v) => [v * k, unit];

  // Order matters (first match wins in the alternation): longer / more
  // specific spellings must come before their prefixes.
  const UNITS = [
    // torque
    { id: 'ftlb', cat: 'other', src: 'ft\\.?[\\s-]*lbs?\\.?', conv: scale(1.3558179483, 'N·m') },
    { id: 'inlb', cat: 'other', src: 'in(?:ch(?:es)?)?\\.?[\\s-]*lbs?\\.?', conv: scale(0.1129848290, 'N·m') },
    // speed / flow / power / force
    { id: 'fpm', cat: 'other', src: '(?:ft\\.?\\/min\\.?|fpm)', conv: scale(0.3048, 'm/min') },
    { id: 'fps', cat: 'other', src: 'ft\\.?\\/(?:sec|s)\\.?', conv: scale(0.3048, 'm/s') },
    { id: 'mph', cat: 'other', src: 'mph', conv: scale(1.609344, 'km/h') },
    { id: 'gpm', cat: 'other', src: 'gpm', conv: scale(3.785411784, 'L/min') },
    { id: 'cfm', cat: 'other', src: 'cfm', conv: scale(1.699010796, 'm³/h') },
    { id: 'hp', cat: 'other', src: 'hp', conv: scale(0.7456998716, 'kW') },
    { id: 'lbf', cat: 'other', src: 'lbf', conv: scale(4.4482216153, 'N') },
    // pressure
    { id: 'psi', cat: 'pressure', src: 'psi[ga]?', conv: (v) => pressure(v * 6.894757293) },
    // area
    { id: 'sqin', cat: 'area', src: '(?:sq\\.?\\s*in(?:ch(?:es)?)?\\.?|in²)', conv: (v) => area(v * 6.4516) },
    { id: 'sqft', cat: 'area', src: '(?:sq\\.?\\s*ft\\.?|ft²)', conv: (v) => area(v * 929.0304) },
    // volume
    { id: 'cuin', cat: 'volume', src: '(?:cu\\.?\\s*in\\.?|in³)', conv: (v) => volume(v * 16.387064) },
    { id: 'cuft', cat: 'volume', src: '(?:cu\\.?\\s*ft\\.?|ft³)', conv: (v) => volume(v * 28316.846592) },
    { id: 'floz', cat: 'volume', src: 'fl\\.?\\s*oz\\.?', conv: (v) => volume(v * 29.5735295625) },
    { id: 'gal', cat: 'volume', src: 'gal(?:lons?)?\\.?', conv: (v) => volume(v * 3785.411784) },
    { id: 'qt', cat: 'volume', src: '(?:qt|quarts?)\\.?', conv: (v) => volume(v * 946.352946) },
    // mass
    { id: 'lb', cat: 'mass', src: '(?:lbs?|pounds?)\\.?', conv: (v) => mass(v * 453.59237) },
    { id: 'oz', cat: 'mass', src: '(?:oz|ounces?)\\.?', conv: (v) => mass(v * 28.349523125) },
    // length
    { id: 'in', cat: 'length', src: 'in(?:ch(?:es)?)?\\.?', conv: (v) => length(v * IN) },
    { id: 'ft', cat: 'length', src: '(?:ft|feet|foot)\\.?', conv: (v) => length(v * 304.8) },
    { id: 'yd', cat: 'length', src: '(?:yds?|yards?)\\.?', conv: (v) => length(v * 914.4) }
  ];
  UNITS.forEach((u) => { u.full = new RegExp('^(?:' + u.src + ')$', 'i'); });
  const unitDef = (text) => UNITS.find((u) => u.full.test(text.trim()));

  const WORD_UNITS = UNITS.map((u) => u.src).join('|');
  // Symbol units never need a word boundary: 3/4" , 5'
  const QUOTE_IN = '["″”]';
  const QUOTE_FT = "['′](?![A-Za-z])";
  const UNIT_ALT =
    '(' + QUOTE_IN + '|' + QUOTE_FT + '|(?:' + WORD_UNITS + ')(?![A-Za-z0-9²³]))';

  const LB = '(?<![\\w.#\\/])'; // don't start inside tokens like M6x1.5 or #10-32

  // ------------------------------------------------------------ regex rules
  // Thread callouts such as 1/4"-20 or #10-32 are names, not lengths.
  const RE_THREAD = new RegExp(
    LB + '(?:#\\d+-\\d+|' + NUM + '["″”]-\\d+(?![\\d"″”\\/.]))',
    'gi'
  );
  const TNUM = '-?\\d+(?:\\.\\d+)?';
  const RE_TEMP_RANGE = new RegExp(
    '(?<![\\w.])(' + TNUM + ')\\s*°?\\s*(?:to|–|—|-)\\s*(' + TNUM + ')\\s*°\\s*F\\b',
    'gi'
  );
  const RE_TEMP = new RegExp('(?<![\\w.])(' + TNUM + ')\\s*°\\s*F\\b', 'gi');
  // "3 x 4 x 5 in."  (unit only on the last number; word units only)
  const RE_DIMS = new RegExp(
    LB + '(' + NUM + '(?:\\s*[x×]\\s*' + NUM + ')+)\\s*(in(?:ch(?:es)?)?\\.?|ft\\.?)(?![A-Za-z0-9²³])',
    'gi'
  );
  const RE_SIMPLE = new RegExp(LB + '(' + NUM + ')\\s*' + UNIT_ALT + '(?!\\s+stock\\b)', 'gi');

  // Text we've already appended in "both" mode, e.g. '3/4" (19.05 mm)'.
  const RE_ALREADY =
    /^\s*\(\s*-?[\d,.]+[^()]{0,30}?\s*(?:mm|cm|m|kg|g|mL|L|kPa|MPa|°\s?C|N|kW|N·m|m³\/h|L\/min|m\/s|m\/min|km\/h|cm²|m²)\s*\)/;

  const c2 = (f) => (f - 32) * 5 / 9;
  const tempStr = (f) => fmt(Math.round(c2(f) * 10) / 10);

  function collect(text, re, prio, build, out) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text))) {
      const r = build(m);
      if (r !== undefined) out.push({ start: m.index, end: m.index + m[0].length, prio, ...r });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  function convertQuantity(numText, unitText) {
    const value = parseNum(numText);
    if (!isFinite(value)) return null;
    let def;
    if (new RegExp('^' + QUOTE_IN + '$').test(unitText)) def = unitDef('in');
    else if (/^['′]$/.test(unitText)) def = unitDef('ft');
    else def = unitDef(unitText);
    if (!def) return null;
    const [v, u] = def.conv(value);
    return { cat: def.cat, metric: fmt(v) + ' ' + u };
  }

  /**
   * Find every imperial quantity in `text`.
   * Returns [{start, end, original, metric, cat}] sorted and non-overlapping;
   * entries with metric === null are protected spans (thread sizes) that are
   * returned only internally and filtered out.
   */
  function findMatches(text, options) {
    const o = Object.assign({}, DEFAULT_OPTIONS, options || {});
    const cats = Object.assign({}, DEFAULT_OPTIONS.categories, o.categories || {});
    if (!/[\d½¼¾⅛⅜⅝⅞⅓⅔]/.test(text)) return [];
    const cand = [];

    collect(text, RE_THREAD, 0, () => ({ metric: null, cat: 'length' }), cand);

    collect(text, RE_TEMP_RANGE, 1, (m) => {
      const a = parseFloat(m[1]), b = parseFloat(m[2]);
      return { cat: 'temperature', metric: tempStr(a) + '° to ' + tempStr(b) + '° C' };
    }, cand);

    collect(text, RE_TEMP, 2, (m) => ({
      cat: 'temperature',
      metric: tempStr(parseFloat(m[1])) + '° C'
    }), cand);

    collect(text, RE_DIMS, 3, (m) => {
      const nums = m[1].split(/\s*[x×]\s*/i).map(parseNum);
      if (nums.some((n) => !isFinite(n))) return undefined;
      const def = unitDef(m[2]);
      const mms = nums.map((n) => def.conv(n)); // [[v,u],...]
      // use one shared unit: metres only if every dimension is large
      const unit = mms.every(([, u]) => u === 'm') ? 'm' : 'mm';
      const vals = mms.map(([v, u]) => fmt(u === unit ? v : u === 'm' ? v * 1000 : v / 1000));
      return { cat: 'length', metric: vals.join(' x ') + ' ' + unit };
    }, cand);

    collect(text, RE_SIMPLE, 4, (m) => {
      const r = convertQuantity(m[1], m[2]);
      return r || undefined;
    }, cand);

    cand.sort((a, b) => a.start - b.start || a.prio - b.prio);
    const out = [];
    let last = 0;
    for (const c of cand) {
      if (c.start < last) continue;
      last = c.end;
      if (c.metric === null) continue;
      if (!cats[c.cat]) continue;
      if (RE_ALREADY.test(text.slice(c.end))) continue;
      out.push({ start: c.start, end: c.end, original: text.slice(c.start, c.end), metric: c.metric, cat: c.cat });
    }
    return out;
  }

  /** Convenience: convert a whole string (used by tests and the popup preview). */
  function convertString(text, options) {
    const o = Object.assign({}, DEFAULT_OPTIONS, options || {});
    const ms = findMatches(text, o);
    let res = '';
    let cur = 0;
    for (const m of ms) {
      res += text.slice(cur, m.start);
      res += o.mode === 'both' ? m.original + ' (' + m.metric + ')' : m.metric;
      cur = m.end;
    }
    return res + text.slice(cur);
  }

  return { DEFAULT_OPTIONS, PRESETS, findMatches, convertString, pageInScope, parseNum, fmt };
});

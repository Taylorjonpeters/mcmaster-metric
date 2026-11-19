const test = require('node:test');
const assert = require('node:assert/strict');
const { convertString: c } = require('../src/converter.js');

const eq = (input, expected, opts) => assert.equal(c(input, opts), expected);

test('thin stock: decimals, mils, microinches', () => {
  eq('.0024"', '0.061 mm');
  eq('0.0024" thick', '0.061 mm thick');
  eq('2 mil', '0.0508 mm');
  eq('5 mils', '0.127 mm');
  eq('32 µin', '0.813 µm');
  eq('32 microinches', '0.813 µm');
});

test('long distances', () => {
  eq('2 miles', '3.22 km');
});

test('ranges with one shared unit', () => {
  eq('1/4 to 1/2 in.', '6.35 to 12.7 mm');
  eq('6 to 12 in.', '152.4 to 304.8 mm');
  eq('6 – 12 ft.', '1,829 to 3,658 mm');
  eq('1/4 to 1/2"', '6.35 to 12.7 mm');
  eq('100 to 200 psi', '689.5 kPa to 1.38 MPa');
  eq('5 to 10 lbs.', '2.27 to 4.54 kg');
});

test('pressure variants', () => {
  eq('36 ksi', '248.2 MPa');
  eq('30 in. Hg', '101.6 kPa');
  eq('10 inches of water', '2.49 kPa');
  eq('10 in. H2O', '2.49 kPa');
  eq('150 lbs./sq. in.', '1.03 MPa');
});

test('weight per length / area / density', () => {
  eq('2 lb./ft.', '2.98 kg/m');
  eq('10 lbs./sq. ft.', '48.82 kg/m²');
  eq('50 lbs./cu. ft.', '800.9 kg/m³');
  eq('0.1 lb./cu. in.', '2.77 g/cm³');
});

test('flow rates', () => {
  eq('5 gal./min.', '18.93 L/min');
  eq('10 gph', '37.85 L/h');
  eq('20 cu. ft./min.', '33.98 m³/h');
  eq('10 scfm', '16.99 m³/h');
});

test('speed and energy', () => {
  eq('10 in./sec.', '254 mm/s');
  eq('5 ipm', '127 mm/min');
  eq('10000 BTU/hr', '2.93 kW');
  eq('100 BTU', '105.5 kJ');
  eq('8 in.-oz.', '56.49 N·mm');
});

test('area / volume extras', () => {
  eq('2 sq. yd.', '1.67 m²');
  eq('1 cu. yd.', '764.6 L');
  eq('1 pint', '473.2 mL');
  eq('3 in.²', '19.35 cm²');
  eq('2 ft.²', '1,858 cm²');
});

test('temperature spellings', () => {
  eq('500° F', '260° C');
  eq('500°F', '260° C');
  eq('200 deg. F', '93.3° C');
  eq('70 ºF', '21.1° C');
  eq('350 degrees Fahrenheit', '176.7° C');
  eq('-20° F to 180° F', '-28.9° C to 82.2° C');
  eq('-65° to 400° F', '-53.9° to 204.4° C');
});

test('new units do not cause false positives', () => {
  eq('MIL-DTL-5541', 'MIL-DTL-5541');
  eq('316 MIL-SPEC', '316 MIL-SPEC');
  eq('Delivers in 3 min', 'Delivers in 3 min');
  eq('5 milliliters', '5 milliliters');
  eq('10 minutes', '10 minutes');
  eq('2 pints of paint'.replace('pints', 'pt'), '2 pt of paint'); // bare "pt" is ambiguous, left alone
});

test('"both" mode works for ranges and compound units', () => {
  const once = c('6 to 12 in.', { mode: 'both' });
  assert.equal(once, '6 to 12 in. (152.4 to 304.8 mm)');
  assert.equal(c(once, { mode: 'both' }), once);
  const w = c('2 lb./ft.', { mode: 'both' });
  assert.equal(w, '2 lb./ft. (2.98 kg/m)');
  assert.equal(c(w, { mode: 'both' }), w);
});

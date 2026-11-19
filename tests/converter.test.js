const test = require('node:test');
const assert = require('node:assert/strict');
const { convertString: c } = require('../src/converter.js');

const eq = (input, expected, opts) => assert.equal(c(input, opts), expected);

test('fractions, decimals, mixed numbers', () => {
  eq('3/4"', '19.05 mm');
  eq('1/4"', '6.35 mm');
  eq('0.25"', '6.35 mm');
  eq('1 1/2"', '38.1 mm');
  eq('1-1/2"', '38.1 mm');
  eq('½"', '12.7 mm');
  eq('1½"', '38.1 mm');
  eq('1/16"', '1.59 mm');
  eq('0.005"', '0.127 mm');
});

test('word units', () => {
  eq('12 in.', '304.8 mm');
  eq('2 inches', '50.8 mm');
  eq('10 ft.', '3,048 mm');
  eq('40 ft', '12.19 m');
  eq("5'", '1,524 mm');
});

test('thread callouts are left alone', () => {
  eq('1/4"-20 Thread Size', '1/4"-20 Thread Size');
  eq('1"-8', '1"-8');
  eq('1 1/4"-12', '1 1/4"-12');
  eq('#10-32 x 1"', '#10-32 x 25.4 mm');
  eq('US Origin, 1/4"-20 Thread Size, 3/4" Long', 'US Origin, 1/4"-20 Thread Size, 19.05 mm Long');
  eq('1/4"-20 x 1-1/2" Long', '1/4"-20 x 38.1 mm Long');
});

test('dimension lists', () => {
  eq('3" x 4" x 5"', '76.2 mm x 101.6 mm x 127 mm');
  eq('3 x 4 x 5 in.', '76.2 x 101.6 x 127 mm');
  eq('Pedestal (35" Ht. x 4" Wd. x 4" Dp.)', 'Pedestal (889 mm Ht. x 101.6 mm Wd. x 101.6 mm Dp.)');
});

test('ranges of lengths', () => {
  eq('1/4" to 1/2"', '6.35 mm to 12.7 mm');
});

test('pressure, weight, volume, torque', () => {
  eq('170,000 psi', '1,172 MPa');
  eq('100 psi', '689.5 kPa');
  eq('5 lbs.', '2.27 kg');
  eq('8 oz.', '226.8 g');
  eq('1 gal.', '3.79 L');
  eq('25 ft.-lbs.', '33.9 N·m');
  eq('10 in.-lbs.', '1.13 N·m');
  eq('2 sq. in.', '12.9 cm²');
  eq('3 hp', '2.24 kW');
});

test('temperature', () => {
  eq('180° F', '82.2° C');
  eq('-20° to 180° F', '-28.9° to 82.2° C');
  eq('32° F', '0° C');
});

test('no false positives', () => {
  eq('Rockwell C37', 'Rockwell C37');
  eq('5 in stock', '5 in stock');
  eq('M6 x 1.5', 'M6 x 1.5');
  eq('Pack of 50', 'Pack of 50');
  eq('1/0"', '1/0"');
  eq('$12.42 per pack of 50', '$12.42 per pack of 50');
  eq('Specifications Met ASTM A574', 'Specifications Met ASTM A574');
  eq('5mm', '5mm');
});

test('"both" mode appends metric and is idempotent', () => {
  const once = c('3/4" Long', { mode: 'both' });
  assert.equal(once, '3/4" (19.05 mm) Long');
  assert.equal(c(once, { mode: 'both' }), once);
});

test('category toggles', () => {
  eq('3/4" and 5 lbs.', '3/4" and 2.27 kg', { categories: { length: false } });
});

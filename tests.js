const assert = require('assert');
const fs = require('fs');
const path = require('path');

function run() {
  console.log('Running test suite...');
  let failures = 0;

  // Load utils
  let utils;
  try {
    utils = require('./src/utils');
    console.log('Loaded ./src/utils');
  } catch (err) {
    console.error('Failed to require ./src/utils:', err.message);
    process.exit(2);
  }

  try {
    // Basic API
    assert.strictEqual(typeof utils.clamp, 'function', 'clamp should be a function');
    assert.strictEqual(typeof utils.getFrequencyWithOctave, 'function', 'getFrequencyWithOctave should be a function');
    assert.strictEqual(typeof utils.calculateDynamicVolumeMultiplier, 'function', 'calculateDynamicVolumeMultiplier should be a function');
    assert.strictEqual(typeof utils.zToOctaveShift, 'function', 'zToOctaveShift should be a function');
    console.log('API surface assertions passed');
  } catch (e) {
    console.error('API assertions failed:', e.message);
    failures++;
  }

  // clamp tests
  try {
    assert.strictEqual(utils.clamp(5, 1, 10), 5);
    assert.strictEqual(utils.clamp(-1, 0, 3), 0);
    assert.strictEqual(utils.clamp(100, 0, 10), 10);
    console.log('clamp tests passed');
  } catch (e) { console.error('clamp tests failed:', e.message); failures++; }

  // getFrequencyWithOctave
  try {
    assert.strictEqual(utils.getFrequencyWithOctave(440, 0), 440);
    assert.strictEqual(utils.getFrequencyWithOctave(440, 1), 880);
    assert.strictEqual(utils.getFrequencyWithOctave(440, -1), 220);
    assert.strictEqual(utils.getFrequencyWithOctave(261.63, 2), 261.63 * 4);
    console.log('getFrequencyWithOctave tests passed');
  } catch (e) { console.error('getFrequencyWithOctave tests failed:', e.message); failures++; }

  // calculateDynamicVolumeMultiplier edge cases
  try {
    const w = 800;
    const center = w / 2;
    const multCenter = utils.calculateDynamicVolumeMultiplier(center, w);
    assert.ok(Math.abs(multCenter - 1) < 1e-6, 'center multiplier should be 1');

    const multLeft = utils.calculateDynamicVolumeMultiplier(0, w);
    assert.ok(Math.abs(multLeft - 0.5) < 1e-6, 'far left should be leftMultiplier (0.5)');

    const multRight = utils.calculateDynamicVolumeMultiplier(w, w);
    assert.ok(Math.abs(multRight - 1.5) < 1e-6, 'far right should be rightMultiplier (1.5)');

    const quarterRight = utils.calculateDynamicVolumeMultiplier(center + center * 0.5, w);
    assert.ok(Math.abs(quarterRight - 1.25) < 1e-6, '3/4 width should be 1.25');

    // canvasWidth = 0 should return multiplier 1 (guarded)
    const zeroW = utils.calculateDynamicVolumeMultiplier(10, 0);
    assert.strictEqual(zeroW, 1);

    // out-of-range X clamps to edges
    assert.strictEqual(utils.calculateDynamicVolumeMultiplier(w * 2, w), 1.5);
    assert.strictEqual(utils.calculateDynamicVolumeMultiplier(-w, w), 0.5);

    console.log('calculateDynamicVolumeMultiplier tests passed');
  } catch (e) { console.error('calculateDynamicVolumeMultiplier tests failed:', e.message); failures++; }

  // zToOctaveShift tests
  try {
    const minZ = -0.1;
    const maxZ = 0.05;
    assert.strictEqual(utils.zToOctaveShift(minZ, minZ, maxZ), -2);
    assert.strictEqual(utils.zToOctaveShift(maxZ, minZ, maxZ), 2);
    const mid = (minZ + maxZ) / 2; // should map to 0
    assert.strictEqual(utils.zToOctaveShift(mid, minZ, maxZ), 0);
    // out of bounds
    assert.strictEqual(utils.zToOctaveShift(minZ - 1, minZ, maxZ), -2);
    assert.strictEqual(utils.zToOctaveShift(maxZ + 1, minZ, maxZ), 2);
    console.log('zToOctaveShift tests passed');
  } catch (e) { console.error('zToOctaveShift tests failed:', e.message); failures++; }

  // index.html integration checks
  try {
    const indexPath = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    assert.ok(html.includes('vendor/hands.js'), 'index.html must include local vendor/hands.js');
    assert.ok(html.includes('vendor/drawing_utils.js'), 'index.html must include local vendor/drawing_utils.js');
    assert.ok(html.includes('vendor/camera_utils.js'), 'index.html must include local vendor/camera_utils.js');
    assert.ok(html.includes('vendor/tone.js'), 'index.html must include local vendor/tone.js');
    assert.ok(html.includes('src/utils.js'), 'index.html must include src/utils.js');
    assert.ok(html.includes('src/app.js'), 'index.html must include src/app.js');
    console.log('index.html integration checks passed');
  } catch (e) { console.error('index.html checks failed:', e.message); failures++; }

  if (failures === 0) {
    console.log('\nAll tests passed.');
    process.exit(0);
  } else {
    console.error(`\n${failures} test group(s) failed.`);
    process.exit(1);
  }
}

if (require.main === module) run();

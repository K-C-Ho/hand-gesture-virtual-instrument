/**
 * Inspect WASM References Script
 * 
 * Analyzes vendor/hands.js to find WebAssembly file references.
 * Helps identify what WASM files are required and where they're loaded from.
 * 
 * Run with: npm run inspect:wasm
 * 
 * Why inspect WASM references?
 * - MediaPipe hands.js loads large WASM files from CDN
 * - Need to know what files to download for local hosting
 * - Helps debug if WASM files can't be found
 * - Identifies patterns used for file loading (useful for future updates)
 * 
 * What it does:
 * 1. Reads vendor/hands.js file
 * 2. Searches for .wasm filename references
 * 3. Looks for WASM loading patterns (wasmBinary, modelAssetPath, locateFile, etc.)
 * 4. Prints findings to console
 * 
 * Output examples:
 * - "Found potential WASM references:"
 * - "  vision_wasm_internal.wasm"
 * - "Patterns to check:"
 * - "  Found: locateFile(file)"
 * 
 * When to use:
 * - First time setting up the project
 * - Troubleshooting WASM loading errors
 * - When updating MediaPipe to a new version
 * - Verifying all required files are present
 */

const fs = require('fs');
const path = require('path');

/**
 * Path to hands.js file
 * Must be downloaded first with npm run vendor:fetch
 */
const handsPath = path.join(__dirname, '..', 'vendor', 'hands.js');

/**
 * Verify hands.js exists
 */
if (!fs.existsSync(handsPath)) {
  console.error('✗ vendor/hands.js not found.');
  console.error('\nRun first: npm run vendor:fetch');
  process.exit(1);
}

/**
 * Read hands.js content
 */
const content = fs.readFileSync(handsPath, 'utf8');

/**
 * Search for .wasm file references
 * Looks for quoted strings containing ".wasm"
 * Examples: "vision_wasm_internal.wasm", "file.wasm"
 */
const wasmPattern = /["']([^"']*\.wasm[^"']*?)["']/g;
const matches = content.match(wasmPattern);

console.log('WASM Reference Analysis\n');
console.log('========================\n');

if (matches) {
  console.log('✓ Found WASM file references:');
  
  // Remove duplicates using Set
  const unique = new Set(matches.map(m => m.slice(1, -1)));
  unique.forEach(m => {
    console.log(`    • ${m}`);
  });
} else {
  console.log('✗ No direct .wasm references found.');
}

/**
 * Search for WASM loading patterns
 * These indicate how MediaPipe loads WASM files
 * Examples:
 * - wasmBinary = fetch(url)
 * - modelAssetPath = "path/to/file"
 * - locateFile(file)
 * - getAssetPath(file)
 */
const patterns = [
  { regex: /wasmBinary[:\s=]+["']([^"']+)["']/gi, name: 'wasmBinary' },
  { regex: /modelAssetPath[:\s=]+["']([^"']+)["']/gi, name: 'modelAssetPath' },
  { regex: /getAssetPath\([^)]*\)/g, name: 'getAssetPath()' },
  { regex: /locateFile[:\s=]/gi, name: 'locateFile()' }
];

console.log('\n\nWASM Loading Patterns Found:');
console.log('-----------------------------');

let foundAny = false;
patterns.forEach(p => {
  const m = content.match(p.regex);
  if (m) {
    console.log(`✓ ${p.name}`);
    if (m[0]) console.log(`    → ${m[0].substring(0, 80)}`);
    foundAny = true;
  }
});

if (!foundAny) {
  console.log('✗ No common WASM loading patterns detected');
}

/**
 * Summary and next steps
 */
console.log('\n\nSummary:');
console.log('--------');
console.log('This script found the WASM references in hands.js.');
console.log('To use local WASM files:');
console.log('  1. Run: npm run vendor:fetch (downloads WASM files)');
console.log('  2. src/hands_wrapper.js redirects WASM requests to local /wasm/');
console.log('  3. server.js serves from vendor/wasm/ directory');
console.log('\nFor more info, see: SCRIPTS_GUIDE.md');

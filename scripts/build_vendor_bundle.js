/**
 * Build Vendor Bundle Script
 * 
 * Bundles all vendor JavaScript files into a single file.
 * This is optional but can improve page load time.
 * 
 * Run with: npm run vendor:build
 * 
 * What it does:
 * 1. Combines tone.js, camera_utils.js, drawing_utils.js, hands.js
 * 2. Produces dist/vendor.bundle.js (single file)
 * 3. Original vendor files are not modified
 * 
 * When to use:
 * - Production deployment (reduces HTTP requests)
 * - Slower networks (one request instead of 4)
 * 
 * How to use the bundle:
 * Replace in index.html:
 *   <script src="/vendor/tone.js"></script>
 *   <script src="/vendor/camera_utils.js"></script>
 *   ... etc
 * 
 * With:
 *   <script src="/dist/vendor.bundle.js"></script>
 * 
 * Or set USE_BUNDLED=true in environment:
 *   USE_BUNDLED=true npm start
 * 
 * Prerequisites:
 * - Must run `npm run vendor:fetch` first
 * - Must run `npm run vendor:wasm` first
 * 
 * Note: WASM files are not bundled; they're still served via /wasm/ route.
 *       Only JavaScript files are bundled.
 */

const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

// Set up paths
const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
const distDir = path.join(root, 'dist');

/**
 * Create dist/ directory if it doesn't exist
 */
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

/**
 * Create temporary entry point file
 * 
 * This file loads all vendor JavaScript in the correct order.
 * Each vendor file sets global variables (Tone, Camera, etc.)
 * so the order matters.
 */
const entryPoint = path.join(vendorDir, '_bundle_entry.js');
const bundleContent = `
// Load vendor scripts in order (each sets global variables)
require('./tone.js');          // Sets window.Tone
require('./camera_utils.js');  // Sets window.Camera
require('./drawing_utils.js'); // Sets window.drawConnectors, etc.
require('./hands.js');         // Sets window.Hands
`;

fs.writeFileSync(entryPoint, bundleContent, 'utf8');

/**
 * Run esbuild to bundle the files
 * 
 * Options:
 * - entryPoints: File to start from
 * - bundle: false - Don't bundle dependencies, just concatenate
 * - outfile: Where to write the bundle
 * - platform: 'browser' - Optimize for browser environment
 * - format: 'iife' - Wrap in Immediately Invoked Function Expression
 * - minify: false - Keep readable (set to true for production)
 * - sourcemap: false - No source maps (set to true for debugging)
 */
esbuild.build({
  entryPoints: [entryPoint],
  bundle: false,  // Don't bundle, just concatenate files
  outfile: path.join(distDir, 'vendor.bundle.js'),
  platform: 'browser',
  format: 'iife',  // Wrap in function to avoid global namespace pollution
  minify: false,
  sourcemap: false
}).then(() => {
  console.log('✓ Created dist/vendor.bundle.js');
  console.log('\nTo use this bundle, update index.html:');
  console.log('  Replace 4 separate vendor <script> tags');
  console.log('  With: <script src="/dist/vendor.bundle.js"></script>');
  console.log('\nOr set environment variable: USE_BUNDLED=true npm start');
  
  // Clean up temporary entry file
  fs.unlinkSync(entryPoint);
}).catch((err) => {
  console.error('✗ Build failed:', err.message);
  process.exit(1);
});

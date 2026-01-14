/**
 * Fetch WASM Files Script
 * 
 * Downloads WebAssembly (.wasm) modules needed by MediaPipe hand detection.
 * These are large binary files (~4MB) that contain the actual ML model code.
 * 
 * Run with: npm run vendor:wasm
 * 
 * Prerequisites:
 * - Must run `npm run vendor:fetch` first (to download hands.js)
 * - Must have vendor/ directory created
 * 
 * Downloads:
 * 1. vision_wasm_internal.js - WASM loader and initialization code
 * 2. vision_wasm_internal.wasm - Binary ML model file (~4MB)
 * 
 * Saves to: vendor/wasm/ directory
 * 
 * How it works:
 * 1. The main hands.js file contains instructions to load WASM from CDN
 * 2. src/hands_wrapper.js intercepts fetch() calls and redirects to local /wasm/
 * 3. Server.js serves files from vendor/wasm/ via /wasm/ route
 * 
 * Without WASM files locally:
 * - App must download 4MB files from CDN every time (slow)
 * - App requires internet connection (offline doesn't work)
 * 
 * With WASM files locally:
 * - Instant loading from disk (much faster)
 * - Works offline
 * - Can be bundled with app for deployment
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Set up paths
const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
const wasmDir = path.join(vendorDir, 'wasm');

/**
 * Verify prerequisites: vendor/ must exist from fetch_vendors.js
 */
if (!fs.existsSync(vendorDir)) {
  console.error('✗ vendor/ not found. Run `npm run vendor:fetch` first.');
  process.exit(1);
}

/**
 * Create wasm/ subdirectory if it doesn't exist
 */
if (!fs.existsSync(wasmDir)) {
  fs.mkdirSync(wasmDir, { recursive: true });
}

/**
 * List of WASM files to download
 * These are hosted by CDN and needed by MediaPipe hand tracking
 * 
 * vision_wasm_internal.js (small, ~50KB):
 *   - JavaScript loader for the WASM module
 *   - Contains init code and JS bindings
 * 
 * vision_wasm_internal.wasm (large, ~4MB):
 *   - Binary WebAssembly module with the ML model
 *   - Compiled machine learning code for hand detection
 */
const wasmFiles = [
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/vision_wasm_internal.js',
    dest: path.join(wasmDir, 'vision_wasm_internal.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/vision_wasm_internal.wasm',
    dest: path.join(wasmDir, 'vision_wasm_internal.wasm')
  }
];

/**
 * Download a file from a URL and save to disk
 * 
 * @param {string} url - URL to download from (HTTPS)
 * @param {string} dest - Local file path to save to
 * @returns {Promise<void>}
 */
function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log('Fetching', path.basename(dest), '...');
    
    // Create write stream to disk
    const file = fs.createWriteStream(dest);
    
    // Start HTTPS request
    https.get(url, (res) => {
      // Check for HTTP errors
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }
      
      // Show download progress
      const fileSize = parseInt(res.headers['content-length'], 10);
      let downloadedSize = 0;
      
      res.on('data', (chunk) => {
        downloadedSize += chunk.length;
        const percentage = ((downloadedSize / fileSize) * 100).toFixed(1);
        process.stdout.write(`  [${percentage}%]\r`);
      });
      
      // Pipe response to file
      res.pipe(file);
      
      // Wait for file to finish writing
      file.on('finish', () => {
        file.close();
        console.log('✓ Saved', path.basename(dest));
        resolve();
      });
    }).on('error', (err) => {
      // Clean up incomplete file on error
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

/**
 * Main function: Download all WASM files
 */
async function main() {
  console.log('Fetching WASM files to vendor/wasm/ ...\n');
  let failed = false;
  
  for (const f of wasmFiles) {
    try {
      await fetchToFile(f.url, f.dest);
    } catch (err) {
      console.error('✗ Error fetching', path.basename(f.dest), ':', err.message);
      failed = true;
    }
  }
  
  if (!failed) {
    console.log('\n✓ WASM files fetched successfully.');
    console.log('\nHow it works:');
    console.log('  1. src/hands_wrapper.js intercepts fetch() calls');
    console.log('  2. Redirects vision_wasm_internal.* from CDN to /wasm/');
    console.log('  3. Server.js serves files from vendor/wasm/ directory');
    console.log('\nYou can now run: npm run dev (or npm start)');
  } else {
    console.error('\n✗ Some WASM files failed. Check your internet connection and try again.');
    process.exitCode = 1;
  }
}

// Run main function if this script is run directly (not imported)
if (require.main === module) main();

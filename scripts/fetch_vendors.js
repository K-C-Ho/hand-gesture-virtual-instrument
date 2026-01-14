/**
 * Fetch Vendor Libraries Script
 * 
 * Downloads JavaScript libraries from CDN and saves them locally.
 * This allows the app to work without CDN dependencies.
 * 
 * Run with: npm run vendor:fetch
 * 
 * Downloads:
 * 1. Tone.js (v14.8.49) - Audio synthesis library
 * 2. MediaPipe Camera Utils - Helper for camera input processing
 * 3. MediaPipe Drawing Utils - Helper for drawing landmarks on canvas
 * 4. MediaPipe Hands - Hand detection model
 * 
 * Saves to: vendor/ directory
 * 
 * Note: This does NOT download WASM files (.wasm).
 * Use npm run vendor:wasm to download those separately.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Set up vendor directory
const root = path.join(__dirname, '..');
const vendorDir = path.join(root, 'vendor');
if (!fs.existsSync(vendorDir)) fs.mkdirSync(vendorDir, { recursive: true });

/**
 * List of vendor files to download
 * Each object has:
 * - url: CDN URL to fetch from
 * - dest: Local path to save to (relative to vendor/)
 */
const files = [
  {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js',
    dest: path.join(vendorDir, 'tone.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    dest: path.join(vendorDir, 'camera_utils.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js',
    dest: path.join(vendorDir, 'drawing_utils.js')
  },
  {
    url: 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
    dest: path.join(vendorDir, 'hands.js')
  }
];

/**
 * Download a file from a URL and save to disk
 * 
 * @param {string} url - URL to download from
 * @param {string} dest - Local file path to save to
 * @returns {Promise<void>}
 */
function fetchToFile(url, dest) {
  return new Promise((resolve, reject) => {
    // Create write stream to disk
    const file = fs.createWriteStream(dest);
    
    // Start HTTPS request
    https.get(url, (res) => {
      // Check for HTTP errors
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`));
      }
      
      // Pipe response to file
      res.pipe(file);
      
      // Wait for file to finish writing
      file.on('finish', () => {
        file.close();
        console.log('✓ Saved', dest);
        resolve();
      });
    }).on('error', (err) => {
      // Network error
      reject(err);
    });
  });
}

/**
 * Main function: Download all vendor files
 */
async function main() {
  console.log('Downloading vendor files...\n');
  
  for (const f of files) {
    try {
      await fetchToFile(f.url, f.dest);
    } catch (err) {
      console.error('✗ Error fetching', f.url, '\n', err.message);
      process.exitCode = 1;
    }
  }
  
  console.log('\n✓ All vendor files fetched to vendor/');
  console.log('\nNext step: npm run vendor:wasm (to download WASM files)');
}

// Run main function if this script is run directly (not imported)
if (require.main === module) main();

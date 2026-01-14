/**
 * Compute SRI (Subresource Integrity) Hash
 * 
 * Calculates the SHA-384 hash of a file from a CDN URL.
 * Used to verify that files from CDN haven't been tampered with.
 * 
 * Usage:
 *   node scripts/compute_sri.js <URL>
 * 
 * Example:
 *   node scripts/compute_sri.js https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
 * 
 * Output:
 *   sha384-[base64 hash]
 * 
 * How SRI works:
 * 1. Download file from URL
 * 2. Calculate SHA-384 hash of file contents
 * 3. Add integrity attribute to <script> tag:
 *    <script src="https://cdn.../file.js" integrity="sha384-[hash]"></script>
 * 4. Browser verifies hash before executing script
 * 5. If hash doesn't match, script is rejected (prevents tampering)
 * 
 * Why use SRI:
 * - Protects against CDN compromise
 * - Detects malicious file modifications
 * - Recommended security best practice
 * - Works with CSP (Content Security Policy)
 * 
 * Run with:
 *   npm run compute-sri -- <URL>
 */

const https = require('https');
const { createHash } = require('crypto');

/**
 * Fetch a file from an HTTPS URL and return as Buffer
 * 
 * @param {string} url - HTTPS URL to download from
 * @returns {Promise<Buffer>} File contents as Buffer
 */
function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Check for HTTP errors
      if (res.statusCode !== 200) {
        return reject(new Error('Fetch failed: ' + res.statusCode));
      }
      
      // Collect all chunks of the response
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      
      // Combine chunks into single buffer
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Main function: Compute and print SRI hash
 */
async function main() {
  // Get URL from command line argument
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/compute_sri.js <url>');
    console.error('\nExample:');
    console.error('  node scripts/compute_sri.js https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js');
    process.exit(2);
  }
  
  try {
    // Fetch file from URL
    const buf = await fetchBuffer(url);
    
    // Calculate SHA-384 hash and convert to base64
    const hash = createHash('sha384').update(buf).digest('base64');
    
    // Output in SRI format
    const sri = `sha384-${hash}`;
    console.log('\nSRI Hash:');
    console.log(sri);
    console.log('\nUse in HTML:');
    console.log(`<script src="${url}" integrity="${sri}" crossorigin="anonymous"></script>`);
    
  } catch (err) {
    console.error('✗ Error:', err.message);
    process.exit(1);
  }
}

// Run main function if this script is run directly (not imported)
if (require.main === module) main();

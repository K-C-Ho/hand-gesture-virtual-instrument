/**
 * MediaPipe Hands WASM Wrapper
 * 
 * This script intercepts network requests to redirect MediaPipe WebAssembly (WASM) files
 * from the CDN to local `/wasm/` directory.
 * 
 * Why needed:
 * - MediaPipe loads large WASM files (.wasm) from CDN
 * - For offline or self-hosted deployments, we need to serve them locally
 * - This wrapper transparently redirects the fetch requests
 * 
 * How it works:
 * 1. Overrides window.fetch() to intercept all fetch calls
 * 2. Checks if the URL contains 'vision_wasm_internal' (MediaPipe's WASM filename pattern)
 * 3. If yes, redirects to local /wasm/ instead of CDN
 * 4. For all other requests, passes through unchanged
 * 
 * IMPORTANT: This script MUST be loaded BEFORE hands.js (MediaPipe's main script)
 * See index.html: includes this before vendor/hands.js
 */

(function() {
  // Store the original fetch function so we can still use it
  const originalFetch = typeof fetch !== 'undefined' ? fetch : null;

  /**
   * Override window.fetch to redirect WASM file loading
   * 
   * Intercepts fetch() calls and checks if they're for MediaPipe WASM files.
   * If yes, redirects to local /wasm/ directory.
   */
  if (originalFetch && typeof window !== 'undefined') {
    window.fetch = function(url, options) {
      // Check if this is a MediaPipe WASM fetch request
      // MediaPipe WASM files are named 'vision_wasm_internal.js' and 'vision_wasm_internal.wasm'
      if (typeof url === 'string' && url.includes('vision_wasm_internal')) {
        // Extract the filename from the URL (e.g., 'vision_wasm_internal.wasm')
        const filename = url.split('/').pop();
        // Redirect to local /wasm/ path
        const localUrl = '/wasm/' + filename;
        console.log('[hands wrapper] Redirecting WASM fetch:', url, '→', localUrl);
        // Call original fetch with the local URL
        return originalFetch.call(this, localUrl, options);
      }
      // All other fetches go through unchanged
      return originalFetch.call(this, url, options);
    };
  }

  /**
   * Extended wrapper for Hands class (additional safety)
   * 
   * If Hands is already loaded, we also wrap its constructor
   * to set up locateFile callback for asset loading.
   * This provides a second layer of redirection.
   */
  if (typeof window !== 'undefined' && typeof Hands !== 'undefined') {
    // Store the original Hands class
    const OriginalHands = Hands;
    
    // Replace with wrapped version
    window.Hands = class extends OriginalHands {
      constructor(options) {
        const opts = options || {};
        
        // If locateFile is not already defined, add one
        if (!opts.locateFile) {
          /**
           * locateFile callback: Called by MediaPipe when it needs to load asset files
           * @param {string} file - Filename (e.g., 'vision_wasm_internal.wasm')
           * @returns {string} URL to load from
           */
          opts.locateFile = (file) => {
            // Redirect WASM files to local /wasm/
            if (file.includes('vision_wasm_internal')) {
              return '/wasm/' + file;
            }
            // For other files, use default CDN or local path
            return `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm/${file}`;
          };
        }
        
        // Call parent constructor with modified options
        super(opts);
      }
    };
  }
})();

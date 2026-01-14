/**
 * Express Server with CSP Nonce Injection and Security Headers
 * 
 * This server:
 * 1. Generates a random nonce for each request and injects it into all <script> tags
 * 2. Sets a strict Content Security Policy (CSP) header to prevent XSS attacks
 * 3. Serves vendor files, WASM modules, and static assets
 * 4. Enforces HTTPS in production (when behind a reverse proxy)
 * 5. Sets additional security headers (HSTS, X-Frame-Options, etc.)
 * 
 * Environment:
 * - NODE_ENV=development: CSP allows 'unsafe-eval' (for debugging)
 * - NODE_ENV=production: CSP is strict, no unsafe-eval
 * 
 * HTTPS:
 * - Automatically detected when behind reverse proxy (nginx, CloudFront, etc.)
 * - Set REQUIRE_HTTPS=true to force HTTPS even on localhost (for testing)
 * - Set REQUIRE_HTTPS=false to disable HTTPS enforcement
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('./config');

const app = express();
const root = path.join(__dirname);

/**
 * HTTPS Enforcement Middleware (Production Only)
 * 
 * In production:
 * - Detects if running behind a reverse proxy (nginx, CloudFront, etc.)
 *   by checking for the 'x-forwarded-proto' header
 * - Redirects HTTP to HTTPS only if behind a reverse proxy
 * - Can be forced with REQUIRE_HTTPS=true env var
 * 
 * This allows localhost testing without HTTPS while ensuring HTTPS
 * enforcement in real production deployments.
 */
if (config.isDev === false && process.env.REQUIRE_HTTPS !== 'false') {
  app.use((req, res, next) => {
    // Check if behind reverse proxy (typical production setup)
    const behindProxy = req.header('x-forwarded-proto') !== undefined;
    // Check if HTTPS enforcement is explicitly required
    const requireHttps = process.env.REQUIRE_HTTPS === 'true';
    
    // Only redirect if behind proxy and protocol is not HTTPS, or if explicitly required
    if ((behindProxy || requireHttps) && req.header('x-forwarded-proto') !== 'https') {
      console.warn('Non-HTTPS request detected, redirecting...');
      return res.redirect(301, `https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

/**
 * Static File Routes
 * These serve the application code, vendor files, and WebAssembly modules
 */
app.use('/src', express.static(path.join(root, 'src')));          // Application source files
app.use('/scripts', express.static(path.join(root, 'scripts')));  // Utility scripts
app.use('/vendor', express.static(path.join(root, 'vendor')));    // Vendor JS libraries (Tone.js, MediaPipe)
app.use('/wasm', express.static(path.join(root, 'vendor', 'wasm'))); // MediaPipe WebAssembly modules
app.use('/dist', express.static(path.join(root, 'dist')));        // Built bundles

/**
 * Generate a cryptographically secure random nonce
 * @returns {string} Base64-encoded random bytes (nonce)
 */
function generateNonce() {
  return crypto.randomBytes(16).toString('base64');
}

/**
 * Inject nonce attribute into all <script> tags
 * Adds nonce="${nonce}" to any <script> tag that doesn't already have a nonce
 * 
 * This allows inline scripts to pass CSP validation via the nonce.
 * 
 * @param {string} html - The HTML content
 * @param {string} nonce - The nonce value to inject
 * @returns {string} HTML with nonces injected
 */
function injectNonceToScripts(html, nonce) {
  return html.replace(/<script\s+([^>]*)>/gi, (match, attrs) => {
    // Don't duplicate nonce if it already exists
    if (/nonce=/.test(attrs)) return `<script ${attrs}>`;
    return `<script nonce="${nonce}" ${attrs}>`;
  });
}

/**
 * Main Route: Serve index.html with CSP and Security Headers
 * 
 * For each request:
 * 1. Generate a unique nonce
 * 2. Inject nonce into all <script> tags
 * 3. Set CSP header with the nonce
 * 4. Set additional security headers
 */
app.get(['/', '/index.html'], (req, res) => {
  const nonce = generateNonce();
  const indexPath = path.join(root, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  // Inject the nonce into all script tags
  html = injectNonceToScripts(html, nonce);
  
  /**
   * Construct the Content Security Policy (CSP) header
   * 
   * CSP rules:
   * - 'nonce-${nonce}': Allow inline scripts with matching nonce
   * - 'strict-dynamic': Disallow inline scripts unless they have nonce/hash
   *                     (prevents injected scripts from loading)
   * - 'wasm-unsafe-eval': Allow WebAssembly instantiation (required for MediaPipe)
   * - 'unsafe-eval': Allow eval() and similar (dev only, for debugging)
   * - https:: Allow external scripts from HTTPS origins
   * 
   * This combination provides strong security while enabling MediaPipe hand tracking
   */
  let evalAllow = " 'wasm-unsafe-eval'";
  if (config.csp.allowUnsafeEval) {
    evalAllow += " 'unsafe-eval'";
  }
  const scriptSrc = `script-src 'nonce-${nonce}' 'strict-dynamic'${evalAllow} https:;`;

  /**
   * Full CSP header breakdown:
   * - default-src: Most restrictive policy (fallback for all directives)
   * - script-src: Where scripts can be loaded from (controlled above)
   * - object-src: Prevent plugin loading (<embed>, <object>)
   * - base-uri: Restrict where <base href=""> can point
   * - connect-src: Where fetch/XMLHttpRequest can connect (cameras, etc.)
   * - img-src: Where images can be loaded from
   * - style-src: Where stylesheets can be loaded from (data: allows data URLs)
   * - frame-ancestors: Prevent embedding in iframes
   */
  const csp = [
    "default-src 'self'",                                // Only same-origin by default
    scriptSrc,                                            // Scripts with nonce or from https
    "object-src 'none'",                                 // No plugins
    "base-uri 'self'",                                   // No external base URLs
    "connect-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com", // Allow vendor CDNs if needed
    "img-src 'self' data:",                              // Images from self or data URLs
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // CSS from self, inline, and Google Fonts
    "frame-ancestors 'none'"                             // Don't allow embedding in iframes
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  
  // Log what CSP was applied for debugging
  const env = config.isDev ? 'dev' : 'prod';
  const evalMsg = config.csp.allowUnsafeEval ? 'unsafe-eval + wasm-unsafe-eval' : 'wasm-unsafe-eval only';
  console.log(`CSP sent [${env}]: ${evalMsg}`);
  
  /**
   * Additional Security Headers
   */
  res.setHeader('Referrer-Policy', 'no-referrer');       // Don't send referrer info
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self)'); // Allow camera/mic for same-origin
  res.setHeader('X-Content-Type-Options', 'nosniff');    // Prevent MIME type sniffing
  res.setHeader('X-XSS-Protection', '1; mode=block');    // Legacy XSS protection (mostly ignored by modern browsers)
  res.setHeader('X-UA-Compatible', 'IE=edge');           // Force latest IE rendering engine

  // Add HSTS (HTTP Strict-Transport-Security) in production
  // Forces HTTPS for 1 year and all subdomains; includes preload for HSTS preload list
  if (config.security.hstsMaxAge) {
    res.setHeader('Strict-Transport-Security', `max-age=${config.security.hstsMaxAge}; includeSubDomains; preload`);
  }
  
  // Add X-Frame-Options to prevent clickjacking attacks
  if (config.security.frameDeny) {
    res.setHeader('X-Frame-Options', 'DENY');  // Don't allow embedding in iframes
  }

  res.type('html').send(html);
});

/**
 * Fallback Static File Serving
 * Serves CSS, images, and other static assets that don't match above routes
 */

app.use(express.static(root));

/**
 * Start the Server
 * 
 * Listens on the configured host and port (default: localhost:8080)
 * Logs startup information including CSP mode
 */
const port = config.port;
const host = config.host;
app.listen(port, host, () => {
  const env = config.isDev ? 'development' : 'production';
  console.log(`[${env}] Server listening on http://${host}:${port}`);
  if (config.isDev) {
    console.log('  CSP allows unsafe-eval for development debugging');
    console.log('  Run with NODE_ENV=production for strict CSP');
  } else {
    console.log('  CSP is strict (no unsafe-eval, only wasm-unsafe-eval)');
  }
});

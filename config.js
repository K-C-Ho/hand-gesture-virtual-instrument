// Environment configuration for dev and production
// This module centralizes all environment-dependent settings
// Use NODE_ENV environment variable to switch between 'development' and 'production'

module.exports = {
  // Is development mode? (true if NODE_ENV !== 'production')
  isDev: process.env.NODE_ENV !== 'production',
  
  // Server settings
  port: parseInt(process.env.PORT || '8080', 10),        // Port to listen on (default 8080)
  host: process.env.HOST || 'localhost',                  // Host to bind to (default localhost)
  
  // Content Security Policy settings
  // CSP restricts which scripts, styles, and resources can be loaded
  csp: {
    // Allow wasm-unsafe-eval in both dev and production
    // Required for MediaPipe WebAssembly instantiation
    // This is necessary for hand tracking to work
    allowWasmEval: true,
    
    // Allow unsafe-eval only in development
    // Adds 'unsafe-eval' to CSP script-src in addition to wasm-unsafe-eval
    // In production, only wasm-unsafe-eval is allowed (more secure)
    allowUnsafeEval: process.env.NODE_ENV !== 'production'
  },
  
  // Security headers configuration
  security: {
    // HSTS (HTTP Strict-Transport-Security) max age in seconds
    // Production: 1 year (31536000 seconds) - forces HTTPS for 1 year
    // Development: undefined - HSTS header not sent
    // This prevents downgrade attacks from HTTPS to HTTP
    hstsMaxAge: process.env.NODE_ENV === 'production' ? 31536000 : undefined,
    
    // X-Frame-Options: DENY prevents the app from being embedded in iframes
    // Protects against clickjacking attacks
    frameDeny: true
  },
  
  // Vendor and bundling settings
  serveVendor: true,                                       // Always serve individual vendor files
  
  // In production with NODE_ENV=production, optionally use bundled vendor.bundle.js
  // Set to true if you've run `npm run vendor:build`
  serveBundled: process.env.NODE_ENV === 'production' && process.env.USE_BUNDLED !== 'false',
  
  // Logging level: 'debug' shows detailed info, 'info' shows less
  // Use 'debug' for development, 'info' for production
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug')
};

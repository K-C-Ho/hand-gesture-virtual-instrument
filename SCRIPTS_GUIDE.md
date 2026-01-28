# Scripts Guide

This directory contains utility scripts for downloading, building, and managing vendor files.

## Overview of All Scripts

### Application Startup Scripts
These are defined in `package.json` and run the server.

```bash
# Development mode (allows unsafe-eval for debugging)
npm run dev

# Production mode (strict CSP, no unsafe-eval)
npm start
# OR
npm run prod
```

### Vendor Management Scripts

#### `fetch_vendors.js`
**Purpose**: Download vendor JavaScript libraries from CDN

**Run with**:
```bash
npm run vendor:fetch
```

**What it downloads**:
- `Tone.js` (v14.8.49) - Audio synthesis library
- `camera_utils.js` - MediaPipe camera helper
- `drawing_utils.js` - MediaPipe drawing helper
- `hands.js` - MediaPipe hand detection model

**Output**: Creates `vendor/` directory with .js files

**Notes**:
- Must be run before the app can start
- Does NOT download WASM files (use `fetch_wasm.js` separately)
- Safe to re-run (overwrites existing files)

---

#### `fetch_wasm.js`
**Purpose**: Download WebAssembly modules needed by MediaPipe

**Run with**:
```bash
npm run vendor:fetch
```

This is automatically called by `npm run vendor:fetch` (same command).

**What it downloads**:
- `vision_wasm_internal.js` - WASM loader (~50KB)
- `vision_wasm_internal.wasm` - ML model binary (~4MB)

**Output**: Creates `vendor/wasm/` directory with WASM files

**Why needed**:
- MediaPipe hand detection requires WebAssembly
- WASM files are large (~4MB), so hosting locally improves performance
- Allows offline operation without downloading from CDN each time

**How it works**:
1. `src/hands_wrapper.js` intercepts fetch() calls
2. Redirects WASM requests from CDN to local `/wasm/` path
3. `server.js` serves files from `vendor/wasm/`

---

#### `build_vendor_bundle.js`
**Purpose**: Bundle all vendor JavaScript into a single file (optional)

**Run with**:
```bash
npm run vendor:build
```

**What it does**:
- Combines Tone.js, camera_utils, drawing_utils, hands.js
- Creates `dist/vendor.bundle.js` (single file)

**When to use**:
- Production deployment (reduces HTTP requests from 4 to 1)
- Slower networks (faster load time)

**How to use**:
- Update `index.html` to replace 4 vendor `<script>` tags with:
  ```html
  <script src="/dist/vendor.bundle.js"></script>
  ```
- OR set environment variable:
  ```bash
  USE_BUNDLED=true npm start
  ```

**Notes**:
- Optional (app works fine without bundling)
- WASM files are NOT bundled (still served via `/wasm/`)
- Original vendor files are not deleted

---

#### `compute_sri.js`
**Purpose**: Compute SRI (Subresource Integrity) hashes for CDN URLs

**Run with**:
```bash
npm run compute-sri
```

**What it does**:
- Calculates SHA-384 hashes for vendor scripts
- Hashes allow CSP to verify CDN files haven't been tampered with
- Provides `integrity="sha384-..."` attributes for `<script>` tags

**When to use**:
- If switching to CDN-hosted vendor files
- If updating vendor library versions
- For security validation

**Output**: Console prints SRI hashes and example `<script>` tags

---

#### `inspect_wasm.js`
**Purpose**: Analyze hands.js to find WASM file references

**Run with**:
```bash
npm run inspect:wasm
```

**What it does**:
- Searches `vendor/hands.js` for WASM filename patterns
- Lists all WASM files that MediaPipe expects
- Helps debug if hand detection fails to load

**When to use**:
- Troubleshooting WASM loading errors
- Verifying all required WASM files are downloaded
- Updating when MediaPipe version changes

---

## Quick Start

1. **First time setup**:
   ```bash
   npm install
   npm run vendor:fetch  # Downloads all vendor files
   npm run dev           # Start development server
   ```

2. **Production deployment**:
   ```bash
   npm install --omit=dev  # Install only dependencies
   npm run vendor:fetch     # Download vendor files
   npm start                # Run production server (strict CSP)
   ```

3. **Optional optimization**:
   ```bash
   npm run vendor:build     # Bundle vendor files
   npm start                # Run with bundled files
   ```

## Script Dependencies

```
package.json (npm scripts)
├── npm run dev/start (uses server.js)
│   └── Uses vendor files from vendor/ and vendor/wasm/
│
├── npm run vendor:fetch
│   ├── scripts/fetch_vendors.js (downloads JS files)
│   └── scripts/fetch_wasm.js (downloads WASM files)
│
├── npm run vendor:build
│   └── scripts/build_vendor_bundle.js (uses esbuild)
│
├── npm run compute-sri
│   └── scripts/compute_sri.js (calculates hashes)
│
└── npm run inspect:wasm
    └── scripts/inspect_wasm.js (analyzes files)
```

## Environment Variables

These can be set to control behavior:

```bash
# Port to listen on (default: 8080)
PORT=3000 npm start

# Host to bind to (default: localhost)
HOST=0.0.0.0 npm start

# Logging level: 'debug' or 'info'
LOG_LEVEL=debug npm run dev

# Force HTTPS redirect even on localhost
REQUIRE_HTTPS=true npm start

# Use bundled vendor files (if available)
USE_BUNDLED=true npm start

# Node environment (development or production)
NODE_ENV=production npm start
```

## Troubleshooting

### WASM files not loading
1. Verify `vendor/wasm/` directory exists:
   ```bash
   ls -la vendor/wasm/
   ```
2. Check browser DevTools → Console for WASM fetch errors
3. Verify server.js has `/wasm/` route configured

### Camera access denied
- Check browser permissions for camera
- Verify Permissions-Policy header in server.js
- Some browsers require HTTPS for camera access

### Hand detection not working
1. Ensure `vendor/hands.js` is loaded
2. Check WASM files are accessible
3. Verify browser supports WebAssembly

### Vendor files not loading
1. Run `npm run vendor:fetch` to download files
2. Check `vendor/` directory exists with .js files
3. Verify server.js has `/vendor/` route configured

## File Structure

```
hand-gesture-virtual-instrument/
├── index.html              # Main app page
├── server.js               # Express server with CSP injection
├── config.js               # Environment configuration
├── styles.css              # Extracted stylesheet
├── package.json            # Project metadata and npm scripts
├── src/
│   ├── app.js              # Main application logic
│   ├── utils.js            # Shared utility functions
│   └── hands_wrapper.js    # Intercepts WASM loading
├── scripts/
│   ├── fetch_vendors.js    # Download vendor JS files
│   ├── fetch_wasm.js       # Download WASM files
│   ├── build_vendor_bundle.js  # Bundle vendor files
│   ├── compute_sri.js      # Calculate SRI hashes
│   └── inspect_wasm.js     # Analyze WASM references
├── vendor/                 # Local copies of vendor files (created by fetch_vendors.js)
│   ├── tone.js
│   ├── camera_utils.js
│   ├── drawing_utils.js
│   ├── hands.js
│   └── wasm/              # WASM modules (created by fetch_wasm.js)
│       ├── vision_wasm_internal.js
│       └── vision_wasm_internal.wasm
└── dist/                  # Build output (created by build_vendor_bundle.js)
    └── vendor.bundle.js   # Bundled vendor files (optional)
```

## Commands Reference

| Command | Purpose | Speed |
|---------|---------|-------|
| `npm run dev` | Start development server | Medium |
| `npm start` | Start production server | Fast (with bundling) |
| `npm run vendor:fetch` | Download all vendor files | Slow (network) |
| `npm run vendor:build` | Bundle vendor files (optional) | Fast (local) |
| `npm run compute-sri` | Calculate SRI hashes | Fast (local) |
| `npm run inspect:wasm` | Analyze WASM references | Fast (local) |

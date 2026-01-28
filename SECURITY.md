# Security Guidelines

This document lists practical security measures for the Hand Gesture Virtual Instrument project.

1) Content Security Policy (CSP)
- A CSP reduces XSS risk by restricting script/style sources. We added a conservative meta CSP in `index.html` for development.
- For production prefer setting the `Content-Security-Policy` header from the server and avoid `'unsafe-inline'` for scripts/styles.
- To enable strict CSP with CDN scripts, compute SRI hashes (see below) and set `script-src 'self' 'sha384-...';` or use `nonce-` values injected by the server.

2) Subresource Integrity (SRI)
- Use the included script `scripts/compute_sri.js` to compute the `sha384-...` integrity value for external CDN resources.
- Example:
  ```powershell
  node scripts/compute_sri.js https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
  # copy the output and add as integrity attribute on the <script> tag with crossorigin="anonymous"
  ```

3) Avoid innerHTML and inline event handlers
- Build DOM nodes with `createElement` and `textContent` as done in `src/app.js` to prevent accidental HTML injection.

4) Serve over HTTPS and set secure headers
- Serve the app over HTTPS in production.
- Recommended headers:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `Referrer-Policy: no-referrer-when-downgrade` (or `no-referrer`)
  - `X-Frame-Options: DENY` (or CSP frame-ancestors)
  - `Permissions-Policy` to restrict camera/mic by default.

5) Dependency hygiene
- Lock dependency versions and monitor for vulnerabilities. For frontend libs, prefer known pinned versions and compute SRI.

6) Camera & Microphone permissions
- The app uses the camera; the `Permissions-Policy` meta header blocks camera access in third-party contexts. Always prompt users and explain use.

7) Tests and automation
- Include security checks in CI: validate no `innerHTML` usage, run linter, and verify `index.html` includes SRI/integrity attributes if CSP is strict.

8) Incident response
- Keep a `SECURITY_CONTACT` section in the repo and a process to report vulnerabilities.

If you'd like, I can:
- Run the SRI computation for the CDN scripts and add integrity attributes (requires network access).
- Harden the CSP further and switch to nonces (requires server support).

Server-set CSP with nonces
--------------------------------
This repository includes a tiny development server `server.js` that demonstrates how to deliver a per-request nonce and set the `Content-Security-Policy` header. Usage:

```powershell
npm install
npm start
# then open http://localhost:8080
```

What it does:
- Generates a cryptographic nonce per request.
- Injects the nonce into all `<script>` tags in `index.html` before sending to the client.
- Sets a `Content-Security-Policy` header that includes the nonce in `script-src`.

Notes:
- For production, serve the CSP header from your web server (nginx, Apache, cloud provider) and ensure nonces are injected into templates server-side.
- Remove `unsafe-eval` and `wasm-unsafe-eval` from CSP in production and host the WASM locally or use trusted signed packages.

Local vendor hosting
---------------------
You can host vendor scripts locally to avoid CDN/SRI brittleness. This repo includes a helper to fetch vendor files:

```powershell
npm run vendor:fetch
npm start
# open http://localhost:8080
```

The fetch script downloads Tone.js and MediaPipe JS files into `vendor/` and the dev server serves them from `/vendor`.
If you prefer bundling, consider using a bundler (esbuild/webpack/rollup) to produce a single vendor bundle and serve it from your origin.

Building a bundled version
--------------------------
To produce a single `vendor.bundle.js` for production:

```powershell
npm install
npm run vendor:fetch     # Fetch all vendor JS and WASM files
npm run vendor:build     # Bundle into dist/vendor.bundle.js
```

Then replace the individual `<script src="vendor/...">` tags in `index.html` with:
```html
<script src="dist/vendor.bundle.js"></script>
```

WASM handling
-----------
MediaPipe hands.js loads WASM files dynamically. The `src/hands_wrapper.js` module intercepts fetch() calls and redirects WASM loads to local `/wasm/` directory. 
- Run `npm run vendor:fetch` to also download WASM files.
- The dev server (`npm start`) serves WASM from `/wasm/` so hands initialization succeeds locally.
- For production, ensure the `/wasm/` directory is deployed alongside your app.


# Hand Gesture Virtual Instrument - Deployment Guide

## Quick Start

### Development
```powershell
npm install
npm run vendor:fetch
npm run dev
# Open http://localhost:8080
```

The dev environment allows `unsafe-eval` in CSP so MediaPipe's WebAssembly can be instantiated.

### Production
```powershell
npm install
npm run vendor:fetch
npm run vendor:build      # Optional: bundle vendor files into single bundle.js
npm start                 # or: npm run prod
# Open http://your-domain.com
```

The production environment enforces strict CSP without `unsafe-eval`, adds HSTS header, and enables X-Frame-Options.

## Environment Variables

Create a `.env` file (copy from `.env.example`) to customize:

```powershell
NODE_ENV=production     # or "development"
PORT=8080              # Server port
HOST=0.0.0.0           # Server host (use 0.0.0.0 for docker/remote)
LOG_LEVEL=info         # debug, info, warn, error
USE_BUNDLED=false      # Use dist/vendor.bundle.js if true
```

Or set variables in the shell:
```powershell
# PowerShell
$env:NODE_ENV = "production"
npm start

# Or inline
NODE_ENV=production npm start
```

## Deployment Checklist

- [ ] Run `npm install --omit=dev` to install only production dependencies
- [ ] Run `npm run vendor:fetch` to download vendor JS/WASM files
- [ ] Optional: Run `npm run vendor:build` to create bundled `dist/vendor.bundle.js`
- [ ] Set `NODE_ENV=production` environment variable
- [ ] Ensure `/vendor/` and optionally `/dist/` directories are deployed
- [ ] Serve over HTTPS in production
- [ ] Verify CSP headers with `curl -I https://your-domain.com`
- [ ] Test camera access and MediaPipe hand tracking

## Docker Deployment (Optional)

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN npm run vendor:fetch

EXPOSE 8080
ENV NODE_ENV=production
ENV HOST=0.0.0.0

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t hand-gesture-instrument .
docker run -p 8080:8080 -e NODE_ENV=production hand-gesture-instrument
```

## Security Notes

**Development Mode** (`NODE_ENV=development` or `npm run dev`):
- CSP allows `unsafe-eval` for MediaPipe WASM compilation
- Suitable for local development and testing only

**Production Mode** (`NODE_ENV=production` or `npm start`):
- Strict CSP without `unsafe-eval`
- HSTS header enforces HTTPS
- X-Frame-Options prevents embedding
- Permissions-Policy restricts camera/mic to same-origin

To remove `unsafe-eval` in production, you must:
1. Host MediaPipe WASM locally (already set up with `npm run vendor:fetch`)
2. Ensure `/wasm/` directory is deployed and served
3. The `src/hands_wrapper.js` already redirects WASM loads to `/wasm/`

## Monitoring

Check that security headers are sent:
```powershell
curl -I http://localhost:8080

# Look for:
# Content-Security-Policy: ...
# Referrer-Policy: no-referrer
# Permissions-Policy: camera=(self), microphone=(self)
# Strict-Transport-Security: ... (production only)
# X-Frame-Options: DENY (production only)
```

## Troubleshooting

**"Hands is not defined"**: Make sure vendor files are fetched
```powershell
npm run vendor:fetch
```

**WASM compilation error in production**: Ensure WASM files are in `vendor/wasm/` and being served from `/wasm/`

**CSP violations in browser console**: Check CSP header matches your environment. Dev mode should allow eval; production should not.

# Hand Gesture Virtual Instrument

A web-based musical instrument that lets you play notes by moving your hand in front of a webcam!

## Features

- **7-Note Scale** - Play C to B (C4-B4)
- **Multi-Octave Support** - Move hand closer/farther to shift octaves (-2 to +2)
- **Dynamic Volume** - Hand position left-to-right controls volume (0.5x to 1.5x)
- **Waveform Selection** - Choose sine, triangle, sawtooth, or square waves
- **Recording & Playback** - Record your hand gestures and play them back
- **Visual Effects** - Finger trails and particle effects
- **Secure** - Content Security Policy (CSP) with nonces, HTTPS-ready
- **Offline-Ready** - Works with local vendor files (no CDN dependencies)

## Quick Start

### Prerequisites
- Node.js (v14+) and npm
- Webcam/camera
- Modern browser (Chrome, Firefox, Edge, Safari)

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Download vendor files (Tone.js, MediaPipe, etc.)
npm run vendor:fetch

# 3. Start development server
npm run dev
```

Then open **http://localhost:8080** in your browser!

### First Run

1. Click the **"Start"** button
2. Allow camera access when prompted
3. Move your hand in front of the camera to play notes!

**Tips**:
- Higher on screen = higher notes
- Closer to camera = higher octaves
- Left side = quieter, right side = louder
- All 7 notes light up as you move your hand

## npm Scripts

### Development & Testing
```bash
npm run dev              # Start development server (http://localhost:8080)
npm start               # Start production server (with strict CSP)
npm run vendor:fetch    # Download vendor JS and WASM files
```

### Building & Utility
```bash
npm run vendor:build    # Bundle vendors into single file (optional)
npm run compute-sri     # Calculate SRI hashes for CDN files
npm run inspect:wasm    # Analyze WASM file references
```

### Testing
```bash
node tests.js           # Run unit tests
# Then open http://localhost:8080/test-runner.html in browser
```

## How to Play

### Controls
- **Note Selection**: Move hand vertically (up/down)
  - Top = B (highest note)
  - Middle = F/G
  - Bottom = C (lowest note)

- **Octave Shift**: Move hand toward/away from camera (depth)
  - Far away (-0.1m) = Octave -2
  - Normal distance = Octave 0
  - Close to camera (+0.05m) = Octave +2

- **Volume Control**: Move hand left/right
  - Left edge = 50% volume (quiet)
  - Center = 100% volume (normal)
  - Right edge = 150% volume (loud)

### Recording
1. Click **"Record"** to start recording
2. Move your hand to play notes
3. Click **"Record"** again to stop
4. Click **"Playback"** to hear your recording
5. Use **"Select All"** or **"Deselect All"** to choose which notes play back

## Development

### Making Changes

Want to modify the app? See [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md) for quick examples:

- **Change note frequencies** → [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md#change-note-frequencies)
- **Change colors** → [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md#change-note-colors)
- **Adjust sensitivity** → [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md#adjust-note-selection-sensitivity)
- **Add custom sounds** → [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md#audio--music)

### Understanding the Code

1. **New to the project?**
   - Read [ARCHITECTURE.md](ARCHITECTURE.md) → "How the App Works"
   - Takes ~30 minutes to understand the basics

2. **Want to modify something?**
   - Find your task in [MODIFICATIONS_GUIDE.md](MODIFICATIONS_GUIDE.md)
   - Follow the code example
   - Check source file comments for context

3. **Need to deploy?**
   - Follow [DEPLOYMENT.md](DEPLOYMENT.md) step-by-step

## Security

This app implements enterprise-grade security:

- **Content Security Policy (CSP)** with nonce-based script injection
- **HTTPS enforcement** (smart detection of reverse proxy)
- **Security headers** (HSTS, X-Frame-Options, etc.)
- **Subresource Integrity (SRI)** for vendor files
- **Safe DOM practices** (no innerHTML)
- **WASM security** (proper permissions and headers)

See [SECURITY.md](SECURITY.md) and [SECURITY_AUDIT.md](SECURITY_AUDIT.md) for details.

## 📱 Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | Fully supported |
| Firefox | 88+ | Fully supported |
| Safari | 14+ | Fully supported |
| Edge | 90+ | Fully supported |
| Opera | 76+ | Fully supported |

**Requirements**:
- WebAssembly support
- WebGL (for hand detection)
- Web Audio API
- WebRTC (camera access)

## Deployment

### Quick Deployment Steps

```bash
# 1. Install production dependencies
npm install --omit=dev

# 2. Download vendor files
npm run vendor:fetch

# 3. Build (optional, for bundled vendors)
npm run vendor:build

# 4. Start production server
NODE_ENV=production npm start
```

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed guides for:
- **Heroku**, **AWS**, **DigitalOcean**, **Vercel**
- **Docker** deployment
- **Nginx** reverse proxy setup
- **SSL/HTTPS** configuration

## 🐛 Troubleshooting

### Camera not detected
- Check browser permissions (DevTools → Application → Permissions)
- Verify camera works in other apps
- Try a different browser

### Hand not detected
- Ensure good lighting
- Try moving hand slowly
- Check [SCRIPTS_GUIDE.md](SCRIPTS_GUIDE.md) → "Troubleshooting"

### WASM loading errors
- Run `npm run vendor:fetch` to download WASM files
- Check browser DevTools Console for errors
- See [SCRIPTS_GUIDE.md](SCRIPTS_GUIDE.md) → "Troubleshooting"

### Sound not working
- Check volume slider (should be > 0%)
- Verify browser audio permissions
- Try different waveform
- Check DevTools Console for errors

For more issues, see [SCRIPTS_GUIDE.md](SCRIPTS_GUIDE.md#troubleshooting).

## Learning Resources

This project is a great learning resource for:

- **Web Audio API** - Tone.js synthesizer usage
- **Machine Learning in Browser** - MediaPipe Hands integration
- **Real-time Processing** - Hand tracking and audio synthesis loop
- **Security Best Practices** - CSP, HTTPS, safe DOM practices
- **Modern JavaScript** - Async/await, events, DOM manipulation
- **WebAssembly** - WASM module loading and execution

## Performance

- **FPS**: ~30 FPS (optimized for real-time response)
- **Latency**: <100ms (hand detection to sound)
- **Bundle Size**: 
  - Core app: ~50KB (minified)
  - Tone.js: ~400KB
  - MediaPipe: ~4MB (WASM)

Frame skipping enables smooth performance on slower devices.

## Tips & Tricks

1. **Use headphones** for better audio quality
2. **Good lighting** improves hand detection
3. **Smooth movements** reduce note flickering
4. **Experiment with waveforms** - each has different sound quality
5. **Record multiple takes** - select best one to play back

## Contributing

Contributions welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add comments to new code
5. Submit a pull request

## Acknowledgments

- **Tone.js** - Audio synthesis library
- **MediaPipe** - Hand detection and tracking
- **Express.js** - Web server framework
- **Web Audio API** - Browser audio capabilities

---

**Current Version**: 0.1.0  
**Status**: Production Ready

**Start playing**: `npm run dev` → http://localhost:8080

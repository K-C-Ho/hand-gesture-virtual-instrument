# Code Architecture & Developer Guide

This document explains how the Hand Gesture Virtual Instrument works and how to modify it.

## Table of Contents

1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [How the App Works](#how-the-app-works)
4. [Key Components](#key-components)
5. [Data Flow](#data-flow)
6. [Making Changes](#making-changes)
7. [Common Tasks](#common-tasks)

---

## Project Overview

**Hand Gesture Virtual Instrument** is a web application that lets you play musical notes by moving your hand in front of a webcam.

**Tech Stack**:
- **Frontend**: Vanilla JavaScript, HTML5 Canvas
- **Audio**: Tone.js (synthesis library)
- **Hand Tracking**: MediaPipe Hands (ML model)
- **Server**: Node.js + Express (development and production)
- **Security**: Content Security Policy (CSP) with nonces, SRI hashes

**Key Features**:
- Real-time hand detection and tracking
- 7 playable notes (C4 to B4 scale)
- Multi-octave support (hand depth changes pitch)
- Dynamic volume (hand position left-right controls volume)
- Recording and playback of hand gestures
- Visual effects (particle trails, highlighting)
- Waveform selection (sine, triangle, sawtooth, square)

---

## File Structure

```
hand-gesture-virtual-instrument/
│
├── index.html                  # Main HTML page
├── server.js                   # Express.js server with CSP injection
├── config.js                   # Environment-based configuration
├── styles.css                  # All CSS styling
├── package.json                # Project dependencies and npm scripts
│
├── src/                        # Application source code
│   ├── app.js                  # Main application logic (1200+ lines)
│   ├── utils.js                # Shared utility functions (UMD module)
│   └── hands_wrapper.js        # WASM file redirection
│
├── scripts/                    # Utility scripts for building and setup
│   ├── fetch_vendors.js        # Download vendor JS files
│   ├── fetch_wasm.js           # Download WASM files
│   ├── build_vendor_bundle.js  # Bundle vendors (optional)
│   ├── compute_sri.js          # Calculate SRI hashes
│   └── inspect_wasm.js         # Analyze WASM references
│
├── vendor/                     # Downloaded vendor files (created by fetch_vendors.js)
│   ├── tone.js                 # Audio synthesis
│   ├── camera_utils.js         # MediaPipe camera helper
│   ├── drawing_utils.js        # MediaPipe drawing helper
│   ├── hands.js                # Hand detection model
│   └── wasm/                   # WebAssembly modules (created by fetch_wasm.js)
│       ├── vision_wasm_internal.js
│       └── vision_wasm_internal.wasm
│
├── dist/                       # Build output (created by vendor:build)
│   └── vendor.bundle.js        # Bundled vendors (optional)
│
├── ARCHITECTURE.md             # Code architecture and developer guide
├── DEPLOYMENT.md               # Deployment guide
├── MODIFICATIONS_GUIDE.md      # Quick modification reference
├── SCRIPTS_GUIDE.md            # Script usage guide
├── SECURITY.md                 # Security practices
└── SECURITY_AUDIT.md           # Security audit results
```

---

## How the App Works

### Startup Flow

```
1. User opens index.html in browser
   |
   v
2. server.js serves index.html with CSP header (includes nonce for scripts)
   |
   v
3. Browser loads index.html, which includes:
   - styles.css (styling)
   - vendor/tone.js (audio)
   - vendor/camera_utils.js (camera helper)
   - vendor/drawing_utils.js (drawing helper)
   - src/hands_wrapper.js (WASM redirector - loaded BEFORE hands.js!)
   - vendor/hands.js (hand detection)
   - src/utils.js (shared utilities)
   - src/app.js (main app logic)
   |
   v
4. JavaScript runs: window.addEventListener('DOMContentLoaded', init)
   |
   v
5. init() function sets up UI event listeners and initial state
   |
   v
6. App is ready - user can click "Start"
```

### Runtime Flow (When User Clicks "Start")

```
startSystem()
  ↓
initializeAudio()
  - Calls Tone.start() (requires user interaction)
  - Creates Tone.Synth with selected waveform
  - Sets initial volume
  ↓
initializeHandTracking()
  - Creates MediaPipe Hands instance
  - Configures model options (maxNumHands: 1, confidence threshold)
  - Sets up onResults callback
  - Initializes model
  ↓
startCamera()
  - Requests camera permission (user must allow)
  - Creates video stream from webcam
  - Sets canvas dimensions to match video
  - Creates MediaPipe Camera helper
  - Starts camera feed
  ↓
Main Loop (runs ~30 FPS)
  ├─ Camera captures frame
  ├─ MediaPipe detects hand landmarks (21 points per hand)
  ├─ onHandsResults() callback receives detection data
  ├─ App processes hand position:
  │  ├─ Extract index finger tip (landmark #8)
  │  ├─ Map Y position to note (0-6 = B, A, G, F, E, D, C)
  │  ├─ Map Z position (depth) to octave shift (-2 to +2)
  │  ├─ Map X position (horizontal) to volume multiplier (0.5-1.5x)
  │  └─ Play note with calculated frequency and volume
  ├─ If recording: save note data (timestamp, index, octave, frequency)
  ├─ Draw visual feedback on canvas:
  │  ├─ Draw hand skeleton (bones and joints)
  │  ├─ Highlight selected note zone
  │  ├─ Draw finger trail (particle effect)
  │  ├─ Show current note name and info
  └─ Repeat
```

### Key Interactions

**Playing a Note**:
```
Hand position in zone → Detect note change → playNote(frequency)
  ↓
synth.triggerAttack(frequency)  [start ADSR envelope]
  ↓
synth.frequency.setValueAtTime(newFreq, Tone.now())  [change pitch]
  ↓
synth.triggerRelease()  [stop note, fade out]
```

**Recording**:
```
User clicks "Record" → isRecording = true
  ↓
Each note played:
  recordedNotes.push({
    timestamp: Date.now() - recordingStartTime,
    noteIndex: currentNoteIndex,
    octaveShift: currentOctaveShift,
    frequency: currentFrequency
  })
  ↓
User clicks "Playback" → playRecording()
  ↓
For each recorded note:
  Wait until timestamp
  Play note with stored frequency for ~100ms
```

---

## Key Components

### 1. app.js - Main Application (1200+ lines)

**Purpose**: Core application logic

**Major Sections**:

#### State Management (`app` object)
```javascript
const app = {
  // DOM elements
  video, canvas, ctx, stream, hands, camera,
  
  // Audio
  synth, audioInitialized, baseVolume, dynamicVolumeMultiplier,
  
  // Hand tracking
  handDetected, pointerFinger, currentNote, currentNoteIndex, isPlaying,
  
  // Multi-octave
  currentOctaveShift,
  
  // Recording
  isRecording, recordedNotes, isPlayingRecording, selectedNoteIndices,
  
  // Visual effects
  trailPoints, particles,
  
  // Performance
  frameCount, processEveryNthFrame, fps
}
```

#### Core Functions

| Function | Purpose |
|----------|---------|
| `init()` | Initialize DOM listeners and state |
| `initializeAudio()` | Set up Tone.js synthesizer |
| `initializeHandTracking()` | Set up MediaPipe Hands model |
| `startCamera()` | Request camera access and start feed |
| `onHandsResults(results)` | Process hand detection results each frame |
| `playNote(freq)` | Start or update currently playing note |
| `stopNote()` | Stop current note (fade out) |
| `toggleRecording()` | Start/stop recording gestures |
| `playRecording()` | Play back recorded gestures |
| `draw()` | Draw visual feedback to canvas |
| `updateVolume()` | Calculate and apply volume |

---

### 2. **utils.js** - Shared Utilities (UMD Module)

**Purpose**: Mathematical functions used by app.js and tests

**Functions**:

#### `clamp(v, a, b)`
Constrains a value between min and max
```javascript
clamp(5, 0, 10)  // → 5
clamp(15, 0, 10) // → 10
clamp(-5, 0, 10) // → 0
```

#### `getFrequencyWithOctave(baseFrequency, octaveShift)`
Applies octave shifts to a frequency
```javascript
getFrequencyWithOctave(440, 0)   // → 440 Hz (A4)
getFrequencyWithOctave(440, 1)   // → 880 Hz (A5, one octave higher)
getFrequencyWithOctave(440, -1)  // → 220 Hz (A3, one octave lower)
```

#### `calculateDynamicVolumeMultiplier(pointerX, canvasWidth, options)`
Maps hand X position to volume (left=quiet, right=loud)
```javascript
// If hand is on left edge (X=0), volume = 0.5x
// If hand is in center (X=canvasWidth/2), volume = 1.0x
// If hand is on right edge (X=canvasWidth), volume = 1.5x
calculateDynamicVolumeMultiplier(100, 1280)  // Left side → ~0.5
```

#### `zToOctaveShift(avgZ, minZ, maxZ)`
Maps hand depth (Z-axis) to octave shift (-2 to +2)
```javascript
zToOctaveShift(-0.1)  // Far from camera → octave -2
zToOctaveShift(0.0)   // Middle distance → octave 0
zToOctaveShift(0.05)  // Close to camera → octave +2
```

---

### 3. **server.js** - Express.js Server

**Purpose**: Serve app files and inject CSP security headers

**Key Features**:

#### HTTPS Enforcement (Production)
```javascript
// Only redirect if:
// 1. Behind reverse proxy (has x-forwarded-proto header)
// 2. OR REQUIRE_HTTPS=true env var
// Does NOT redirect localhost (allows testing without SSL)
```

#### CSP Header Injection
```javascript
// For each request:
1. Generate random nonce
2. Inject nonce into all <script> tags
3. Set CSP header:
   script-src 'nonce-[random]' 'strict-dynamic' 'wasm-unsafe-eval'
   [+ 'unsafe-eval' in dev]
```

#### Routes
- `GET /` or `/index.html` - Main page with CSP headers
- `GET /src/*` - Application source files
- `GET /vendor/*` - Vendor JavaScript libraries
- `GET /wasm/*` - WebAssembly modules
- `GET /dist/*` - Built bundles (optional)
- `GET /styles/*` - Stylesheets

---

### 4. **config.js** - Environment Configuration

**Purpose**: Centralize environment-dependent settings

**Toggles** (controlled by NODE_ENV and env vars):
- CSP strictness (allow unsafe-eval in dev only)
- Security headers (HSTS in production only)
- WASM eval permission (always allowed, required by MediaPipe)
- Logging level (debug in dev, info in prod)

---

### 5. **hands_wrapper.js** - WASM Redirection

**Purpose**: Intercept WASM file loading and redirect to local `/wasm/`

**How it works**:
```javascript
1. Overrides window.fetch()
2. Checks if URL contains 'vision_wasm_internal'
3. If yes: redirects to /wasm/ instead of CDN
4. If no: passes through unchanged

Example:
  Original: https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm/vision_wasm_internal.wasm
  Redirected to: /wasm/vision_wasm_internal.wasm
```

**Must load BEFORE hands.js** in index.html!

---

### 6. **index.html** - Main Page

**Structure**:
```html
<!DOCTYPE html>
<html>
  <head>
    <!-- CSP meta tag (optional, can also be set by server) -->
    <link rel="stylesheet" href="styles.css">
  </head>
  <body>
    <!-- UI elements: buttons, sliders, displays -->
    <video id="videoElement">     <!-- Camera feed -->
    <canvas id="canvas">          <!-- Visual feedback -->
    
    <!-- Vendor scripts (must be in correct order) -->
    <script src="/vendor/tone.js"></script>
    <script src="/vendor/camera_utils.js"></script>
    <script src="/vendor/drawing_utils.js"></script>
    
    <!-- IMPORTANT: Load hands_wrapper BEFORE hands.js -->
    <script src="/src/hands_wrapper.js"></script>
    <script src="/vendor/hands.js"></script>
    
    <!-- App scripts -->
    <script src="/src/utils.js"></script>
    <script src="/src/app.js"></script>
  </body>
</html>
```

---

## Data Flow

### Hand Position → Note Mapping

```
MediaPipe detects 21 hand landmarks
  ↓
Extract index finger tip (landmark #8)
  ↓
Calculate average Z (depth) from all landmarks
  ↓
Map to 7 zones based on Y position (top to bottom):
  B (493.88 Hz) - top
  A (440.00 Hz)
  G (392.00 Hz)
  F (349.23 Hz)
  E (329.63 Hz)
  D (293.66 Hz)
  C (261.63 Hz) - bottom
  ↓
Map Z position (depth) to octave shift:
  Z = -0.1 (far)    → octave = -2
  Z = 0.0  (middle) → octave = 0
  Z = 0.05 (close)  → octave = +2
  ↓
Map X position (horizontal) to volume multiplier:
  X = 0 (left)      → multiplier = 0.5x (quiet)
  X = mid (center)  → multiplier = 1.0x (normal)
  X = max (right)   → multiplier = 1.5x (loud)
  ↓
Calculate final frequency:
  frequency = baseNote * 2^octaveShift
  ↓
Calculate final volume:
  volume = baseVolume * dynamicMultiplier
  ↓
Play note with Tone.js synth
```

### Recording Data Structure

```javascript
recordedNotes = [
  {
    timestamp: 0,              // ms since recording started
    noteIndex: 4,              // 0-6 (B to C)
    octaveShift: 1,            // -2 to +2
    frequency: 659.26          // Calculated frequency
  },
  {
    timestamp: 150,
    noteIndex: 4,
    octaveShift: 0,
    frequency: 329.63
  },
  ...
]
```

---

## Making Changes

### Adding a New Feature

**Example: Add a new waveform**

1. **Identify where waveforms are configured**:
   - Look in `app.js` for waveformSelect dropdown

2. **Find relevant HTML**:
   - In `index.html`, find `<select id="waveformSelect">`

3. **Add new waveform**:
   ```html
   <select id="waveformSelect">
     <option value="sine">Sine</option>
     <option value="triangle">Triangle</option>
     <option value="square">Square</option>
     <option value="sawtooth">Sawtooth</option>
     <option value="custom">Custom</option>  <!-- NEW -->
   </select>
   ```

4. **Verify Tone.js supports it**:
   - Tone.js oscillator types: 'sine', 'sawtooth', 'square', 'triangle'
   - Custom waveforms require PeriodicWave API

5. **Test**:
   - Run `npm run dev`
   - Click Start
   - Select new waveform
   - Play notes to verify sound changes

### Modifying Note Frequencies

**In `src/app.js`**:
```javascript
const NOTES = [
  { name: 'B', frequency: 493.88, color: '#9b59b6' },
  { name: 'A', frequency: 440.00, color: '#3498db' },
  // ... modify frequencies here
];
```

To change scale:
- Find frequency values online (e.g., "A3 frequency Hz")
- Update the values in NOTES array
- Colors can be any CSS color

### Adding Debug Output

```javascript
// In app.js
console.log('Current note:', app.currentNote);
console.log('Hand position:', app.pointerFinger);
console.log('FPS:', app.fps);
```

**View output**: Open browser DevTools (F12) → Console tab

### Adjusting Hand Sensitivity

**Note change threshold** (in `src/app.js`):
```javascript
const NOTE_CHANGE_THRESHOLD = 20;  // pixels
// Increase = less sensitive (bigger hand movement needed)
// Decrease = more sensitive (smaller movements trigger notes)
```

**Octave range** (in `src/utils.js`):
```javascript
function zToOctaveShift(avgZ, minZ = -0.1, maxZ = 0.05) {
  // minZ: Z value for octave -2 (hand far from camera)
  // maxZ: Z value for octave +2 (hand close to camera)
  // Increase range = less sensitive to depth changes
}
```

---

## Common Tasks

### Task: Change a Note's Frequency
**File**: `src/app.js`, line ~20
```javascript
const NOTES = [
  { name: 'A', frequency: 440.00, ... },  // Change 440.00
];
```

### Task: Change Note Colors
**File**: `src/app.js`, line ~20
```javascript
const NOTES = [
  { name: 'A', frequency: 440.00, color: '#3498db' },  // Change color
];
```

### Task: Adjust Volume Range
**File**: `src/app.js`, line ~70
```javascript
baseVolume: 70,  // Default 0-100, from slider
```

### Task: Change ADSR Envelope
**File**: `src/app.js`, function `initializeAudio()`
```javascript
envelope: {
  attack: 0.05,    // How fast note fades in (seconds)
  decay: 0.1,      // How fast it transitions to sustain
  sustain: 0.7,    // Sustained volume level (0-1)
  release: 0.3     // How fast it fades out
}
```

### Task: Debug Hand Detection
**File**: `src/app.js`, function `onHandsResults()`
```javascript
// Add at top of function:
console.log('Hand detection results:', results);
console.log('Landmarks count:', results.landmarks?.length);
```

### Task: Deploy to Production
**See**: `DEPLOYMENT.md` (comprehensive guide)

**Quick version**:
```bash
npm install --omit=dev         # Install only dependencies
npm run vendor:fetch            # Download vendor files
npm start                       # Start production server (strict CSP)
```

### Task: Add Local HTTPS (for testing)
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365

# Update server.js to use HTTPS:
const https = require('https');
https.createServer({ key, cert }, app).listen(443);

# Run with
npm start
```

---

## Performance Optimization

### Frame Skipping
If FPS drops below 20, app automatically skips processing frames:
```javascript
if (app.fps < FPS_THRESHOLD) {
  app.processEveryNthFrame = 2;  // Process every 2nd frame
}
```

### Limiting Note Changes
Max 10 note changes per second (prevents rapid flickering):
```javascript
if (now - app.lastNoteChangeTime < MIN_NOTE_CHANGE_INTERVAL) {
  return;  // Ignore if too soon
}
```

### Canvas Rendering
Only redraws parts that changed (partial updates, not full clear):
```javascript
// Drawing optimized for performance
ctx.fillStyle = ...;
ctx.fillRect(...);  // Selective redraws
```

---

## Testing

**Unit Tests** (for utility functions):
```bash
node tests.js
```

**Browser Tests**:
```bash
npm run dev
# Open http://localhost:8080/test-runner.html
```

**Manual Testing**:
1. Run `npm run dev`
2. Open http://localhost:8080
3. Click "Start"
4. Move hand in front of camera
5. Check:
   - Notes play correctly
   - Hand is tracked
   - Volume changes with hand position
   - Octave changes with depth
   - Recording captures notes
   - Playback works

---

## Useful Resources

- [Tone.js Documentation](https://tonejs.org/)
- [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

---

**Last Updated**: December 2025
**Project**: Hand Gesture Virtual Instrument v0.1.0

# Quick Modification Guide

Quick reference for common changes to the codebase.

## Table of Contents

1. [Audio & Music](#audio--music)
2. [Hand Tracking](#hand-tracking)
3. [UI & Styling](#ui--styling)
4. [Performance](#performance)
5. [Security](#security)

---

## Audio & Music

### Change Note Frequencies

**File**: `src/app.js` (lines 33-41)

```javascript
const NOTES = [
  { name: 'B', frequency: 493.88, color: '#9b59b6' },
  { name: 'A', frequency: 440.00, color: '#3498db' },
  { name: 'G', frequency: 392.00, color: '#1abc9c' },
  { name: 'F', frequency: 349.23, color: '#2ecc71' },
  { name: 'E', frequency: 329.63, color: '#f1c40f' },
  { name: 'D', frequency: 293.66, color: '#e67e22' },
  { name: 'C', frequency: 261.63, color: '#e74c3c' }
];
```

**To play a different scale** (e.g., C Major pentatonic):
```javascript
const NOTES = [
  { name: 'C', frequency: 261.63, color: '#e74c3c' },
  { name: 'D', frequency: 293.66, color: '#e67e22' },
  { name: 'E', frequency: 329.63, color: '#f1c40f' },
  { name: 'G', frequency: 392.00, color: '#2ecc71' },
  { name: 'A', frequency: 440.00, color: '#3498db' }
];
```

**To find frequencies**: Search "note frequency chart" (e.g., A4=440 Hz)

---

### Change Note Colors

**File**: `src/app.js` (lines 33-41)

```javascript
const NOTES = [
  { name: 'B', frequency: 493.88, color: '#FF0000' },  // Red
  { name: 'A', frequency: 440.00, color: '#00FF00' },  // Green
  { name: 'G', frequency: 392.00, color: '#0000FF' },  // Blue
  // ... etc
];
```

**CSS Color formats**:
- Hex: `#RRGGBB` (e.g., `#FF0000` = red)
- RGB: `rgb(255, 0, 0)` (e.g., red)
- Names: `red`, `blue`, `green`

---

### Change Sound Envelope (ADSR)

**File**: `src/app.js`, function `initializeAudio()` (lines 227-234)

```javascript
app.synth = new Tone.Synth({
  oscillator: { type: selectedWaveform },
  envelope: {
    attack: 0.05,     // ← How long to fade in (seconds)
    decay: 0.1,       // ← How fast to transition to sustain
    sustain: 0.7,     // ← Level to hold (0-1)
    release: 0.3      // ← How long to fade out (seconds)
  }
}).toDestination();
```

**ADSR Explanation**:
- **Attack**: Fade-in time (quick=0.01, slow=1.0)
- **Decay**: Time to reach sustain level
- **Sustain**: Volume level while note plays (0=silent, 1=full)
- **Release**: Fade-out time when note stops

**Examples**:
```javascript
// Piano (fast attack, long release)
envelope: { attack: 0.01, decay: 0.1, sustain: 0.6, release: 0.5 }

// Pad (slow attack and release)
envelope: { attack: 0.5, decay: 0.2, sustain: 0.8, release: 1.0 }

// Stab (very fast, sharp release)
envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.1 }
```

---

### Change Default Volume

**File**: `src/app.js` (line 60)

```javascript
baseVolume: 70,  // 0-100 (percentage)
```

Or dynamically:
```javascript
// In index.html, find the slider:
<input type="range" id="volumeSlider" min="0" max="100" value="70">
// ↑ Change value="70" to desired default (0-100)
```

---

### Add a New Waveform

**File**: `index.html`

1. Find the waveform dropdown:
```html
<select id="waveformSelect">
  <option value="sine">Sine</option>
  <option value="triangle">Triangle</option>
  <option value="sawtooth">Sawtooth</option>
  <option value="square">Square</option>
</select>
```

2. Add new option (Tone.js supports these types):
```html
<select id="waveformSelect">
  <option value="sine">Sine</option>
  <option value="triangle">Triangle</option>
  <option value="sawtooth">Sawtooth</option>
  <option value="square">Square</option>
  <option value="square">Square</option>  <!-- Already supported -->
</select>
```

3. **Note**: Tone.js only supports these 4 waveforms natively. For custom waveforms, use `PeriodicWave` API.

---

## Hand Tracking

### Adjust Note Selection Sensitivity

**File**: `src/app.js` (line 95)

```javascript
const NOTE_CHANGE_THRESHOLD = 20;  // pixels
```

**How it works**:
- Hand must move `NOTE_CHANGE_THRESHOLD` pixels vertically to change notes
- Prevents rapid flickering between notes
- **Increase** (e.g., 50) = less sensitive, requires bigger movements
- **Decrease** (e.g., 10) = more sensitive, reacts to smaller movements

---

### Adjust Octave Range

**File**: `src/utils.js`, function `zToOctaveShift()` (lines 120-135)

```javascript
function zToOctaveShift(avgZ, minZ, maxZ) {
  // Set defaults if not provided
  if (typeof minZ === 'undefined') minZ = -0.1;  // Hand far from camera
  if (typeof maxZ === 'undefined') maxZ = 0.05;  // Hand close to camera
  
  // Current range: -0.1 to 0.05 (depth from ~10cm to 5cm from camera)
}
```

**To adjust**: Modify the default values inside the function:
```javascript
// Make octave changes happen faster (narrower Z range)
if (typeof minZ === 'undefined') minZ = -0.05;
if (typeof maxZ === 'undefined') maxZ = 0.02;

// Make octave changes happen slower (wider Z range)
if (typeof minZ === 'undefined') minZ = -0.2;
if (typeof maxZ === 'undefined') maxZ = 0.1;
```

**How to measure**:
1. Run `npm run dev`
2. Open DevTools Console
3. Move hand and check `console.log()` output
4. Adjust minZ and maxZ based on observed Z values

---

### Adjust Volume Range (X-axis Multiplier)

**File**: `src/utils.js`, function `calculateDynamicVolumeMultiplier()` (line 77)

```javascript
function calculateDynamicVolumeMultiplier(pointerX, canvasWidth, options) {
  options = options || {};
  var leftMultiplier = options.leftMultiplier || 0.5;    // Left edge = 50% volume
  var rightMultiplier = options.rightMultiplier || 1.5;  // Right edge = 150% volume
}
```

**To adjust**:
```javascript
// Less dynamic (more consistent volume)
var leftMultiplier = 0.8;      // Left = 80%
var rightMultiplier = 1.2;     // Right = 120%

// More dynamic (louder range)
var leftMultiplier = 0.3;      // Left = 30%
var rightMultiplier = 2.0;     // Right = 200%

// No dynamic volume (always same)
var leftMultiplier = 1.0;
var rightMultiplier = 1.0;
```

---

### Change Hand Detection Model

**File**: `src/app.js`, function `initializeHandTracking()` (lines 327-332)

```javascript
app.hands.setOptions({
  maxNumHands: 1,              // ← Change to detect multiple hands
  modelComplexity: 1,          // ← 0=lite (faster), 1=full (accurate)
  minDetectionConfidence: 0.5, // ← Higher = only detect confident hands
  minTrackingConfidence: 0.5   // ← Higher = smoother tracking
});
```

**Options**:
- `maxNumHands`: How many hands to detect (1, 2, etc.) - more hands = slower
- `modelComplexity`:
  - `0` = Lite (faster, less accurate)
  - `1` = Full (slower, more accurate)
- `minDetectionConfidence`: 0-1 (higher = filter out low-confidence detections)
- `minTrackingConfidence`: 0-1 (higher = smoother but fewer detections)

---

## UI & Styling

### Change Colors

**File**: `styles.css`

Find the color you want to change and update:

```css
/* Playing note highlight */
.note.active {
  background-color: #FFD700;  /* Change to any color */
}

/* UI buttons */
button {
  background-color: #3498db;  /* Blue */
}

/* Status indicator */
#soundIndicator.playing {
  background-color: #00FF00;  /* Green */
}
```

**Useful color tools**:
- [Colorhexa](https://www.colorhexa.com/) - Color picker with hex codes
- [Coolors](https://coolors.co/) - Color palette generator

---

### Change Font Size

**File**: `styles.css`

```css
body {
  font-size: 16px;  /* Change this */
}

#noteDisplay {
  font-size: 24px;  /* Or individual elements */
}
```

---

### Add Dark Mode Toggle

**File**: `index.html` - Add button:
```html
<button onclick="toggleDarkMode()">Dark Mode</button>
```

**File**: `src/app.js` - Add function:
```javascript
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}
```

**File**: `styles.css` - Add styles:
```css
body.dark-mode {
  background-color: #1a1a1a;
  color: #ffffff;
}

body.dark-mode canvas {
  filter: invert(1);
}
```

---

### Change Button Text

**File**: `index.html`

Find button and change text:
```html
<button id="startBtn">Start</button>      <!-- Change "Start" -->
<button id="stopBtn">Stop</button>        <!-- Change "Stop" -->
<button id="recordBtn">Record</button>    <!-- Change "Record" -->
```

---

## Performance

### Enable Frame Skipping

Frame skipping is already automatic when FPS drops below 20.

**File**: `src/app.js` (line ~90)

```javascript
const FPS_THRESHOLD = 20;  // If FPS < this, skip frames
```

**To adjust**:
```javascript
const FPS_THRESHOLD = 30;  // Start skipping at 30 FPS (more aggressive)
const FPS_THRESHOLD = 15;  // Start skipping at 15 FPS (less aggressive)
```

---

### Limit Note Change Rate

Maximum note changes per second:

**File**: `src/app.js` (line ~95)

```javascript
const MIN_NOTE_CHANGE_INTERVAL = 100;  // milliseconds (10 per second)
```

**To adjust**:
```javascript
const MIN_NOTE_CHANGE_INTERVAL = 50;   // 20 notes per second (more responsive)
const MIN_NOTE_CHANGE_INTERVAL = 200;  // 5 notes per second (smoother)
```

---

### Reduce Canvas Resolution

For slower computers, reduce canvas size:

**File**: `src/app.js`, function `startCamera()` (lines ~200-210)

```javascript
const constraints = {
  video: {
    width: { ideal: 1280 },   // ← Change to 640
    height: { ideal: 720 }    // ← Change to 360
  }
};
```

**Impact**:
- Lower resolution = faster processing
- But hand detection may be less accurate

---

## Security

### Update CSP Policy

**File**: `server.js` (lines ~50-70)

```javascript
const csp = [
  "default-src 'self'",
  scriptSrc,  // Has nonce + strict-dynamic
  "object-src 'none'",
  "base-uri 'self'",
  "connect-src 'self' https://cdn.jsdelivr.net",  // ← Add URLs if needed
  "img-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'"
].join('; ');
```

**Common modifications**:
```javascript
// Allow Google Fonts
"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

// Allow external images
"img-src 'self' data: https:",

// Allow external APIs
"connect-src 'self' https://api.example.com",
```

---

### Disable HTTPS Redirect (For Testing)

**File**: `server.js` (lines ~15-35)

```javascript
// Set environment variable:
REQUIRE_HTTPS=false npm start
```

Or edit code:
```javascript
if (config.isDev === false && process.env.REQUIRE_HTTPS === 'true') {
  // Only redirect if explicitly required
}
```

---

### Update Security Headers

**File**: `server.js` (lines ~120-140)

```javascript
// HSTS header (force HTTPS)
if (config.security.hstsMaxAge) {
  res.setHeader('Strict-Transport-Security', 
    `max-age=${config.security.hstsMaxAge}; includeSubDomains`);
}

// Frame-deny (prevent embedding)
res.setHeader('X-Frame-Options', 'DENY');

// Other headers
res.setHeader('Referrer-Policy', 'no-referrer');
res.setHeader('X-Content-Type-Options', 'nosniff');
```

---

## Debugging

### Enable Debug Logging

**File**: `src/app.js` - Add to functions:

```javascript
console.log('Hand detected:', app.handDetected);
console.log('Current note:', app.currentNote);
console.log('Pointer position:', app.pointerFinger);
console.log('FPS:', app.fps);
console.log('Octave shift:', app.currentOctaveShift);
```

**View in browser**: F12 → Console tab

---

### Check Browser Errors

**Steps**:
1. Open DevTools: `F12` or `Right-click → Inspect`
2. Go to **Console** tab
3. Look for red error messages
4. Click on error to see full details
5. Check line number and file

**Common errors**:
- `Hands is not defined` - Hands.js not loaded
- `Tone is not defined` - Tone.js not loaded
- `Failed to load resource` - File not found (check path)
- `Permission denied` - Camera access denied by user

---

### Monitor Hand Detection

Add this to `onHandsResults()` function:

```javascript
function onHandsResults(results) {
  // Add logging
  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0];
    console.log('Hand detected! Landmarks:', landmarks.length);
    console.log('Index finger tip (landmark 8):', landmarks[8]);
  } else {
    console.log('No hand detected in frame');
  }
  
  // ... rest of function
}
```

---

## Summary of Common Changes

| Change | File | Where |
|--------|------|-------|
| Note frequencies | `src/app.js` | `const NOTES` |
| Note colors | `src/app.js` | `const NOTES` |
| ADSR envelope | `src/app.js` | `initializeAudio()` |
| Default volume | `src/app.js` | `baseVolume` |
| Note sensitivity | `src/app.js` | `NOTE_CHANGE_THRESHOLD` |
| Octave range | `src/utils.js` | `zToOctaveShift()` |
| Volume range | `src/utils.js` | `calculateDynamicVolumeMultiplier()` |
| Colors/fonts | `styles.css` | CSS rules |
| CSP policy | `server.js` | `const csp` |
| Hand detection | `src/app.js` | `initializeHandTracking()` |

---

**Last Updated**: January 2026

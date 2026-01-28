# Hand-Gesture Virtual Instrument: Implementation Plan

## Project Overview

This is a web-based musical instrument controlled by hand gestures captured through a webcam. The application uses computer vision to track finger positions and maps vertical finger movement to musical pitches across a natural scale (C-D-E-F-G-A-B).

**Core Technologies:**
- **MediaPipe Hands** (via CDN) - Google's hand tracking solution, provides 21 3D landmarks per hand
- **Tone.js** - Web Audio API wrapper for sound synthesis
- **HTML5 Canvas** - For video display and visual overlays
- **Vanilla JavaScript** - No framework needed for this scope

**Why These Technologies:**
- MediaPipe Hands is the industry standard for browser-based hand tracking (accurate, fast, no training required)
- Tone.js simplifies complex audio synthesis and provides high-quality sound generation
- All technologies work client-side with no backend required

---

## Step-by-Step Implementation Plan

### **Phase 1: Environment Setup & Camera Access** (Priority: Critical)

**Objective:** Get webcam feed displaying on screen

**Steps:**
1. Create HTML structure with:
   - `<video>` element (hidden, for camera input)
   - `<canvas>` element (visible, for drawing video + overlays)
   - UI controls (start/stop button, status indicator)

2. Request camera permissions using `navigator.mediaDevices.getUserMedia()`
   - Handle permission denied errors
   - Default to rear camera on mobile, front camera on desktop

3. Stream video to canvas at 30fps using `requestAnimationFrame()`
   - Mirror the video horizontally for intuitive interaction

**Deliverable:** Webcam feed displaying in browser

---

### **Phase 2: Hand Detection Integration** (Priority: Critical)

**Objective:** Detect hand and finger positions in real-time

**Steps:**
1. Load MediaPipe Hands library from CDN:
   ```
   https://cdn.jsdelivr.net/npm/@mediapipe/hands
   ```

2. Initialize MediaPipe Hands with configuration:
   - `maxNumHands: 1` (track one hand only for simplicity)
   - `modelComplexity: 1` (balance between speed and accuracy)
   - `minDetectionConfidence: 0.5`
   - `minTrackingConfidence: 0.5`

3. Process each video frame through MediaPipe:
   - Feed canvas frames to `hands.send()`
   - Receive 21 landmark coordinates in callback

4. Identify the 5 fingertips using landmark indices:
   - Thumb tip: landmark #4
   - Index finger tip: landmark #8
   - Middle finger tip: landmark #12
   - Ring finger tip: landmark #16
   - Pinky tip: landmark #20

5. Draw landmarks on canvas for visual feedback
   - Draw circles at fingertip positions
   - Highlight the "active" finger

**Deliverable:** Hand skeleton overlay on video feed

---

### **Phase 3: Finger Selection Logic** (Priority: High)

**Objective:** Determine which finger is the "pointer"

**Approach Options:**
1. **Option A (Recommended):** Index finger (landmark #8) is always the pointer
   - Simplest and most intuitive
   - Mimics natural pointing gesture

2. **Option B:** Highest extended finger
   - Detect which finger is most extended (compare tip to knuckle)
   - More flexible but adds complexity

**Implementation for Option A:**
1. Extract index fingertip coordinates (x, y, z)
2. Convert normalized coordinates (0-1) to canvas pixel coordinates
3. Store current position for pitch mapping

**Deliverable:** Tracking data for pointer finger

---

### **Phase 4: Pitch Mapping System** (Priority: Critical)

**Objective:** Map vertical finger position to musical notes

**Steps:**
1. Define the note scale and frequencies:
   ```javascript
   const notes = [
     { name: 'C', frequency: 261.63 },  // C4
     { name: 'D', frequency: 293.66 },
     { name: 'E', frequency: 329.63 },
     { name: 'F', frequency: 349.23 },
     { name: 'G', frequency: 392.00 },
     { name: 'A', frequency: 440.00 },
     { name: 'B', frequency: 493.88 }
   ];
   ```

2. Divide canvas height into 7 zones (one per note)
   - Top of screen → B (highest pitch)
   - Bottom of screen → C (lowest pitch)

3. Calculate which zone the finger is in:
   ```javascript
   const zoneHeight = canvas.height / 7;
   const noteIndex = Math.floor(fingerY / zoneHeight);
   ```

4. Add hysteresis/smoothing to prevent rapid note changes:
   - Only change note if finger moves significantly (e.g., 20 pixels)
   - Implement debouncing (50-100ms delay)

**Deliverable:** Finger position mapped to note name + frequency

---

### **Phase 5: Audio Synthesis** (Priority: Critical)

**Objective:** Generate musical tones

**Steps:**
1. Load Tone.js from CDN:
   ```
   https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
   ```

2. Create a synthesizer:
   ```javascript
   const synth = new Tone.Synth({
     oscillator: { type: 'sine' },  // Smooth, flute-like sound
     envelope: {
       attack: 0.05,   // Quick fade-in
       decay: 0.1,
       sustain: 0.3,
       release: 0.8    // Gradual fade-out
     }
   }).toDestination();
   ```

3. Implement note triggering logic:
   - **Continuous mode:** Play note whenever finger is detected
   - **Trigger mode:** Play note only when entering a new zone
   
4. Handle note transitions:
   - Stop previous note before starting new one
   - Use `synth.triggerAttackRelease(frequency, duration)`

5. Add volume control based on hand distance (optional):
   - Use z-coordinate from MediaPipe
   - Closer hand → louder sound

**Deliverable:** Sound plays when finger moves through zones

---

### **Phase 6: Visual Feedback UI** (Priority: Medium)

**Objective:** Display scale and current note to user

**Steps:**
1. Draw horizontal lines dividing the 7 note zones
   - Use semi-transparent lines

2. Label each zone with note name (C, D, E, F, G, A, B)
   - Position labels on right side of screen
   - Use large, readable font

3. Highlight the active zone:
   - Change background color of zone containing finger
   - Pulse animation when note triggers

4. Display current note prominently:
   - Large text in corner showing "Current Note: G"
   - Show frequency value for educational purposes

5. Add status indicators:
   - "Hand Detected" / "No Hand Detected"
   - FPS counter (performance monitoring)

**Deliverable:** Intuitive visual interface showing note zones and current state

---

### **Phase 7: Performance Optimization** (Priority: Medium)

**Objective:** Ensure smooth 30fps operation

**Steps:**
1. Optimize MediaPipe processing:
   - Process every other frame if performance is poor (15fps detection)
   - Lower `modelComplexity` to 0 if needed

2. Optimize canvas rendering:
   - Only redraw when hand position changes significantly
   - Use `willReadFrequently: true` on canvas context

3. Audio optimization:
   - Limit note changes to max 10 per second
   - Pre-load Tone.js context on user interaction (avoids audio delays)

4. Memory management:
   - Stop video stream when not in use
   - Properly dispose Tone.js synth when page unloads

**Deliverable:** Smooth, responsive application

---

### **Phase 8: Enhanced Features** (Priority: Low - Optional)

**Optional improvements after core functionality works:**

1. **Multi-octave support:**
   - Use hand distance (z-axis) to shift octaves up/down
   - Display current octave on screen

2. **Different sound presets:**
   - Dropdown to select synth type (sine, square, triangle, sawtooth)
   - Presets: Piano, Flute, Strings, Synth Pad

3. **Recording capability:**
   - Record note sequence with timestamps
   - Playback recorded melody

4. **Visual effects:**
   - Particle effects when notes play
   - Colorful trails following fingertip

5. **Calibration mode:**
   - Let user adjust note zone sizes
   - Save preferences to localStorage

---

## Implementation Priority Order

### **Sprint 1** (Core MVP):
1. Phase 1: Camera Setup
2. Phase 2: Hand Detection
3. Phase 3: Finger Selection (use index finger)
4. Phase 4: Pitch Mapping
5. Phase 5: Audio Synthesis

**Goal:** Working prototype that plays notes based on finger height

### **Sprint 2** (Polish):
6. Phase 6: Visual Feedback
7. Phase 7: Performance Optimization

**Goal:** Production-ready application with good UX

### **Sprint 3** (Optional):
8. Phase 8: Enhanced Features

**Goal:** Differentiated product with extra capabilities

---

## Technical Architecture

```
┌─────────────────────────────────────────────┐
│           Browser Environment               │
│                                             │
│  ┌──────────┐     ┌────────────────────┐  │
│  │  Camera  │────▶│  HTML5 Canvas      │  │
│  │  Stream  │     │  (video + overlay) │  │
│  └──────────┘     └────────────────────┘  │
│                            │                │
│                            ▼                │
│                   ┌─────────────────┐      │
│                   │  MediaPipe      │      │
│                   │  Hands (ML)     │      │
│                   └─────────────────┘      │
│                            │                │
│                            ▼                │
│                   ┌─────────────────┐      │
│                   │  Finger Position│      │
│                   │  Tracking       │      │
│                   └─────────────────┘      │
│                            │                │
│                            ▼                │
│                   ┌─────────────────┐      │
│                   │  Pitch Mapping  │      │
│                   │  (Y → Note)     │      │
│                   └─────────────────┘      │
│                            │                │
│                            ▼                │
│                   ┌─────────────────┐      │
│                   │  Tone.js        │      │
│                   │  (Audio Synth)  │      │
│                   └─────────────────┘      │
│                            │                │
│                            ▼                │
│                    [Audio Output]           │
└─────────────────────────────────────────────┘
```

---

## Key Implementation Considerations

### **1. Coordinate System**
- MediaPipe returns normalized coordinates (0-1)
- Must convert to canvas pixels: `x * canvas.width`, `y * canvas.height`
- Y-axis: 0 = top of screen (high pitch), 1 = bottom (low pitch)

### **2. Audio Context Activation**
- Web Audio requires user interaction before starting
- Add a "Start" button that initializes Tone.js
- Display "Click to start" message initially

### **3. Mobile Considerations**
- Test camera permissions on iOS Safari and Android Chrome
- Smaller touch targets need larger hit zones
- Consider portrait vs landscape orientation

### **4. Error Handling**
- Camera access denied → Show clear error message
- MediaPipe fails to load → Fall back gracefully
- No hand detected → Display helper message

### **5. Latency Minimization**
- Target <100ms latency from gesture to sound
- Use `lookAhead: 0` in Tone.js transport settings
- Process video at native camera FPS (usually 30fps)

---

## Sample Code Structure

```javascript
// main.js structure
const app = {
  // State
  camera: null,
  hands: null,
  synth: null,
  currentNote: null,
  
  // Initialization
  async init() {
    await this.setupCamera();
    await this.setupHandTracking();
    this.setupAudio();
    this.setupCanvas();
    this.startLoop();
  },
  
  // Core loop
  loop() {
    this.processFrame();
    this.detectHands();
    this.updatePitch();
    this.render();
    requestAnimationFrame(() => this.loop());
  }
};
```

---

## Testing Checklist

- [ ] Camera permissions work on Chrome, Firefox, Safari
- [ ] Hand detection works in various lighting conditions
- [ ] Notes play accurately at correct pitches
- [ ] No audio crackling or glitches
- [ ] Smooth visual performance (30fps minimum)
- [ ] Works on mobile devices (iOS/Android)
- [ ] Error messages are clear and helpful
- [ ] UI is intuitive without instructions

---

This plan provides a complete roadmap for your AI coding agent. The modular structure allows for incremental development and testing. Start with Sprint 1 to get a working prototype, then enhance with Sprint 2 and 3 features based on user feedback.
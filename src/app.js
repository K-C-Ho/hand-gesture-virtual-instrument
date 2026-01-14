/**
 * Hand Gesture Virtual Instrument - Main Application
 * 
 * This is the main application logic for the hand gesture-controlled musical instrument.
 * 
 * Features:
 * 1. Hand Tracking: Uses MediaPipe Hands for real-time hand detection
 * 2. Sound Synthesis: Uses Tone.js to generate musical notes
 * 3. Multi-octave Support: Vertical hand position (Z-axis depth) changes octave
 * 4. Dynamic Volume: Horizontal hand position (X-axis) controls volume
 * 5. Recording & Playback: Record hand gestures and play them back
 * 6. Visual Effects: Trail particles and note-triggered visual effects
 * 7. Performance Optimization: Adaptive frame skipping when FPS drops
 * 
 * Architecture:
 * - Uses utils.js for shared functions (clamp, frequency calc, volume calc, etc.)
 * - Uses Tone.js for audio synthesis
 * - Uses MediaPipe for hand detection and landmark tracking
 * - Uses HTML5 Canvas for visual feedback
 * 
 * Main flow:
 * 1. User clicks "Start" → initializes audio and camera
 * 2. MediaPipe detects hand landmarks in real-time
 * 3. App maps hand position to musical notes
 * 4. Audio is played based on hand position
 * 5. Visual feedback shown on canvas
 */

/**
 * NOTES: Musical scale (C4 to B4)
 * Defines the 7 notes that can be played, with frequency and color
 */
const NOTES = [
  { name: 'B', frequency: 493.88, color: '#9b59b6' },  // Purple
  { name: 'A', frequency: 440.00, color: '#3498db' },  // Blue
  { name: 'G', frequency: 392.00, color: '#1abc9c' },  // Teal
  { name: 'F', frequency: 349.23, color: '#2ecc71' },  // Green
  { name: 'E', frequency: 329.63, color: '#f1c40f' },  // Yellow
  { name: 'D', frequency: 293.66, color: '#e67e22' },  // Orange
  { name: 'C', frequency: 261.63, color: '#e74c3c' }   // Red
];

/**
 * Application State Object
 * Stores all runtime state needed by the app
 */
const app = {
  // DOM and Media
  video: null,                              // Video element for camera feed
  canvas: null,                             // Canvas for visual feedback
  ctx: null,                                // 2D canvas context
  stream: null,                             // MediaStream from getUserMedia
  hands: null,                              // MediaPipe Hands instance
  camera: null,                             // MediaPipe Camera helper
  
  // Audio
  synth: null,                              // Tone.js synthesizer
  isRunning: false,                         // Is app actively running
  audioInitialized: false,                  // Has Tone.js been initialized
  baseVolume: 70,                           // Base volume from slider (0-100)
  dynamicVolumeMultiplier: 1.0,             // Volume multiplier based on X position (0.5-1.5)
  
  // Hand Detection & Note Mapping
  handDetected: false,                      // Is a hand currently visible
  pointerFinger: null,                      // Index finger landmark {x, y, z}
  currentNote: null,                        // Current note being played {name, frequency, color}
  currentNoteIndex: -1,                     // Index in NOTES array (-1 = none)
  lastNoteChangeY: 0,                       // Y position of last note change (for hysteresis)
  isPlaying: false,                         // Is a note currently playing
  
  // Multi-octave Support
  currentOctaveShift: 0,                    // Current octave shift (-2 to +2)
  
  // Performance Optimization
  frameCount: 0,                            // Frame counter for adaptive skipping
  processEveryNthFrame: 1,                  // Process every nth frame (increase if FPS drops)
  lastFrameTime: 0,                         // Timestamp of last frame
  fps: 0,                                   // Current FPS (for display)
  lastNoteChangeTime: 0,                    // Timestamp of last note change
  minNoteChangeDelta: 100,                  // Min milliseconds between note changes (10/sec max)
  
  // Recording System
  isRecording: false,                       // Is recording in progress
  recordedNotes: [],                        // Array of {timestamp, noteIndex, octaveShift, frequency}
  recordingStartTime: 0,                    // Timestamp when recording started
  isPlayingRecording: false,                // Is playback in progress
  selectedNoteIndices: new Set(),           // Track which recorded notes to play
  
  // Visual Effects
  trailPoints: [],                          // Finger trail: array of {x, y, life}
  particles: []                             // Visual particles: array of {x, y, vx, vy, life, color}
};

// Constants
const NOTE_CHANGE_THRESHOLD = 20;          // Pixels; ignore small hand movements
const INDEX_FINGER_TIP = 8;                // MediaPipe landmark index for index finger tip
const FPS_THRESHOLD = 20;                  // If FPS < this, enable frame skipping
const MIN_NOTE_CHANGE_INTERVAL = 100;      // Milliseconds between note changes (max 10/sec)

/**
 * Initialize the Application
 * 
 * Sets up DOM element references and event listeners for:
 * - Start/Stop buttons
 * - Volume control slider
 * - Recording controls (record, playback, clear, select/deselect)
 * - Waveform selection dropdown
 * 
 * Called once when the page loads (see end of file: window.addEventListener('DOMContentLoaded', init))
 */
function init() {
  // Get DOM element references
  app.video = document.getElementById('videoElement');
  app.canvas = document.getElementById('canvas');
  app.ctx = app.canvas.getContext('2d', { willReadFrequently: true });
  
  // Start/Stop buttons
  document.getElementById('startBtn').addEventListener('click', startSystem);
  document.getElementById('stopBtn').addEventListener('click', stopSystem);
  
  /**
   * Volume Control Slider
   * Ranges 0-100%, updates display and recalculates synth volume
   */
  document.getElementById('volumeSlider').addEventListener('input', (e) => {
    const volume = e.target.value;
    app.baseVolume = parseInt(volume);
    document.getElementById('volumeValue').textContent = volume + '%';
    updateVolume();
  });

  /**
   * Recording Controls
   * - recordBtn: Toggle recording on/off
   * - playbackBtn: Play all recorded notes
   * - clearBtn: Delete all recorded notes
   * - selectAllBtn/deselectAllBtn: Select notes for playback
   * - playSelectedBtn: Play only selected recorded notes
   */
  document.getElementById('recordBtn').addEventListener('click', toggleRecording);
  document.getElementById('playbackBtn').addEventListener('click', playRecording);
  document.getElementById('clearBtn').addEventListener('click', clearRecording);
  
  // Selection controls for recorded notes
  document.getElementById('selectAllBtn').addEventListener('click', selectAllNotes);
  document.getElementById('deselectAllBtn').addEventListener('click', deselectAllNotes);
  document.getElementById('playSelectedBtn').addEventListener('click', playSelectedNotes);

  /**
   * Waveform Selection Dropdown
   * Allows switching between sine, triangle, sawtooth, square waves
   * 
   * Creates a new Tone.js Synth with the selected waveform
   * Maintains current playing state (note + frequency)
   */
  document.getElementById('waveformSelect').addEventListener('change', (e) => {
    if (app.synth && app.audioInitialized) {
      // Store if we were playing and what frequency
      const wasPlaying = app.isPlaying;
      const currentFreq = wasPlaying ? app.synth.frequency.value : null;
      
      // Stop current note if playing
      if (wasPlaying) {
        stopNote();
      }
      
      // Dispose old synth (release resources)
      app.synth.dispose();
      
      // Create new synth with selected waveform
      app.synth = new Tone.Synth({
        oscillator: {
          type: e.target.value  // 'sine', 'triangle', 'sawtooth', 'square'
        },
        envelope: {
          attack: 0.05,   // 50ms fade-in
          decay: 0.1,     // 100ms decay to sustain
          sustain: 0.7,   // Hold at 70% volume
          release: 0.3    // 300ms fade-out
        }
      }).toDestination();
      
      // Restore volume based on slider
      updateVolume();
      
      // Resume playing if we were playing
      if (wasPlaying && currentFreq) {
        app.synth.triggerAttack(currentFreq);
        app.isPlaying = true;
        document.getElementById('soundIndicator').classList.add('playing');
        document.getElementById('soundStatus').textContent = 'On';
        document.getElementById('noteDisplay').classList.add('playing');
      }
    }
  });
  
  // Set initial UI state
  updateStatus('Click Start to begin', 'inactive');
}

/**
 * Initialize Tone.js Audio Synthesizer
 * 
 * Called when user clicks "Start". Requires user interaction (click) to start Tone.js.
 * 
 * Sets up:
 * 1. Tone.js audio context (must be started by user gesture)
 * 2. Tone.Synth with selected waveform and ADSR envelope
 * 3. Initial volume level
 * 
 * @returns {Promise<void>}
 * @throws {Error} If Tone.js fails to initialize
 */
async function initializeAudio() {
  if (app.audioInitialized) return;  // Already initialized

  try {
    // Start Tone.js audio context
    // This requires a user interaction (click, touch, etc.)
    await Tone.start();
    
    // Get the waveform currently selected in the dropdown
    const selectedWaveform = document.getElementById('waveformSelect').value;
    
    // Create the synthesizer with ADSR envelope
    // ADSR = Attack, Decay, Sustain, Release (controls sound shape)
    app.synth = new Tone.Synth({
      oscillator: {
        type: selectedWaveform  // 'sine', 'triangle', 'sawtooth', 'square'
      },
      envelope: {
        attack: 0.05,    // 50ms fade-in when note starts
        decay: 0.1,      // 100ms transition from attack to sustain
        sustain: 0.7,    // Hold at 70% volume while note plays
        release: 0.3     // 300ms fade-out when note stops
      }
    }).toDestination();  // Route synth to speakers

    // Set initial volume from the slider
    const volumeValue = document.getElementById('volumeSlider').value;
    app.baseVolume = parseInt(volumeValue);
    updateVolume();

    app.audioInitialized = true;
    console.log('Audio initialized successfully');
    
  } catch (error) {
    throw new Error('Failed to initialize audio: ' + error.message);
  }
}

/**
 * Start the Hand Gesture Instrument System
 * 
 * User clicks "Start" button → This function:
 * 1. Initializes audio (Tone.js)
 * 2. Initializes hand tracking (MediaPipe)
 * 3. Starts camera feed
 * 4. Enables recording and playback controls
 * 5. Updates UI status to "Ready to play"
 * 
 * @returns {Promise<void>}
 */
async function startSystem() {
  try {
    hideError();
    updateStatus('Starting...', 'inactive');
    document.getElementById('startBtn').disabled = true;
    
    // Show loading message
    document.getElementById('loadingMsg').classList.add('show');
    
    // Initialize audio first (requires user interaction)
    await initializeAudio();
    
    // Initialize hand tracking
    await initializeHandTracking();
    
    // Start camera feed
    await startCamera();
    
    // Hide loading message
    document.getElementById('loadingMsg').classList.remove('show');
    
    // Mark system as running
    app.isRunning = true;
    updateStatus('Ready to play! Show your hand', 'detecting');
    
    // Enable controls
    document.getElementById('stopBtn').disabled = false;
    document.getElementById('recordBtn').disabled = false;
    document.getElementById('playbackBtn').disabled = false;
    document.getElementById('clearBtn').disabled = false;
    document.getElementById('octaveDisplay').style.display = 'block';

  } catch (error) {
    console.error('Initialization error:', error);
    handleError(error);
    document.getElementById('startBtn').disabled = false;
    document.getElementById('loadingMsg').classList.remove('show');
  }
}

/**
 * Initialize MediaPipe Hand Detection
 * 
 * Sets up the MediaPipe Hands model for real-time hand tracking:
 * - Detects hands in camera feed
 * - Provides 21 hand landmarks (finger joints, palm, etc.)
 * - Calls onHandsResults callback when frame is processed
 * 
 * @returns {Promise<void>}
 * @throws {Error} If MediaPipe initialization fails
 */
async function initializeHandTracking() {
  return new Promise((resolve, reject) => {
    // Create MediaPipe Hands instance
    app.hands = new Hands({
      // locateFile: Tells MediaPipe where to load WASM files
      // NOTE: src/hands_wrapper.js intercepts this to load from local /wasm/
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    // Configure model options
    app.hands.setOptions({
      maxNumHands: 1,              // Detect only 1 hand (multi-hand would be more complex)
      modelComplexity: 1,          // 1 = full model (better accuracy), 0 = lite (faster)
      minDetectionConfidence: 0.5, // Only track hands with >50% confidence
      minTrackingConfidence: 0.5   // Only report tracked hands with >50% confidence
    });

    // Set callback function to receive hand detection results
    // This is called for every frame from the camera
    app.hands.onResults(onHandsResults);
    
    // Initialize the model
    app.hands.initialize().then(() => {
      resolve();
    }).catch((error) => {
      reject(new Error('Failed to initialize MediaPipe Hands: ' + error.message));
    });
  });
}

/**
 * Start Camera Feed
 * 
 * Accesses user's webcam via getUserMedia:
 * 1. Request camera permissions
 * 2. Create video stream from camera
 * 3. Set canvas dimensions to match video
 * 4. Set up MediaPipe Camera helper to send frames to hand detection
 * 
 * @returns {Promise<void>}
 * @throws {Error} If camera access is denied or unavailable
 */
async function startCamera() {
  try {
    // Request camera access
    // width/height are ideal; device chooses closest match
    const constraints = {
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'  // Use front-facing camera
      },
      audio: false  // No microphone needed
    };

    // Get camera stream
    app.stream = await navigator.mediaDevices.getUserMedia(constraints);
    app.video.srcObject = app.stream;
    
    // Wait for video metadata to load (so we know actual dimensions)
    await new Promise((resolve) => {
      app.video.onloadedmetadata = () => {
        resolve();
      };
    });

    // Set canvas to same dimensions as video
    app.canvas.width = app.video.videoWidth;
    app.canvas.height = app.video.videoHeight;

    // Create MediaPipe Camera helper
    // This feeds camera frames to the Hands model
    app.camera = new Camera(app.video, {
      onFrame: async () => {
        // For each video frame, send it to MediaPipe Hands for processing
        if (app.isRunning && app.hands) {
          await app.hands.send({ image: app.video });
        }
      },
      width: app.canvas.width,
      height: app.canvas.height
    });

    // Start the camera feed
    await app.camera.start();

  } catch (error) {
    throw new Error('Camera access failed: ' + error.message);
  }
}

/**
 * Play a Musical Note
 * 
 * Starts or updates the currently playing note.
 * If already playing, changes the frequency (pitch) instead of creating a new note.
 * 
 * Volume is controlled by:
 * - baseVolume: Slider value (0-100%)
 * - dynamicVolumeMultiplier: Based on hand X position (0.5-1.5)
 * 
 * @param {number} frequency - Frequency in Hz (e.g., 440 for A4)
 */
function playNote(frequency) {
  if (!app.synth || !app.audioInitialized) return;  // Audio not ready

  if (!app.isPlaying) {
    // Start a new note (triggerAttack = start ADSR envelope)
    app.synth.triggerAttack(frequency);
    app.isPlaying = true;
    
    // Update UI indicators
    document.getElementById('soundIndicator').classList.add('playing');
    document.getElementById('soundStatus').textContent = 'On';
    document.getElementById('noteDisplay').classList.add('playing');
  } else {
    // Already playing - change frequency (smooth pitch glide)
    app.synth.frequency.setValueAtTime(frequency, Tone.now());
  }
}

/**
 * Stop Playing Current Note
 * 
 * Stops the current note (triggerRelease = start release phase of ADSR).
 * The release phase creates a smooth fade-out.
 */
function stopNote() {
  if (!app.synth || !app.isPlaying) return;  // Nothing playing

  // Start release phase (fade-out)
  app.synth.triggerRelease();
  app.isPlaying = false;
  
  // Update UI indicators
  document.getElementById('soundIndicator').classList.remove('playing');
  document.getElementById('soundStatus').textContent = 'Off';
  document.getElementById('noteDisplay').classList.remove('playing');
}

// MediaPipe Hands results callback
function onHandsResults(results) {
  if (!app.isRunning) return;

  // Frame skipping optimization: if FPS drops, process fewer frames
  app.frameCount++;
  if (app.frameCount % app.processEveryNthFrame !== 0) {
    return; // Skip this frame
  }

  // Calculate FPS
  const now = performance.now();
  if (app.lastFrameTime > 0) {
    const delta = now - app.lastFrameTime;
    app.fps = Math.round(1000 / delta);
    document.getElementById('fpsCounter').textContent = app.fps;
    
    // Dynamic frame skipping: if FPS drops below threshold, skip every other frame
    if (app.fps < FPS_THRESHOLD && app.processEveryNthFrame === 1) {
      app.processEveryNthFrame = 2;
      console.warn('Performance: Enabling frame skipping (processing every 2nd frame)');
    } else if (app.fps > FPS_THRESHOLD + 5 && app.processEveryNthFrame > 1) {
      app.processEveryNthFrame = 1;
      console.log('Performance: Disabling frame skipping (back to normal)');
    }
  }
  app.lastFrameTime = now;

  // Clear canvas
  app.ctx.clearRect(0, 0, app.canvas.width, app.canvas.height);

  // Draw note zones
  drawNoteZones();

  // Draw video frame (mirrored)
  app.ctx.save();
  app.ctx.translate(app.canvas.width, 0);
  app.ctx.scale(-1, 1);
  app.ctx.drawImage(results.image, 0, 0, app.canvas.width, app.canvas.height);
  app.ctx.restore();

  // Check if hand is detected
  if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
    app.handDetected = true;
    const landmarks = results.multiHandLandmarks[0];
    
    extractPointerFinger(landmarks);
    
    if (app.pointerFinger) {
      mapPositionToNote();
      calculateDynamicVolume(); // Add dynamic volume control
      updateOctaveShift(landmarks); // Phase 8: Multi-octave support
      
      drawHandSkeleton(landmarks);
      drawPointer();
      drawTrail(); // Phase 8: Visual trail effect
      highlightActiveZone();
      
      // Play the note!
      if (app.currentNote) {
        const adjustedFrequency = getFrequencyWithOctave(app.currentNote.frequency);
        playNote(adjustedFrequency);
      }
    }
    
    document.getElementById('handStatus').textContent = 'Yes';
    updateStatus('🎵 Playing notes!', 'active');
    
  } else {
    app.handDetected = false;
    app.pointerFinger = null;
    
    // Stop playing when hand is not detected
    stopNote();
    
    app.currentNote = null;
    app.currentNoteIndex = -1;
    app.dynamicVolumeMultiplier = 1.0;
    
    document.getElementById('handStatus').textContent = 'No';
    document.getElementById('noteZone').textContent = '--';
    document.getElementById('currentNote').textContent = '--';
    document.getElementById('currentFrequency').textContent = '-- Hz';
    document.getElementById('dynamicVolume').textContent = '100%';
    updateStatus('No hand detected - Move hand into view', 'detecting');
  }
  
  // Phase 8: Update visual effects on every frame
  updateParticles();
}

// (rest of functions are defined below in this file)

// Draw note zones
function drawNoteZones() {
  const zoneHeight = app.canvas.height / NOTES.length;
  
  NOTES.forEach((note, index) => {
    const y = index * zoneHeight;
    
    app.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    app.ctx.lineWidth = 2;
    app.ctx.beginPath();
    app.ctx.moveTo(0, y);
    app.ctx.lineTo(app.canvas.width, y);
    app.ctx.stroke();
    
    app.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    app.ctx.font = 'bold 40px Arial';
    app.ctx.textAlign = 'right';
    app.ctx.textBaseline = 'middle';
    app.ctx.fillText(note.name, app.canvas.width - 20, y + zoneHeight / 2);
  });
}

// Extract pointer finger
function extractPointerFinger(landmarks) {
  const landmark = landmarks[INDEX_FINGER_TIP];
  
  app.pointerFinger = {
    x: landmark.x * app.canvas.width,
    y: landmark.y * app.canvas.height,
    z: landmark.z,
    displayX: (1 - landmark.x) * app.canvas.width
  };
}

// Map position to note
function mapPositionToNote() {
  if (!app.pointerFinger) return;
  
  const y = app.pointerFinger.y;
  const zoneHeight = app.canvas.height / NOTES.length;
  
  let noteIndex = Math.floor(y / zoneHeight);
  noteIndex = Math.max(0, Math.min(NOTES.length - 1, noteIndex));
  
  // Apply hysteresis
  if (app.currentNoteIndex !== -1) {
    const yDiff = Math.abs(y - app.lastNoteChangeY);
    if (yDiff < NOTE_CHANGE_THRESHOLD && noteIndex !== app.currentNoteIndex) {
      noteIndex = app.currentNoteIndex;
    }
  }
  
  // Update note if changed (with throttling: max 10 changes per second)
  if (noteIndex !== app.currentNoteIndex) {
    const now = performance.now();
    const timeSinceLastChange = now - app.lastNoteChangeTime;
    
    // Only allow note change if enough time has passed
    if (timeSinceLastChange >= MIN_NOTE_CHANGE_INTERVAL) {
      app.currentNoteIndex = noteIndex;
      app.currentNote = NOTES[noteIndex];
      app.lastNoteChangeY = y;
      app.lastNoteChangeTime = now;
      
      document.getElementById('currentNote').textContent = app.currentNote.name;
      document.getElementById('currentFrequency').textContent = app.currentNote.frequency.toFixed(2) + ' Hz';
      document.getElementById('noteZone').textContent = app.currentNote.name;
      
      // Phase 8: Record note and create visual effect
      recordNote();
      createNoteParticles();
    }
  }
}

// Highlight active zone
function highlightActiveZone() {
  if (!app.currentNote || app.currentNoteIndex === -1) return;

  const zoneHeight = app.canvas.height / NOTES.length;
  const y = app.currentNoteIndex * zoneHeight;

  // Convert hex color to rgba with an animated (pulsing) alpha
  function hexToRgba(hex, alpha) {
    const h = hex.replace('#', '');
    const bigint = parseInt(h, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Subtle pulse: alpha oscillates over time for a gentle animation
  const pulseAlpha = 0.12 + 0.06 * Math.sin(performance.now() / 300);
  const fillColor = hexToRgba(app.currentNote.color, Math.abs(pulseAlpha));

  app.ctx.fillStyle = fillColor;
  app.ctx.fillRect(0, y, app.canvas.width, zoneHeight);

  app.ctx.strokeStyle = hexToRgba(app.currentNote.color, 0.6);
  app.ctx.lineWidth = 4;
  app.ctx.beginPath();
  app.ctx.rect(0, y, app.canvas.width, zoneHeight);
  app.ctx.stroke();
}

// Draw hand skeleton
function drawHandSkeleton(landmarks) {
  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [0, 9], [9, 10], [10, 11], [11, 12],
    [0, 13], [13, 14], [14, 15], [15, 16],
    [0, 17], [17, 18], [18, 19], [19, 20],
    [5, 9], [9, 13], [13, 17]
  ];

  app.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  app.ctx.lineWidth = 2;

  connections.forEach(([start, end]) => {
    const startPoint = landmarks[start];
    const endPoint = landmarks[end];
    
    app.ctx.beginPath();
    app.ctx.moveTo(
      (1 - startPoint.x) * app.canvas.width,
      startPoint.y * app.canvas.height
    );
    app.ctx.lineTo(
      (1 - endPoint.x) * app.canvas.width,
      endPoint.y * app.canvas.height
    );
    app.ctx.stroke();
  });
}

// Draw pointer
function drawPointer() {
  if (!app.pointerFinger) return;

  const x = app.pointerFinger.displayX;
  const y = app.pointerFinger.y;

  // Outer glow
  const gradient = app.ctx.createRadialGradient(x, y, 0, x, y, 40);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  app.ctx.fillStyle = gradient;
  app.ctx.beginPath();
  app.ctx.arc(x, y, 40, 0, 2 * Math.PI);
  app.ctx.fill();

  // Main pointer circle
  app.ctx.fillStyle = app.currentNote ? app.currentNote.color : '#4ecdc4';
  app.ctx.beginPath();
  app.ctx.arc(x, y, 16, 0, 2 * Math.PI);
  app.ctx.fill();
  
  app.ctx.strokeStyle = 'white';
  app.ctx.lineWidth = 4;
  app.ctx.stroke();

  // Crosshair
  app.ctx.strokeStyle = 'white';
  app.ctx.lineWidth = 3;
  app.ctx.beginPath();
  app.ctx.moveTo(x - 10, y);
  app.ctx.lineTo(x + 10, y);
  app.ctx.moveTo(x, y - 10);
  app.ctx.lineTo(x, y + 10);
  app.ctx.stroke();
}

// Update volume based on base volume and dynamic multiplier
function updateVolume() {
  if (!app.synth) return;
  
  // Calculate final volume (base * multiplier)
  const finalVolume = app.baseVolume * app.dynamicVolumeMultiplier;
  
  // Clamp to 0-100 range
  const clampedVolume = Math.max(0, Math.min(100, finalVolume));
  
  // Convert to decibels
  app.synth.volume.value = ((clampedVolume - 100) / 100) * 40;
  
  // Update UI
  document.getElementById('dynamicVolume').textContent = Math.round(clampedVolume) + '%';
}

// Calculate dynamic volume multiplier based on X position
function calculateDynamicVolume() {
  if (!app.pointerFinger) return;
  
  const centerX = app.canvas.width / 2;
  const x = app.pointerFinger.x; // Use non-mirrored X for natural control
  
  // Calculate distance from center as a ratio (-1 to 1)
  // Left = negative, Right = positive
  const distanceFromCenter = (centerX - x) / centerX;
  
  // Map to multiplier range:
  // Far left (-1) = 0.5x (50% of base volume)
  // Center (0) = 1.0x (100% of base volume)
  // Far right (+1) = 1.5x (150% of base volume)
  app.dynamicVolumeMultiplier = 1.0 + (distanceFromCenter * 0.5);
  
  // Clamp multiplier to reasonable range
  app.dynamicVolumeMultiplier = Math.max(0.5, Math.min(1.5, app.dynamicVolumeMultiplier));
  
  // Update volume
  updateVolume();
}

// Stop system
function stopSystem() {
  app.isRunning = false;
  
  // Stop audio first
  stopNote();
  
  if (app.synth) {
    app.synth.dispose();
    app.synth = null;
  }
  
  app.audioInitialized = false;
  
  if (app.camera) {
    app.camera.stop();
    app.camera = null;
  }

  if (app.stream) {
    app.stream.getTracks().forEach(track => track.stop());
    app.stream = null;
  }

  if (app.hands) {
    app.hands.close();
    app.hands = null;
  }

  app.video.srcObject = null;
  app.ctx.clearRect(0, 0, app.canvas.width, app.canvas.height);
  
  app.handDetected = false;
  app.pointerFinger = null;
  app.currentNote = null;
  app.currentNoteIndex = -1;
  app.dynamicVolumeMultiplier = 1.0;
  
  updateStatus('Stopped', 'inactive');
  document.getElementById('handStatus').textContent = 'No';
  document.getElementById('soundStatus').textContent = 'Off';
  document.getElementById('noteZone').textContent = '--';
  document.getElementById('currentNote').textContent = '--';
  document.getElementById('currentFrequency').textContent = '-- Hz';
  document.getElementById('dynamicVolume').textContent = '100%';
  document.getElementById('fpsCounter').textContent = '0';
  
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
}

// Update status indicator
function updateStatus(text, state) {
  const indicator = document.getElementById('statusIndicator');
  const statusText = document.getElementById('statusText');
  
  statusText.textContent = text;
  indicator.className = 'status-indicator ' + state;
}

// Handle errors
function handleError(error) {
  let errorMessage = error.message || 'An unknown error occurred.';
  
  if (errorMessage.includes('Camera access')) {
    errorMessage += ' Please allow camera access in your browser settings.';
  }
  
  showError(errorMessage);
  updateStatus('Error', 'inactive');
  
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
}

// Show error message
function showError(message) {
  const errorBox = document.getElementById('errorBox');
  const errorText = document.getElementById('errorText');
  errorText.textContent = message;
  errorBox.classList.add('show');
}

// Hide error message
function hideError() {
  document.getElementById('errorBox').classList.remove('show');
}

// ===== PHASE 8: ENHANCED FEATURES =====

// Calculate octave shift based on hand distance (z-axis)
function updateOctaveShift(landmarks) {
  if (!landmarks || landmarks.length < 21) return;
  
  // Collect all Z values from landmarks for better depth estimation
  const zValues = landmarks.map(l => l.z);
  const avgZ = zValues.reduce((a, b) => a + b, 0) / zValues.length;
  
  // MediaPipe Z ranges roughly from -0.1 (reasonably close) to 0.05 (reasonably far)
  // Map this to octave shifts of -2 to +2
  // Closer hand (more negative Z) → higher octaves
  // Farther hand (less negative Z) → lower octaves
  
  const minZ = -0.1;  // Reasonably close
  const maxZ = 0.05;  // Reasonably far
  let normalized = (avgZ - minZ) / (maxZ - minZ); // 0 to 1
  normalized = Math.max(0, Math.min(1, normalized)); // Clamp to 0-1
  let octave = Math.round((normalized * 4) - 2); // Map to -2 to +2
  octave = Math.max(-2, Math.min(2, octave)); // Clamp to -2 to +2
  
  if (octave !== app.currentOctaveShift) {
    app.currentOctaveShift = octave;
    const octaveText = octave > 0 ? '+' + octave : octave;
    document.getElementById('octaveValue').textContent = octaveText;
    console.log(`Octave shift: ${octaveText} (avgZ: ${avgZ.toFixed(3)})`);
  }
}

// Get frequency with octave shift applied
function getFrequencyWithOctave(baseFrequency) {
  // Each octave up = multiply by 2
  return baseFrequency * Math.pow(2, app.currentOctaveShift);
}

// Toggle recording
function toggleRecording() {
  if (!app.audioInitialized) return;
  
  const btn = document.getElementById('recordBtn');
  const info = document.getElementById('recordingInfo');
  
  if (!app.isRecording) {
    // Start recording
    app.isRecording = true;
    app.recordedNotes = [];
    app.selectedNoteIndices.clear();
    app.recordingStartTime = performance.now();
    btn.textContent = '⏹️ Stop Recording';
    btn.style.background = 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)';
    info.style.display = 'block';
    document.getElementById('recordingStatus').textContent = '🔴 Recording... Notes will be captured.';
    document.getElementById('recordedNotesContainer').style.display = 'block';
    updateRecordedNotesList();
  } else {
    // Stop recording
    app.isRecording = false;
    btn.textContent = '⏺️ Record';
    btn.style.background = '';
    info.style.display = 'block';
    document.getElementById('recordingStatus').textContent = 
      `✓ Recorded ${app.recordedNotes.length} notes. Select notes above to play back!`;
  }
}

// Record note when it changes
function recordNote() {
  if (!app.isRecording || !app.currentNote) return;
  
  const now = performance.now();
  const relativeTime = now - app.recordingStartTime;
  
  const noteData = {
    timestamp: relativeTime,
    noteIndex: app.currentNoteIndex,
    octaveShift: app.currentOctaveShift,
    frequency: getFrequencyWithOctave(app.currentNote.frequency)
  };
  
  app.recordedNotes.push(noteData);
  
  // Update UI with new note
  const index = app.recordedNotes.length - 1;
  app.selectedNoteIndices.add(index); // Select new notes by default
  updateRecordedNotesList();
}

// Play back recorded notes (all notes)
function playRecording() {
  if (app.recordedNotes.length === 0) {
    alert('No notes recorded yet! Click Record while playing to capture notes.');
    return;
  }
  playSequence(Array.from({length: app.recordedNotes.length}, (_, i) => i));
}

// Play only selected notes
function playSelectedNotes() {
  const selected = Array.from(app.selectedNoteIndices).sort((a, b) => a - b);
  if (selected.length === 0) {
    alert('No notes selected! Click Select All or check notes to play.');
    return;
  }
  playSequence(selected);
}

// Common playback sequence logic
function playSequence(noteIndices) {
  if (app.isPlayingRecording) {
    app.isPlayingRecording = false;
    stopNote();
    return;
  }
  
  app.isPlayingRecording = true;
  const playBtn = document.getElementById('playbackBtn');
  playBtn.textContent = '⏹️ Stop Playback';
  playBtn.style.background = 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)';
  
  let noteIdx = 0;
  const startTime = performance.now();
  
  function playNext() {
    if (!app.isPlayingRecording || noteIdx >= noteIndices.length) {
      app.isPlayingRecording = false;
      playBtn.textContent = '▶️ Playback';
      playBtn.style.background = '';
      stopNote();
      return;
    }
    
    const recordedNoteIdx = noteIndices[noteIdx];
    const note = app.recordedNotes[recordedNoteIdx];
    const elapsed = performance.now() - startTime;
    const nextNoteTime = note.timestamp;
    
    if (elapsed >= nextNoteTime) {
      // Play this note
      if (app.synth && app.audioInitialized) {
        playNote(note.frequency);
        app.currentNote = NOTES[note.noteIndex];
        app.currentOctaveShift = note.octaveShift;
        document.getElementById('currentNote').textContent = app.currentNote.name + (note.octaveShift !== 0 ? (note.octaveShift > 0 ? '+' : '') + note.octaveShift : '');
        document.getElementById('currentFrequency').textContent = note.frequency.toFixed(2) + ' Hz';
        document.getElementById('octaveValue').textContent = note.octaveShift > 0 ? '+' + note.octaveShift : note.octaveShift;
      }
      
      noteIdx++;
      
      // Schedule next note
      if (noteIdx < noteIndices.length) {
        const nextNote = app.recordedNotes[noteIndices[noteIdx]];
        const delayUntilNext = nextNote.timestamp - nextNoteTime;
        setTimeout(playNext, delayUntilNext);
      } else {
        setTimeout(playNext, 500);
      }
    } else {
      // Wait for next note time
      const delayUntilNext = nextNoteTime - elapsed;
      setTimeout(playNext, Math.min(delayUntilNext, 50));
    }
  }
  
  playNext();
}

// Clear recording
function clearRecording() {
  if (app.recordedNotes.length === 0) {
    alert('No recording to clear!');
    return;
  }
  
  if (confirm('Are you sure you want to delete the recording? This cannot be undone.')) {
    app.recordedNotes = [];
    app.selectedNoteIndices.clear();
    document.getElementById('recordingInfo').style.display = 'none';
    document.getElementById('recordedNotesContainer').style.display = 'none';
    updateRecordedNotesList();
    alert('Recording cleared!');
  }
}

// Update the displayed list of recorded notes with checkboxes
function updateRecordedNotesList() {
  const container = document.getElementById('recordedNotesContainer');
  const notesList = document.getElementById('notesList');
  
  if (app.recordedNotes.length === 0) {
    container.style.display = 'none';
    return;
  }
  
  container.style.display = 'block';
  
  // Build notes list using DOM methods to avoid innerHTML and inline handlers
  const fragment = document.createDocumentFragment();
  app.recordedNotes.forEach((note, index) => {
    const noteName = NOTES[note.noteIndex].name;
    const octaveText = note.octaveShift !== 0 ? ` (${note.octaveShift > 0 ? '+' : ''}${note.octaveShift})` : '';
    const timeText = (note.timestamp / 1000).toFixed(2) + 's';

    const item = document.createElement('div');
    item.className = 'note-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `note-${index}`;
    checkbox.checked = app.selectedNoteIndices.has(index);
    checkbox.addEventListener('change', () => { toggleNoteSelection(index); });

    const content = document.createElement('div');
    content.className = 'note-item-content';
    const strong = document.createElement('strong');
    strong.textContent = noteName + octaveText;
    content.appendChild(strong);
    content.appendChild(document.createTextNode(' - ' + note.frequency.toFixed(1) + ' Hz'));

    const timeDiv = document.createElement('div');
    timeDiv.className = 'note-item-time';
    timeDiv.textContent = timeText;

    item.appendChild(checkbox);
    item.appendChild(content);
    item.appendChild(timeDiv);
    fragment.appendChild(item);
  });

  // Replace children safely
  while (notesList.firstChild) notesList.removeChild(notesList.firstChild);
  notesList.appendChild(fragment);
}

// Toggle note selection
function toggleNoteSelection(index) {
  if (app.selectedNoteIndices.has(index)) {
    app.selectedNoteIndices.delete(index);
  } else {
    app.selectedNoteIndices.add(index);
  }
  updateRecordedNotesList();
}

// Select all recorded notes
function selectAllNotes() {
  for (let i = 0; i < app.recordedNotes.length; i++) {
    app.selectedNoteIndices.add(i);
  }
  updateRecordedNotesList();
}

// Deselect all recorded notes
function deselectAllNotes() {
  app.selectedNoteIndices.clear();
  updateRecordedNotesList();
}

// Draw finger trail (visual effect)
function drawTrail() {
  if (!app.pointerFinger) return;
  
  // Add new trail point
  app.trailPoints.push({
    x: app.pointerFinger.displayX,
    y: app.pointerFinger.y,
    life: 1.0
  });
  
  // Limit trail length
  if (app.trailPoints.length > 30) {
    app.trailPoints.shift();
  }
  
  // Draw trail with fading opacity
  app.trailPoints.forEach((point, index) => {
    const opacity = (point.life * 0.6).toFixed(2);
    const size = 4 + (1 - point.life) * 6; // Grow as it fades
    
    const gradient = app.ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, size);
    gradient.addColorStop(0, `rgba(255, 200, 100, ${opacity})`);
    gradient.addColorStop(1, `rgba(255, 150, 0, ${opacity * 0.3})`);
    
    app.ctx.fillStyle = gradient;
    app.ctx.beginPath();
    app.ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
    app.ctx.fill();
    
    // Fade out
    point.life -= 0.05;
  });
  
  // Remove dead trail points
  app.trailPoints = app.trailPoints.filter(p => p.life > 0);
}

// Create particle effect when note plays
function createNoteParticles() {
  if (!app.currentNote || !app.pointerFinger) return;
  
  const particleCount = 8;
  for (let i = 0; i < particleCount; i++) {
    const angle = (i / particleCount) * Math.PI * 2;
    const speed = 2 + Math.random() * 3;
    
    app.particles.push({
      x: app.pointerFinger.displayX,
      y: app.pointerFinger.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1.0,
      color: app.currentNote.color
    });
  }
}

// Update and draw particles
function updateParticles() {
  app.particles.forEach((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.vy += 0.15; // Gravity
    particle.life -= 0.03;
    
    // Draw particle
    const opacity = (particle.life * 0.8).toFixed(2);
    const size = 3 + (1 - particle.life) * 4;
    
    app.ctx.fillStyle = particle.color.replace('#', 'rgba(') + `, ${opacity})`;
    app.ctx.beginPath();
    app.ctx.arc(particle.x, particle.y, size, 0, 2 * Math.PI);
    app.ctx.fill();
  });
  
  // Remove dead particles
  app.particles = app.particles.filter(p => p.life > 0);
}

// Initialize on page load
window.addEventListener('load', init);

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (app.isRunning) {
    stopSystem();
  }
});

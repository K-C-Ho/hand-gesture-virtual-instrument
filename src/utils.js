/**
 * Shared Utility Functions for Hand Gesture Instrument
 * 
 * This module uses the UMD (Universal Module Definition) pattern to work in:
 * - Node.js (CommonJS): Used by test suite
 * - Browser (global): Used by application code
 * - AMD loaders: For compatibility
 * 
 * Functions:
 * - clamp: Constrain a value between min and max
 * - getFrequencyWithOctave: Apply octave shifts to base frequencies
 * - calculateDynamicVolumeMultiplier: Volume varies by hand position (X-axis)
 * - zToOctaveShift: Convert hand depth (Z-axis) to octave shift
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD loader (e.g., RequireJS)
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    // Node.js / CommonJS
    module.exports = factory();
  } else {
    // Browser global
    root.utils = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Clamp a value between a minimum and maximum
   * 
   * @param {number} v - The value to clamp
   * @param {number} a - Minimum (lower bound)
   * @param {number} b - Maximum (upper bound)
   * @returns {number} The clamped value (a <= result <= b)
   */
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  /**
   * Get frequency adjusted by octave shift
   * 
   * Each octave doubles or halves the frequency:
   * - octaveShift = -1 → freq / 2
   * - octaveShift = 0 → freq (unchanged)
   * - octaveShift = +1 → freq * 2
   * - octaveShift = +2 → freq * 4
   * 
   * @param {number} baseFrequency - Base frequency in Hz (e.g., 440 for A4)
   * @param {number} [octaveShift=0] - Octave shift (-2..+2)
   * @returns {number} Adjusted frequency
   */
  function getFrequencyWithOctave(baseFrequency, octaveShift) {
    octaveShift = octaveShift || 0;
    return baseFrequency * Math.pow(2, octaveShift);
  }

  /**
   * Calculate dynamic volume multiplier based on hand X position
   * 
   * Volume varies left-to-right:
   * - Left edge (X=0): multiplier = leftMultiplier (default 0.5 = half volume)
   * - Center (X=canvasWidth/2): multiplier = 1.0
   * - Right edge (X=canvasWidth): multiplier = rightMultiplier (default 1.5 = 1.5x volume)
   * 
   * This makes the instrument responsive to horizontal hand movement.
   * 
   * @param {number} pointerX - Hand X position in pixels
   * @param {number} canvasWidth - Canvas width in pixels
   * @param {object} [options] - Optional configuration
   * @param {number} [options.leftMultiplier=0.5] - Volume multiplier at left edge
   * @param {number} [options.rightMultiplier=1.5] - Volume multiplier at right edge
   * @returns {number} Volume multiplier (typically 0.5..1.5)
   */
  function calculateDynamicVolumeMultiplier(pointerX, canvasWidth, options) {
    options = options || {};
    var leftMultiplier = typeof options.leftMultiplier === 'number' ? options.leftMultiplier : 0.5;
    var rightMultiplier = typeof options.rightMultiplier === 'number' ? options.rightMultiplier : 1.5;

    // Calculate normalized position: -1 (left) to +1 (right)
    var center = canvasWidth / 2;
    var ratio = 0;
    if (center !== 0) {
      ratio = (pointerX - center) / center;
    }
    ratio = clamp(ratio, -1, 1);

    // Linear interpolation between left and right multipliers
    var multiplier;
    if (ratio >= 0) {
      // Right side: interpolate from 1.0 to rightMultiplier
      multiplier = 1 + ratio * (rightMultiplier - 1);
    } else {
      // Left side: interpolate from leftMultiplier to 1.0
      multiplier = 1 + ratio * (1 - leftMultiplier);
    }

    // Final clamp to ensure within bounds
    multiplier = clamp(multiplier, Math.min(leftMultiplier, rightMultiplier), Math.max(leftMultiplier, rightMultiplier));
    return multiplier;
  }

  /**
   * Convert average hand depth (Z-axis) to octave shift
   * 
   * MediaPipe provides Z coordinates in 3D space:
   * - Z ≈ -0.1: Hand far from camera → octave shift = -2 (lowest)
   * - Z ≈ -0.02: Hand at middle depth → octave shift = 0 (normal)
   * - Z ≈ 0.05: Hand very close to camera → octave shift = +2 (highest)
   * 
   * Moving hand toward/away from camera changes the pitch up/down.
   * 
   * @param {number} avgZ - Average Z coordinate from MediaPipe (typically -0.1..0.05)
   * @param {number} [minZ=-0.1] - Z value for octave shift = -2 (hand farthest)
   * @param {number} [maxZ=0.05] - Z value for octave shift = +2 (hand closest)
   * @returns {number} Octave shift (-2..+2)
   */
  function zToOctaveShift(avgZ, minZ, maxZ) {
    // Set defaults if not provided
    if (typeof minZ === 'undefined') minZ = -0.1;
    if (typeof maxZ === 'undefined') maxZ = 0.05;

    // Normalize Z to 0..1 range
    var normalized = (avgZ - minZ) / (maxZ - minZ);
    normalized = clamp(normalized, 0, 1);
    
    // Convert 0..1 to -2..+2 octave range
    var octave = Math.round((normalized * 4) - 2);
    octave = clamp(octave, -2, 2);
    return octave;
  }

  // Export all functions
  return {
    clamp: clamp,
    getFrequencyWithOctave: getFrequencyWithOctave,
    calculateDynamicVolumeMultiplier: calculateDynamicVolumeMultiplier,
    zToOctaveShift: zToOctaveShift
  };
}));

// src/services/soundEffects.js
// Sintetizador nativo con Web Audio API (Cero dependencias externas)

let audioCtx = null;
let soundEnabled = true;

try {
  const saved = localStorage.getItem('gairo_sound_enabled');
  if (saved !== null) {
    soundEnabled = JSON.parse(saved);
  }
} catch (e) {
  soundEnabled = true;
}

export function isSoundEnabled() {
  return soundEnabled;
}

export function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    localStorage.setItem('gairo_sound_enabled', JSON.stringify(enabled));
  } catch (e) {
    // Ignore storage errors
  }
}

function getAudioContext() {
  if (!audioCtx && typeof window !== 'undefined') {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playTone(frequency, duration = 0.12, type = 'sine', gainVal = 0.08, startTimeOffset = 0) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime + startTimeOffset);

    gain.gain.setValueAtTime(0.001, ctx.currentTime + startTimeOffset);
    gain.gain.exponentialRampToValueAtTime(gainVal, ctx.currentTime + startTimeOffset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTimeOffset + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime + startTimeOffset);
    osc.stop(ctx.currentTime + startTimeOffset + duration + 0.05);
  } catch (e) {
    // Audio context may be restricted before user interaction
  }
}

export function playClickSound() {
  playTone(800, 0.04, 'sine', 0.03);
}

export function playSuccessSound() {
  playTone(523.25, 0.12, 'sine', 0.06, 0);       // C5
  playTone(659.25, 0.18, 'sine', 0.07, 0.08);    // E5
  playTone(783.99, 0.25, 'sine', 0.08, 0.16);    // G5
}

export function playVictorySound() {
  playTone(523.25, 0.15, 'triangle', 0.08, 0);     // C5
  playTone(659.25, 0.15, 'triangle', 0.08, 0.12);  // E5
  playTone(783.99, 0.15, 'triangle', 0.09, 0.24);  // G5
  playTone(1046.50, 0.35, 'triangle', 0.10, 0.36); // C6
}

export function playAlertSound() {
  playTone(440, 0.1, 'sawtooth', 0.04, 0);
  playTone(330, 0.15, 'sawtooth', 0.04, 0.1);
}

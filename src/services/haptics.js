// src/services/haptics.js
// Respuesta háptica en navegadores y dispositivos móviles compatibles

let hapticsEnabled = true;

try {
  const saved = localStorage.getItem('gairo_haptics_enabled');
  if (saved !== null) {
    hapticsEnabled = JSON.parse(saved);
  }
} catch (e) {
  hapticsEnabled = true;
}

export function isHapticsEnabled() {
  return hapticsEnabled;
}

export function setHapticsEnabled(enabled) {
  hapticsEnabled = enabled;
  try {
    localStorage.setItem('gairo_haptics_enabled', JSON.stringify(enabled));
  } catch (e) {
    // Ignore error
  }
}

export function triggerHaptic(pattern = [15]) {
  if (!hapticsEnabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore vibration error
    }
  }
}

export const hapticFeedback = {
  light: () => triggerHaptic([10]),
  medium: () => triggerHaptic([20]),
  heavy: () => triggerHaptic([35]),
  success: () => triggerHaptic([15, 40, 25]),
  warning: () => triggerHaptic([25, 50, 25]),
  error: () => triggerHaptic([40, 60, 40, 60, 40])
};

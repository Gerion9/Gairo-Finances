import { createAccountBackup, normalizeBackup } from './backup.js';

// Read-only recovery bridge; never overwrite or delete the old browser data.
export const LEGACY_STORAGE_KEY = 'gairo_finances_data_v2';
export function readLegacyBackup(storage = globalThis.localStorage) {
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { throw new Error('La copia local está dañada. Descarga el original para recuperarla; no se reemplazó ningún dato.'); }
  const data = normalizeBackup(parsed, 'gairo');
  const read = (key, fallback) => {
    const value = storage.getItem(key);
    if (!value) return fallback;
    try { return JSON.parse(value); } catch { throw new Error('No se pudo leer el progreso local. Conserva una copia del original.'); }
  };
  data.education = { weeks: read('gairo_52_weeks', []), impulses: read('gairo_impulse_cooling', []) };
  const manual = storage.getItem('gairo_fx_manual');
  data.preferences = { manualRate: manual ? Number(manual) : null, manualRateUpdatedAt: null };
  return createAccountBackup(data, 'gairo');
}
export function downloadJSON(value, filename) {
  const url = URL.createObjectURL(new Blob([typeof value === 'string' ? value : JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadLegacyBackup(storage = globalThis.localStorage) {
  const backup = readLegacyBackup(storage);
  if (!backup) throw new Error('No hay registros de la instalación anterior en este navegador.');
  downloadJSON(backup, 'Sifran_Gairo_migracion.json');
}
export function downloadRawLegacy(storage = globalThis.localStorage) {
  const raw = storage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) throw new Error('No hay una copia local.');
  downloadJSON(raw, 'Sifran_Gairo_original.json');
}

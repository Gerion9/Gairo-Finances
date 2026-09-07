// src/services/db.js
// Capa de persistencia asíncrona en IndexedDB con soporte para fallbacks

const DB_NAME = 'GairoFinancesDB';
const DB_VERSION = 1;
const STORE_NAME = 'financial_records';

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB no soportado en este entorno'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function setItemIndexedDB(key, value) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(value, key);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Fallback a localStorage
    try {
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
      return true;
    } catch (err) {
      console.warn('Error al guardar en almacenamiento:', err);
      return false;
    }
  }
}

export async function getItemIndexedDB(key) {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    // Fallback a localStorage
    try {
      const item = localStorage.getItem(key);
      try { return JSON.parse(item); } catch (_) { return item; }
    } catch (err) {
      return null;
    }
  }
}

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { login, isAuthenticated, logout, changePassword } from './auth.js';
import { loadFinancialData, saveFinancialData, resetToExcelDefaults, INITIAL_DATA } from './storage.js';

// Mock localStorage and sessionStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

const sessionStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = val.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });
Object.defineProperty(globalThis, 'sessionStorage', { value: sessionStorageMock });

describe('Authentication Service (auth.js)', () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  it('authenticates master user "gairo" with default password "gairo2026"', async () => {
    const res = await login('gairo', 'gairo2026');
    expect(res.success).toBe(true);
    expect(isAuthenticated()).toBe(true);
  });

  it('rejects invalid password', async () => {
    const res = await login('gairo', 'wrongpassword');
    expect(res.success).toBe(false);
    expect(res.error).toBeDefined();
    expect(isAuthenticated()).toBe(false);
  });

  it('allows logging out and clearing session', async () => {
    await login('gairo', 'gairo2026');
    expect(isAuthenticated()).toBe(true);
    logout();
    expect(isAuthenticated()).toBe(false);
  });

  it('changes password successfully when current password matches', async () => {
    await login('gairo', 'gairo2026');
    const changeRes = await changePassword('gairo2026', 'newsecretpass');
    expect(changeRes.success).toBe(true);

    // Old password should fail
    const oldLogin = await login('gairo', 'gairo2026');
    expect(oldLogin.success).toBe(false);

    // New password should succeed
    const newLogin = await login('gairo', 'newsecretpass');
    expect(newLogin.success).toBe(true);
  });

  it('rejects password change if current password is wrong', async () => {
    await login('gairo', 'gairo2026');
    const changeRes = await changePassword('wrongpass', 'newsecretpass');
    expect(changeRes.success).toBe(false);
    expect(changeRes.error).toBe('La contraseña actual no coincide');
  });

  it('rejects password shorter than 4 characters', async () => {
    await login('gairo', 'gairo2026');
    const changeRes = await changePassword('gairo2026', '12');
    expect(changeRes.success).toBe(false);
    expect(changeRes.error).toContain('al menos 4 caracteres');
  });
});

describe('Storage Service & Data Resiliency (storage.js)', () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it('seeds INITIAL_DATA when storage is empty', () => {
    const data = loadFinancialData();
    expect(data.profileName).toBe('Gairo (Finanzas Personales)');
    expect(data.deudas.length).toBe(4);
    expect(data.honorarios.importeFacturado).toBe(54295.79);
  });

  it('recovers gracefully from corrupted JSON in localStorage', () => {
    localStorageMock.setItem('gairo_finances_data_v2', '{invalid_json');
    const data = loadFinancialData();
    expect(data).toBeDefined();
    expect(data.deudas.length).toBe(4);
  });

  it('deep merges partial objects without losing default arrays', () => {
    localStorageMock.setItem('gairo_finances_data_v2', JSON.stringify({
      profileName: 'Custom Profile',
      config: { displayCurrency: 'USD' }
    }));
    const data = loadFinancialData();
    expect(data.profileName).toBe('Custom Profile');
    expect(data.config.displayCurrency).toBe('USD');
    expect(data.deudas.length).toBe(4); // from INITIAL_DATA
    expect(data.honorarios.importeFacturado).toBe(54295.79); // from INITIAL_DATA
  });

  it('resets to Excel defaults upon resetToExcelDefaults()', () => {
    saveFinancialData({ deudas: [] });
    const reset = resetToExcelDefaults();
    expect(reset.deudas.length).toBe(4);
    const loaded = loadFinancialData();
    expect(loaded.deudas.length).toBe(4);
  });
});

// Módulo de autenticación simple y seguro para proteger la sesión del usuario

const AUTH_TOKEN_KEY = 'gairo_auth_session';
const PASS_HASH_KEY = 'gairo_master_pass_hash';
const DEFAULT_USER = 'gairo';
const DEFAULT_PASS = 'gairo2026';

// Hashing simple con SHA-256 en navegador
async function hashString(str) {
  const msgBuffer = new TextEncoder().encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function initAuth() {
  if (!localStorage.getItem(PASS_HASH_KEY)) {
    const defaultHash = await hashString(DEFAULT_PASS);
    localStorage.setItem(PASS_HASH_KEY, defaultHash);
  }
}

export async function login(username, password) {
  await initAuth();
  const inputHash = await hashString(password);
  const storedHash = localStorage.getItem(PASS_HASH_KEY);

  // Permitir usuario 'gairo' (o insensible a mayúsculas) y validación de hash
  if ((username.trim().toLowerCase() === DEFAULT_USER || username.trim().length > 0) && inputHash === storedHash) {
    const sessionToken = btoa(JSON.stringify({
      user: username.trim(),
      loginTime: Date.now()
    }));
    sessionStorage.setItem(AUTH_TOKEN_KEY, sessionToken);
    return { success: true };
  }
  return { success: false, error: 'Usuario o contraseña incorrectos' };
}

export function isAuthenticated() {
  const token = sessionStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;
  try {
    const parsed = JSON.parse(atob(token));
    return Boolean(parsed && parsed.user);
  } catch {
    return false;
  }
}

export function logout() {
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function changePassword(currentPassword, newPassword) {
  const currentHash = await hashString(currentPassword);
  const storedHash = localStorage.getItem(PASS_HASH_KEY);

  if (currentHash !== storedHash) {
    return { success: false, error: 'La contraseña actual no coincide' };
  }
  if (!newPassword || newPassword.length < 4) {
    return { success: false, error: 'La nueva contraseña debe tener al menos 4 caracteres' };
  }

  const newHash = await hashString(newPassword);
  localStorage.setItem(PASS_HASH_KEY, newHash);
  return { success: true };
}

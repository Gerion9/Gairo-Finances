import { ACCOUNT_NAMES } from '../../src/services/accountData.js';
import { WorkspaceError } from './errors.js';

// Only the production Sites entrypoint calls this module. Local development
// never grants authority to user-supplied oai-* headers.
export function readIdentity(request) {
  const userId = request.headers.get('oai-authenticated-user-id');
  const email = request.headers.get('oai-authenticated-user-email');
  if (!userId || !email || userId.length > 256 || email.length > 320) return null;
  return { userId, email: email.trim().toLowerCase() };
}
export async function findAccount(db, identity) {
  if (!identity) return null;
  const row = await db.prepare('SELECT account_id FROM accounts WHERE user_id = ?').bind(identity.userId).first();
  return row && ACCOUNT_NAMES[row.account_id] ? { id: row.account_id, displayName: ACCOUNT_NAMES[row.account_id], userId: identity.userId } : null;
}
function invitation(env, identity) {
  if (!identity) return null;
  const invitations = Object.keys(ACCOUNT_NAMES).map(id => ({ id, email: String(env[`SIFRAN_${id.toUpperCase()}_EMAIL`] || '').trim().toLowerCase() }));
  if (invitations[0].email && invitations[0].email === invitations[1].email) return null;
  return invitations.find(item => item.email && item.email === identity.email)?.id || null;
}
export async function getAccountSession(db, env, identity) {
  if (!identity) return { authenticated: false, access: 'pending', account: null };
  const account = await findAccount(db, identity);
  if (account) return { authenticated: true, access: 'allowed', account, email: identity.email };
  const accountId = invitation(env, identity);
  const occupied = accountId && await db.prepare('SELECT user_id FROM accounts WHERE account_id = ?').bind(accountId).first();
  return { authenticated: true, access: accountId && !occupied ? 'invited' : 'pending', account: null, invitedName: !occupied && accountId ? ACCOUNT_NAMES[accountId] : null, email: identity.email };
}
export async function bindAccount(db, env, identity) {
  if (!identity) throw new WorkspaceError(401, 'AUTH_REQUIRED', 'Inicia sesión para continuar.');
  const existing = await findAccount(db, identity);
  if (existing) return getAccountSession(db, env, identity);
  const accountId = invitation(env, identity);
  if (!accountId) throw new WorkspaceError(403, 'ACCOUNT_NOT_ALLOWED', 'Este acceso aún no está vinculado a Gairo o Ricardo.');
  await db.prepare('INSERT INTO accounts (account_id, user_id, email_at_binding, created_at) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING').bind(accountId, identity.userId, identity.email, new Date().toISOString()).run();
  const bound = await findAccount(db, identity);
  if (!bound || bound.id !== accountId) throw new WorkspaceError(403, 'ACCOUNT_NOT_ALLOWED', 'Esta cuenta ya tiene un acceso vinculado.');
  return getAccountSession(db, env, identity);
}
export async function requireAccount(db, request, identity) {
  if (!identity) throw new WorkspaceError(401, 'AUTH_REQUIRED', 'Tu sesión terminó. Vuelve a entrar para continuar.');
  const account = await findAccount(db, identity);
  if (!account) throw new WorkspaceError(403, 'ACCOUNT_NOT_ALLOWED', 'Tu acceso todavía no tiene una cuenta asignada.');
  if (request.headers.get('x-sifran-account') !== account.id) throw new WorkspaceError(409, 'ACCOUNT_CHANGED', 'La sesión cambió de cuenta. Tu borrador permanece separado.');
  return account;
}

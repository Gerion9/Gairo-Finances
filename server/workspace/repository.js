import { emptyFinancialData } from '../../src/services/accountData.js';
import { normalizeBackup } from '../../src/services/backup.js';
import { WorkspaceError } from './errors.js';

export const MAX_WORKSPACE_BYTES = 1_500_000;
const encoder = new TextEncoder();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function hashValue(value) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(hash), b => b.toString(16).padStart(2, '0')).join('');
}
export async function getWorkspace(db, accountId) {
  const row = await db.prepare('SELECT revision, data_json, receipts_json, updated_at FROM workspaces WHERE account_id = ?').bind(accountId).first();
  return { accountId, schemaVersion: 1, revision: row?.revision || 0, updatedAt: row?.updated_at || null,
    financialData: row ? JSON.parse(row.data_json) : emptyFinancialData(accountId), receipts: row ? JSON.parse(row.receipts_json) : [] };
}
export async function putWorkspace(db, accountId, input, { migration = false, now = Date.now } = {}) {
  if (input.schemaVersion !== 1 || !Number.isSafeInteger(input.baseRevision) || input.baseRevision < 0 || !UUID.test(input.mutationId || '')) throw new WorkspaceError(422, 'INVALID_WORKSPACE', 'No se pudo verificar la versión de tus cambios.');
  if (migration && (accountId !== 'gairo' || input.baseRevision !== 0)) throw new WorkspaceError(409, 'MIGRATION_NOT_ALLOWED', 'La migración sólo se admite en la cuenta inicial de Gairo.');
  let data;
  try { data = normalizeBackup(input.financialData, accountId); }
  catch (error) { throw new WorkspaceError(422, 'INVALID_WORKSPACE', error.message); }
  const serialized = JSON.stringify(data);
  if (encoder.encode(serialized).length > MAX_WORKSPACE_BYTES) throw new WorkspaceError(413, 'WORKSPACE_TOO_LARGE', 'Los registros superan 1.5 MB. Conserva tu respaldo; no se guardó una versión parcial.');
  const hash = await hashValue(JSON.stringify([input.baseRevision, migration, serialized]));
  const previous = await getWorkspace(db, accountId);
  const checkReplay = workspace => {
    const receipt = workspace.receipts.find(item => item.id === input.mutationId);
    if (!receipt) return null;
    if (receipt.hash !== hash) throw new WorkspaceError(409, 'IDEMPOTENCY_KEY_REUSED', 'La operación ya se utilizó con otros cambios.');
    return { accountId, acceptedRevision: receipt.revision, currentRevision: workspace.revision, mutationId: input.mutationId, updatedAt: workspace.updatedAt, replayed: true };
  };
  const replay = checkReplay(previous); if (replay) return replay;
  if (previous.revision !== input.baseRevision) throw new WorkspaceError(409, 'REVISION_CONFLICT', 'Hay cambios guardados desde otro dispositivo. Tu borrador sigue en esta pestaña.');
  const revision = previous.revision + 1;
  const updatedAt = new Date(now()).toISOString();
  const receipts = JSON.stringify([...previous.receipts.slice(-31), { id: input.mutationId, hash, revision }]);
  let written;
  if (input.baseRevision === 0) {
    written = await db.prepare('INSERT INTO workspaces (account_id, schema_version, revision, data_json, receipts_json, migration_hash, updated_at) VALUES (?, 1, 1, ?, ?, ?, ?) ON CONFLICT(account_id) DO NOTHING RETURNING revision').bind(accountId, serialized, receipts, migration ? hash : null, updatedAt).first();
  } else {
    written = await db.prepare('UPDATE workspaces SET data_json = ?, revision = ?, receipts_json = ?, updated_at = ? WHERE account_id = ? AND revision = ? RETURNING revision').bind(serialized, revision, receipts, updatedAt, accountId, input.baseRevision).first();
  }
  if (!written) {
    const after = await getWorkspace(db, accountId);
    const concurrentReplay = checkReplay(after); if (concurrentReplay) return concurrentReplay;
    throw new WorkspaceError(409, 'REVISION_CONFLICT', 'Otro dispositivo guardó antes. No se reemplazó ningún dato.');
  }
  return { accountId, acceptedRevision: revision, currentRevision: revision, mutationId: input.mutationId, updatedAt, replayed: false };
}

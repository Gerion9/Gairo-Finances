// Navigation stays available while editing is paused. Actions that need access
// to financial content or an editor explain why they cannot run.
const editingActions = new Set(['newTransaction', 'importStatement', 'newDebt', 'openSettings']);
const privateActions = new Set([...editingActions, 'openAssistant', 'exportExcel', 'exportBackup']);

export function actionUnavailableReason(action, { readOnly = false, privacyMode = false } = {}) {
  if (privacyMode && privateActions.has(action)) return 'Muestra tu información para usar esta acción.';
  if (readOnly && editingActions.has(action)) return 'La edición está pausada. Revisa el aviso de tu espacio.';
  return '';
}

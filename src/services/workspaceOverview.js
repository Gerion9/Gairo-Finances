import { hasFinancialRecords } from './accountData.js';
import { normalizePaymentPlan } from './paymentPlan.js';
import { summarizeReceivables } from './receivables.js';

// Presentation routing only: expected money never becomes a balance or financial-health input.
export function hasWorkspaceActivity(data = {}) {
  if (!data || typeof data !== 'object') return false;
  if (hasFinancialRecords(data) || (Array.isArray(data.receivables?.items) && data.receivables.items.length > 0)) return true;
  return hasWorkspacePlan(data);
}

export function hasWorkspacePlan(data = {}) {
  try { return Boolean(normalizePaymentPlan(data?.planFinanciero)); }
  catch { return false; }
}

export function workspaceReceivables(data = {}, { today } = {}) {
  try {
    const summary = summarizeReceivables(data, { today });
    const pending = summary.items.filter(item => item.status === 'pending' && item.pendingMinor > 0)
      .sort((a, b) => (a.expectedDate || '9999-12-31').localeCompare(b.expectedDate || '9999-12-31') || a.id.localeCompare(b.id));
    return { status: 'ready', hasItems: summary.items.length > 0, pendingCount: pending.length, representative: pending[0] || null, needsReview: summary.inconsistencies.length > 0 };
  } catch {
    // A broken relationship is not an empty or settled ledger. Keep the recovery route visible.
    return { status: 'error', hasItems: true, pendingCount: null, representative: null, needsReview: true };
  }
}

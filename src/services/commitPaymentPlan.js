import { applyPaymentPlan, normalizePaymentPlan } from './paymentPlan.js';

const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Apply only the changes made in the plan. Independent edits are not an import.
function applyProjectionChanges(previous, current, next) {
  if (equal(previous, next)) return current;
  if (Array.isArray(previous) && Array.isArray(next)) {
    const before = new Map(previous.map(row => [row.id, row]));
    const after = new Map(next.map(row => [row.id, row]));
    const rows = Array.isArray(current) ? current : [];
    const currentIds = new Set(rows.map(row => row.id));
    return [
      ...rows.filter(row => !before.has(row.id) || after.has(row.id)).map(row =>
        before.has(row.id) && after.has(row.id) ? applyProjectionChanges(before.get(row.id), row, after.get(row.id)) : row),
      ...next.filter(row => !before.has(row.id) && !currentIds.has(row.id)),
    ];
  }
  if (previous && next && typeof previous === 'object' && typeof next === 'object' && !Array.isArray(previous) && !Array.isArray(next)) {
    const result = { ...(current || {}) };
    for (const key of new Set([...Object.keys(previous), ...Object.keys(next)])) {
      if (equal(previous[key], next[key])) continue;
      if (!(key in next)) delete result[key];
      else result[key] = applyProjectionChanges(previous[key], current?.[key], next[key]);
    }
    return result;
  }
  return next;
}

/** Explicit imports replace the inventory; normal saves update only changed fields. */
export function commitPaymentPlan(data, input, { replaceInventory = false } = {}) {
  const plan = normalizePaymentPlan(input);
  const projected = applyPaymentPlan(data, plan);
  if (!data.planFinanciero || replaceInventory) return projected;
  // Unknown plan expenses inherit user records during import, but do not own them.
  const seed = { ...data, gastosNecesarios: [], gastosOpcionales: [] };
  const previous = applyPaymentPlan(seed, data.planFinanciero);
  const nextProjection = applyPaymentPlan(seed, plan);
  const result = { ...data, planFinanciero: plan };
  for (const key of ['deudas', 'deudasPendientes', 'activos', 'honorarios', 'gastosNecesarios', 'gastosOpcionales']) {
    result[key] = applyProjectionChanges(previous[key], data[key], nextProjection[key]);
  }
  return result;
}

import { applyPaymentPlan } from './paymentPlan.js';

const canonical = value => {
  if (Array.isArray(value)) return value.map(canonical).sort((a, b) => String(a?.id ?? '').localeCompare(String(b?.id ?? '')));
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).filter(key => key !== 'planManaged').sort().map(key => [key, canonical(value[key])]));
  return value;
};
const same = (a, b) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));

/** Linked views must never conceal independently edited records. */
export function managedPlanSections(data) {
  if (!data.planFinanciero) return { budget: false, debts: false, balance: false };
  const projected = applyPaymentPlan({ ...data, gastosNecesarios: [], gastosOpcionales: [] }, data.planFinanciero);
  const debts = same(data.deudas, projected.deudas) && same(data.deudasPendientes, projected.deudasPendientes);
  return {
    debts,
    budget: ['honorarios', 'gastosNecesarios', 'gastosOpcionales'].every(key => same(data[key], projected[key])),
    balance: debts && same(data.activos, projected.activos),
  };
}

/** Presentation-only union. Never used for projections or to persist inferred terms. */
export function balanceDisplayData(data) {
  const debts = new Map();
  let incomplete = false;
  for (const item of data.deudas || []) {
    const valid = item.saldo != null && Number.isFinite(Number(item.saldo)) && Number(item.saldo) >= 0;
    if (!valid) incomplete = true;
    debts.set(item.id, { ...item, saldo: valid ? Number(item.saldo) : 0, balanceUnknown: !valid });
  }
  for (const item of data.deudasPendientes || []) {
    if (debts.has(item.id)) continue;
    const valid = item.saldoEstimado != null && Number.isFinite(Number(item.saldoEstimado)) && Number(item.saldoEstimado) >= 0;
    if (!valid) incomplete = true;
    debts.set(item.id, { id: item.id, nombre: item.nombre, moneda: item.moneda, saldo: valid ? Number(item.saldoEstimado) : 0, balanceUnknown: !valid });
  }
  for (const item of data.planFinanciero?.accounts || []) {
    if (!debts.has(item.id)) debts.set(item.id, { id: item.id, nombre: item.name, moneda: item.currency, saldo: item.balance });
  }
  return { ...data, deudas: [...debts.values()], balanceCoverageIncomplete: incomplete };
}

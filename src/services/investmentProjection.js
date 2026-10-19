const finiteInput = value => ['number', 'string'].includes(typeof value) && String(value).trim() !== '' && Number.isFinite(Number(value));

export function projectMonthlySavings({ monthlyContribution, annualRate, years }) {
  const errors = {};
  if (!finiteInput(monthlyContribution) || Number(monthlyContribution) < 0) errors.monthlyContribution = 'Introduce una aportación de cero o más.';
  if (!finiteInput(annualRate) || Number(annualRate) < -100 || Number(annualRate) > 1000) errors.annualRate = 'Introduce una tasa entre −100 % y 1,000 %.';
  if (!finiteInput(years) || !Number.isInteger(Number(years)) || Number(years) < 1 || Number(years) > 40) errors.years = 'Introduce un plazo de 1 a 40 años completos.';
  if (Object.keys(errors).length) return { valid: false, errors };
  const months = Number(years) * 12;
  const rate = Number(annualRate) / 1200;
  const contributed = Number(monthlyContribution) * months;
  // Contributions arrive at month end; log1p/expm1 also handle near-zero rates.
  const total = rate === 0 ? contributed : Number(monthlyContribution) * Math.expm1(months * Math.log1p(rate)) / rate;
  const returns = total - contributed;
  if (![contributed, total, returns].every(Number.isFinite)) return { valid: false, errors: { monthlyContribution: 'La aportación es demasiado grande para esta proyección.' } };
  return { valid: true, errors: {}, contributed, total, returns, months };
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function summarizeCashReserve({ financialData, monthlyExpenses, exchangeRate }) {
  const cash = (financialData?.activos || []).filter(asset => String(asset.tipo).toLocaleLowerCase('es-MX') === 'efectivo');
  let amount = 0;
  let excluded = 0;
  let dated = 0;
  let hasUsd = false;
  const dates = [];
  for (const asset of cash) {
    const currency = asset.moneda;
    if (!finiteInput(asset.monto) || !['MXN', 'USD'].includes(currency) || currency === 'USD' && (!finiteInput(exchangeRate) || Number(exchangeRate) <= 0)) { excluded++; continue; }
    const value = Number(asset.monto) * (currency === 'USD' ? Number(exchangeRate) : 1);
    if (!Number.isFinite(value) || !Number.isFinite(amount + value)) { excluded++; continue; }
    amount += value;
    hasUsd ||= currency === 'USD';
    const planAsset = asset.planManaged ? financialData?.planFinanciero?.assets?.find(item => item.id === asset.id && item.currency === currency && item.balance === Number(asset.monto)) : null;
    const balanceDate = validDate(asset.balanceDate) ? asset.balanceDate : planAsset?.balanceDate;
    if (validDate(balanceDate)) { dates.push(balanceDate); dated++; }
  }
  const expenses = financialData?.gastosNecesarios;
  const budget = financialData?.planFinanciero?.budget;
  // applyPaymentPlan preserves manual rows when living expenses are unknown.
  // Its projected IDs also retain provenance if optional metadata was removed.
  const projectedExpenseIds = new Set(['plan-living', 'plan-tuition', ...(budget?.expenses || []).map(item => 'plan-expense-' + item.id)]);
  const usesPlanExpenses = Array.isArray(expenses) && expenses.some(item => item.planManaged || projectedExpenseIds.has(item.id));
  const missingPlanExpenses = Boolean(usesPlanExpenses && budget && (budget.expenses?.length ? budget.expenses.some(item => !finiteInput(item.amount)) : budget.livingExpenses === null));
  const expensesKnown = finiteInput(monthlyExpenses) && Number(monthlyExpenses) > 0 && Array.isArray(expenses) && expenses.length > 0 && expenses.every(item => finiteInput(item.monto) && Number(item.monto) >= 0) && !missingPlanExpenses;
  const complete = excluded === 0;
  const rawCoverage = expensesKnown && complete ? amount / Number(monthlyExpenses) : null;
  const coverage = Number.isFinite(rawCoverage) ? rawCoverage : null;
  const progress = coverage === null ? null : Math.max(0, Math.min(100, coverage / 3 * 100));
  return { amount, excluded, hasUsd, complete, expensesKnown, coverage, progress, dates: [...new Set(dates)].sort(), allDated: cash.length > 0 && dated === cash.length, count: cash.length };
}

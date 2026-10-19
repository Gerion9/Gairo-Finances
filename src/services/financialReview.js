import { localDateKey, parseLocalDate, pendingPayments } from './dashboardAnalytics.js';
import { livingBudgetSummary } from './paymentPlan.js';
import { dayDistance, knownRequirement } from './paymentTimeline.js';
import { isValidTransactionDate, moneyToCents, summarizeTransactions, validateTransaction } from './transactionAnalytics.js';
import { formatMoney } from './exchangeRate.js';

const array = value => Array.isArray(value) ? value : [];
const number = value => value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const amount = (value, currency = 'MXN') => number(value) === null ? 'Importe por confirmar' : `${formatMoney(value, currency)} ${currency}`;
const dateLabel = value => parseLocalDate(value)?.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }) || 'Fecha por confirmar';
const validDay = value => Number.isInteger(number(value)) && number(value) >= 1 && number(value) <= 31;
const emptyCategory = row => typeof row.categoria !== 'string' || !row.categoria.trim();
const planTarget = panel => ({ tab: 'plan', options: { panel } });

function differsFromPlan(row, account) {
  return (row.moneda || 'MXN') !== account.currency
    || number(row.saldo ?? row.saldoEstimado) !== number(account.balance)
    || number(row.pagoMinimo) !== number(account.minimum)
    || number(row.diaPagoLimite) !== (account.dueDate ? Number(account.dueDate.slice(-2)) : null)
    || number(row.tasaAnual) !== number(account.ordinaryApr);
}

/** A read-only checklist of observable exceptions, never payment confirmation or advice. */
export function buildFinancialReview(data = {}, { today = localDateKey(new Date()), daysAhead = 14, exchangeRate, displayCurrency = 'MXN' } = {}) {
  const now = parseLocalDate(today);
  if (!now) throw new Error('La revisión necesita una fecha válida.');
  const horizon = Number.isInteger(daysAhead) && daysAhead >= 0 ? daysAhead : 14;
  const period = today.slice(0, 7);
  const plan = data.planFinanciero;
  const groups = [
    { id: 'dates', label: 'Fechas', title: 'Revisa fechas pasadas y próximas', description: 'Fechas registradas que ya pasaron o llegan en los próximos 14 días. Una fecha no confirma un pago.', items: [] },
    { id: 'transactions', label: 'Movimientos', title: 'Dale contexto a tus movimientos', description: 'Corrige lo que falta y abre el detalle de los gastos que quieras revisar.', items: [] },
    { id: 'data', label: 'Datos', title: 'Completa lo que cambia tu panorama', description: 'Datos concretos que faltan o difieren. Revisarlos no modifica tus registros.', items: [] },
  ];
  groups[0].description = `Fechas registradas que ya pasaron o llegan en los próximos ${horizon} días. Una fecha no confirma un pago.`;
  const add = (group, item) => groups[group].items.push({ tone: 'neutral', evidence: [], ...item });
  const debts = [...array(data.deudas), ...array(data.deudasPendientes)];
  const planIds = new Set(array(plan?.accounts).map(account => account.id));
  const conflicts = new Set();

  for (const account of array(plan?.accounts)) {
    const copies = debts.filter(row => row.id === account.id);
    if (copies.some(row => differsFromPlan(row, account))) {
      conflicts.add(account.id);
      add(2, { id: `conflict:${account.id}`, title: `Dos versiones de ${account.name}`, reason: 'El plan y tus registros tienen condiciones distintas. Revisa cuál necesitas actualizar antes de usar su fecha o importe.', tone: 'attention', evidence: [`Saldo del plan: ${amount(account.balance, account.currency)}.`, ...copies.map(row => `Saldo del registro: ${amount(row.saldo ?? row.saldoEstimado, row.moneda)}.`), 'No se suman como dos deudas ni se elige una versión automáticamente.'], actionLabel: 'Comparar con mis registros', target: { tab: 'debts' } });
      continue;
    }
    if (!(number(account.balance) > 0)) continue;
    const missing = [];
    if (!parseLocalDate(account.dueDate)) missing.push('fecha de vencimiento');
    if (knownRequirement(account) === null) missing.push('mínimo o cuotas requeridas');
    if (missing.length) add(2, { id: `account-data:${account.id}`, title: `Completa ${account.name}`, reason: `Falta confirmar: ${missing.join(' y ')}.`, evidence: ['Un importe desconocido no se trata como cero.'], actionLabel: 'Revisar condiciones', target: planTarget('accounts') });
  }

  const datedPlanRows = [
    ...array(plan?.accounts).filter(account => number(account.balance) > 0 && !conflicts.has(account.id)).map(account => ({ id: `plan:${account.id}`, name: account.name, date: account.dueDate, evidence: [`Mínimo declarado: ${amount(account.minimum, account.currency)}.`, `Corte del saldo: ${dateLabel(account.balanceDate)}.`, 'La asignación del simulador y la domiciliación no acreditan un pago.'] })),
    ...array(plan?.budget?.tuitionPayments).map((row, index) => ({ id: `tuition:${row.date}:${index}`, name: 'Colegiatura registrada', date: row.date, evidence: [`Compromiso declarado: ${amount(row.amount)}.`, 'La fecha proviene del plan; confirma si ya fue cubierto.'] })),
  ];
  for (const row of datedPlanRows) {
    if (!parseLocalDate(row.date) || dayDistance(today, row.date) > horizon) continue;
    add(0, { id: row.id, date: row.date, title: row.name, tone: row.date <= today ? 'attention' : 'neutral', reason: row.date < today ? `La fecha del ${dateLabel(row.date)} ya pasó. Confirma el pago o actualiza el corte.` : `Fecha registrada: ${dateLabel(row.date)}. Revisa los fondos y el compromiso.`, evidence: row.evidence, actionLabel: 'Ver fecha en el plan', target: planTarget('calendar') });
  }

  // The monthly legacy checklist is independent of documented plan dates.
  // Exact true is the only supported confirmation; strings such as "false" are not.
  const paid = Object.fromEntries(Object.entries(data.pagosRealizadosMes?.[period] || {}).filter(([, value]) => value === true));
  const legacy = { ...data, deudas: array(data.deudas).filter(row => !planIds.has(row.id)), gastosNecesarios: array(data.gastosNecesarios).filter(row => !plan || row.id !== 'plan-tuition'), pagosRealizadosMes: { [period]: paid } };
  for (const row of pendingPayments(legacy, now, exchangeRate, displayCurrency)) {
    if (row.daysRemaining > horizon) continue;
    add(0, { id: `calendar:${period}:${row.kind}:${row.id}`, date: row.dateKey, title: row.nombre || 'Compromiso registrado', tone: row.daysRemaining <= 0 ? 'attention' : 'neutral', reason: `${dateLabel(row.dateKey)} · sin marcar como pagado en el calendario de este mes.`, evidence: [`${row.kind}: ${amount(row.originalAmount, row.currency)}.`, 'El calendario es un registro manual; verifica la acreditación por separado.'], actionLabel: 'Revisar en calendario', target: { tab: 'calendar', options: { itemId: row.id } } });
  }
  groups[0].items.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));

  const transactions = array(data.transacciones);
  const valid = [];
  transactions.forEach((row, index) => {
    if (isValidTransactionDate(row.fecha) && row.fecha > today) return;
    const errors = validateTransaction(row);
    if (Object.keys(errors).length) {
      add(1, { id: `invalid:${row.id || index}`, title: row.descripcion || 'Movimiento por completar', reason: 'Este registro tiene datos que necesitan corrección.', evidence: Object.values(errors), actionLabel: 'Corregir movimiento', target: { tab: 'transactions', transactionContext: { transactionId: row.id } } });
    } else valid.push(row);
  });
  const missingMonths = new Map();
  valid.filter(emptyCategory).forEach(row => {
    const month = row.fecha.slice(0, 7);
    missingMonths.set(month, (missingMonths.get(month) || 0) + 1);
  });
  [...missingMonths].sort(([a], [b]) => b.localeCompare(a)).forEach(([month, count]) => add(1, { id: `categories:${month}`, title: `${count} ${count === 1 ? 'movimiento sin categoría' : 'movimientos sin categoría'}`, reason: `Corresponden a ${month}. Ponles una categoría para interpretar mejor tus gastos.`, evidence: ['“Otros” y tus categorías personalizadas sí cuentan como categorías.'], actionLabel: 'Completar categorías', target: { tab: 'transactions', transactionContext: { period: month, uncategorized: true, dateThrough: today } } }));

  // Plan adapters use a single generic category. Do not pretend it matches
  // bank transaction categories or mix it into independent category limits.
  const budgetRows = [...array(data.gastosNecesarios), ...array(data.gastosOpcionales)];
  const comparable = budgetRows.filter(row => !row.planManaged && !String(row.id).startsWith('plan-') && !emptyCategory(row) && moneyToCents(row.monto) !== null && number(row.monto) >= 0 && ['MXN', 'USD'].includes(row.moneda || 'MXN'));
  const summary = summarizeTransactions({ ...data, transacciones: valid.filter(row => row.fecha <= today && !emptyCategory(row)), gastosNecesarios: comparable, gastosOpcionales: [] }, period, exchangeRate, displayCurrency);
  const budgetCategories = new Set(comparable.map(row => row.categoria));
  summary.categories.filter(row => budgetCategories.has(row.category) && row.spent > row.budget).forEach(row => add(1, { id: `budget:${period}:${row.category}`, title: `Revisa ${row.category}`, reason: `Gastos registrados: ${amount(row.spent, summary.currency)}. Presupuesto actual: ${amount(row.budget, summary.currency)}.`, evidence: [`Diferencia: ${amount(Math.abs(row.remaining), summary.currency)}.`, 'Solo movimientos capturados hasta hoy; no acredita cobertura bancaria completa.', 'El límite es el presupuesto actual, no un historial de presupuestos.'], actionLabel: 'Ver estos gastos', target: { tab: 'transactions', transactionContext: { period, category: row.category, type: 'GASTO', dateThrough: today } } }));

  const independentPending = array(data.deudasPendientes).filter(row => !planIds.has(row.id));
  if (independentPending.length) add(2, { id: 'pending-debts', title: `${independentPending.length} ${independentPending.length === 1 ? 'deuda por completar' : 'deudas por completar'}`, reason: 'Todavía hay créditos fuera de los cálculos completos del presupuesto.', evidence: independentPending.map(row => row.nombre || 'Crédito sin nombre'), actionLabel: 'Completar deudas', target: { tab: 'debts' } });
  if (plan) {
    const budget = livingBudgetSummary(plan);
    const fields = [...budget.missing];
    if (plan.budget.monthlyIncome > 0 && !validDay(plan.budget.payday)) fields.push('día de ingreso');
    if (plan.budget.monthlyTax > 0 && !validDay(plan.budget.taxDay)) fields.push('día de pago de impuestos');
    if (fields.length) add(2, { id: 'plan-budget', title: 'Completa los supuestos de tu presupuesto', reason: `Por confirmar: ${fields.join(', ')}.`, evidence: ['El plan usa estos datos para ordenar el dinero por fecha.'], actionLabel: 'Revisar presupuesto del plan', target: planTarget('monthly') });
    const datedBalances = [...array(plan.accounts), ...array(plan.assets)];
    const old = datedBalances.filter(row => parseLocalDate(row.balanceDate) && (dayDistance(row.balanceDate, today) > 45 || row.balanceDate > today));
    if (old.length) add(2, { id: 'dated-balances', title: 'Revisa las fechas de tus saldos', reason: 'Hay saldos con fecha futura o de hace más de 45 días. Comprueba si necesitas actualizar el corte.', evidence: old.map(row => `${row.name}: ${dateLabel(row.balanceDate)}.`), actionLabel: 'Revisar conciliación', target: planTarget('data') });
  }
  const undated = budgetRows.filter(row => !row.planManaged && number(row.monto) > 0 && !validDay(row.diaPago));
  if (undated.length) add(2, { id: 'undated-expenses', title: 'Gastos sin fecha de pago', reason: `${undated.length} conceptos tienen importe, pero no un día de pago válido.`, evidence: [...undated.map(row => row.nombre || 'Gasto sin nombre'), 'La falta de fecha no elimina el gasto del presupuesto mensual.'], actionLabel: 'Revisar fechas del presupuesto', target: { tab: 'budget' } });

  return {
    asOf: today, total: groups.reduce((total, group) => total + group.items.length, 0), groups,
    coverage: [
      'Esta revisión usa únicamente los registros de Sifran. No comprueba tu saldo bancario ni acredita pagos.',
      `El calendario tradicional cubre ${period}; las fechas absolutas del plan pueden cruzar al siguiente mes.`,
      'Los movimientos futuros se excluyen de la revisión de gastos. Solo se comparan categorías con un presupuesto compatible.',
      'Cerrar o recorrer la revisión no confirma ni modifica registros. Los asuntos cambian al corregir sus datos de origen.',
    ],
  };
}

import { addMonths, cents, money, normalizeScenario, tuitionForPeriod, validDate } from './paymentPlan.js';
import { businessDaysBefore, firstRequirement, recommendPayments } from './paymentRecommendation.js';

const round = n => money(cents(n));
const sum = rows => round(rows.reduce((a, b) => a + b, 0));
export const shiftDay = (date, days) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const dayDistance = (from, to) => Math.round((Date.parse(to + 'T12:00:00Z') - Date.parse(from + 'T12:00:00Z')) / 86400000);
const atLeast = (a, b) => a > b ? a : b;
const monthStart = date => date.slice(0, 8) + '01';
const monthDay = (month, day) => month.slice(0, 8) + String(Math.min(day, Number(shiftDay(addMonths(month, 1), -1).slice(-2)))).padStart(2, '0');

export function knownRequirement(account) {
  if (account.requiredPayment !== null) return firstRequirement(account);
  if (account.minimum === null) return null;
  const installments = account.tranches.filter(t => t.type === 'INSTALLMENT' && t.balance > 0);
  if (account.minimumIncludesInstallments !== true && installments.some(t => t.monthlyPayment === null)) return null;
  if (account.minimumIncludesInstallments === null && installments.length) return null;
  return firstRequirement(account);
}

export function discoverDepositTerms(plan, input, from = plan.asOf) {
  const offer = plan.offers.discover, d = normalizeScenario({ cashflow: { discover: input } }).cashflow.discover;
  const fee = round(d.amount * offer.feePercent / 100), debt = round(d.amount + fee);
  const account = plan.accounts.find(a => /discover/i.test(a.name) && a.currency === 'USD');
  const issues = [];
  if (!account) issues.push('Falta la cuenta de crédito Discover.');
  if (!plan.recommendation.transferDepositConfirmed) issues.push('Confirma en los supuestos que la oferta permite depósito a tu cuenta.');
  if (!d.date || d.date < from) issues.push('Indica una fecha de llegada desde el inicio de la simulación.');
  if (!(d.amount > 0)) issues.push('Indica el principal que recibirías de Discover.');
  if ((d.limitIncludesFee ? debt : d.amount) > offer.maximum) issues.push('El principal y la comisión superan el límite elegido de Discover.');
  if (d.currency === 'MXN' && (d.netMXN === null || d.quotePrincipalUSD !== d.amount)) issues.push('Introduce los pesos netos cotizados para este principal; una cotización anterior no se reutiliza.');
  const destination = plan.assets.find(a => a.id === d.assetId);
  if (d.assetId && (!destination || destination.currency !== d.currency)) issues.push('La cuenta receptora debe tener la moneda del depósito.');
  if (d.firstPaymentDate && d.date && d.firstPaymentDate < d.date) issues.push('El primer abono de Discover no puede ser anterior a la llegada.');
  return { ...d, fee, debt, accountId: account?.id, monthlyTarget: Math.ceil(debt * 100 / offer.months) / 100, promoEnd: d.date ? addMonths(d.date, offer.months) : null, receipt: d.currency === 'USD' ? d.amount : d.netMXN, issues, valid: issues.length === 0 };
}

/** Cash commitments by date. Negative balances expose unfinanced plans; they never
 * turn a future receipt into funding available before a documented deadline. */
export function buildPaymentTimeline(plan, { from = plan.asOf, days = 60, fx = plan.settings.fx || 1, scenario = null } = {}) {
  if (!validDate(from) || from < plan.asOf || !Number.isInteger(days) || days < 1 || days > 120 || !(fx > 0)) throw new Error('Revisa la fecha, el horizonte o el tipo de cambio.');
  const to = shiftDay(from, days - 1);
  const options = normalizeScenario(scenario || {}), cf = options.cashflow;
  // Keep seed assignments stable while editing the reserve or incoming money.
  // Redistribution is an explicit user action; it must not erase manual edits.
  const recommendation = recommendPayments(plan, fx, { from });
  const initial = { MXN: sum(plan.assets.filter(a => a.currency === 'MXN').map(a => a.balance - a.reserved)), USD: sum(plan.assets.filter(a => a.currency === 'USD').map(a => a.balance - a.reserved)) };
  const reserve = cf.reserveMXN ?? recommendation.config.emergencyMXN;
  const accounts = new Map(plan.accounts.map(a => [a.id, a]));
  const warnings = new Set();
  const occurrences = new Map();
  const payments = recommendation.events.filter(e => e.accountId && e.accountId !== 'loan-reserve').map(e => {
    const key = e.accountId + '-' + (e.due || 'pending'), index = occurrences.get(key) || 0;
    occurrences.set(key, index + 1);
    return { ...e, id: 'planned-' + key + '-' + index, funding: e.currency, estimated: e.note?.includes('Referencia del siguiente mes') || false };
  });
  // MXN loans and unclassified accounts must remain visible even if the older
  // recommendation does not assign money to them.
  for (const a of plan.accounts.filter(a => a.balance > 0 && !payments.some(e => e.accountId === a.id))) {
    payments.push({ id: 'initial-' + a.id, accountId: a.id, name: a.name, currency: a.currency, funding: a.currency, date: atLeast(from, a.dueDate ? businessDaysBefore(a.dueDate) : from), due: a.dueDate, amount: Math.max(knownRequirement(a) || 0, a.autopayAmount || 0), kind: 'PAYMENT', note: 'Importe conocido; confirmar el próximo estado.' });
  }
  // Following statements are explicitly references, never new documented bills.
  for (const a of plan.accounts.filter(a => a.balance > 0 && a.dueDate)) {
    for (let n = 1; n <= 120; n++) {
      const due = addMonths(a.dueDate, n);
      if (due > to) break;
      if (due < from || payments.some(e => e.accountId === a.id && e.due === due)) continue;
      payments.push({ id: 'planned-' + a.id + '-' + due + '-0', accountId: a.id, name: a.name, currency: a.currency, funding: a.currency, date: atLeast(from, businessDaysBefore(due)), due, amount: Math.max(knownRequirement(a) || 0, a.autopayAmount || 0), kind: 'PAYMENT', estimated: true, note: 'Referencia con el mínimo y cuotas actuales. El siguiente corte puede exigir más.' });
    }
  }
  const overrides = new Map(cf.payments.map(p => [p.id, p]));
  const scheduled = payments.map(p => {
    const edit = overrides.get(p.id);
    return edit ? { ...p, date: edit.date, amount: edit.amount, funding: edit.funding, assetId: edit.assetId, edited: true } : p;
  });
  for (const edit of cf.payments.filter(p => !payments.some(seed => seed.id === p.id))) {
    const account = accounts.get(edit.accountId);
    if (account) {
      const due = edit.dueDate || account.dueDate;
      // Manual assignments supersede an altered automatic suggestion for the
      // same cycle. Do not append both and charge the same intended payment twice.
      for (let i = scheduled.length - 1; i >= 0; i--) if (scheduled[i].accountId === account.id && scheduled[i].due === due && !scheduled[i].edited) scheduled.splice(i, 1);
      scheduled.push({ ...edit, name: account.name, currency: account.currency, due, estimated: Boolean(due && due !== account.dueDate), kind: 'PAYMENT', edited: true, note: 'Asignación conservada después de cambiar los supuestos.' });
    }
    else warnings.add('Una asignación pertenece a un crédito que ya no está en el plan.');
  }
  for (const p of cf.extraPayments) {
    const account = accounts.get(p.accountId);
    if (!account) { warnings.add('Un abono apunta a un crédito que ya no está en el plan.'); continue; }
    scheduled.push({ ...p, name: account.name, currency: account.currency, due: p.dueDate || account.dueDate, estimated: Boolean(p.dueDate && p.dueDate !== account.dueDate), kind: 'PAYMENT', extra: true, edited: true });
  }
  for (const p of scheduled) if (p.currency === 'MXN' && p.funding === 'USD') throw new Error('Los pagos en pesos requieren fondos MXN.');
  const events = [...scheduled];
  // A manually entered reserve for loans is an envelope, not a second payment.
  // Fund only the portion not already assigned to those loans in that month.
  const firstLoanDate = plan.accounts.filter(a => a.kind === 'LOAN' && a.currency === 'USD').map(a => a.dueDate).filter(Boolean).sort()[0];
  const reserveStart = monthStart(atLeast(from, firstLoanDate || from));
  for (let month = reserveStart, n = 0; month <= to && n < 5; month = addMonths(month, 1), n++) {
    const assigned = sum(scheduled.filter(p => accounts.get(p.accountId)?.kind === 'LOAN' && p.currency === 'USD' && (p.due || p.date).slice(0, 7) === month.slice(0, 7)).map(p => p.amount));
    const residual = round(Math.max(0, (recommendation.config.loanMonthlyUSD || 0) - assigned));
    if (residual > 0) events.push({ id: 'loan-envelope-' + month, name: 'Préstamos existentes · reserva aún sin asignar', date: atLeast(from, month), currency: 'USD', amount: residual, kind: 'RESERVE' });
  }
  const expenses = recommendation.expenses;
  if (expenses.missing.length) warnings.add('Gastos pendientes: ' + expenses.missing.join(', ') + '. La liquidez es parcial.');
  if (!plan.budget.payday) warnings.add('Falta el día de ingreso: no se agrega nómina a la gráfica.');
  const firstPayday = plan.budget.payday ? monthDay(monthStart(from), plan.budget.payday) : null;
  if (firstPayday && firstPayday >= from && cf.currentExpensesMXN !== null) events.push({ id: 'before-income-expenses', name: 'Gastos pendientes antes del ingreso', date: from, currency: 'MXN', amount: cf.currentExpensesMXN, kind: 'RESERVE' });
  for (let month = monthStart(from), n = 0; month <= to && n < 5; month = addMonths(month, 1), n++) {
    const payday = plan.budget.payday ? monthDay(month, plan.budget.payday) : null;
    const reserveDate = payday && payday >= from ? payday : from;
    if (payday && payday >= from && payday <= to) {
      const raised = options.raise.enabled && options.raise.date && options.raise.date <= payday ? options.raise.amount : 0;
      events.push({ id: 'income-' + month, name: raised ? 'Ingreso + aumento' : 'Ingreso mensual', date: payday, currency: 'MXN', amount: plan.budget.monthlyIncome + raised, kind: 'INCOME' });
    }
    const partialMonth = (!payday || payday < from) && month === monthStart(from);
    const living = partialMonth && cf.currentExpensesMXN !== null ? cf.currentExpensesMXN : sum([expenses.total, plan.budget.monthlyTax]);
    if (reserveDate <= to) events.push({ id: 'living-' + month, name: partialMonth ? 'Gastos pendientes antes del ingreso' : 'Vida e impuestos · apartado', date: reserveDate, currency: 'MXN', amount: living, kind: 'RESERVE' });
    if (partialMonth && cf.currentExpensesMXN === null && living > 0) warnings.add('Se apartó el presupuesto completo del mes inicial; ajusta «Gastos pendientes» si ya cubriste parte.');
    const tuition = tuitionForPeriod(plan, month, addMonths(month, 1));
    if (tuition.isProvision && reserveDate <= to) events.push({ id: 'tuition-reserve-' + month, name: 'Maestría · provisión', date: reserveDate, currency: 'MXN', amount: tuition.amount, kind: 'RESERVE' });
  }
  for (const [i, p] of plan.budget.tuitionPayments.entries()) if (p.date >= from && p.date <= to) events.push({ id: 'tuition-' + i, name: 'Maestría', date: atLeast(from, businessDaysBefore(p.date)), due: p.date, currency: 'MXN', amount: p.amount, kind: 'PAYMENT', fixed: true });
  if (options.bonus.enabled) {
    if (!options.bonus.date) warnings.add('El bono necesita fecha para entrar al cálculo.');
    else events.push({ id: 'bonus', name: 'Bono neto · hipotético', date: options.bonus.date, currency: 'MXN', amount: options.bonus.amount, kind: 'INCOME' });
  }
  if (options.raise.enabled && !options.raise.date) warnings.add('El aumento necesita una fecha de inicio.');
  const loan = cf.loan;
  let newDebt = 0;
  if (loan.enabled && loan.amount > 0) {
    if (!loan.date) warnings.add('El préstamo necesita fecha de desembolso.');
    else {
      // The fee is financed, not spendable money. Repayments are cash commitments;
      // no payoff date or remaining loan principal is inferred from them.
      events.push({ id: 'new-loan', name: 'Préstamo nuevo · desembolso', date: loan.date, currency: 'MXN', amount: loan.amount, kind: 'BORROWING' });
      if (loan.date >= from && loan.date <= to) newDebt = round(loan.amount + loan.fee);
    }
    if (loan.apr === null || loan.monthlyPayment === null || !loan.firstPaymentDate) warnings.add('Préstamo parcial: confirma tasa, cuota y primera fecha de pago.');
    if (loan.firstPaymentDate && loan.date && loan.firstPaymentDate < loan.date) warnings.add('La primera cuota del préstamo está antes del desembolso; corrige sus fechas.');
    if (loan.firstPaymentDate && loan.monthlyPayment !== null) for (let n = 0; n < 120; n++) {
      const date = addMonths(loan.firstPaymentDate, n);
      if (date > to) break;
      if (date >= from) events.push({ id: 'new-loan-payment-' + n, name: 'Préstamo nuevo · cuota', date, due: date, currency: 'MXN', amount: loan.monthlyPayment, kind: 'PAYMENT', fixed: true });
    }
  }
  const discover = discoverDepositTerms(plan, cf.discover, from);
  if (options.transfer.enabled && cf.discover.enabled) { discover.issues.push('Desactiva la transferencia entre tarjetas del escenario mensual antes de probar el depósito de la misma oferta.'); discover.valid = false; }
  let newDebtUSD = 0;
  if (cf.discover.enabled) {
    for (const issue of discover.issues) warnings.add('Discover: ' + issue);
    if (discover.valid) {
      events.push({ id: 'discover-deposit', name: 'Discover · depósito de la oferta', date: discover.date, currency: discover.currency, amount: discover.receipt, assetId: discover.assetId, kind: 'BORROWING' });
      if (discover.date <= to) newDebtUSD = discover.debt;
      if (discover.monthlyPayment === null || !discover.firstPaymentDate) warnings.add('Discover: falta el abono adicional o su primera fecha. La nueva deuda aún no tiene pagos previstos.');
      if (discover.monthlyPayment !== null && discover.firstPaymentDate) for (let n = 0; n < plan.offers.discover.months; n++) {
        const date = addMonths(discover.firstPaymentDate, n);
        if (date > to) break;
        if (date >= from) events.push({ id: 'discover-extra-' + n, name: 'Discover · abono adicional propuesto', date, due: date, currency: 'USD', funding: discover.funding, assetId: discover.paymentAssetId, amount: discover.monthlyPayment, ledgerAccountId: discover.accountId, kind: 'PAYMENT', fixed: true, discoverExtra: true });
      }
      warnings.add('Discover: los abonos adicionales se suman a los pagos del saldo anterior. La asignación del banco entre tramos, el nuevo mínimo, la tasa de la comisión y la tasa posterior siguen por confirmar; no se acredita liquidación.');
    }
    if (options.transfer.enabled) warnings.add('La transferencia entre tarjetas del escenario mensual es otra operación. No se agrega ni se acumula con este depósito en la gráfica diaria.');
  }
  if (options.transfer.enabled) warnings.add('La transferencia de saldo Discover se compara en Proyección mensual; no se cuenta como efectivo en este simulador.');
  if (options.useSavings) warnings.add('Aquí los ahorros registrados ya forman el saldo inicial. No se suman otra vez como una entrada.');
  if (scheduled.some(p => p.estimated)) warnings.add('Los cortes posteriores usan mínimos y cuotas de referencia. No incluyen compras ni intereses futuros.');
  if (scheduled.some(p => p.date < from)) warnings.add('Hay asignaciones anteriores al inicio: no se presumen realizadas y quedan fuera del cálculo.');
  if (events.some(p => p.funding && p.funding !== p.currency)) warnings.add('Pagos USD desde MXN: conversión hipotética al tipo indicado, con comisiones registradas por abono. Confirma cotización y acreditación.');
  if (events.some(p => p.funding && p.funding !== p.currency) && (plan.settings.remittanceFeeUSD === null || plan.settings.receiverFeeUSD === null)) warnings.add('Faltan comisiones de conversión; el costo MXN mostrado es parcial.');
  if (plan.accounts.some(a => a.balance > 0 && knownRequirement(a) === null)) warnings.add('Hay mínimos o mensualidades desconocidos. No equivalen a cero.');
  if (plan.accounts.some(a => a.balance > 0 && !a.dueDate)) warnings.add('Hay créditos sin fecha de vencimiento; requieren confirmación.');
  const cash = { ...initial }, remainingCommitments = new Map(plan.accounts.map(a => [a.id, a.balance]));
  // Unassigned receipts stay in a visible planning pocket until their bank is
  // known. Automatic allocation uses it first; it never invents a bank transfer.
  const pocket = c => '@unassigned-' + c;
  const fundingAccounts = [...plan.assets.map(a => ({ id: a.id, name: a.name, currency: a.currency, initial: round(a.balance - a.reserved) })), ...['MXN', 'USD'].map(c => ({ id: pocket(c), name: 'Ingresos / faltantes sin cuenta asignada', currency: c, initial: 0, virtual: true }))];
  const balances = Object.fromEntries(fundingAccounts.map(a => [a.id, a.initial]));
  const assetById = new Map(fundingAccounts.map(a => [a.id, a]));
  const debit = (e, funding, cost) => {
    e.sourceAllocations = {};
    if (e.assetId) {
      const asset = assetById.get(e.assetId);
      if (!asset || asset.currency !== funding) throw new Error('Revisa la cuenta de origen de ' + e.name + '.');
      e.sourceAllocations[e.assetId] = -cost;
      balances[e.assetId] = round(balances[e.assetId] - cost);
      return;
    }
    let rest = cost;
    const sources = [assetById.get(pocket(funding)), ...fundingAccounts.filter(a => !a.virtual && a.currency === funding)];
    for (const a of sources) {
      const used = Math.min(rest, Math.max(0, balances[a.id]));
      if (used > 0) { balances[a.id] = round(balances[a.id] - used); e.sourceAllocations[a.id] = -used; rest = round(rest - used); }
    }
    if (rest > 0) { balances[pocket(funding)] = round(balances[pocket(funding)] - rest); e.sourceAllocations[pocket(funding)] = round((e.sourceAllocations[pocket(funding)] || 0) - rest); }
  };
  const rank = e => ['INCOME', 'BORROWING'].includes(e.kind) ? 0 : e.kind === 'RESERVE' ? 1 : 2;
  const ordered = events.filter(e => e.date >= from && e.date <= to).sort((a, b) => a.date.localeCompare(b.date) || rank(a) - rank(b) || a.id.localeCompare(b.id));
  const daily = [];
  for (let date = from, i = 0; i < days; date = shiftDay(date, 1), i++) {
    const today = ordered.filter(e => e.date === date);
    for (const e of today) {
      if (['INCOME', 'BORROWING'].includes(e.kind)) {
        cash[e.currency] = round(cash[e.currency] + e.amount);
        const destination = e.assetId || pocket(e.currency);
        balances[destination] = round(balances[destination] + e.amount);
        e.sourceAllocations = { [destination]: e.amount };
        if (e.id === 'discover-deposit') remainingCommitments.set(discover.accountId, round((remainingCommitments.get(discover.accountId) || 0) + discover.debt));
        continue;
      }
      const debtId = e.ledgerAccountId || e.accountId, balance = remainingCommitments.get(debtId);
      e.requestedAmount = e.amount;
      if (balance !== undefined && e.kind === 'PAYMENT') {
        e.amount = round(Math.min(balance, e.amount));
        if (e.amount < e.requestedAmount) warnings.add('Hay abonos limitados al saldo registrado del crédito; el excedente no se descuenta.');
      }
      const funding = e.funding || e.currency;
      const fee = e.currency !== funding && e.amount > 0 ? (plan.settings.remittanceFeeUSD || 0) + (plan.settings.receiverFeeUSD || 0) : 0;
      const cost = round(e.currency === funding ? e.amount : (e.amount + fee) * fx);
      const available = Math.max(0, Math.min(cash[funding], e.assetId ? balances[e.assetId] ?? 0 : Infinity));
      e.funded = round(Math.min(e.amount, e.currency === funding ? available : Math.max(0, available / fx - fee)));
      // Cap the sum of proposed outflows. Funding remains separate on each event;
      // a negative projection never marks the earlier commitment as paid.
      if (balance !== undefined && e.kind === 'PAYMENT') remainingCommitments.set(debtId, round(balance - e.amount));
      e.cost = cost; e.funding = funding;
      cash[funding] = round(cash[funding] - cost);
      debit(e, funding, cost);
    }
    daily.push({ date, timestamp: Date.parse(date + 'T12:00:00Z'), MXN: cash.MXN, USD: cash.USD, accounts: { ...balances }, events: today });
  }
  const accountShortfalls = fundingAccounts.filter(a => !a.virtual).flatMap(a => { const first = daily.find(d => d.accounts[a.id] < 0); return first ? [{ ...a, date: first.date, amount: -Math.min(...daily.map(d => d.accounts[a.id])) }] : []; });
  for (const a of accountShortfalls) warnings.add(a.name + ': los pagos asignados exceden su saldo desde ' + a.date + '. Cambia el origen o registra el ingreso en esa cuenta.');
  const obligations = plan.accounts.filter(a => a.balance > 0).flatMap(a => {
    const dueDates = [...new Set([a.dueDate, ...scheduled.filter(p => p.accountId === a.id && p.estimated && p.due && p.due <= to).map(p => p.due)])].sort((x, y) => (x || '9999').localeCompare(y || '9999'));
    return dueDates.map((dueDate, index) => {
    const estimated = dueDate !== a.dueDate;
    const previousDue = index > 0 ? dueDates[index - 1] : null;
    const prior = sum(ordered.filter(e => e.accountId === a.id && e.kind === 'PAYMENT' && previousDue && e.date <= previousDue).map(e => e.funded || 0));
    const balance = Math.max(0, a.balance - prior);
    const known = knownRequirement(a);
    const required = known === null ? null : Math.min(known, balance);
    const avoidInterest = estimated ? null : a.paymentToAvoidInterest;
    const target = avoidInterest ?? required;
    const eligible = ordered.filter(e => e.accountId === a.id && e.kind === 'PAYMENT' && dueDate && e.due === dueDate && e.date <= dueDate);
    const allocated = sum(eligible.map(e => e.amount)), funded = sum(eligible.map(e => e.funded || 0));
    const overdue = dueDate !== null && dueDate < from;
    const minimumGap = required === null ? null : round(Math.max(0, required - funded));
    const gap = target === null ? null : round(Math.max(0, target - funded));
    return { ...a, id: estimated ? a.id + '-due-' + dueDate : a.id, accountId: a.id, dueDate, estimated, paymentToAvoidInterest: avoidInterest, required, target, allocated, funded, gap, minimumGap, overdue,
      status: overdue ? 'Vencimiento pasado · confirmar pago' : !dueDate || target === null || required === null ? 'Datos pendientes' : minimumGap > 0 ? 'Mínimo sin cubrir' : gap > 0 ? 'Falta para evitar intereses' : estimated ? 'Referencia asignada · confirmar próximo corte' : 'Asignado con fondos · confirmar acreditación',
      risk: overdue || minimumGap > 0 ? 'danger' : !dueDate || target === null || required === null || estimated || gap > 0 ? 'warning' : 'covered',
      interest: estimated ? 'Mínimo de referencia · próximo corte pendiente' : a.lastInterest > 0 ? 'Registró intereses al corte' : a.paymentToAvoidInterest !== null ? 'Meta para no generar intereses' : a.tranches.some(t => t.type === 'DEFERRED') ? 'Interés diferido · revisar promoción' : a.ordinaryApr > 0 ? 'Tasa ordinaria ' + a.ordinaryApr + '%' : 'Condiciones por revisar' };
    });
  });
  for (const e of ordered.filter(e => e.fixed && e.due)) {
    const gap = round(Math.max(0, e.amount - (e.funded || 0)));
    obligations.push({ id: e.id, name: e.name, currency: e.currency, dueDate: e.due, target: e.amount, required: e.amount, allocated: e.amount, funded: e.funded || 0, gap, minimumGap: gap, status: gap ? 'Compromiso sin fondos suficientes' : 'Apartado con fondos', risk: gap ? 'danger' : 'covered', interest: e.discoverExtra ? 'Abono adicional elegido · no es el mínimo bancario' : 'Compromiso fijo', fixed: true, discoverExtra: e.discoverExtra === true, tranches: [] });
  }
  obligations.sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  const inWindow = obligations.filter(a => !a.dueDate || a.dueDate <= to);
  const totals = { MXN: { target: 0, funded: 0, gap: 0 }, USD: { target: 0, funded: 0, gap: 0 } };
  for (const a of inWindow) for (const key of ['target', 'funded', 'gap']) totals[a.currency][key] = round(totals[a.currency][key] + (key === 'funded' ? Math.min(a.target || 0, a.funded) : a[key] || 0));
  const promos = plan.accounts.flatMap(a => a.tranches.filter(t => ['PROMO', 'DEFERRED'].includes(t.type)).map(t => ({ ...t, account: a.name, currency: a.currency })));
  return { from, to, reserve, initial, fundingAccounts, accountShortfalls, daily, payments: scheduled, events: ordered, obligations, totals, warnings: [...warnings], promos, newDebt, newDebtUSD, discover, recommendation,
    minimumMXN: Math.min(initial.MXN, ...daily.map(d => d.MXN)), minimumUSD: Math.min(initial.USD, ...daily.map(d => d.USD)), firstShortfall: daily.find(d => d.MXN < 0 || d.USD < 0)?.date || null };
}

export function comparePaymentTimelines(plan, config) {
  const base = buildPaymentTimeline(plan, { ...config, scenario: null });
  const scenario = buildPaymentTimeline(plan, { ...config, scenario: plan.scenario });
  return { base, scenario, rows: base.daily.map((d, i) => ({ date: d.date, timestamp: d.timestamp, baseMXN: d.MXN, scenarioMXN: scenario.daily[i].MXN, baseUSD: d.USD, scenarioUSD: scenario.daily[i].USD, baseAccounts: d.accounts, scenarioAccounts: scenario.daily[i].accounts, events: scenario.daily[i].events })) };
}

import { addMonths, cents, money, tuitionForPeriod } from './paymentPlan.js';

const sum = rows => rows.reduce((a, b) => a + b, 0);
const round = n => money(cents(n));
const iso = d => d.toISOString().slice(0, 10);
const dt = s => new Date(s + 'T12:00:00Z');
const days = (a, b) => Math.round((dt(b) - dt(a)) / 86400000);
const first = s => s.slice(0, 8) + '01';
const shift = (s, n) => iso(new Date(dt(s).getTime() + n * 86400000));
export function businessDaysBefore(date, count = 2) {
  let d = dt(date);
  while (count > 0) { d.setUTCDate(d.getUTCDate() - 1); if (![0, 6].includes(d.getUTCDay())) count--; }
  return iso(d); // Weekends only; bank holidays and actual processing still require confirmation.
}
const availableAssets = (plan, currency) => round(sum(plan.assets.filter(a => a.currency === currency).map(a => a.balance - a.reserved)));
const installments = a => sum(a.tranches.filter(t => t.type === 'INSTALLMENT').map(t => Math.min(t.balance, t.monthlyPayment || 0)));
export function firstRequirement(a) {
  if (a.requiredPayment !== null) return Math.min(a.balance, a.requiredPayment);
  const ins = installments(a);
  return Math.min(a.balance, Math.max(a.autopayAmount || 0, a.minimumIncludesInstallments === true ? Math.max(a.minimum || 0, ins) : (a.minimum || 0) + ins));
}
function estimateExpenses(plan, config) {
  const estimates = new Map(config.expenseEstimates.map(e => [e.id, e.amount]));
  const rows = plan.budget.expenses.map(e => ({ ...e, amount: estimates.has(e.id) ? estimates.get(e.id) : e.amount, proposed: estimates.has(e.id) }));
  return { rows, total: rows.length ? round(sum(rows.map(e => e.amount || 0))) : plan.budget.livingExpenses || 0, missing: rows.length ? rows.filter(e => e.amount === null).map(e => e.name) : plan.budget.livingExpenses === null ? ['Gastos de vida'] : [] };
}
export function recommendationSettings(plan) {
  const c = plan.recommendation;
  return { ...c, from: c.from || plan.asOf, emergencyMXN: c.emergencyMXN ?? Math.round(plan.budget.monthlyIncome / 8 / 100) * 100,
    expenseEstimates: c.expenseEstimates.length ? c.expenseEstimates : plan.budget.expenses.filter(e => e.amount === null && /comida|salidas|ocio/i.test(e.name)).map(e => ({ id: e.id, amount: /comida/i.test(e.name) ? Math.round(plan.budget.monthlyIncome * .15 / 100) * 100 : 0 })) };
}

/** Proposed next-pay-cycle cash allocation. This does not post transactions or impute missing APRs. */
export function recommendPayments(plan, fx, override = {}) {
  const config = { ...recommendationSettings(plan), ...override };
  if (!(fx > 0)) throw new Error('Falta el tipo de cambio del escenario.');
  const month = addMonths(first(config.from), config.from.slice(8) === '01' ? 0 : 1);
  const end = addMonths(month, 1), expenses = estimateExpenses(plan, config);
  const tuition = tuitionForPeriod(plan, month, end).amount;
  const incomeDate = month.slice(0, 8) + String(Math.min(plan.budget.payday || 1, days(month, end))).padStart(2, '0');
  const monthlyAvailable = round(plan.budget.monthlyIncome - plan.budget.monthlyTax - tuition - expenses.total);
  const mxnAssets = availableAssets(plan, 'MXN'), usdAssets = availableAssets(plan, 'USD');
  const usdEvents = [], overdueAccounts = [], missingMinimums = plan.accounts.filter(a => a.balance > 0 && a.minimum === null).map(a => a.name);
  for (const a of plan.accounts.filter(a => a.currency === 'USD' && a.kind === 'CARD')) {
    if (!a.dueDate) continue;
    let due = a.dueDate, iteration = 0, remaining = a.balance;
    if (due < config.from) {
      const amount = round(Math.min(remaining, Math.max(a.minimum || 0, a.autopayAmount || 0)));
      overdueAccounts.push(a.name);
      usdEvents.push({ accountId: a.id, name: a.name, currency: 'USD', amount, due, date: config.from, kind: 'PAYMENT', note: 'Vencimiento anterior sin pago confirmado. Verificar el saldo vencido; no se presume pagado.' });
      remaining -= amount;
      while (due < config.from) { due = addMonths(due, 1); iteration++; }
    }
    while (due < end && remaining > 0 && iteration < 36) {
      const firstDue = iteration === 0;
      const grace = firstDue && a.paymentToAvoidInterest !== null && a.lastInterest === 0 && a.tranches.some(t => t.type === 'REVOLVING' && t.apr > 0);
      const amount = round(Math.min(remaining, grace ? a.paymentToAvoidInterest : Math.max(a.minimum || 0, a.autopayAmount || 0)));
      const auto = a.autopayDate ? addMonths(a.autopayDate, iteration) : null;
      const planned = auto && auto >= config.from ? auto : businessDaysBefore(due);
      usdEvents.push({ accountId: a.id, name: a.name, currency: 'USD', amount, due, date: planned < config.from ? config.from : planned,
        note: grace ? 'Cubrir el corte para conservar el periodo sin intereses; confirmar saldo actualizado.' : firstDue ? 'Incluye la domiciliación conocida; no pagarla dos veces.' : 'Referencia del siguiente mes: confirmar el nuevo estado.', kind: 'PAYMENT' });
      remaining -= amount; due = addMonths(due, 1); iteration++;
    }
  }
  const knownLoans = plan.accounts.filter(a => a.currency === 'USD' && a.kind === 'LOAN');
  const loanMonthlyUSDUsed = Math.max(config.loanMonthlyUSD || 0, sum(knownLoans.map(a => Math.max(a.minimum || 0, a.requiredPayment || 0))));
  let firstLoanReserve = loanMonthlyUSDUsed;
  for (const a of knownLoans) {
    if (a.dueDate && a.dueDate < config.from) overdueAccounts.push(a.name);
    if (a.dueDate && a.dueDate >= config.from && a.dueDate < month) firstLoanReserve += Math.max(a.minimum || 0, a.requiredPayment || 0);
  }
  const firstLoanDue = knownLoans.map(a => a.dueDate).filter(Boolean).sort()[0] || null;
  if (firstLoanReserve > 0 || config.loanMonthlyUSD !== null) usdEvents.push({ accountId: 'loan-reserve', name: 'Préstamos · reserva conjunta', currency: 'USD', amount: firstLoanReserve, date: firstLoanDue && firstLoanDue < month ? config.from : month, due: firstLoanDue, note: 'Incluye al menos las cuotas conocidas. Confirmar cada vencimiento con el administrador.', kind: 'RESERVE' });
  const usdPayments = round(sum(usdEvents.map(e => e.amount)));
  const usdShortfall = round(Math.max(0, usdPayments - usdAssets));
  const remittanceFee = usdShortfall ? (plan.settings.remittanceFeeUSD || 0) + (plan.settings.receiverFeeUSD || 0) : 0;
  const fundingMXN = round((usdShortfall + remittanceFee) * fx);
  const savingsContribution = round(Math.max(0, mxnAssets - config.emergencyMXN));
  const available = round(monthlyAvailable + savingsContribution - fundingMXN);
  const cards = plan.accounts.filter(a => a.currency === 'MXN' && a.kind === 'CARD');
  const scored = cards.map(a => ({ a, score: sum(a.tranches.filter(t => t.type === 'REVOLVING' && t.apr !== null).map(t => t.balance * t.apr)) })).sort((a, b) => b.score - a.score);
  const focus = scored[0]?.score > 0 ? scored[0].a : null;
  const rows = cards.map(a => ({ accountId: a.id, name: a.name, currency: 'MXN', due: a.dueDate, minimum: firstRequirement(a),
    amount: a.id === focus?.id ? 0 : config.protectReported && a.reportedPayment !== null ? Math.max(firstRequirement(a), a.reportedPayment) : a.paymentToAvoidInterest ?? firstRequirement(a),
    kind: a.reportedPayment !== null && a.paymentToAvoidInterest === null && config.protectReported ? 'RESERVE' : 'PAYMENT',
    note: a.reportedPayment !== null && a.paymentToAvoidInterest === null && config.protectReported ? 'Apartado condicionado: confirmar qué representa el pago reportado antes de ordenar el abono.' : a.id === focus?.id ? 'Techo de abono después de apartados. Incluye mínimo y mensualidades; no adelanta MSI futuros.' : a.paymentToAvoidInterest !== null ? 'Conservar el periodo sin intereses del corte.' : 'Mínimo conocido; las condiciones pendientes pueden exigir más.' }));
  const protectedAmount = round(sum(rows.filter(r => r.accountId !== focus?.id).map(r => r.amount)));
  const focusRow = rows.find(r => r.accountId === focus?.id);
  if (focusRow) focusRow.amount = round(Math.min(focus.paymentToAvoidInterest ?? focus.balance, Math.max(0, available - protectedAmount)));
  const required = round(protectedAmount + (focusRow?.minimum || 0));
  const shortfall = round(Math.max(0, required - available));
  const allocated = round(sum(rows.map(r => r.amount)));
  const earlyObligations = sum(rows.filter(r => r.accountId !== focus?.id && r.due && businessDaysBefore(r.due) < incomeDate).map(r => r.amount));
  const earlyFocus = Math.min(focusRow?.amount || 0, Math.max(0, mxnAssets - config.emergencyMXN - earlyObligations));
  const mxnEvents = [];
  for (const row of rows) {
    if (row.due && row.due < config.from) overdueAccounts.push(row.name);
    const safeDate = row.due ? businessDaysBefore(row.due) : month;
    if (row.accountId === focus?.id && row.amount < (focus.paymentToAvoidInterest ?? Infinity) && earlyFocus > 0) {
      mxnEvents.push({ ...row, amount: round(earlyFocus), date: config.from, note: row.note + ' Abono temprano, sujeto a confirmar saldos y gastos restantes del mes.' });
      if (row.amount > earlyFocus) mxnEvents.push({ ...row, amount: round(row.amount - earlyFocus), date: incomeDate });
    } else mxnEvents.push({ ...row, date: safeDate < config.from ? config.from : safeDate });
  }
  const events = [...usdEvents, ...mxnEvents,
    { name: 'Ingreso', currency: 'MXN', amount: plan.budget.monthlyIncome, date: incomeDate, kind: 'INCOME' },
    { name: 'Impuestos y gastos de vida · apartado', currency: 'MXN', amount: round(plan.budget.monthlyTax + expenses.total), date: incomeDate, kind: 'RESERVE', note: 'Se excluyen del efectivo libre desde la nómina. No se inventa su día real de gasto.' },
    ...plan.budget.tuitionPayments.filter(p => p.date >= month && p.date < end).map(p => ({ name: 'Maestría', currency: 'MXN', amount: p.amount, date: businessDaysBefore(p.date), due: p.date, kind: 'PAYMENT', note: 'Margen de acreditación propuesto.' }))];
  if (!plan.budget.tuitionPayments.some(p => p.date >= month && p.date < end) && tuition) events.push({ name: 'Maestría · provisión', currency: 'MXN', amount: tuition, date: incomeDate, kind: 'RESERVE' });
  if (usdShortfall) {
    const firstDeficit = [...usdEvents].sort((a,b) => a.date.localeCompare(b.date)).find((e, i, array) => sum(array.slice(0,i+1).map(x => x.amount)) > usdAssets)?.date || incomeDate;
    const date = businessDaysBefore(firstDeficit, 5);
    events.push({ name: 'Remesa requerida · pendiente de cotización', currency: 'MXN', amount: fundingMXN, date: date < config.from ? config.from : date, kind: 'RESERVE', note: 'La fecha es un margen propuesto, no garantiza llegada. Costo receptor pendiente si no está informado.' });
  }
  events.sort((a,b) => a.date.localeCompare(b.date) || Number(b.kind === 'INCOME') - Number(a.kind === 'INCOME'));
  let free = mxnAssets;
  const daily = [];
  for (let date = config.from, n = 0; date < end && n < 70; date = shift(date, 1), n++) {
    const today = events.filter(e => e.date === date && e.currency === 'MXN');
    for (const e of today) free = round(free + (e.kind === 'INCOME' ? e.amount : -e.amount));
    daily.push({ date, free, events: today.map(e => e.name).join(' · ') });
  }
  const lateMinimums = [...rows.filter(row => row.due && sum(mxnEvents.filter(e => e.accountId === row.accountId && e.date <= row.due).map(e => e.amount)) + .005 < row.minimum).map(row => row.name), ...usdEvents.filter(e => e.due && e.amount > 0 && e.date > e.due).map(e => e.name)];
  return { config, month, end, incomeDate, expenses, tuition, monthlyAvailable, mxnAssets, usdAssets, usdPayments, usdRemaining: round(usdAssets - usdPayments), fundingMXN, savingsContribution, available, allocated, required, shortfall, focus, rows, events, daily, minimumCash: Math.min(...daily.map(d => d.free)), unallocated: round(available - allocated), loanMonthlyUSDUsed, firstLoanReserve, missingMinimums, overdueAccounts, lateMinimums, loanUnknown: config.loanMonthlyUSD === null && plan.accounts.some(a => a.kind === 'LOAN' && a.minimum === null) };
}

/** Optimistic principal-only lower bound, not an interest or payoff forecast. */
export function deadlineFeasibility(plan, recommendation, fx, extra = false) {
  const { month, config, expenses } = recommendation;
  const promos = plan.accounts.filter(a => a.currency === 'USD').flatMap(a => a.tranches.filter(t => ['PROMO', 'DEFERRED'].includes(t.type) && t.promoEnd).map(t => ({ account: a, tranche: t, safeDate: businessDaysBefore(t.promoEnd, 3) })));
  return promos.sort((a,b) => a.safeDate.localeCompare(b.safeDate)).map(promo => {
    const date = promo.safeDate;
    let income = 0, installmentsDue = 0, months = 0;
    for (let period = month; period <= date && months < 36; period = addMonths(period, 1)) {
      const payday = period.slice(0,8) + String(Math.min(plan.budget.payday || 1, days(period, addMonths(period,1)))).padStart(2,'0');
      if (payday > date) break;
      const tuition = tuitionForPeriod(plan, period, addMonths(period, 1)).amount;
      income += plan.budget.monthlyIncome - plan.budget.monthlyTax - expenses.total - tuition;
      if (extra && plan.scenario.raise.enabled && plan.scenario.raise.date && plan.scenario.raise.date <= payday) income += plan.scenario.raise.amount;
      months++;
    }
    if (extra && plan.scenario.bonus.enabled && plan.scenario.bonus.date && plan.scenario.bonus.date >= config.from && plan.scenario.bonus.date <= date) income += plan.scenario.bonus.amount;
    for (const a of plan.accounts.filter(a => a.currency === 'MXN')) for (const t of a.tranches.filter(t => t.type === 'INSTALLMENT')) {
      let remaining = t.balance, due = a.dueDate, count = 0;
      while (due && due <= date && remaining > 0 && count < Math.min(t.paymentsRemaining ?? 36, 36)) {
        if (due >= config.from) { const v = count === t.paymentsRemaining - 1 ? remaining : Math.min(remaining, t.monthlyPayment || 0); installmentsDue += v; remaining -= v; }
        due = addMonths(due, 1); count++;
      }
    }
    const firstNonInstallment = sum(plan.accounts.filter(a => a.currency === 'MXN').map(a => Math.max(0, firstRequirement(a) - installments(a))));
    const matureUSD = sum(promos.filter(p => p.safeDate <= date).map(p => p.tranche.balance));
    const promoAccounts = new Set(promos.filter(p => p.safeDate <= date).map(p => p.account.id));
    const otherUSD = sum(plan.accounts.filter(a => a.currency === 'USD' && a.kind === 'CARD' && !promoAccounts.has(a.id)).map(a => a.paymentToAvoidInterest !== null && a.tranches.some(t => t.type === 'REVOLVING') ? a.paymentToAvoidInterest : Math.max(a.minimum || 0, a.autopayAmount || 0)));
    const required = round(installmentsDue + firstNonInstallment + (matureUSD + otherUSD + (config.loanMonthlyUSD || 0) * months) * fx);
    const available = round(income + recommendation.mxnAssets - config.emergencyMXN + recommendation.usdAssets * fx);
    return { date, name: promo.account.name, months, required, available, gap: round(Math.max(0, required - available)), monthlyGap: round(Math.max(0, required - available) / Math.max(1, months)), installmentsDue: round(installmentsDue) };
  });
}

/** Isolated yield comparison. Unknown expiry never turns into an asserted perpetual offer. */
export function dailyYieldComparison(amount, annualRate, count, { from, rateEnd = null, credit = 'DAILY', cap = 25000, excessRate = null, extraCost = 0 } = {}) {
  if (annualRate == null) return { accrued: null, credited: null, netBeforeTax: null, supportedDays: 0, assumption: true, beyondCapUnknown: amount > cap && excessRate === null };
  let balance = amount, accrued = 0, credited = 0, supportedDays = 0;
  for (let n = 0; n < Math.floor(count); n++) {
    const date = shift(from, n);
    const active = !rateEnd || date <= rateEnd;
    const eligible = Math.min(balance, cap), excess = Math.max(0, balance - cap);
    // Without an excess rate the calculation intentionally excludes that slice.
    const daily = active ? round((eligible * annualRate + excess * (excessRate || 0)) / 100 / 360) : 0;
    accrued = round(accrued + daily); if (active) supportedDays++;
    if (credit === 'DAILY') { balance = round(balance + daily); credited = round(credited + daily); }
    else if (credit === 'MONTHLY' && shift(date, 1).slice(0,7) !== date.slice(0,7)) { balance = round(balance + accrued - credited); credited = accrued; }
  }
  return { accrued, credited, netBeforeTax: round(accrued - extraCost), supportedDays, assumption: !rateEnd, beyondCapUnknown: amount > cap && excessRate === null };
}

/** Conditional partial bridge: clear the selected statement, repay Discover with remaining cash.
 * Fixed FX, no new charges, other USD minimums fixed, unknown student payments explicitly excluded.
 * Returns capacity, not a claim that every card/promo has been paid off.
 */
export function bridgeCapacity(plan, r, fx, { haircut = .02, loanMonthlyUSD = r.loanMonthlyUSDUsed } = {}) {
  const discover = plan.accounts.find(a => /discover/i.test(a.name));
  const focusRow = r.rows.find(row => row.accountId === r.focus?.id);
  if (!discover || !focusRow || r.focus.paymentToAvoidInterest === null) return null;
  const needMXN = round(Math.max(0, r.focus.paymentToAvoidInterest - focusRow.amount));
  const estimatedPrincipal = Math.ceil(needMXN / (fx * (1 - haircut)) * 100) / 100;
  const principal = r.config.transferPrincipalUSD || estimatedPrincipal;
  const fee = round(principal * plan.offers.discover.feePercent / 100);
  const quoteMatches = r.config.transferNetMXN !== null && Math.abs((r.config.transferQuotePrincipalUSD ?? -1) - principal) < .005;
  const netMXN = quoteMatches ? r.config.transferNetMXN : round(principal * fx * (1 - haircut));
  const repaymentFX = r.config.transferRepaymentFX || fx;
  let legacy = discover.balance, transfer = round(principal + fee), usdCash = 0, totalInterest = 0;
  const monthly = [], flows = [], unknownPost = [];
  const term = discover.tranches.find(t => t.balance > 0), periodAPR = term?.apr;
  if (periodAPR === null || periodAPR === undefined) return null;
  const firstOtherUSD = sum(r.events.filter(e => e.currency === 'USD' && e.accountId !== discover.id && e.accountId !== 'loan-reserve').map(e => e.amount));
  const deferred = plan.accounts.filter(a => a.currency === 'USD' && a.id !== discover.id && a.tranches.some(t => t.type === 'DEFERRED'));
  const deferredRemaining = new Map(deferred.map(a => [a.id, a.balance]));
  for (let m = 0; m < plan.offers.discover.months; m++) {
    const date = addMonths(r.month, m), end = addMonths(date, 1);
    let mxnCommitments = 0, flow = 0;
    if (m === 0) {
      mxnCommitments = r.allocated;
      flow = r.usdAssets + Math.max(0, r.usdPayments - r.usdAssets) - firstOtherUSD;
      for (const a of deferred) deferredRemaining.set(a.id, Math.max(0, a.balance - sum(r.events.filter(e => e.accountId === a.id && e.currency === 'USD').map(e => e.amount))));
    } else {
      for (const a of plan.accounts.filter(a => a.currency === 'MXN')) {
        for (const t of a.tranches.filter(t => t.type === 'INSTALLMENT')) {
          if (m < (t.paymentsRemaining ?? 0)) mxnCommitments += m === t.paymentsRemaining - 1 ? Math.max(0, t.balance - (t.monthlyPayment || 0) * m) : Math.min(t.monthlyPayment || 0, Math.max(0, t.balance - (t.monthlyPayment || 0) * m));
        }
        // No rate is invented: reserve an unclassified remainder fully in month two.
        if (m === 1) mxnCommitments += Math.max(0, sum(a.tranches.filter(t => t.type !== 'INSTALLMENT').map(t => t.balance)) - Math.max(0, (r.rows.find(row => row.accountId === a.id)?.amount || 0) + (a.id === r.focus.id ? Math.min(netMXN, needMXN) : 0) - installments(a)));
      }
      let otherUSD = 0;
      for (const a of plan.accounts.filter(a => a.currency === 'USD' && a.kind === 'CARD' && a.id !== discover.id)) {
        if (deferredRemaining.has(a.id)) {
          const payment = Math.min(deferredRemaining.get(a.id), Math.max(a.minimum || 0, a.autopayAmount || 0));
          deferredRemaining.set(a.id, round(deferredRemaining.get(a.id) - payment)); otherUSD += payment;
        } else if (a.paymentToAvoidInterest !== null && a.tranches.some(t => t.type === 'REVOLVING')) {
          if (m === 1) otherUSD += Math.max(0, a.balance - sum(r.events.filter(e => e.accountId === a.id && e.currency === 'USD').map(e => e.amount)));
        } else otherUSD += Math.max(a.minimum || 0, a.autopayAmount || 0);
      }
      const mxnCapacity = plan.budget.monthlyIncome - plan.budget.monthlyTax - r.expenses.total - tuitionForPeriod(plan, date, end).amount - mxnCommitments;
      const sendingFee = Math.max(0, mxnCapacity) > 0 ? (plan.settings.remittanceFeeUSD || 0) + (plan.settings.receiverFeeUSD || 0) : 0;
      flow = mxnCapacity / repaymentFX - sendingFee - otherUSD;
    }
    flows.push({ date, end, mxnCommitments: round(mxnCommitments), flow: round(flow - (m === 0 ? Math.max(loanMonthlyUSD, r.firstLoanReserve) : loanMonthlyUSD)) });
  }
  const minimumAllocation = r.config.discoverMinimumAllocationUSD ?? discover.minimum ?? 0;
  const referencePayment = Math.max(minimumAllocation, discover.autopayAmount || 0);
  const reserves = flows.map(() => r.config.usdBuffer);
  // Retain the cash needed to keep the existing autopay through later low-income months.
  for (let m = flows.length - 2; m >= 0; m--) reserves[m] = Math.max(r.config.usdBuffer, round(reserves[m + 1] + referencePayment - flows[m + 1].flow));
  for (let m = 0; m < flows.length; m++) {
    const { date, end, mxnCommitments, flow } = flows[m];
    usdCash = round(usdCash + flow);
    // Conservative monthly approximation; stop pretending the old APR persists after expiry.
    if (legacy > 0 && term.promoEnd && date > term.promoEnd && term.postApr === null) unknownPost.push(date);
    const rate = term.promoEnd && date > term.promoEnd ? term.postApr : periodAPR;
    const interest = rate === null ? 0 : round(legacy * rate / 100 * days(date, end) / term.dayBasis);
    legacy = round(legacy + interest); totalInterest = round(totalInterest + interest);
    const availablePayment = Math.max(0, usdCash - reserves[m]);
    const capacity = round(Math.min(Math.max(0, usdCash), Math.max(Math.min(referencePayment, legacy + transfer), availablePayment)));
    // Conservative allocation: the issuer may send the minimum to 0%; only the excess
    // is guaranteed to go to the higher APR. The future minimum remains an assumption.
    const minimumToTransfer = Math.min(transfer, capacity, minimumAllocation);
    const paidLegacy = Math.min(legacy, Math.max(0, capacity - minimumToTransfer)); legacy = round(legacy - paidLegacy);
    const paidTransfer = Math.min(transfer, Math.max(0, capacity - paidLegacy)); transfer = round(transfer - paidTransfer);
    const payment = round(paidLegacy + paidTransfer); usdCash = round(usdCash - payment);
    const minimumGap = Math.max(0, Math.min(referencePayment, legacy + transfer + payment) - payment);
    if (term.promoEnd && term.promoEnd >= date && term.promoEnd < end && legacy > 0 && term.postApr === null) unknownPost.push(term.promoEnd);
    monthly.push({ date, mxnCommitments, payment, legacy, transfer, interest, cashGap: round(Math.max(minimumGap, -usdCash, r.config.usdBuffer - usdCash)), remainingUSD: round(Math.max(0, usdCash)), reserve: round(reserves[m]) });
  }
  const unknownMXN = plan.accounts.filter(a => a.currency === 'MXN' && a.id !== r.focus.id && (a.reportedPayment !== null && a.paymentToAvoidInterest === null || a.tranches.some(t => t.apr === null)));
  return { principal, fee, newBalance: round(principal + fee), needMXN, netMXN, netGap: round(Math.max(0, needMXN - netMXN)), repaymentFX, estimatedPrincipal,
    withinLimit: principal + fee <= plan.offers.discover.maximum, monthly, remaining: round(legacy + transfer), totalInterest, unknownPost,
    unknownMXN: unknownMXN.map(a => a.name), conditional: true, referencePayment, minimumAllocation, quoteMatches, staleQuote: r.config.transferNetMXN !== null && !quoteMatches,
    wouldClear: legacy + transfer < .005 && monthly.every(m => m.cashGap === 0) && !unknownPost.length && netMXN >= needMXN && principal + fee <= plan.offers.discover.maximum && r.shortfall === 0 && r.minimumCash >= r.config.emergencyMXN - .005 && !r.lateMinimums.length && !r.overdueAccounts.length && !r.expenses.missing.length && !plan.accounts.some(a => a.kind === 'CARD' && a.balance > 0 && a.minimum === null) };
}

import React from 'react';
import { ArrowRight, CalendarDays, CreditCard, Database, Plus, Wallet } from 'lucide-react';
import { livingBudgetSummary, planTotals } from '../services/paymentPlan.js';
import { convertCurrency, formatMoney } from '../services/exchangeRate.js';

const money = (value, currency = 'MXN') => value == null ? 'Por confirmar' : `${formatMoney(value, currency)} ${currency}`;
const date = value => value ? new Date(`${value}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : 'Fecha por confirmar';

/** Read the same inventory that the plan edits, without a second conflicting editor. */
export default function PlanSourceView({ type, plan, onNavigate, exchangeRate, displayCurrency = 'MXN' }) {
  const totals = planTotals(plan);
  const currency = displayCurrency === 'USD' ? 'USD' : 'MXN';
  const total = values => convertCurrency(values.MXN, 'MXN', currency, exchangeRate) + convertCurrency(values.USD, 'USD', currency, exchangeRate);
  const budget = livingBudgetSummary(plan);
  const meta = {
    budget: { eyebrow: 'Tu presupuesto', title: 'Dale un lugar a cada peso.', description: 'Ingresos y gastos del plan, reunidos en un solo presupuesto.', panel: 'monthly', action: 'Ajustar presupuesto', icon: Wallet },
    debts: { eyebrow: 'Tus compromisos', title: 'Cada deuda, en su lugar.', description: 'Consulta tus créditos y abre el plan para actualizar sus condiciones o simular un abono.', panel: 'accounts', action: 'Revisar cuentas y deudas', icon: CreditCard },
    balance: { eyebrow: 'Tu patrimonio', title: 'Lo que tienes y lo que debes.', description: 'Un balance de los ahorros y créditos incluidos en tu plan.', panel: 'savings', action: 'Actualizar ahorros', icon: Wallet },
  }[type];
  const openPanel = panel => onNavigate('plan', { panel });
  const rows = type === 'debts' ? plan.accounts : plan.assets;
  const Icon = meta.icon;
  const metrics = type === 'budget' ? [
    ['Ingreso mensual', plan.budget.monthlyIncome, 'Ingreso recibido registrado en el plan'],
    ['Provisión fiscal', plan.budget.monthlyTax, 'Estimación mensual configurada'],
    ['Gastos de vida', budget.total, budget.missing.length ? `${budget.missing.length} conceptos por completar` : 'Sin sumar pagos de deuda ni colegiaturas'],
  ] : type === 'debts' ? [
    ['Saldo en pesos', totals.debts.MXN, `${plan.accounts.filter(a => a.currency === 'MXN').length} créditos en MXN`, 'MXN'],
    ['Saldo en dólares', totals.debts.USD, `${plan.accounts.filter(a => a.currency === 'USD').length} créditos en USD`, 'USD'],
  ] : [
    ['Ahorros registrados', total(totals.assets), 'Saldos del inventario, incluidos apartados', currency],
    ['Deuda registrada', total(totals.debts), 'Incluye el saldo de todos los créditos del plan', currency],
    ['Patrimonio neto', total(totals.assets) - total(totals.debts), 'Ahorros menos deudas del plan', currency],
  ];
  return <div className="plan-source-view">
    <header className="workspace-page-heading"><div><p className="eyebrow">{meta.eyebrow}</p><h1>{meta.title}</h1><p>{meta.description}</p></div><button className="button-primary" type="button" onClick={() => openPanel(meta.panel)}>{meta.action}<ArrowRight size={16} aria-hidden="true" /></button></header>
    <div className="source-context"><Database size={17} aria-hidden="true" /><p><strong>Vinculado a tu plan de pagos</strong><span>Revisión del {date(plan.asOf)}. Actualiza los datos en el plan para mantener una sola versión.</span></p><button type="button" className="button-ghost" onClick={() => openPanel('data')}>Ver conciliación <ArrowRight size={14} aria-hidden="true" /></button></div>
    <div className={`source-metrics source-metrics-${metrics.length}`}>{metrics.map(([label, value, detail, code = 'MXN']) => <section className="surface-card" key={label}><h2>{label}</h2><p className="sensitive-value" data-sensitive>{money(value, code)}</p><small>{detail}</small></section>)}</div>
    {type === 'balance' && <p className="source-note">Consolidado en {currency} con el tipo de cambio de visualización. Los saldos pueden tener distintas fechas de corte; no representan dinero disponible en tiempo real.</p>}
    {type === 'budget' ? <section className="surface-card source-list"><header><div><h2>Gastos de vida, por concepto</h2><p>Los pagos de deuda y compromisos con fecha se revisan por separado en el plan.</p></div><Wallet size={20} aria-hidden="true" /></header>{plan.budget.expenses.length ? plan.budget.expenses.map(item => <div className="source-row" key={item.id}><span>{item.name}</span><strong data-sensitive>{money(item.amount)}</strong></div>) : <div className="source-row"><span>Gastos de vida</span><strong data-sensitive>{money(plan.budget.livingExpenses)}</strong></div>}<button type="button" className="button-ghost source-list-action" onClick={() => openPanel('monthly')}>Editar los conceptos del presupuesto<ArrowRight size={16} aria-hidden="true" /></button></section> : <section className="surface-card source-list"><header><div><h2>{type === 'debts' ? 'Tus cuentas de crédito' : 'Tus cuentas de ahorro'}</h2><p>{rows.length} {rows.length === 1 ? 'registro en la conciliación' : 'registros en la conciliación'}</p></div><Icon size={20} aria-hidden="true" /></header>{rows.length ? rows.map(item => <button type="button" key={item.id} className="source-record" onClick={() => openPanel(meta.panel)}><span className="source-record-icon"><Icon size={19} aria-hidden="true" /></span><span><strong>{item.name}</strong><small>{type === 'debts' ? `Vencimiento: ${date(item.dueDate)}` : `Saldo al ${date(item.balanceDate)}`}</small></span><span className="source-record-amount"><strong data-sensitive>{money(item.balance, item.currency)}</strong><small>{type === 'debts' ? 'Saldo registrado' : `Apartado: ${money(item.reserved, item.currency)}`}</small></span><ArrowRight size={16} aria-hidden="true" /></button>) : <p className="source-empty">La conciliación todavía no incluye {type === 'debts' ? 'créditos' : 'cuentas de ahorro'}. Puedes incorporarlos al actualizarla.</p>}<button type="button" className="button-ghost source-list-action" onClick={() => openPanel('data')}><Plus size={16} aria-hidden="true" />Actualizar el inventario de la conciliación<ArrowRight size={16} aria-hidden="true" /></button></section>}
    <button type="button" className="source-next" onClick={() => openPanel(type === 'budget' ? 'overview' : 'calendar')}><CalendarDays size={20} aria-hidden="true" /><span><strong>{type === 'budget' ? 'Mira cómo cambia tu plan' : 'Revisa lo que sigue'}</strong><small>{type === 'budget' ? 'Explora abonos y fechas con este presupuesto.' : 'Consulta vencimientos e importes documentados.'}</small></span><ArrowRight size={18} aria-hidden="true" /></button>
  </div>;
}

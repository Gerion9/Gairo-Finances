import React from 'react';
import { formatMoney } from '../services/exchangeRate.js';
import PendingDebts from './PendingDebts.jsx';

export default function PlanningOverview({ financialData, cashFlow, onNavigate }) {
  const rows = [
    ['Ingreso mensual recibido', cashFlow.fiscal.netoEnCuenta + cashFlow.fiscal.otrosIngresos],
    ['Impuestos mensuales estimados', cashFlow.fiscal.totalImpuestosSat],
    ['Gastos mensuales registrados', cashFlow.totalCostodeVida + cashFlow.totalGastosOpcionales],
  ];
  return <div className="space-y-7"><header><p className="eyebrow">Tu panorama inicial</p><h1 className="text-3xl font-semibold text-white mt-2">Tus compromisos, en un solo lugar.</h1><p className="text-slate-400 mt-3">Presupuesto mensual y saldos aproximados. Completa los pagos y las tasas de tus estados de cuenta para construir tu plan.</p></header>
    <section className="surface-card p-6 sm:p-7"><div className="grid sm:grid-cols-3 gap-6">{rows.map(([label, value]) => <div key={label}><p className="text-sm text-slate-400">{label}</p><p className="text-2xl text-white font-semibold mt-2 tabular-nums">{formatMoney(value)} <span className="text-sm">MXN</span></p></div>)}</div><div className="border-t border-slate-700 mt-6 pt-5"><p className="text-sm text-emerald-200">Subtotal antes de otros gastos y pagos de deudas pendientes</p><p className="text-3xl text-white font-semibold mt-2 tabular-nums">≈ {formatMoney(cashFlow.flujoLibreReal)} MXN</p><p className="text-sm text-slate-400 mt-3">Aún no representa dinero libre para gastar. Faltan pagos mínimos y cualquier gasto que todavía no hayas registrado.</p></div><button className="button-secondary mt-5" onClick={() => onNavigate('budget')}>Editar ingresos y gastos</button></section>
    <PendingDebts financialData={financialData} /><button className="button-primary" onClick={() => onNavigate('debts')}>Completar mis deudas</button>
  </div>;
}

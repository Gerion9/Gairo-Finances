import React, { useEffect, useState } from 'react';
import { 
  Calculator, 
  Sparkles, 
  Percent, 
  Layers, 
  Coffee, 
  PieChart, 
  ArrowRight, 
  RefreshCw, 
  ShieldCheck, 
  Home, 
  Briefcase, 
  TrendingUp, 
  FileText 
} from 'lucide-react';
import { 
  calculateCATReal, 
  calculateMSIvsDiscount, 
  calculateWindfallAllocation, 
  calculateGastosHormiga, 
  calculate503020Rule, 
  calculateRefinancingBenefit, 
  calculateFIRERetirement, 
  calculateWorkHoursCost, 
  calculateBorrowingCapacity, 
  calculateRentVsBuy, 
  calculateRealYield, 
  calculatePersonalTaxDeductions, 
  calculateResicoVsPfae 
} from '../services/calculators.js';
import { formatMoney } from '../services/exchangeRate.js';
import { calculateCashFlow } from '../services/financeEngine.js';

export default function FinancialCalculatorsHub({ financialData = {}, exchangeRate, initialCalculator = 'cat' }) {
  const cashFlow = calculateCashFlow(financialData, exchangeRate);
  const annualIncome = cashFlow.fiscal.importeFacturado * 12;
  const validCalculators = ['cat', 'msi', 'windfall', 'hormiga', 'rule503020', 'refinance', 'fire', 'horas', 'rentVsBuy', 'realYield', 'deductions', 'resico'];
  const [activeCalc, setActiveCalc] = useState(validCalculators.includes(initialCalculator) ? initialCalculator : 'cat');
  useEffect(() => { setActiveCalc(validCalculators.includes(initialCalculator) ? initialCalculator : 'cat'); }, [initialCalculator]);

  // Estados para cada calculadora
  const [catInput, setCatInput] = useState({ saldo: 0, tasa: 0, plazo: 12, anualidad: 0, comision: 0 });
  const [msiInput, setMsiInput] = useState({ precio: 0, desc: 0, meses: 12, tasaInv: 0 });
  const [windfallInput, setWindfallInput] = useState(0);
  const [hormigaInput, setHormigaInput] = useState({ diario: 0, dias: 30, tasa: 0 });
  const [rule503020Input, setRule503020Input] = useState({
    neto: cashFlow.fiscal.ingresoDisponibleReal,
    necesidades: cashFlow.totalCostodeVida,
    deseos: cashFlow.totalGastosOpcionales,
    ahorroDeuda: cashFlow.totalPagosMinimosMXN
  });
  const [refinanceInput, setRefinanceInput] = useState({ saldo: 0, tasaVieja: 0, tasaNueva: 0, plazo: 24 });
  const [fireInput, setFireInput] = useState({ gastosAnuales: (cashFlow.totalCostodeVida + cashFlow.totalGastosOpcionales) * 12, patrimonio: 0, ahorro: 0, tasa: 0 });
  const [horasInput, setHorasInput] = useState({ neto: cashFlow.fiscal.ingresoDisponibleReal, horas: 160, precio: 0 });
  const [rentVsBuyInput, setRentVsBuyInput] = useState({ renta: 0, precio: 0, enganchePct: 20, tasaHip: 0 });
  const [realYieldInput, setRealYieldInput] = useState({ nominal: 0, inflacion: 0, isr: 0 });
  const [deductionsInput, setDeductionsInput] = useState({ medicos: 0, ppr: 0, colegiaturas: 0 });
  const [resicoInput, setResicoInput] = useState({ facturacion: annualIncome, gastos: 0 });

  // Cálculos reactivos
  const catRes = calculateCATReal(catInput.saldo, catInput.tasa, catInput.plazo, catInput.anualidad, catInput.comision);
  const msiRes = calculateMSIvsDiscount(msiInput.precio, msiInput.desc, msiInput.meses, msiInput.tasaInv);
  const windfallRes = calculateWindfallAllocation(windfallInput, financialData.deudas, exchangeRate);
  const hormigaRes = calculateGastosHormiga(hormigaInput.diario, hormigaInput.dias, hormigaInput.tasa);
  const rule503020 = calculate503020Rule(rule503020Input.neto, rule503020Input.necesidades, rule503020Input.deseos, rule503020Input.ahorroDeuda);
  const refinanceRes = calculateRefinancingBenefit(refinanceInput.saldo, refinanceInput.tasaVieja, refinanceInput.tasaNueva, refinanceInput.plazo);
  const fireRes = calculateFIRERetirement(fireInput.gastosAnuales, fireInput.patrimonio, fireInput.ahorro, fireInput.tasa);
  const horasRes = calculateWorkHoursCost(horasInput.neto, horasInput.horas, horasInput.precio);
  const rentBuyRes = calculateRentVsBuy(rentVsBuyInput.renta, rentVsBuyInput.precio, rentVsBuyInput.enganchePct, rentVsBuyInput.tasaHip);
  const realYieldRes = calculateRealYield(realYieldInput.nominal, realYieldInput.inflacion, realYieldInput.isr);
  const deductionsRes = calculatePersonalTaxDeductions(annualIncome, deductionsInput.medicos, deductionsInput.ppr, deductionsInput.colegiaturas);
  const resicoRes = calculateResicoVsPfae(resicoInput.facturacion, resicoInput.gastos);

  const contextIncomplete = (financialData.deudasPendientes?.length > 0 && ['windfall', 'rule503020', 'fire'].includes(activeCalc))
    || (financialData.honorarios?.modo === 'MANUAL' && ['deductions', 'resico'].includes(activeCalc));
  const calcList = [
    { id: 'cat', title: 'CAT Real & Costo Total', icon: Percent },
    { id: 'msi', title: 'MSI vs Descuento Contado', icon: Sparkles },
    { id: 'windfall', title: 'Inyección Aguinaldo/Bono', icon: Layers },
    { id: 'hormiga', title: 'Gastos Hormiga & Fuga', icon: Coffee },
    { id: 'rule503020', title: 'Regla 50 / 30 / 20', icon: PieChart },
    { id: 'refinance', title: 'Refinanciamiento / Consolidación', icon: RefreshCw },
    { id: 'fire', title: 'Libertad Financiera (FIRE)', icon: TrendingUp },
    { id: 'horas', title: 'Costo en Horas de Vida', icon: Briefcase },
    { id: 'rentVsBuy', title: 'Renta vs Compra Inmueble', icon: Home },
    { id: 'realYield', title: 'Rendimiento Real vs Inflación', icon: Percent },
    { id: 'deductions', title: 'Deducciones SAT & Devolución', icon: FileText },
    { id: 'resico', title: 'RESICO vs PFAE (Impuestos)', icon: ShieldCheck }
  ];

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-5 h-5 text-emerald-400" />
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                Suite de Calculadoras Financieras & Toma de Decisiones
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Herramientas matemáticas especializadas para optimizar cada peso, evaluar compras y acelerar tu libertad.
            </p>
          </div>
        </div>

        {/* Tab selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 mt-4">
          {calcList.map(c => {
            const Icon = c.icon;
            const isActive = activeCalc === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveCalc(c.id)}
                className={`p-2.5 rounded-xl border text-left text-xs font-semibold flex items-center gap-2 transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span className="truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Calculator Card */}
      {contextIncomplete ? <div className="surface-card p-6 text-slate-300"><h3 className="text-xl text-white font-semibold">Faltan datos para este cálculo</h3><p className="text-sm mt-3">Completa tus pagos y tasas contractuales para las proyecciones de deuda. Los cálculos fiscales requieren facturación y retenciones; tu ingreso recibido no sustituye esos datos.</p></div> : <>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        
        {/* 1. CAT Real */}
        {activeCalc === 'cat' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Calculadora de CAT Real (Costo Anual Total)</h3>
            <p className="text-xs text-slate-400">
              Calcula el costo verdadero de un crédito incluyendo tasa de interés, anualidad de tarjeta y comisiones.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Monto / Saldo ($)</label>
                <input
                  type="number"
                  value={catInput.saldo}
                  onChange={(e) => setCatInput({ ...catInput, saldo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Tasa Anual Nominal (%)</label>
                <input
                  type="number"
                  value={catInput.tasa}
                  onChange={(e) => setCatInput({ ...catInput, tasa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Plazo (Meses)</label>
                <input
                  type="number"
                  value={catInput.plazo}
                  onChange={(e) => setCatInput({ ...catInput, plazo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800 mt-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Cuota Mensual Estimada</span>
                <span className="text-xl font-black text-white font-mono mt-0.5 block">{formatMoney(catRes.cuotaMensual, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 block">Total Intereses Pagados</span>
                <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">+{formatMoney(catRes.totalInteresesYCargos, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 block">CAT Real Efectivo</span>
                <span className="text-2xl font-black text-amber-300 font-mono mt-0.5 block">{catRes.catReal}%</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. MSI vs Descuento */}
        {activeCalc === 'msi' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">¿Meses Sin Intereses (MSI) o Descuento de Contado?</h3>
            <p className="text-xs text-slate-400">
              Descubre matemáticamente si te conviene pagar de contado o diferir a meses e invertir el dinero en CETES.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Precio de Lista ($)</label>
                <input
                  type="number"
                  value={msiInput.precio}
                  onChange={(e) => setMsiInput({ ...msiInput, precio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Descuento de Contado (%)</label>
                <input
                  type="number"
                  value={msiInput.desc}
                  onChange={(e) => setMsiInput({ ...msiInput, desc: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Plazo MSI (Meses)</label>
                <input
                  type="number"
                  value={msiInput.meses}
                  onChange={(e) => setMsiInput({ ...msiInput, meses: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Tasa CETES Anual (%)</label>
                <input
                  type="number"
                  value={msiInput.tasaInv}
                  onChange={(e) => setMsiInput({ ...msiInput, tasaInv: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-950/20 border border-emerald-500/40 rounded-xl text-xs text-emerald-300">
              <strong className="text-emerald-400 font-bold block text-sm mb-1">Resultado: ¡Conviene pagar de {msiRes.mejorOpcion}!</strong>
              <p>{msiRes.consejo}</p>
            </div>
          </div>
        )}

        {/* 3. Inyección Extraordinaria */}
        {activeCalc === 'windfall' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Inyección Extraordinaria (Aguinaldo / Bono / Venta)</h3>
            <p className="text-xs text-slate-400">
              Ingresa un monto extra inesperado y el algoritmo distribuirá cada peso para maximizar tu ahorro en intereses.
            </p>

            <div className="max-w-xs">
              <label className="block text-xs text-slate-300 font-semibold mb-1">Monto Extra a Inyectar ($ MXN)</label>
              <input
                type="number"
                step="1000"
                value={windfallInput}
                onChange={(e) => setWindfallInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono font-bold text-emerald-400"
              />
            </div>

            <div className="space-y-2 mt-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">Distribución Óptima Sugerida:</span>
              {windfallRes.asignaciones.map((asig, i) => (
                <div key={i} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-white block">{asig.nombre}</span>
                    <span className="text-[11px] text-slate-400">{asig.razon}</span>
                  </div>
                  <span className="text-emerald-400 font-black font-mono text-sm">
                    +{formatMoney(asig.montoAsignado, 'MXN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Gastos Hormiga */}
        {activeCalc === 'hormiga' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Detector de Fuga de Capital / Gastos Hormiga</h3>
            <p className="text-xs text-slate-400">
              ¿Cuánto te cuesta realmente ese café, botana o estacionamiento diario si en lugar de gastarlo lo invirtieras?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Gasto Diario ($ MXN)</label>
                <input
                  type="number"
                  value={hormigaInput.diario}
                  onChange={(e) => setHormigaInput({ ...hormigaInput, diario: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Días al Mes</label>
                <input
                  type="number"
                  value={hormigaInput.dias}
                  onChange={(e) => setHormigaInput({ ...hormigaInput, dias: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Rendimiento CETES (%)</label>
                <input
                  type="number"
                  value={hormigaInput.tasa}
                  onChange={(e) => setHormigaInput({ ...hormigaInput, tasa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800 mt-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Costo Anual Directo</span>
                <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">{formatMoney(hormigaRes.gastoAnual, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-400 block">Costo en 10 Años (Con CETES)</span>
                <span className="text-xl font-black text-amber-400 font-mono mt-0.5 block">{formatMoney(hormigaRes.costoOportunidad10Anos, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-400 block">Costo en 20 Años (Con CETES)</span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{formatMoney(hormigaRes.costoOportunidad20Anos, 'MXN')}</span>
              </div>
            </div>
          </div>
        )}

        {/* 5. Regla 50/30/20 */}
        {activeCalc === 'rule503020' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Auditoría de Presupuesto 50 / 30 / 20</h3>
            <p className="text-xs text-slate-400">
              Compara la distribución de tu dinero con la regla de oro financiera: 50% Necesidades, 30% Deseos, 20% Ahorro/Deuda.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Ingreso Neto ($)</label>
                <input
                  type="number"
                  value={rule503020Input.neto}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, neto: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Necesidades / Fijos ($)</label>
                <input
                  type="number"
                  value={rule503020Input.necesidades}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, necesidades: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Deseos / Opcionales ($)</label>
                <input
                  type="number"
                  value={rule503020Input.deseos}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, deseos: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Aporte Ahorro/Deuda ($)</label>
                <input
                  type="number"
                  value={rule503020Input.ahorroDeuda}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, ahorroDeuda: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-white block">Necesidades (Meta: 50%)</span>
                <span className="text-xl font-mono font-black text-emerald-400 mt-1 block">{rule503020.actual.pctNecesidades}%</span>
                <span className="text-[11px] text-slate-400">{formatMoney(rule503020.actual.necesidades, 'MXN')} / mes</span>
              </div>
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-white block">Deseos / Opcionales (Meta: 30%)</span>
                <span className="text-xl font-mono font-black text-teal-400 mt-1 block">{rule503020.actual.pctDeseos}%</span>
                <span className="text-[11px] text-slate-400">{formatMoney(rule503020.actual.deseos, 'MXN')} / mes</span>
              </div>
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-xs font-bold text-white block">Ahorro & Deuda (Meta: 20%)</span>
                <span className="text-xl font-mono font-black text-rose-400 mt-1 block">{rule503020.actual.pctAhorroDeuda}%</span>
                <span className="text-[11px] text-slate-400">{formatMoney(rule503020.actual.ahorroDeuda, 'MXN')} / mes</span>
              </div>
            </div>
          </div>
        )}

        {/* 6. Refinanciamiento */}
        {activeCalc === 'refinance' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Calculadora de Refinanciamiento / Consolidación</h3>
            <p className="text-xs text-slate-400">
              Evalúa si te conviene transferir la deuda de una tarjeta cara (ej. 49%) a un crédito personal al 18%.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Saldo a Consolidar ($)</label>
                <input
                  type="number"
                  value={refinanceInput.saldo}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, saldo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Tasa Actual (%)</label>
                <input
                  type="number"
                  value={refinanceInput.tasaVieja}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, tasaVieja: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Nueva Tasa Consolidada (%)</label>
                <input
                  type="number"
                  value={refinanceInput.tasaNueva}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, tasaNueva: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Plazo (Meses)</label>
                <input
                  type="number"
                  value={refinanceInput.plazo}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, plazo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-emerald-400 block text-sm">
                  ¡Ahorro total estimado en intereses: {formatMoney(refinanceRes.ahorroTotalIntereses, 'MXN')} ({refinanceRes.porcentajeAhorro}%)!
                </span>
                <span className="text-slate-300">
                  Tu mensualidad baja de {formatMoney(refinanceRes.cuotaVieja, 'MXN')} a {formatMoney(refinanceRes.cuotaNueva, 'MXN')} (ahorras {formatMoney(refinanceRes.reduccionCuotaMensual, 'MXN')} al mes).
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 7. Retiro FIRE */}
        {activeCalc === 'fire' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Calculadora de Libertad Financiera & Retiro (FIRE)</h3>
            <p className="text-xs text-slate-400">
              Descubre tu número objetivo de libertad financiera y a qué edad puedes dejar de trabajar por necesidad.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Gastos Anuales ($)</label>
                <input
                  type="number"
                  value={fireInput.gastosAnuales}
                  onChange={(e) => setFireInput({ ...fireInput, gastosAnuales: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Patrimonio Actual ($)</label>
                <input
                  type="number"
                  value={fireInput.patrimonio}
                  onChange={(e) => setFireInput({ ...fireInput, patrimonio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Ahorro Mensual ($)</label>
                <input
                  type="number"
                  value={fireInput.ahorro}
                  onChange={(e) => setFireInput({ ...fireInput, ahorro: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Rendimiento Anual (%)</label>
                <input
                  type="number"
                  value={fireInput.tasa}
                  onChange={(e) => setFireInput({ ...fireInput, tasa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800 mt-4">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tu Número FIRE (Regla del 4%)</span>
                <span className="text-2xl font-black text-emerald-400 font-mono mt-0.5 block">{formatMoney(fireRes.numeroFIRE, 'MXN')}</span>
                <span className="text-[11px] text-slate-400">Meta estimada con una tasa de retiro del 4%</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400 block">Años para Alcanzar el Retiro</span>
                {Number(fireInput.gastosAnuales) <= 0 ? (
                  <span className="text-sm text-slate-300 mt-1 block">Completa los datos del escenario</span>
                ) : fireRes.anosParaRetiro === 99 ? (
                  <span className="text-sm text-slate-300 mt-1 block">Sin proyección con estos aportes y rendimiento</span>
                ) : (
                  <span className="text-2xl font-black text-teal-300 font-mono mt-0.5 block">{fireRes.anosParaRetiro >= 50 ? '50 años o más' : `${fireRes.anosParaRetiro} años`}</span>
                )}
                <span className="text-[11px] text-slate-400">Manteniendo tu ritmo de ahorro e inversión</span>
              </div>
            </div>
          </div>
        )}

        {/* 8. Horas de Trabajo */}
        {activeCalc === 'horas' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Calculadora: Costo Real en Horas de Vida Laboral</h3>
            <p className="text-xs text-slate-400">
              ¿Cuántas horas o días de trabajo te cuesta comprar un artículo o pagar el interés de una tarjeta?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Ingreso Neto Mensual ($)</label>
                <input
                  type="number"
                  value={horasInput.neto}
                  onChange={(e) => setHorasInput({ ...horasInput, neto: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Horas Trabajadas al Mes</label>
                <input
                  type="number"
                  value={horasInput.horas}
                  onChange={(e) => setHorasInput({ ...horasInput, horas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Precio del Gasto ($ MXN)</label>
                <input
                  type="number"
                  value={horasInput.precio}
                  onChange={(e) => setHorasInput({ ...horasInput, precio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <span className="font-bold text-white block text-sm">
                Ganas <strong className="text-emerald-400">${horasRes.ingresoPorHora} MXN por hora</strong>.
              </span>
              <p className="text-slate-300 mt-1">
                Comprar ese artículo de {formatMoney(horasInput.precio, 'MXN')} te cuesta exactamente <strong className="text-amber-400 font-bold">{horasRes.horasNecesarias} horas de tu vida</strong> ({horasRes.diasLaborales} días completos de trabajo).
              </p>
            </div>
          </div>
        )}

        {/* 9. Renta vs Compra */}
        {activeCalc === 'rentVsBuy' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Renta vs Compra de Vivienda (Análisis a 20 Años)</h3>
            <p className="text-xs text-slate-400">
              Compara el costo de rentar e invertir la diferencia frente a pagar una hipoteca bancaria.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Renta Mensual Actual ($)</label>
                <input
                  type="number"
                  value={rentVsBuyInput.renta}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, renta: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Precio de la Casa ($)</label>
                <input
                  type="number"
                  value={rentVsBuyInput.precio}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, precio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Enganche Requerido (%)</label>
                <input
                  type="number"
                  value={rentVsBuyInput.enganchePct}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, enganchePct: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Tasa Hipotecaria (%)</label>
                <input
                  type="number"
                  value={rentVsBuyInput.tasaHip}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, tasaHip: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
              <span className="font-bold text-white block text-sm">
                Enganche necesario: {formatMoney(rentBuyRes.engancheRequerido, 'MXN')} · Mensualidad hipoteca: {formatMoney(rentBuyRes.mensualidadHipoteca, 'MXN')}
              </span>
              <p className="text-slate-300 mt-1">{rentBuyRes.consejo}</p>
            </div>
          </div>
        )}

        {/* 10. Rendimiento Real */}
        {activeCalc === 'realYield' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Rendimiento Real Neto (CETES / Sofipos vs Inflación)</h3>
            <p className="text-xs text-slate-400">
              ¿Tu dinero realmente está creciendo o la inflación y la retención del SAT se lo comen?
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Tasa Nominal Anual (%)</label>
                <input
                  type="number"
                  value={realYieldInput.nominal}
                  onChange={(e) => setRealYieldInput({ ...realYieldInput, nominal: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Inflación Estimada (%)</label>
                <input
                  type="number"
                  value={realYieldInput.inflacion}
                  onChange={(e) => setRealYieldInput({ ...realYieldInput, inflacion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Retención ISR SAT (%)</label>
                <input
                  type="number"
                  value={realYieldInput.isr}
                  onChange={(e) => setRealYieldInput({ ...realYieldInput, isr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 text-xs flex items-center justify-between">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Rendimiento Real Neto Anual</span>
                <span className={`text-2xl font-black font-mono ${realYieldRes.leGanaALaInflacion ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {realYieldRes.rendimientoRealNeto}%
                </span>
              </div>
              <span className="text-xs text-slate-300">
                {realYieldRes.leGanaALaInflacion ? '✅ Tu poder adquisitivo CRECE por encima de la inflación.' : '⚠️ Tu dinero PIERDE poder de compra.'}
              </span>
            </div>
          </div>
        )}

        {/* 11. Deducciones SAT */}
        {activeCalc === 'deductions' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Estimador de Deducciones Personales & Devolución Anual SAT</h3>
            <p className="text-xs text-slate-400">
              Calcula cuánto saldo a favor puedes reclamarle al SAT en tu declaración anual de abril.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Gastos Médicos / Dentales ($)</label>
                <input
                  type="number"
                  value={deductionsInput.medicos}
                  onChange={(e) => setDeductionsInput({ ...deductionsInput, medicos: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Aportaciones a PPR / Retiro ($)</label>
                <input
                  type="number"
                  value={deductionsInput.ppr}
                  onChange={(e) => setDeductionsInput({ ...deductionsInput, ppr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Colegiaturas Deducibles ($)</label>
                <input
                  type="number"
                  value={deductionsInput.colegiaturas}
                  onChange={(e) => setDeductionsInput({ ...deductionsInput, colegiaturas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-emerald-950/30 border border-emerald-500/40 rounded-xl flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-emerald-400 text-sm block">Devolución Estimada a Tu Favor: {formatMoney(deductionsRes.devolucionEstimadaSAT, 'MXN')}</span>
                <span className="text-slate-300">Con un total deducible de {formatMoney(deductionsRes.totalDeducciones, 'MXN')} facturado con CFDI.</span>
              </div>
            </div>
          </div>
        )}

        {/* 12. RESICO vs PFAE */}
        {activeCalc === 'resico' && (
          <div className="space-y-4">
            <h3 className="text-lg font-black text-white">Comparativa Fiscal: RESICO vs Personas Físicas (PFAE)</h3>
            <p className="text-xs text-slate-400">
              Compara si tu actividad profesional pagaría menos impuestos cambiándote a RESICO (1% - 2.5%).
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Facturación Anual sin IVA ($)</label>
                <input
                  type="number"
                  value={resicoInput.facturacion}
                  onChange={(e) => setResicoInput({ ...resicoInput, facturacion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 font-semibold mb-1">Gastos Deducibles con Factura ($)</label>
                <input
                  type="number"
                  value={resicoInput.gastos}
                  onChange={(e) => setResicoInput({ ...resicoInput, gastos: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-950/80 rounded-xl border border-slate-800 mt-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">ISR Anual en RESICO</span>
                <span className="text-xl font-black text-emerald-400 font-mono mt-0.5 block">{formatMoney(resicoRes.isrResico, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400 block">ISR Anual en PFAE</span>
                <span className="text-xl font-black text-rose-400 font-mono mt-0.5 block">{formatMoney(resicoRes.isrPfae, 'MXN')}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-400 block">Ahorro Potencial</span>
                <span className="text-xl font-black text-teal-300 font-mono mt-0.5 block">{formatMoney(resicoRes.ahorroEstimadoConResico, 'MXN')}</span>
              </div>
            </div>
          </div>
        )}

      </div>

      </>}
    </div>
  );
}

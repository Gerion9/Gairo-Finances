import React, { useEffect, useId, useRef, useState } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
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
  FileText,
  Search,
  X
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
import './FinancialCalculatorsHub.css';

const CALCULATORS = [
  { id: 'cat', title: 'CAT y costo total', description: 'Estima el costo anual total de un crédito a partir del saldo, tasa y plazo.', hint: 'El costo de tu crédito', group: 'Créditos y compras', icon: Percent },
  { id: 'msi', title: 'Meses sin intereses', description: 'Compara pagar con descuento o a meses sin intereses e invertir el dinero.', hint: 'MSI o descuento de contado', group: 'Créditos y compras', icon: Sparkles },
  { id: 'refinance', title: 'Refinanciamiento', description: 'Compara tasas y pagos antes de consolidar un crédito.', hint: 'Compara tasas y pagos', group: 'Créditos y compras', icon: RefreshCw },
  { id: 'horas', title: 'Compras en horas de trabajo', description: 'Convierte el precio de una compra en las horas de trabajo necesarias para pagarla.', hint: 'El tiempo que cuesta comprar', group: 'Créditos y compras', icon: Briefcase },
  { id: 'rentVsBuy', title: 'Rentar o comprar', description: 'Compara rentar e invertir la diferencia con comprar una vivienda, a un horizonte de 20 años.', hint: 'Compara opciones de vivienda', group: 'Créditos y compras', icon: Home },
  { id: 'windfall', title: 'Aguinaldo y bonos', description: 'Explora cómo repartir un ingreso extraordinario entre tus deudas.', hint: 'Dale un destino al dinero extra', group: 'Presupuesto y ahorro', icon: Layers },
  { id: 'hormiga', title: 'Gastos hormiga', description: 'Proyecta el costo de tus gastos pequeños y lo que podrían generar si los ahorras.', hint: 'El impacto de los gastos diarios', group: 'Presupuesto y ahorro', icon: Coffee },
  { id: 'rule503020', title: 'Regla 50 / 30 / 20', description: 'Compara tu presupuesto con una distribución de 50% necesidades, 30% deseos y 20% ahorro o deuda.', hint: 'Revisa cómo distribuyes tu ingreso', group: 'Presupuesto y ahorro', icon: PieChart },
  { id: 'fire', title: 'Retiro y libertad financiera', description: 'Estima tu meta de patrimonio y el tiempo para alcanzarla con tus aportaciones.', hint: 'Proyecta tu objetivo FIRE', group: 'Inversión y retiro', icon: TrendingUp },
  { id: 'realYield', title: 'Rendimiento real', description: 'Revisa el rendimiento de una inversión después de inflación e impuestos.', hint: 'Lo que gana tu dinero', group: 'Inversión y retiro', icon: Percent },
  { id: 'deductions', title: 'Deducciones personales', description: 'Estima el efecto de tus deducciones personales sobre tu declaración anual.', hint: 'Revisa tu escenario ante el SAT', group: 'Impuestos', icon: FileText },
  { id: 'resico', title: 'RESICO o actividad profesional', description: 'Compara el ISR de ambos regímenes con tu facturación y gastos deducibles.', hint: 'Compara regímenes fiscales', group: 'Impuestos', icon: ShieldCheck },
];
const CALCULATOR_GROUPS = [...new Set(CALCULATORS.map(calculator => calculator.group))];
const normalizeSearch = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-MX').trim();

export default function FinancialCalculatorsHub({ financialData = {}, exchangeRate, initialCalculator = 'cat', onNavigateTab }) {
  const cashFlow = calculateCashFlow(financialData, exchangeRate);
  const annualIncome = cashFlow.fiscal.importeFacturado * 12;
  const validCalculators = ['cat', 'msi', 'windfall', 'hormiga', 'rule503020', 'refinance', 'fire', 'horas', 'rentVsBuy', 'realYield', 'deductions', 'resico'];
  const [activeCalc, setActiveCalc] = useState(validCalculators.includes(initialCalculator) ? initialCalculator : 'cat');
  useEffect(() => { setActiveCalc(validCalculators.includes(initialCalculator) ? initialCalculator : 'cat'); }, [initialCalculator]);
  const [search, setSearch] = useState('');
  const fieldPrefix = useId();
  const searchRef = useRef(null);
  const listRef = useRef(null);
  const activeOptionRef = useRef(null);
  const animation = useAnimationControls();
  const reducedMotion = useReducedMotion();
  const selectedCalculator = CALCULATORS.find(calculator => calculator.id === activeCalc);
  const SelectedIcon = selectedCalculator.icon;
  const searchTerms = normalizeSearch(search).split(/\s+/).filter(Boolean);
  const visibleCalculators = CALCULATORS.filter(calculator => searchTerms.every(term =>
    normalizeSearch(`${calculator.title} ${calculator.description} ${calculator.hint} ${calculator.group}`).includes(term)));
  const selectCalculator = id => {
    if (!validCalculators.includes(id)) return;
    setActiveCalc(id);
    onNavigateTab?.('calculators', { calculator: id, preserveScroll: true });
  };
  useEffect(() => {
    animation.start({ opacity: [0.7, 1], transition: { duration: reducedMotion ? 0 : 0.18, ease: 'easeOut' } });
    return () => animation.stop();
  }, [activeCalc, animation, reducedMotion]);
  useEffect(() => {
    const list = listRef.current;
    const option = activeOptionRef.current;
    if (!list || !option || !list.clientHeight) return;
    const offset = option.getBoundingClientRect().top - list.getBoundingClientRect().top;
    if (offset < 0 || offset + option.offsetHeight > list.clientHeight) {
      list.scrollTop += offset - (list.clientHeight - option.offsetHeight) / 2;
    }
  }, [activeCalc, search]);

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
  return (
    <div className="sf-calculators">
      <header className="sf-calculators-heading">
        <span className="sf-calculators-eyebrow"><Calculator size={17} aria-hidden="true" /> Explora escenarios</span>
        <h1>Calculadoras</h1>
        <p>Compara créditos, compras, ahorro e impuestos con tus propios datos.</p>
      </header>

      <div className="sf-calculators-layout">
        <aside className="sf-calculators-catalog" aria-label="Elegir calculadora">
          <div className="sf-calculators-catalog-heading"><strong>¿Qué quieres calcular?</strong><span>{CALCULATORS.length} herramientas</span></div>
          <div className="sf-calculators-search">
            <Search size={18} aria-hidden="true" />
            <label htmlFor={`${fieldPrefix}-search`} className="sr-only">Buscar calculadora por tema u objetivo</label>
            <input id={`${fieldPrefix}-search`} ref={searchRef} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Busca por tema u objetivo" />
            {search && <button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }} aria-label="Limpiar búsqueda de calculadoras"><X size={16} aria-hidden="true" /></button>}
          </div>
          {search && <p className="sf-calculators-result-count" role="status">{visibleCalculators.length} {visibleCalculators.length === 1 ? 'calculadora disponible' : 'calculadoras disponibles'}</p>}

          <div className="sf-calculators-mobile-selector">
            <label htmlFor={`${fieldPrefix}-select`}>Calculadora</label>
            <select id={`${fieldPrefix}-select`} value={activeCalc} onChange={event => selectCalculator(event.target.value)} aria-describedby={`${fieldPrefix}-description`}>
              {!visibleCalculators.some(calculator => calculator.id === activeCalc) && <optgroup label="Calculadora actual"><option value={activeCalc}>{selectedCalculator.title}</option></optgroup>}
              {CALCULATOR_GROUPS.map(group => {
                const groupItems = visibleCalculators.filter(calculator => calculator.group === group);
                return groupItems.length > 0 && <optgroup key={group} label={group}>{groupItems.map(calculator => <option key={calculator.id} value={calculator.id}>{calculator.title}</option>)}</optgroup>;
              })}
            </select>
          </div>

          <nav className="sf-calculators-options" ref={listRef} aria-label="Calculadoras por objetivo">
            {CALCULATOR_GROUPS.map((group, index) => {
              const groupItems = visibleCalculators.filter(calculator => calculator.group === group);
              return groupItems.length > 0 && <section key={group} aria-labelledby={`${fieldPrefix}-group-${index}`}>
                <h2 id={`${fieldPrefix}-group-${index}`}>{group}</h2>
                {groupItems.map(calculator => {
                  const Icon = calculator.icon;
                  const isActive = activeCalc === calculator.id;
                  return <motion.button type="button" key={calculator.id} ref={isActive ? activeOptionRef : undefined} className={isActive ? 'is-active' : ''} onClick={() => selectCalculator(calculator.id)} aria-current={isActive ? 'page' : undefined} whileTap={{ scale: 0.99 }}>
                    <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span><strong>{calculator.title}</strong><small>{calculator.hint}</small></span>
                  </motion.button>;
                })}
              </section>;
            })}
          </nav>
          {visibleCalculators.length === 0 && <div className="sf-calculators-empty"><p>No encontramos coincidencias. Prueba con “crédito”, “ahorro” o “impuestos”.</p><button type="button" onClick={() => { setSearch(''); searchRef.current?.focus(); }}>Ver las 12 calculadoras</button></div>}
        </aside>

        <motion.section className="sf-calculators-workspace" aria-labelledby={`${fieldPrefix}-title`} initial={false} animate={animation}>
          <header className="sf-calculators-tool-heading"><span className="sf-calculators-tool-icon"><SelectedIcon size={24} strokeWidth={1.6} aria-hidden="true" /></span><div><span className="sf-calculators-tool-group">{selectedCalculator.group}</span><h2 id={`${fieldPrefix}-title`}>{selectedCalculator.title}</h2><p id={`${fieldPrefix}-description`}>{selectedCalculator.description}</p></div></header>
          {contextIncomplete ? <div className="sf-calculators-incomplete"><h3>Faltan datos para este cálculo</h3><p>Completa tus pagos y tasas contractuales para las proyecciones de deuda. Los cálculos fiscales requieren facturación y retenciones; tu ingreso recibido no sustituye esos datos.</p></div> : <div className="sf-calculators-input-panel">
        
        {/* 1. CAT Real */}
        {activeCalc === 'cat' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-catInput-saldo`} className="block text-xs text-slate-300 font-semibold mb-1">Monto / Saldo ($)</label>
                <input id={`${fieldPrefix}-catInput-saldo`}
                  type="number"
                  value={catInput.saldo}
                  onChange={(e) => setCatInput({ ...catInput, saldo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-catInput-tasa`} className="block text-xs text-slate-300 font-semibold mb-1">Tasa Anual Nominal (%)</label>
                <input id={`${fieldPrefix}-catInput-tasa`}
                  type="number"
                  value={catInput.tasa}
                  onChange={(e) => setCatInput({ ...catInput, tasa: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-catInput-plazo`} className="block text-xs text-slate-300 font-semibold mb-1">Plazo (Meses)</label>
                <input id={`${fieldPrefix}-catInput-plazo`}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-msiInput-precio`} className="block text-xs text-slate-300 font-semibold mb-1">Precio de Lista ($)</label>
                <input id={`${fieldPrefix}-msiInput-precio`}
                  type="number"
                  value={msiInput.precio}
                  onChange={(e) => setMsiInput({ ...msiInput, precio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-msiInput-desc`} className="block text-xs text-slate-300 font-semibold mb-1">Descuento de Contado (%)</label>
                <input id={`${fieldPrefix}-msiInput-desc`}
                  type="number"
                  value={msiInput.desc}
                  onChange={(e) => setMsiInput({ ...msiInput, desc: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-msiInput-meses`} className="block text-xs text-slate-300 font-semibold mb-1">Plazo MSI (Meses)</label>
                <input id={`${fieldPrefix}-msiInput-meses`}
                  type="number"
                  value={msiInput.meses}
                  onChange={(e) => setMsiInput({ ...msiInput, meses: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-msiInput-tasaInv`} className="block text-xs text-slate-300 font-semibold mb-1">Tasa CETES Anual (%)</label>
                <input id={`${fieldPrefix}-msiInput-tasaInv`}
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
            <div className="max-w-xs">
              <label htmlFor={`${fieldPrefix}-windfallInput`} className="block text-xs text-slate-300 font-semibold mb-1">Monto Extra a Inyectar ($ MXN)</label>
              <input id={`${fieldPrefix}-windfallInput`}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-hormigaInput-diario`} className="block text-xs text-slate-300 font-semibold mb-1">Gasto Diario ($ MXN)</label>
                <input id={`${fieldPrefix}-hormigaInput-diario`}
                  type="number"
                  value={hormigaInput.diario}
                  onChange={(e) => setHormigaInput({ ...hormigaInput, diario: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-hormigaInput-dias`} className="block text-xs text-slate-300 font-semibold mb-1">Días al Mes</label>
                <input id={`${fieldPrefix}-hormigaInput-dias`}
                  type="number"
                  value={hormigaInput.dias}
                  onChange={(e) => setHormigaInput({ ...hormigaInput, dias: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-hormigaInput-tasa`} className="block text-xs text-slate-300 font-semibold mb-1">Rendimiento CETES (%)</label>
                <input id={`${fieldPrefix}-hormigaInput-tasa`}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-rule503020Input-neto`} className="block text-xs text-slate-300 font-semibold mb-1">Ingreso Neto ($)</label>
                <input id={`${fieldPrefix}-rule503020Input-neto`}
                  type="number"
                  value={rule503020Input.neto}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, neto: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rule503020Input-necesidades`} className="block text-xs text-slate-300 font-semibold mb-1">Necesidades / Fijos ($)</label>
                <input id={`${fieldPrefix}-rule503020Input-necesidades`}
                  type="number"
                  value={rule503020Input.necesidades}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, necesidades: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rule503020Input-deseos`} className="block text-xs text-slate-300 font-semibold mb-1">Deseos / Opcionales ($)</label>
                <input id={`${fieldPrefix}-rule503020Input-deseos`}
                  type="number"
                  value={rule503020Input.deseos}
                  onChange={(e) => setRule503020Input({ ...rule503020Input, deseos: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rule503020Input-ahorroDeuda`} className="block text-xs text-slate-300 font-semibold mb-1">Aporte Ahorro/Deuda ($)</label>
                <input id={`${fieldPrefix}-rule503020Input-ahorroDeuda`}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-refinanceInput-saldo`} className="block text-xs text-slate-300 font-semibold mb-1">Saldo a Consolidar ($)</label>
                <input id={`${fieldPrefix}-refinanceInput-saldo`}
                  type="number"
                  value={refinanceInput.saldo}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, saldo: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-refinanceInput-tasaVieja`} className="block text-xs text-slate-300 font-semibold mb-1">Tasa Actual (%)</label>
                <input id={`${fieldPrefix}-refinanceInput-tasaVieja`}
                  type="number"
                  value={refinanceInput.tasaVieja}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, tasaVieja: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-refinanceInput-tasaNueva`} className="block text-xs text-slate-300 font-semibold mb-1">Nueva Tasa Consolidada (%)</label>
                <input id={`${fieldPrefix}-refinanceInput-tasaNueva`}
                  type="number"
                  value={refinanceInput.tasaNueva}
                  onChange={(e) => setRefinanceInput({ ...refinanceInput, tasaNueva: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-refinanceInput-plazo`} className="block text-xs text-slate-300 font-semibold mb-1">Plazo (Meses)</label>
                <input id={`${fieldPrefix}-refinanceInput-plazo`}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-fireInput-gastosAnuales`} className="block text-xs text-slate-300 font-semibold mb-1">Gastos Anuales ($)</label>
                <input id={`${fieldPrefix}-fireInput-gastosAnuales`}
                  type="number"
                  value={fireInput.gastosAnuales}
                  onChange={(e) => setFireInput({ ...fireInput, gastosAnuales: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-fireInput-patrimonio`} className="block text-xs text-slate-300 font-semibold mb-1">Patrimonio Actual ($)</label>
                <input id={`${fieldPrefix}-fireInput-patrimonio`}
                  type="number"
                  value={fireInput.patrimonio}
                  onChange={(e) => setFireInput({ ...fireInput, patrimonio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-fireInput-ahorro`} className="block text-xs text-slate-300 font-semibold mb-1">Ahorro Mensual ($)</label>
                <input id={`${fieldPrefix}-fireInput-ahorro`}
                  type="number"
                  value={fireInput.ahorro}
                  onChange={(e) => setFireInput({ ...fireInput, ahorro: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-fireInput-tasa`} className="block text-xs text-slate-300 font-semibold mb-1">Rendimiento Anual (%)</label>
                <input id={`${fieldPrefix}-fireInput-tasa`}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-horasInput-neto`} className="block text-xs text-slate-300 font-semibold mb-1">Ingreso Neto Mensual ($)</label>
                <input id={`${fieldPrefix}-horasInput-neto`}
                  type="number"
                  value={horasInput.neto}
                  onChange={(e) => setHorasInput({ ...horasInput, neto: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-horasInput-horas`} className="block text-xs text-slate-300 font-semibold mb-1">Horas Trabajadas al Mes</label>
                <input id={`${fieldPrefix}-horasInput-horas`}
                  type="number"
                  value={horasInput.horas}
                  onChange={(e) => setHorasInput({ ...horasInput, horas: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-horasInput-precio`} className="block text-xs text-slate-300 font-semibold mb-1">Precio del Gasto ($ MXN)</label>
                <input id={`${fieldPrefix}-horasInput-precio`}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-rentVsBuyInput-renta`} className="block text-xs text-slate-300 font-semibold mb-1">Renta Mensual Actual ($)</label>
                <input id={`${fieldPrefix}-rentVsBuyInput-renta`}
                  type="number"
                  value={rentVsBuyInput.renta}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, renta: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rentVsBuyInput-precio`} className="block text-xs text-slate-300 font-semibold mb-1">Precio de la Casa ($)</label>
                <input id={`${fieldPrefix}-rentVsBuyInput-precio`}
                  type="number"
                  value={rentVsBuyInput.precio}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, precio: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rentVsBuyInput-enganchePct`} className="block text-xs text-slate-300 font-semibold mb-1">Enganche Requerido (%)</label>
                <input id={`${fieldPrefix}-rentVsBuyInput-enganchePct`}
                  type="number"
                  value={rentVsBuyInput.enganchePct}
                  onChange={(e) => setRentVsBuyInput({ ...rentVsBuyInput, enganchePct: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-rentVsBuyInput-tasaHip`} className="block text-xs text-slate-300 font-semibold mb-1">Tasa Hipotecaria (%)</label>
                <input id={`${fieldPrefix}-rentVsBuyInput-tasaHip`}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-realYieldInput-nominal`} className="block text-xs text-slate-300 font-semibold mb-1">Tasa Nominal Anual (%)</label>
                <input id={`${fieldPrefix}-realYieldInput-nominal`}
                  type="number"
                  value={realYieldInput.nominal}
                  onChange={(e) => setRealYieldInput({ ...realYieldInput, nominal: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-realYieldInput-inflacion`} className="block text-xs text-slate-300 font-semibold mb-1">Inflación Estimada (%)</label>
                <input id={`${fieldPrefix}-realYieldInput-inflacion`}
                  type="number"
                  value={realYieldInput.inflacion}
                  onChange={(e) => setRealYieldInput({ ...realYieldInput, inflacion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-realYieldInput-isr`} className="block text-xs text-slate-300 font-semibold mb-1">Retención ISR SAT (%)</label>
                <input id={`${fieldPrefix}-realYieldInput-isr`}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-deductionsInput-medicos`} className="block text-xs text-slate-300 font-semibold mb-1">Gastos Médicos / Dentales ($)</label>
                <input id={`${fieldPrefix}-deductionsInput-medicos`}
                  type="number"
                  value={deductionsInput.medicos}
                  onChange={(e) => setDeductionsInput({ ...deductionsInput, medicos: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-deductionsInput-ppr`} className="block text-xs text-slate-300 font-semibold mb-1">Aportaciones a PPR / Retiro ($)</label>
                <input id={`${fieldPrefix}-deductionsInput-ppr`}
                  type="number"
                  value={deductionsInput.ppr}
                  onChange={(e) => setDeductionsInput({ ...deductionsInput, ppr: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-deductionsInput-colegiaturas`} className="block text-xs text-slate-300 font-semibold mb-1">Colegiaturas Deducibles ($)</label>
                <input id={`${fieldPrefix}-deductionsInput-colegiaturas`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label htmlFor={`${fieldPrefix}-resicoInput-facturacion`} className="block text-xs text-slate-300 font-semibold mb-1">Facturación Anual sin IVA ($)</label>
                <input id={`${fieldPrefix}-resicoInput-facturacion`}
                  type="number"
                  value={resicoInput.facturacion}
                  onChange={(e) => setResicoInput({ ...resicoInput, facturacion: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white font-mono"
                />
              </div>
              <div>
                <label htmlFor={`${fieldPrefix}-resicoInput-gastos`} className="block text-xs text-slate-300 font-semibold mb-1">Gastos Deducibles con Factura ($)</label>
                <input id={`${fieldPrefix}-resicoInput-gastos`}
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

          </div>}
        </motion.section>
      </div>
    </div>
  );
}

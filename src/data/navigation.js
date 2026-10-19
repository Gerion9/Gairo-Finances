import {
  Activity, ArrowDownLeft, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined,
  FileText, Grid2X2, Landmark, Layers3, LayoutDashboard, ListFilter, PieChart,
  Sparkles, TrendingUp, Trophy, WalletCards, WandSparkles,
} from 'lucide-react';

// Shared route vocabulary for the sidebar, mobile navigation, contextual hubs and command menu.
export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Resumen', description: 'Consulta tus saldos, próximos pagos y prioridades', group: 'Panorama y plan', icon: LayoutDashboard },
  { id: 'plan', label: 'Plan de pagos', description: 'Organiza tus pagos y revisa cuánto puedes destinar a cada deuda', group: 'Panorama y plan', icon: ChartNoAxesCombined },
  { id: 'debts', label: 'Deudas y créditos', description: 'Tarjetas, préstamos y estrategias para liquidarlos', group: 'Panorama y plan', icon: Layers3 },
  { id: 'calendar', label: 'Calendario', description: 'Fechas límite, vencimientos y flujo por quincena', group: 'Panorama y plan', icon: CalendarDays },

  { id: 'transactions', label: 'Movimientos', description: 'Registro de ingresos, gastos y compras recientes', group: 'Flujo y cuentas', icon: ListFilter },
  { id: 'budget', label: 'Presupuesto', description: 'Organiza tus ingresos, gastos fijos y margen disponible cada mes', group: 'Flujo y cuentas', icon: PieChart },
  { id: 'statements', label: 'Estados de cuenta', description: 'Importa, revisa y analiza tus movimientos bancarios', group: 'Flujo y cuentas', icon: FileText },

  { id: 'balance', label: 'Patrimonio', description: 'Revisa lo que tienes, lo que debes y tu patrimonio neto', group: 'Patrimonio y futuro', icon: WalletCards },
  { id: 'investments', label: 'Ahorro e inversión', description: 'Efectivo frente a gastos, simulación de ahorro y referencia CETES', group: 'Patrimonio y futuro', icon: TrendingUp },
  { id: 'simulator', label: 'Simulador', description: 'Explora qué cambia si abonas más o ajustas tus metas', group: 'Panorama y plan', icon: WandSparkles },
  { id: 'health', label: 'Salud financiera', description: 'Indicadores clave y diagnóstico integral de tus finanzas', group: 'Patrimonio y futuro', icon: Activity },

  { id: 'tools', label: 'Herramientas', description: 'Encuentra todas tus herramientas y elige qué quieres hacer', group: 'Copiloto y herramientas', icon: Grid2X2 },
  { id: 'credit-library', label: 'Explorar productos financieros', description: 'Consulta tarjetas, préstamos y opciones de ahorro con sus fuentes y condiciones', group: 'Copiloto y herramientas', icon: WalletCards },
  { id: 'assistant', label: 'Asistente IA', description: 'Haz preguntas sobre tus finanzas y explora tus opciones', group: 'Copiloto y herramientas', icon: Sparkles, accent: 'ai' },
  { id: 'calculators', label: 'Calculadoras', description: 'CAT, MSI, regla 50/30/20, retiro FIRE y excedentes', group: 'Copiloto y herramientas', icon: Calculator },
  { id: 'tax-annual', label: 'Declaración anual', description: 'Simula tu ISR anual y revisa tus deducciones personales', group: 'Copiloto y herramientas', icon: Landmark },
  { id: 'diagnostics', label: 'Buró y crédito', description: 'Consulta tu checklist crediticio y opciones para negociar con tu banco', group: 'Copiloto y herramientas', icon: BookOpen },
  { id: 'education', label: 'Retos y hábitos', description: 'Construye hábitos de ahorro con retos y un glosario financiero', group: 'Copiloto y herramientas', icon: Trophy },
  { id: 'report', label: 'Reporte financiero', description: 'Prepara un resumen para imprimir o guardar en PDF', group: 'Patrimonio y futuro', icon: ChartNoAxesCombined },
];

export const NAVIGATION_GROUPS = [...new Set(NAVIGATION_ITEMS.map(item => item.group))];

export const NAVIGATION_SHORTCUTS = [
  { id: 'expected-income', label: 'Cobros esperados', description: 'Sigue lo pendiente y vincula ingresos cuando se reciban', keywords: 'cobro cobrar me deben factura pago parcial', tab: 'transactions', options: { view: 'expected' }, group: 'Acciones rápidas', goal: 'organize', icon: ArrowDownLeft },
  { id: 'compare-savings', label: 'Comparar opciones de ahorro', description: 'Consulta rendimientos, requisitos y costos de ahorro', keywords: 'ahorro cajitas cuenta remunerada CETES', tab: 'credit-library', options: { view: 'savings' }, group: 'Acciones rápidas', goal: 'grow', icon: TrendingUp },
  { id: 'choose-card', label: 'Qué tarjeta usar', description: 'Compara beneficios para una compra con las tarjetas que tienes', tab: 'credit-library', options: { view: 'purchase' }, group: 'Acciones rápidas', goal: 'decide', icon: WalletCards },
];

export const CREDIT_LIBRARY_VIEWS = ['cards', 'loans', 'savings', 'purchase'];
export const TRANSACTION_VIEWS = ['registered', 'expected'];
const PLAN_PANEL_IDS = ['overview', 'accounts', 'calendar', 'monthly', 'analysis', 'savings', 'transfers', 'data'];

export function parseNavigationRoute(hash = '') {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const params = new URLSearchParams(query);
  return {
    tab: NAVIGATION_ITEMS.some(item => item.id === path) ? path : 'dashboard',
    calculator: params.get('tool') || 'cat',
    panel: PLAN_PANEL_IDS.includes(params.get('panel')) ? params.get('panel') : 'overview',
    view: path === 'transactions'
      ? (TRANSACTION_VIEWS.includes(params.get('view')) ? params.get('view') : 'registered')
      : (CREDIT_LIBRARY_VIEWS.includes(params.get('view')) ? params.get('view') : 'cards'),
  };
}

export function buildNavigationHash(tab, options = {}) {
  if (!NAVIGATION_ITEMS.some(item => item.id === tab)) return null;
  const params = new URLSearchParams();
  if (tab === 'calculators') params.set('tool', options.calculator || 'cat');
  if (tab === 'plan' && PLAN_PANEL_IDS.includes(options.panel) && options.panel !== 'overview') params.set('panel', options.panel);
  if (tab === 'credit-library' && CREDIT_LIBRARY_VIEWS.includes(options.view)) params.set('view', options.view);
  if (tab === 'transactions' && TRANSACTION_VIEWS.includes(options.view)) params.set('view', options.view);
  const query = params.toString();
  return `#${tab}${query ? `?${query}` : ''}`;
}

const primaryHints = {
  dashboard: 'Tu panorama de hoy',
  plan: 'Deudas y fechas clave',
  transactions: 'Ingresos y gastos',
  budget: 'Tu dinero, mes a mes',
  balance: 'Activos, ahorros y deudas',
  tools: 'Todo lo que puedes hacer',
};

export const PRIMARY_NAVIGATION = ['dashboard', 'plan', 'transactions', 'budget', 'balance', 'tools']
  .map(id => ({ ...NAVIGATION_ITEMS.find(item => item.id === id), hint: primaryHints[id] }));

export const NAVIGATION_HUBS = [
  {
    id: 'debt-plan',
    title: 'Estrategia de deuda y pagos',
    tabs: ['plan', 'debts', 'calendar', 'simulator'],
  },
  {
    id: 'cashflow',
    title: 'Flujo de efectivo y cuentas',
    tabs: ['transactions', 'statements'],
  },
  {
    id: 'wealth',
    title: 'Patrimonio y diagnóstico',
    tabs: ['balance', 'investments', 'health', 'report'],
  },
  {
    id: 'tools',
    title: 'Herramientas y educación',
    tabs: ['tools', 'credit-library', 'calculators', 'tax-annual', 'diagnostics', 'education'],
  },
];

/** Keep the main destination selected while a related tool is open. */
export function getPrimaryNavigationId(tab) {
  return NAVIGATION_HUBS.find(hub => hub.tabs.includes(tab))?.tabs[0]
    || NAVIGATION_ITEMS.find(item => item.id === tab)?.id
    || 'dashboard';
}

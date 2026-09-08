import {
  Activity, BookOpen, Calculator, CalendarDays, ChartNoAxesCombined,
  FileText, Landmark, Layers3, LayoutDashboard, ListFilter, PieChart,
  Sparkles, TrendingUp, Trophy, WalletCards, WandSparkles,
} from 'lucide-react';

// Shared route vocabulary for the sidebar, mobile navigation and command menu.
export const NAVIGATION_ITEMS = [
  { id: 'dashboard', label: 'Resumen', description: 'Tu panorama financiero y próximos pasos', group: 'Tu día a día', icon: LayoutDashboard },
  { id: 'transactions', label: 'Movimientos', description: 'Ingresos, gastos y registro de transacciones', group: 'Tu día a día', icon: ListFilter },
  { id: 'calendar', label: 'Calendario', description: 'Pagos, vencimientos y quincenas', group: 'Tu día a día', icon: CalendarDays },
  { id: 'debts', label: 'Deudas', description: 'Créditos y estrategias para liquidarlos', group: 'Tu día a día', icon: Layers3 },
  { id: 'balance', label: 'Patrimonio', description: 'Balance de activos y pasivos', group: 'Planea tu futuro', icon: WalletCards },
  { id: 'investments', label: 'Ahorro e inversión', description: 'Fondo de emergencia, CETES e interés compuesto', group: 'Planea tu futuro', icon: TrendingUp },
  { id: 'simulator', label: 'Simulador', description: 'Explora escenarios de pago y ahorro', group: 'Planea tu futuro', icon: WandSparkles },
  { id: 'health', label: 'Salud financiera', description: 'Indicadores y diagnóstico de tus finanzas', group: 'Planea tu futuro', icon: Activity },
  { id: 'assistant', label: 'Asistente', description: 'Pregunta sobre tus finanzas con Claude', group: 'Tu copiloto', icon: Sparkles, accent: 'ai' },
  { id: 'statements', label: 'Estados de cuenta', description: 'Importa, revisa y analiza tus movimientos bancarios', group: 'Tu copiloto', icon: FileText },
  { id: 'calculators', label: 'Calculadoras', description: 'CAT, MSI, presupuesto, retiro y más', group: 'Herramientas', icon: Calculator },
  { id: 'budget', label: 'Ingresos y gastos', description: 'Estado de resultados y obligaciones mensuales', group: 'Herramientas', icon: PieChart },
  { id: 'tax-annual', label: 'Declaración anual', description: 'Simulador de impuestos y deducciones', group: 'Herramientas', icon: Landmark },
  { id: 'diagnostics', label: 'Buró y crédito', description: 'Checklist, derechos y guía de negociación', group: 'Herramientas', icon: BookOpen },
  { id: 'education', label: 'Retos y hábitos', description: 'Aprende, ahorra y construye hábitos', group: 'Herramientas', icon: Trophy },
  { id: 'report', label: 'Reporte financiero', description: 'Resumen imprimible de tus finanzas', group: 'Herramientas', icon: ChartNoAxesCombined },
];

export const NAVIGATION_GROUPS = [...new Set(NAVIGATION_ITEMS.map(item => item.group))];

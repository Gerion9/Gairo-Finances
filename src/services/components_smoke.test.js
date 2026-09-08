import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { emptyFinancialData } from './accountData.js';

import AdvancedDiagnosticsHub from '../components/AdvancedDiagnosticsHub.jsx';
import BalanceSheet from '../components/BalanceSheet.jsx';
import CommandPalette from '../components/CommandPalette.jsx';
import DashboardOverview from '../components/DashboardOverview.jsx';
import DebtCard from '../components/DebtCard.jsx';
import DebtModal from '../components/DebtModal.jsx';
import FinancialCalculatorsHub from '../components/FinancialCalculatorsHub.jsx';
import FinancialHealthScore from '../components/FinancialHealthScore.jsx';
import IncomeStatement from '../components/IncomeStatement.jsx';
import Investments from '../components/Investments.jsx';
import Login from '../components/Login.jsx';
import Navbar from '../components/Navbar.jsx';
import OnboardingModal from '../components/OnboardingModal.jsx';
import PaymentCalendar from '../components/PaymentCalendar.jsx';
import PricingModal from '../components/PricingModal.jsx';
import PrintableReport from '../components/PrintableReport.jsx';
import PromoAlerts from '../components/PromoAlerts.jsx';
import SettingsModal from '../components/SettingsModal.jsx';
import Simulator from '../components/Simulator.jsx';
import StrategyCompare from '../components/StrategyCompare.jsx';
import StrategyPayoff from '../components/StrategyPayoff.jsx';
import TransactionsTracker from '../components/TransactionsTracker.jsx';
import Roadmap100Modal from '../components/Roadmap100Modal.jsx';
import Skeleton from '../components/Skeleton.jsx';
import FinancialEducationHub from '../components/FinancialEducationHub.jsx';
import AnnualTaxSimulator from '../components/AnnualTaxSimulator.jsx';
import App from '../App.jsx';

describe('Component Module Integrity Smoke Tests', () => {
  const components = [
    { name: 'AdvancedDiagnosticsHub', comp: AdvancedDiagnosticsHub },
    { name: 'BalanceSheet', comp: BalanceSheet },
    { name: 'CommandPalette', comp: CommandPalette },
    { name: 'DashboardOverview', comp: DashboardOverview },
    { name: 'DebtCard', comp: DebtCard },
    { name: 'DebtModal', comp: DebtModal },
    { name: 'FinancialCalculatorsHub', comp: FinancialCalculatorsHub },
    { name: 'FinancialHealthScore', comp: FinancialHealthScore },
    { name: 'IncomeStatement', comp: IncomeStatement },
    { name: 'Investments', comp: Investments },
    { name: 'Login', comp: Login },
    { name: 'Navbar', comp: Navbar },
    { name: 'OnboardingModal', comp: OnboardingModal },
    { name: 'PaymentCalendar', comp: PaymentCalendar },
    { name: 'PricingModal', comp: PricingModal },
    { name: 'PrintableReport', comp: PrintableReport },
    { name: 'PromoAlerts', comp: PromoAlerts },
    { name: 'SettingsModal', comp: SettingsModal },
    { name: 'Simulator', comp: Simulator },
    { name: 'StrategyCompare', comp: StrategyCompare },
    { name: 'StrategyPayoff', comp: StrategyPayoff },
    { name: 'TransactionsTracker', comp: TransactionsTracker },
    { name: 'Roadmap100Modal', comp: Roadmap100Modal },
    { name: 'Skeleton', comp: Skeleton },
    { name: 'FinancialEducationHub', comp: FinancialEducationHub },
    { name: 'AnnualTaxSimulator', comp: AnnualTaxSimulator },
    { name: 'App', comp: App }
  ];

  components.forEach(({ name, comp }) => {
    it(`exports a valid React component: ${name}`, () => {
      expect(comp).toBeDefined();
      expect(typeof comp).toBe('function');
    });
  });
});

describe('Financial calculator account defaults', () => {
  const inputValues = (component, props) => {
    const markup = renderToStaticMarkup(createElement(component, props));
    return [...markup.matchAll(/<input\b[^>]*\btype="number"[^>]*>/g)]
      .map(match => Number(match[0].match(/\bvalue="([^"]*)"/)?.[1]));
  };

  it.each(['gairo', 'ricardo'])('starts %s tax scenarios without inherited personal amounts', id => {
    const financialData = emptyFinancialData(id);
    expect(inputValues(AnnualTaxSimulator, { financialData })).toEqual([0, 0, 0]);
    expect(inputValues(FinancialCalculatorsHub, { financialData, initialCalculator: 'resico' })).toEqual([0, 0]);
  });

  it('initializes annual income and withholding from the active account fields', () => {
    const financialData = emptyFinancialData('ricardo');
    financialData.honorarios.importeFacturado = 1000;
    financialData.honorarios.retencionIsrTasa = 0.10;
    expect(inputValues(AnnualTaxSimulator, { financialData })).toEqual([12000, 0, 1200]);
    expect(inputValues(FinancialCalculatorsHub, { financialData, initialCalculator: 'resico' })).toEqual([12000, 0]);
  });

  it('initializes the budget scenario from recorded account values', () => {
    const financialData = emptyFinancialData('ricardo');
    financialData.honorarios.otrosIngresos = 1000;
    financialData.gastosNecesarios = [{ monto: 50 }];
    financialData.gastosOpcionales = [{ monto: 25 }];
    financialData.deudas = [{ saldo: 100, pagoMinimo: 10, moneda: 'MXN' }];
    expect(inputValues(FinancialCalculatorsHub, { financialData, initialCalculator: 'rule503020' })).toEqual([1000, 50, 25, 10]);
  });

  it('asks for a retirement scenario instead of presenting the no-projection sentinel as a date', () => {
    const financialData = emptyFinancialData('ricardo');
    const empty = renderToStaticMarkup(createElement(FinancialCalculatorsHub, { financialData, initialCalculator: 'fire' }));
    expect(empty).toContain('Completa los datos del escenario');
    expect(empty).not.toMatch(/99(?:<!-- -->)? años/);
    financialData.gastosNecesarios = [{ monto: 100 }];
    const withoutContributions = renderToStaticMarkup(createElement(FinancialCalculatorsHub, { financialData, initialCalculator: 'fire' }));
    expect(withoutContributions).toContain('Sin proyección con estos aportes y rendimiento');
    expect(withoutContributions).not.toMatch(/99(?:<!-- -->)? años/);
  });
});

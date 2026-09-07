import { describe, it, expect } from 'vitest';

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

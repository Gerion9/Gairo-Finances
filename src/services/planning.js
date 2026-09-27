// Incomplete obligations are saved separately from calculation-ready debts.
export function debtCoverage(data = {}) {
  const pending = data.deudasPendientes || [];
  const totals = { MXN: 0, USD: 0 };
  let missingBalances = 0;
  for (const debt of data.deudas || []) totals[debt.moneda] += debt.saldo;
  for (const debt of pending) {
    if (debt.saldoEstimado == null) missingBalances += debt.numeroCuentas;
    else totals[debt.moneda] += debt.saldoEstimado;
  }
  return { pending, totals, missingBalances, pendingAccounts: pending.reduce((sum, d) => sum + d.numeroCuentas, 0) };
}

export function saveDebtRecord(data, debt, pending = false) {
  const complete = data.deudas.filter(row => row.id !== debt.id);
  const incomplete = (data.deudasPendientes || []).filter(row => row.id !== debt.id);
  return { ...data, deudas: pending ? complete : [...complete, debt], deudasPendientes: pending ? [...incomplete, debt] : incomplete };
}

export function undatedCommitments(data = {}) {
  const rows = [...(data.gastosNecesarios || []), ...(data.gastosOpcionales || [])];
  if (data.honorarios?.modo === 'MANUAL' && data.honorarios.provisionFiscalMensual > 0) {
    rows.push({ id: 'provision-fiscal', nombre: 'Provisión de impuestos', monto: data.honorarios.provisionFiscalMensual, diaPago: data.honorarios.diaPagoImpuestos });
  }
  return rows.filter(row => row.diaPago == null);
}

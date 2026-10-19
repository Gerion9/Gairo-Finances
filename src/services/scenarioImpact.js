const finite = value => typeof value === 'number' && Number.isFinite(value);
const difference = (value, reference) => Math.round((value - reference) * 100) / 100;

function samples(timeline, scope) {
  const accounts = timeline.fundingAccounts || [];
  const initial = scope.accountId ? accounts.find(account => account.id === scope.accountId)?.initial : timeline.initial?.[scope.currency];
  return [
    { date: timeline.from, phase: 'opening', value: initial, total: timeline.initial?.[scope.currency], accounts: Object.fromEntries(accounts.map(account => [account.id, account.initial])) },
    ...(timeline.daily || []).map(day => ({ date: day.date, phase: 'closing', value: scope.accountId ? day.accounts?.[scope.accountId] : day[scope.currency], total: day[scope.currency], accounts: day.accounts || {} })),
  ];
}

function shortfallAt(sample, scope, accounts) {
  // A positive aggregate cannot fund a payment assigned to a different bank account.
  const account = accounts.find(account => sample.accounts[account.id] < 0);
  if (account) return { date: sample.date, phase: sample.phase, value: sample.accounts[account.id], accountId: account.id, accountName: account.name, currency: account.currency, total: sample.total };
  return sample.value < 0 ? { date: sample.date, phase: sample.phase, value: sample.value, currency: scope.currency, total: sample.total, ...(scope.accountId ? { accountId: scope.accountId, accountName: scope.name } : {}) } : null;
}

/** Summarizes existing timeline output only. No balances, events or plan inputs are changed. */
export function summarizeScenarioImpact(result, { currency = 'MXN', accountId = '' } = {}) {
  const scenario = result?.scenario, base = result?.base;
  const selected = scenario?.fundingAccounts?.find(account => account.id === accountId);
  const scope = { currency: selected?.currency || currency, accountId, name: selected?.name || 'Total disponible' };
  const warnings = [...new Set([...(base?.warnings || []), ...(scenario?.warnings || [])])];
  const partial = warnings.length > 0;
  if (!scenario?.daily?.length || !base?.daily?.length || (accountId && !selected)) return { available: false, scope, partial, warnings };
  const projected = samples(scenario, scope), reference = samples(base, scope);
  if (projected.length !== reference.length || projected.some((point, index) => !finite(point.value) || !finite(reference[index]?.value) || point.date !== reference[index].date)) return { available: false, scope, partial: true, warnings };

  const relevantAccounts = (scenario.fundingAccounts || []).filter(account => account.currency === scope.currency && (accountId ? account.id === accountId : !account.virtual));
  const minimumOf = points => points.reduce((minimum, point) => point.value < minimum.value ? point : minimum);
  const minimum = minimumOf(projected), referenceMinimum = minimumOf(reference);
  const final = projected.at(-1), referenceFinal = reference.at(-1);
  const firstShortfall = projected.map(point => shortfallAt(point, scope, relevantAccounts)).find(Boolean) || null;
  const maskedPoint = projected.find(point => finite(point.total) && point.total >= 0 && relevantAccounts.some(account => !account.virtual && point.accounts[account.id] < 0));
  const maskedShortfall = maskedPoint ? shortfallAt(maskedPoint, scope, relevantAccounts.filter(account => !account.virtual)) : null;
  const unchanged = projected.every((point, index) => point.value === reference[index].value && relevantAccounts.every(account => point.accounts[account.id] === reference[index].accounts[account.id]));

  return {
    available: true, scope, from: scenario.from, to: scenario.to, partial, warnings, unchanged,
    minimum: { date: minimum.date, phase: minimum.phase, value: minimum.value, reference: { date: referenceMinimum.date, phase: referenceMinimum.phase, value: referenceMinimum.value } },
    final: { date: final.date, value: final.value, reference: referenceFinal.value, delta: difference(final.value, referenceFinal.value) },
    firstShortfall, maskedShortfall,
    // These are new principal plus financed fees, not remaining debt at the final date.
    newDebt: { MXN: finite(scenario.newDebt) ? scenario.newDebt : null, USD: finite(scenario.newDebtUSD) ? scenario.newDebtUSD : null },
  };
}

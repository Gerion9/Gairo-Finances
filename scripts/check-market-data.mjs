import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mexicoCreditDirectory as credit } from '../src/data/mexicoCreditDirectory.js';
import { mexicoSavingsCatalog as savings } from '../src/data/mexicoSavingsCatalog.js';
import { creditCatalog } from '../src/data/creditCatalog.js';
import { cardBenefitPrograms as programs } from '../src/data/cardBenefits.js';

// Offline integrity check. This does not verify availability, refresh terms, or certify market coverage.
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
function https(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; }
  catch { return false; }
}
function sources(values, context) {
  check(Array.isArray(values) && values.length > 0, `${context}: missing sources`);
  for (const source of values || []) {
    check(nonempty(source.title) && https(source.url), `${context}: invalid source title or HTTPS URL`);
  }
}
function unique(values, context) {
  const ids = values.map(value => value.id);
  check(ids.every(nonempty) && new Set(ids).size === ids.length, `${context}: missing or duplicate IDs`);
}
function product(entry, context) {
  for (const field of ['id', 'name', 'issuer', 'productType', 'availability', 'summary']) {
    check(nonempty(entry[field]), `${context}/${entry.id}: missing ${field}`);
  }
  check(validDate(entry.consultedOn), `${context}/${entry.id}: invalid consultation date`);
  check(https(entry.canonicalUrl), `${context}/${entry.id}: invalid canonical URL`);
  check(Array.isArray(entry.aliases), `${context}/${entry.id}: aliases must be explicit`);
  check(Array.isArray(entry.limitations), `${context}/${entry.id}: limitations must be explicit`);
  if (entry.hasDetailedSheet === false && Array.isArray(entry.evidence) && entry.evidence.length === 0) {
    check(entry.limitations.length > 0, `${context}/${entry.id}: undocumented entry needs explicit limitations`);
  } else sources(entry.evidence, `${context}/${entry.id}`);
}
function catalog(value, name) {
  check(validDate(value.reviewedOn), `${name}: invalid review date`);
  check(nonempty(value.coverage?.scope) && Array.isArray(value.coverage?.limitations), `${name}: missing coverage statement`);
  sources(value.sources, name);
}

catalog(credit, 'credit');
catalog(savings, 'savings');
unique([...credit.cards, ...credit.loans], 'credit');
unique(savings.products, 'savings');
unique(programs, 'benefits');
check(credit.cards.length > 0 && credit.loans.length > 0 && savings.products.length > 0, 'catalogs must not be empty');
const cardIds = new Set(credit.cards.map(card => card.id));
const loanIds = new Set(credit.loans.map(loan => loan.id));
const detailedLoans = (creditCatalog.loanFamilies || []).flatMap(family => (family.offers || []).map(offer => ({ ...offer, familyId: family.id })));
const detailedEntries = [...(creditCatalog.cards || []), ...detailedLoans];
unique(detailedEntries, 'detailed credit');
const validNumber = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
for (const entry of detailedEntries) {
  check((entry.entryType === 'card' ? cardIds : loanIds).has(entry.id), `detailed credit/${entry.id}: missing directory join`);
  check(validDate(entry.consultedOn) && https(entry.canonicalUrl), `detailed credit/${entry.id}: invalid consultation or URL`);
  sources(entry.evidence, `detailed credit/${entry.id}`);
  for (const [name, cost] of Object.entries(entry.costs || {})) {
    const context = `detailed credit/${entry.id}/${name}`;
    sources(cost.sources, context);
    for (const field of ['percent', 'amount', 'minPercent', 'maxPercent']) {
      if (Object.hasOwn(cost, field)) check(cost[field] === null || validNumber(cost[field]), `${context}: invalid ${field}`);
    }
    if (cost.minPercent != null || cost.maxPercent != null) {
      check(validNumber(cost.minPercent) && validNumber(cost.maxPercent) && cost.minPercent <= cost.maxPercent && cost.percent == null,
        `${context}: range must have two ordered bounds and no inferred point rate`);
    }
    for (const field of ['asOf', 'validThrough']) {
      if (Object.hasOwn(cost, field)) check(cost[field] === null || validDate(cost[field]), `${context}: invalid ${field}`);
    }
    if (validDate(cost.asOf) && validDate(cost.validThrough)) check(cost.asOf <= cost.validThrough, `${context}: inverted published dates`);
    if (name === 'maintenanceFee') check(cost.frequency === 'monthly' && cost.unit === 'MXN' && nonempty(cost.conditions), `${context}: periodic fee needs frequency, currency and conditions`);
    if (name === 'optionalSubscriptionFee') check(['monthly', 'annual'].includes(cost.frequency) && cost.unit === 'MXN' && nonempty(cost.conditions), `${context}: optional subscription needs frequency, currency and conditions`);
    if (Object.hasOwn(cost, 'publishedText')) check(cost.amount === null && nonempty(cost.publishedText) && nonempty(cost.conditions) && nonempty(cost.unit), `${context}: tiered fees need explicit text, conditions, unit and no invented single amount`);
  }
}
for (const entry of credit.cards) product(entry, 'cards');
for (const entry of credit.loans) {
  product(entry, 'loans');
  check(nonempty(credit.familyLabels[entry.familyId]), `loans/${entry.id}: unknown family ${entry.familyId}`);
}
for (const card of creditCatalog.cards || []) check(cardIds.has(card.id), `detailed card ${card.id}: missing directory join`);
for (const program of programs) {
  check(cardIds.has(program.cardId), `program ${program.id}: missing directory card`);
  check(validDate(program.reviewedOn) && validDate(program.reviewDueOn), `program ${program.id}: invalid review dates`);
  check(program.reviewDueOn >= program.reviewedOn, `program ${program.id}: review deadline precedes review`);
  sources(program.sources, `program ${program.id}`);
  unique(program.conditions || [], `program ${program.id} conditions`);
  for (const field of ['validFrom', 'validThrough']) check(program[field] === null || validDate(program[field]), `program ${program.id}: invalid ${field}`);
}
for (const entry of savings.products) {
  product(entry, 'savings');
  check(nonempty(entry.legalIssuer) || entry.legalIssuer === null, `savings/${entry.id}: legal issuer must be named or explicitly unknown`);
  check(nonempty(entry.mechanism), `savings/${entry.id}: missing mechanism`);
  check(['demand', 'term', 'mixed', 'unknown'].includes(entry.liquidity?.category) && nonempty(entry.liquidity?.summary), `savings/${entry.id}: incomplete liquidity`);
  for (const field of ['amounts', 'fees', 'requirements']) check(Array.isArray(entry[field]), `savings/${entry.id}: ${field} must be an explicit list (empty means unknown)`);
  check(nonempty(entry.protection?.label) && nonempty(entry.protection?.summary), `savings/${entry.id}: incomplete protection`);
  check(typeof entry.hasDetailedSheet === 'boolean', `savings/${entry.id}: missing coverage level`);
  check(Array.isArray(entry.returns), `savings/${entry.id}: returns must be an explicit list (empty means unknown)`);
  if (!entry.returns?.length) check(entry.limitations.length > 0, `savings/${entry.id}: missing returns need explicit limitations`);
  unique(entry.returns || [], `savings/${entry.id} returns`);
  for (const rate of entry.returns || []) {
    check(rate.percent === null || (typeof rate.percent === 'number' && Number.isFinite(rate.percent)), `savings/${entry.id}/${rate.id}: invalid rate`);
    check(['base', 'promotion', 'gat', 'historical'].includes(rate.nature), `savings/${entry.id}/${rate.id}: missing rate nature`);
    for (const field of ['label', 'unit', 'rateType', 'conditions']) check(nonempty(rate[field]), `savings/${entry.id}/${rate.id}: missing ${field}`);
    for (const field of ['asOf', 'validThrough']) check(rate[field] === null || validDate(rate[field]), `savings/${entry.id}/${rate.id}: invalid ${field}`);
    sources(rate.sources, `savings/${entry.id}/${rate.id}`);
  }
}
for (const [file, expected, fields] of [
  ['mexico-credit-market.json', credit, ['reviewedOn', 'cards', 'loans', 'sources', 'familyLabels', 'coverage']],
  ['mexico-savings-market.json', savings, ['reviewedOn', 'products', 'sources', 'coverage']],
  ['mexico-credit-details.json', { reviewedOn: creditCatalog.reviewedOn, cards: creditCatalog.cards, loans: detailedLoans }, ['reviewedOn', 'cards', 'loans']],
]) {
  try {
    const audit = JSON.parse(await readFile(new URL(`../docs/${file}`, import.meta.url), 'utf8'));
    for (const field of fields) {
      try { assert.deepEqual(audit[field], expected[field]); }
      catch { errors.push(`${file}: ${field} differs from application dataset`); }
    }
  } catch (error) { errors.push(`${file}: cannot read audit (${error.code || error.name})`); }
}
const detailedSources = detailedEntries.flatMap(entry => [...entry.evidence, ...Object.values(entry.costs || {}).flatMap(cost => cost.sources || [])]);
const sourceUrls = new Set([...credit.sources, ...savings.sources, ...programs.flatMap(program => program.sources), ...detailedSources].map(source => source.url));
console.log(JSON.stringify({
  status: errors.length ? 'failed' : 'passed',
  scope: 'Offline integrity and audit parity; not a live source or market-completeness check.',
  counts: { cards: credit.cards.length, financingProductsAndPrograms: credit.loans.length, savingsModalities: savings.products.length,
    detailedCards: creditCatalog.cards.length, detailedLoanOffers: detailedLoans.length,
    benefitPrograms: programs.length, calculableBenefitPrograms: programs.filter(program => program.calculation).length, distinctReferencedUrls: sourceUrls.size },
  errors,
}, null, 2));
if (errors.length) process.exitCode = 1;

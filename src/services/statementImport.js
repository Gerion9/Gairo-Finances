export const MAX_STATEMENT_ROWS = 150;
export const MAX_STATEMENT_BYTES = 3_000_000;
export const STATEMENT_CURRENCIES = ['MXN', 'USD'];
export const STATEMENT_CATEGORIES = ['Alimentos', 'Vivienda', 'Servicios', 'Transporte', 'Mascota', 'Estilo de Vida', 'Honorarios', 'Otros'];

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const normalizeHeader = (value) => normalize(value).replace(/[^a-z0-9]/g, '');
const TRANSFER_PATTERN = /\b(transferencia|transfer|traspaso|spei|pago (?:de |a )?(?:tarjeta|tdc)|card payment|credit card payment)\b/i;
const MAX_AMOUNT = 1_000_000_000_000;

/** A CSV parser with quoted fields and embedded newlines; it never executes cell contents. */
export function parseCSV(text, { delimiter, maxRows = MAX_STATEMENT_ROWS } = {}) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('El CSV está vacío.');
  const input = text.replace(/^\uFEFF/, '');
  if (input.includes('\0')) throw new Error('El archivo no es un CSV de texto válido. Exporta el archivo en UTF-8.');
  let separator = delimiter;
  if (!separator) {
    const counts = { ',': 0, ';': 0, '\t': 0 };
    let quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === '"') {
        if (quoted && input[i + 1] === '"') { i += 1; continue; }
        quoted = !quoted;
      } else if (!quoted) {
        if (input[i] === '\n' || input[i] === '\r') break;
        if (Object.hasOwn(counts, input[i])) counts[input[i]] += 1;
      }
    }
    separator = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }
  if (![',', ';', '\t'].includes(separator)) throw new Error('Separador CSV no compatible.');

  const table = [];
  let row = [], field = '', inQuote = false, afterQuote = false;
  const finishField = () => { row.push(field); field = ''; afterQuote = false; };
  const finishRow = () => {
    finishField();
    if (row.some((cell) => cell.trim())) table.push(row);
    row = [];
    if (table.length > maxRows + 1) throw new Error(`El archivo supera los ${maxRows} movimientos. Divide el CSV antes de importarlo.`);
  };
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (inQuote) {
      if (char === '"' && input[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') { inQuote = false; afterQuote = true; }
      else field += char;
    } else if (char === separator) finishField();
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      finishRow();
    } else if (char === '"' && field === '' && !afterQuote) inQuote = true;
    else if (afterQuote && /[ \t]/.test(char)) { /* Whitespace after a quoted cell. */ }
    else if (afterQuote || char === '"') throw new Error('El CSV tiene comillas sin cerrar o mal colocadas. Revisa su exportación.');
    else field += char;
  }
  if (inQuote) throw new Error('El CSV tiene un campo con comillas sin cerrar.');
  if (field || row.length || afterQuote) finishRow();
  if (table.length < 2) throw new Error('El CSV necesita encabezados y al menos un movimiento.');
  const headers = table[0].map((header, index) => header.trim() || `Columna ${index + 1}`);
  if (headers.length > 40) throw new Error('El CSV tiene demasiadas columnas. Exporta únicamente la tabla de movimientos.');
  const records = table.slice(1).map((cells, index) => {
    if (cells.length !== headers.length) throw new Error(`El movimiento ${index + 1} tiene ${cells.length} columnas; se esperaban ${headers.length}. Revisa el separador.`);
    return { sourceIndex: index + 1, cells };
  });
  return { headers, records, delimiter: separator, mapping: suggestCSVMapping(headers) };
}

export function suggestCSVMapping(headers) {
  const aliases = {
    date: ['fecha', 'date', 'fechadeoperacion', 'fechaoperacion', 'fechamovimiento', 'transactiondate'],
    description: ['descripcion', 'description', 'concepto', 'detalle', 'movimiento', 'comercio', 'merchant', 'memo'],
    amount: ['monto', 'importe', 'amount', 'cantidad'],
    debit: ['cargo', 'cargos', 'debito', 'debit', 'retiro', 'retiros', 'debits'],
    credit: ['abono', 'abonos', 'credito', 'credit', 'deposito', 'depositos', 'credits'],
    currency: ['moneda', 'currency', 'divisa'],
    direction: ['tipo', 'type', 'direction', 'naturaleza'],
    category: ['categoria', 'category'],
  };
  return Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, headers.findIndex((header) => names.includes(normalizeHeader(header)))]));
}

export function parseStatementDate(value, dateFormat = '') {
  const text = String(value ?? '').trim();
  let year, month, day;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (iso) [, year, month, day] = iso.map(Number);
  else {
    const regional = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(text);
    if (!regional) return '';
    const [, first, second, last] = regional.map(Number);
    year = last;
    const order = dateFormat || (first > 12 && second <= 12 ? 'DMY' : second > 12 && first <= 12 ? 'MDY' : '');
    if (order === 'DMY') { day = first; month = second; }
    else if (order === 'MDY') { day = second; month = first; }
    else return '';
  }
  if (year < 1900 || year > 2200 || month < 1 || month > 12 || day < 1 || day > 31) return '';
  const result = new Date(Date.UTC(year, month - 1, day));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) return '';
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseStatementAmount(value, decimalSeparator = '.') {
  if (!['.', ','].includes(decimalSeparator)) return NaN;
  let raw = String(value ?? '').trim();
  if (!raw) return NaN;
  raw = raw.replace(/^(?:MXN|USD)\s*/i, '').replace(/\s*(?:MXN|USD)$/i, '').replace(/\$/g, '').replace(/[\s\u00a0]/g, '');
  const parentheses = /^\(.+\)$/.test(raw);
  if (parentheses) raw = `-${raw.slice(1, -1)}`;
  const valid = decimalSeparator === '.'
    ? /^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/
    : /^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/;
  if (!valid.test(raw)) return NaN;
  const canonical = decimalSeparator === '.' ? raw.replace(/,/g, '') : raw.replace(/\./g, '').replace(',', '.');
  const amount = Number(canonical);
  return Number.isFinite(amount) && Math.abs(amount) <= MAX_AMOUNT ? amount : NaN;
}

function normalizeDirection(value) {
  const text = normalize(value).replace(/[ _-]+/g, ' ');
  if (['gasto', 'egreso', 'expense', 'debit', 'debito', 'cargo', 'retiro', 'outflow'].includes(text)) return 'GASTO';
  if (['ingreso', 'income', 'credit', 'credito', 'abono', 'deposito', 'inflow'].includes(text)) return 'INGRESO';
  return 'UNKNOWN';
}

export function validateImportRow(row) {
  const issues = [];
  if (!parseStatementDate(row.date)) issues.push('Fecha pendiente o inválida');
  if (typeof row.description !== 'string' || !row.description.trim() || row.description.length > 500) issues.push('Descripción requerida (máximo 500 caracteres)');
  if (!Number.isFinite(Number(row.amount)) || Number(row.amount) <= 0 || Number(row.amount) > MAX_AMOUNT || Math.abs(Number(row.amount) * 100 - Math.round(Number(row.amount) * 100)) > 0.01) issues.push('Monto positivo, con hasta 2 decimales');
  if (!STATEMENT_CURRENCIES.includes(row.currency)) issues.push('Selecciona MXN o USD');
  if (!['GASTO', 'INGRESO'].includes(row.direction)) issues.push('Clasifica como gasto o ingreso');
  if (typeof row.category !== 'string' || !row.category.trim() || row.category.length > 100) issues.push('Categoría requerida (máximo 100 caracteres)');
  if (row.format === 'pdf') {
    if (!Number.isInteger(Number(row.pageNumber)) || Number(row.pageNumber) < 1 || Number(row.pageNumber) > (row.totalPages || 100)) issues.push('Confirma la página de origen');
    if (typeof row.sourceText !== 'string' || !row.sourceText.trim() || row.sourceText.length > 1200) issues.push('Completa la referencia del movimiento');
  }
  return issues;
}

export function mapCSVRows(parsed, options = {}) {
  const mapping = options.mapping ?? parsed.mapping;
  const mode = options.amountMode ?? (mapping.amount >= 0 ? 'signed' : 'split');
  const get = (record, key) => mapping[key] >= 0 ? record.cells[mapping[key]]?.trim() ?? '' : '';
  return parsed.records.map((record) => {
    const description = get(record, 'description');
    let amount, direction;
    if (mode === 'split') {
      const debitText = get(record, 'debit'), creditText = get(record, 'credit');
      const debit = debitText ? parseStatementAmount(debitText, options.decimalSeparator) : 0;
      const credit = creditText ? parseStatementAmount(creditText, options.decimalSeparator) : 0;
      const valid = Number.isFinite(debit) && Number.isFinite(credit) && debit >= 0 && credit >= 0 && ((debit > 0) !== (credit > 0));
      amount = valid ? Math.max(debit, credit) : NaN;
      direction = valid ? debit > 0 ? 'GASTO' : 'INGRESO' : 'UNKNOWN';
    } else {
      const signed = parseStatementAmount(get(record, 'amount'), options.decimalSeparator);
      amount = Math.abs(signed);
      if (mapping.direction >= 0) direction = normalizeDirection(get(record, 'direction'));
      else if (!Number.isFinite(signed) || signed === 0) direction = 'UNKNOWN';
      else direction = (options.signConvention === 'positive-expense' ? signed > 0 : signed < 0) ? 'GASTO' : 'INGRESO';
    }
    const transfer = TRANSFER_PATTERN.test(description) || /transfer|traspaso|card.?payment|pago.?tarjeta/i.test(get(record, 'direction'));
    const row = {
      sourceIndex: record.sourceIndex,
      date: parseStatementDate(get(record, 'date'), options.dateFormat),
      originalDate: get(record, 'date'),
      description,
      amount: Number.isFinite(amount) ? amount : '',
      currency: mapping.currency >= 0 ? get(record, 'currency').toUpperCase() : options.defaultCurrency || 'UNKNOWN',
      direction: transfer ? 'UNKNOWN' : direction,
      category: get(record, 'category') || 'Otros',
      needsReview: transfer,
      reviewReason: transfer ? 'Transferencia o pago de tarjeta: confirma si corresponde registrarlo como gasto o ingreso para evitar contar dinero dos veces.' : '',
      selected: false,
      format: 'csv',
    };
    row.selected = !row.needsReview && validateImportRow(row).length === 0;
    return row;
  });
}

/** Reject a partial or malformed extraction before constructing any ledger rows. */
export function validateStatementExtraction(result) {
  if (!result || result.schemaVersion !== 1 || !result.statement || typeof result.statement !== 'object' || Array.isArray(result.statement)) throw new Error('Claude devolvió un formato no compatible. No se importó ningún movimiento.');
  if (result.coverage?.complete !== true) throw new Error('La extracción está incompleta. Divide el documento o exporta un CSV; no se importó ningún movimiento.');
  if (!Number.isInteger(result.coverage.pagesProcessed) || result.coverage.pagesProcessed < 1 || result.coverage.pagesProcessed > 100 || !Array.isArray(result.coverage.warnings) || result.coverage.warnings.length > 30 || !result.coverage.warnings.every((warning) => typeof warning === 'string' && warning.length <= 500)) throw new Error('La extracción no incluye una cobertura verificable. Usa un CSV o vuelve a intentar.');
  if (!Array.isArray(result.transactions) || result.transactions.length > MAX_STATEMENT_ROWS) throw new Error(`La extracción supera el límite de ${MAX_STATEMENT_ROWS} movimientos o tiene un formato inválido.`);
  const indices = new Set();
  const directions = ['debit', 'credit', 'transfer', 'unknown'];
  for (const row of result.transactions) {
    if (!row || !Number.isInteger(row.sourceIndex) || row.sourceIndex < 0 || row.sourceIndex > 10_000 || indices.has(row.sourceIndex) || (row.date !== null && typeof row.date !== 'string') || typeof row.description !== 'string' || !row.description.trim() || row.description.length > 500 || (row.amount !== null && (typeof row.amount !== 'number' || !Number.isFinite(row.amount))) || !['MXN', 'USD', 'UNKNOWN'].includes(row.currency) || !directions.includes(row.direction) || (row.category !== null && (typeof row.category !== 'string' || row.category.length > 100)) || typeof row.needsReview !== 'boolean' || (row.pageNumber !== null && (!Number.isInteger(row.pageNumber) || row.pageNumber < 1 || row.pageNumber > result.coverage.pagesProcessed)) || typeof row.sourceText !== 'string' || row.sourceText.length > 1200) throw new Error('La extracción contiene un movimiento con formato inválido. No se importó ningún movimiento.');
    indices.add(row.sourceIndex);
  }
  return result;
}

export function extractionToRows(result) {
  validateStatementExtraction(result);
  return result.transactions.map((record) => {
    const transfer = record.direction === 'transfer' || TRANSFER_PATTERN.test(record.description);
    const row = {
      sourceIndex: record.sourceIndex,
      date: parseStatementDate(record.date),
      originalDate: record.date || '',
      description: record.description,
      amount: record.amount ?? '',
      currency: record.currency,
      direction: transfer ? 'UNKNOWN' : normalizeDirection(record.direction),
      category: record.category ?? '',
      pageNumber: record.pageNumber,
      totalPages: result.coverage.pagesProcessed,
      sourceText: record.sourceText,
      format: 'pdf',
      needsReview: true,
      reviewReason: transfer ? 'Transferencia o pago de tarjeta: confirma su clasificación para evitar contar dinero dos veces.' : record.needsReview ? 'Claude marcó este movimiento para revisión. Verifica los datos contra tu documento.' : 'Verifica este movimiento contra el PDF antes de seleccionarlo.',
      selected: false,
    };
    return row;
  });
}

function exactImportKey(transaction) {
  const source = transaction.importSource;
  return source && typeof source.fileHash === 'string' && /^[a-f0-9]{64}$/i.test(source.fileHash) && Number.isInteger(source.sourceIndex) && source.sourceIndex >= 0 ? `${source.fileHash.toLowerCase()}:${source.sourceIndex}` : '';
}

export function transactionFingerprint(transaction) {
  const date = transaction.fecha ?? transaction.date;
  const amount = Number(transaction.monto ?? transaction.amount);
  const currency = transaction.moneda ?? transaction.currency;
  const direction = transaction.tipo ?? transaction.direction;
  const description = normalize(transaction.descripcion ?? transaction.description).replace(/\s+/g, ' ');
  return JSON.stringify([date, Math.round(amount * 100), currency, direction, description]);
}

export function markImportDuplicates(rows, existing, fileHash) {
  const exact = new Set(existing.map(exactImportKey).filter(Boolean));
  const potential = new Set(existing.map(transactionFingerprint));
  const seen = new Set();
  return rows.map((row) => {
    const fingerprint = transactionFingerprint(row);
    const exactDuplicate = exact.has(`${fileHash.toLowerCase()}:${row.sourceIndex}`);
    const potentialDuplicate = potential.has(fingerprint) || seen.has(fingerprint);
    seen.add(fingerprint);
    return { ...row, exactDuplicate, potentialDuplicate, selected: row.selected && !exactDuplicate && !potentialDuplicate };
  });
}

export function rowsToTransactions(rows, fileHash, { institution = '', paymentMethod = 'Estado de cuenta' } = {}) {
  if (typeof fileHash !== 'string' || !/^[a-f0-9]{64}$/i.test(fileHash)) throw new Error('No se pudo verificar la identidad del archivo. Cárgalo de nuevo.');
  return rows.filter((row) => row.selected && !row.exactDuplicate).map((row) => {
    if (validateImportRow(row).length) throw new Error('Hay movimientos seleccionados con datos pendientes. Revísalos antes de importar.');
    if (!Number.isInteger(row.sourceIndex) || row.sourceIndex < 0) throw new Error('El movimiento no tiene una referencia de origen válida.');
    const importSource = { fileHash: fileHash.toLowerCase(), sourceIndex: row.sourceIndex, format: row.format === 'pdf' ? 'pdf' : 'csv', reviewed: true };
    if (row.format === 'pdf') {
      importSource.pageNumber = Number(row.pageNumber);
      importSource.evidenceBasis = row.evidenceEdited ? 'user-corrected' : 'model-proposed';
      // Keep only a short proposed movement excerpt, never the complete document.
      importSource.sourceText = String(row.sourceText || '').slice(0, 500);
      if (typeof institution === 'string' && institution.trim()) importSource.institution = institution.trim().slice(0, 100);
    }
    return {
      id: `import_${fileHash.toLowerCase()}_${row.sourceIndex}`,
      fecha: row.date,
      descripcion: row.description.trim(),
      monto: Math.round(Number(row.amount) * 100) / 100,
      tipo: row.direction,
      categoria: row.category.trim(),
      metodoPago: paymentMethod.trim().slice(0, 100) || 'Estado de cuenta',
      moneda: row.currency,
      importSource,
    };
  });
}

/** Merge against the latest ledger, skipping exact source duplicates, never lookalike purchases. */
export function mergeImportedTransactions(existing = [], incoming = []) {
  const sources = new Set(existing.map(exactImportKey).filter(Boolean));
  const ids = new Set(existing.map((row) => row.id).filter(Boolean));
  const accepted = [];
  let skipped = 0;
  for (const transaction of incoming) {
    const sourceKey = exactImportKey(transaction);
    if (!sourceKey || validateImportRow({ date: transaction.fecha, description: transaction.descripcion, amount: transaction.monto, currency: transaction.moneda, direction: transaction.tipo, category: transaction.categoria }).length) throw new Error('La importación contiene un movimiento inválido. No se guardaron cambios.');
    if (sources.has(sourceKey) || (transaction.id && ids.has(transaction.id))) { skipped += 1; continue; }
    sources.add(sourceKey);
    if (transaction.id) ids.add(transaction.id);
    accepted.push(transaction);
  }
  return { transactions: [...accepted, ...existing], added: accepted.length, skipped };
}

export async function hashStatementFile(file) {
  if (!globalThis.crypto?.subtle) throw new Error('Abre la aplicación en HTTPS o localhost para verificar el archivo de forma segura.');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function statementFileBase64(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return btoa(binary);
}

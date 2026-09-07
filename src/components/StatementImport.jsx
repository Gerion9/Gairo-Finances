import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, CheckCheck, CheckCircle2, ChevronRight, Download, FileCheck2, FileSpreadsheet, FileText, Loader2, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UploadCloud, X, AlertCircle } from 'lucide-react';
import { getAIStatus, requestAI } from '../services/aiClient.js';
import { MAX_STATEMENT_BYTES, MAX_STATEMENT_ROWS, STATEMENT_CATEGORIES, STATEMENT_CURRENCIES, extractionToRows, hashStatementFile, mapCSVRows, markImportDuplicates, parseCSV, rowsToTransactions, statementFileBase64, validateImportRow } from '../services/statementImport.js';

const INPUT = 'min-h-[42px] w-full rounded-xl border border-[#33445b] bg-[#0d1623] px-3 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-[#7DE4BF] focus:ring-2 focus:ring-[#7DE4BF]/20 disabled:opacity-50';
const SECONDARY = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-[#33445b] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-[#7DE4BF]/50 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DE4BF] disabled:cursor-not-allowed disabled:opacity-40';
const PRIMARY = 'inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#7DE4BF] px-5 py-3 text-sm font-semibold text-[#101B23] transition-colors hover:bg-[#9debd0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DE4BF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#111B29] disabled:cursor-not-allowed disabled:opacity-40';
const DEFAULT_OPTIONS = { dateFormat: '', decimalSeparator: '.', defaultCurrency: '', amountMode: 'signed', signConvention: 'negative-expense' };

function Field({ label, children, hint }) {
  return <label className="block min-w-0 space-y-1.5"><span className="block text-xs font-medium text-[#A4B1C3]">{label}</span>{children}{hint && <span className="block text-xs leading-relaxed text-[#A4B1C3]">{hint}</span>}</label>;
}

function money(amount, currency) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

export default function StatementImport({ financialData, onImportTransactions, onOpenAssistant, onNavigateTab }) {
  const id = useId();
  const fileInputRef = useRef(null);
  const fileTaskRef = useRef(null);
  const generationRef = useRef(0);
  const committingRef = useRef(false);
  const [file, setFile] = useState(null);
  const [fileHash, setFileHash] = useState('');
  const [parsed, setParsed] = useState(null);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [rows, setRows] = useState([]);
  const [extraction, setExtraction] = useState(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [statusRevision, setStatusRevision] = useState(0);
  const [completion, setCompletion] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('Estado de cuenta');
  const existing = financialData?.transacciones || [];
  const profileId = financialData?.profileId || 'default';
  const existingRef = useRef(existing);
  const activeProfileRef = useRef(profileId);
  // Async file work must compare with the latest ledger, not its starting snapshot.
  existingRef.current = existing;
  activeProfileRef.current = profileId;

  const clearDocument = useCallback(() => {
    generationRef.current += 1;
    fileTaskRef.current?.abort();
    fileTaskRef.current = null;
    committingRef.current = false;
    setFile(null); setFileHash(''); setParsed(null); setRows([]); setExtraction(null);
    setConsent(false); setBusy(''); setError(''); setCompletion(null); setOptions(DEFAULT_OPTIONS);
    setPaymentMethod('Estado de cuenta'); setDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  useEffect(() => { clearDocument(); }, [profileId, clearDocument]);
  useEffect(() => () => { generationRef.current += 1; fileTaskRef.current?.abort(); }, []);
  useEffect(() => {
    const controller = new AbortController();
    setStatus(null); setStatusError('');
    getAIStatus({ signal: controller.signal }).then((value) => { if (!controller.signal.aborted) setStatus(value); }).catch((failure) => {
      if (!controller.signal.aborted) setStatusError(failure.message || 'No se pudo verificar la conexión con Claude.');
    });
    return () => controller.abort();
  }, [statusRevision, profileId]);

  useEffect(() => {
    if (fileHash) setRows((current) => markImportDuplicates(current, existing, fileHash));
  }, [financialData?.transacciones, fileHash]);

  const validRows = useMemo(() => rows.map((row) => ({ ...row, issues: validateImportRow(row) })), [rows]);
  const selectedRows = validRows.filter((row) => row.selected && !row.exactDuplicate && row.issues.length === 0);
  const reviewCount = validRows.filter((row) => row.issues.length || row.needsReview || row.potentialDuplicate).length;
  const exactCount = validRows.filter((row) => row.exactDuplicate).length;
  const totals = useMemo(() => STATEMENT_CURRENCIES.map((currency) => ({
    currency,
    income: selectedRows.filter((row) => row.currency === currency && row.direction === 'INGRESO').reduce((sum, row) => sum + Number(row.amount), 0),
    expense: selectedRows.filter((row) => row.currency === currency && row.direction === 'GASTO').reduce((sum, row) => sum + Number(row.amount), 0),
    count: selectedRows.filter((row) => row.currency === currency).length,
  })).filter((total) => total.count), [selectedRows]);
  const pdfReady = status?.configured && status?.authenticated && status?.capabilities?.pdf;
  const isPDF = file?.name.toLowerCase().endsWith('.pdf');
  const currentStep = completion ? 3 : rows.length ? 2 : 1;

  const chooseFile = async (nextFile) => {
    if (!nextFile) return;
    clearDocument();
    const token = generationRef.current;
    const isCurrent = () => token === generationRef.current && profileId === activeProfileRef.current;
    const extension = nextFile.name.toLowerCase().split('.').pop();
    if (!['csv', 'pdf'].includes(extension)) { setError('Elige un CSV o PDF. Para Excel, exporta primero la hoja como CSV UTF-8.'); return; }
    const maxBytes = Math.min(MAX_STATEMENT_BYTES, Number(status?.limits?.maxPdfBytes) || MAX_STATEMENT_BYTES);
    if (!nextFile.size || nextFile.size > maxBytes) { setError(`El archivo debe tener contenido y pesar como máximo ${(maxBytes / 1_000_000).toFixed(0)} MB.`); return; }
    setFile(nextFile); setBusy('reading');
    try {
      const hash = await hashStatementFile(nextFile);
      if (!isCurrent()) return;
      if (extension === 'csv') {
        const content = await nextFile.text();
        if (!isCurrent()) return;
        if (content.includes('\uFFFD')) throw new Error('La codificación no es UTF-8. Exporta el CSV como UTF-8 y vuelve a cargarlo.');
        const csv = parseCSV(content);
        const initialOptions = { ...DEFAULT_OPTIONS, mapping: csv.mapping, amountMode: csv.mapping.amount >= 0 ? 'signed' : 'split' };
        setParsed(csv); setOptions(initialOptions);
        setRows(markImportDuplicates(mapCSVRows(csv, initialOptions), existingRef.current, hash));
      }
      setFileHash(hash);
    } catch (failure) {
      if (isCurrent()) { setError(failure.message || 'No pudimos leer este archivo.'); setFileHash(''); }
    } finally { if (isCurrent()) setBusy(''); }
  };

  const updateOptions = (patch) => {
    const next = { ...options, ...patch };
    setOptions(next);
    if (parsed) setRows(markImportDuplicates(mapCSVRows(parsed, next), existing, fileHash));
  };

  const analyzePDF = async () => {
    if (!isPDF || !consent || !fileHash || busy || fileTaskRef.current) return;
    const token = generationRef.current;
    const isCurrent = () => token === generationRef.current && profileId === activeProfileRef.current;
    const controller = new AbortController();
    fileTaskRef.current = controller; setBusy('analyzing'); setError('');
    try {
      const base64 = await statementFileBase64(file);
      if (!isCurrent() || controller.signal.aborted) return;
      const result = await requestAI('analyze', { file: { name: file.name, mime: 'application/pdf', base64, sha256: fileHash }, consent: true }, { signal: controller.signal });
      if (!isCurrent() || controller.signal.aborted) return;
      const nextRows = extractionToRows(result);
      setExtraction(result); setRows(markImportDuplicates(nextRows, existingRef.current, fileHash));
      setConsent(false);
    } catch (failure) {
      if (isCurrent() && !controller.signal.aborted) setError(failure.message || 'No se pudo analizar el documento. Puedes importar un CSV.');
    } finally {
      if (isCurrent()) { setBusy(''); fileTaskRef.current = null; }
    }
  };

  const editRow = (sourceIndex, patch) => {
    setRows((current) => {
      const edited = current.map((row) => row.sourceIndex === sourceIndex ? { ...row, ...patch, selected: false } : row);
      return markImportDuplicates(edited, existing, fileHash).map((row, index) => ({ ...row, selected: row.exactDuplicate ? false : row.sourceIndex !== sourceIndex && edited[index].potentialDuplicate === row.potentialDuplicate ? edited[index].selected : row.selected }));
    });
  };

  const selectRow = (sourceIndex, selected) => {
    setRows((current) => current.map((row) => row.sourceIndex === sourceIndex ? { ...row, selected: selected && !row.exactDuplicate && validateImportRow(row).length === 0 } : row));
  };

  const commitImport = () => {
    if (committingRef.current || !selectedRows.length || busy) return;
    committingRef.current = true; setError('');
    try {
      if (typeof onImportTransactions !== 'function') throw new Error('No se pudo conectar la importación con tus movimientos. Recarga la aplicación.');
      const transactions = rowsToTransactions(rows, fileHash, { institution: extraction?.statement?.institution, paymentMethod });
      const result = onImportTransactions(transactions);
      clearDocument();
      setCompletion({ added: result?.added ?? transactions.length, skipped: result?.skipped ?? 0 });
    } catch (failure) { setError(failure.message || 'No se guardaron los movimientos. Puedes volver a intentarlo.'); }
    finally { committingRef.current = false; }
  };

  const downloadTemplate = () => {
    // Headers only: never add sample transactions to a personal ledger.
    const csv = '\uFEFFfecha,descripcion,monto,moneda,categoria\r\n';
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'plantilla-movimientos.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <section className="min-w-0 space-y-6 text-slate-100" aria-labelledby={`${id}-title`}>
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#7DE4BF]"><FileCheck2 size={15} aria-hidden="true" /> Tu dinero, en orden</div>
          <h1 id={`${id}-title`} className="text-3xl font-semibold tracking-tight sm:text-4xl">De tu estado de cuenta<br className="hidden sm:block" /> a tus movimientos.</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#A4B1C3]">Importa, revisa y decide qué guardar. Tú confirmas cada cambio; tus cuentas siguen bajo tu control.</p>
        </div>
        <button type="button" onClick={downloadTemplate} className={`${SECONDARY} shrink-0 self-start lg:self-auto`}><Download size={16} aria-hidden="true" /> Descargar plantilla CSV</button>
      </header>

      <ol className="grid grid-cols-3 rounded-2xl border border-[#223248] bg-[#111B29] p-2" aria-label="Progreso de importación">
        {['Importar', 'Revisar', 'Listo'].map((label, index) => <li key={label} aria-current={currentStep === index + 1 ? 'step' : undefined} className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-medium sm:gap-3 sm:text-sm ${currentStep === index + 1 ? 'bg-[#223248] text-white' : currentStep > index + 1 ? 'text-[#7DE4BF]' : 'text-[#A4B1C3]'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs ${currentStep >= index + 1 ? 'border-[#7DE4BF]/40 text-[#7DE4BF]' : 'border-[#33445b]'}`}>{currentStep > index + 1 ? <Check size={13} aria-label="Completado" /> : index + 1}</span>{label}</li>)}
      </ol>

      {error && <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm leading-relaxed text-rose-100"><AlertCircle className="mt-0.5 shrink-0" size={18} aria-hidden="true" /><span>{error}</span></div>}

      {completion ? (
        <div className="relative overflow-hidden rounded-3xl border border-[#7DE4BF]/25 bg-[#111B29] px-6 py-14 text-center" role="status">
          <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#7DE4BF]/10 to-transparent" />
          <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#7DE4BF]/30 bg-[#7DE4BF]/10 text-[#7DE4BF]"><CheckCheck size={30} aria-hidden="true" /></div>
          <h2 className="relative text-2xl font-semibold">{completion.added ? `${completion.added} ${completion.added === 1 ? 'movimiento guardado' : 'movimientos guardados'}. Todo en su lugar.` : 'Estos movimientos ya estaban guardados.'}</h2>
          <p className="relative mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#A4B1C3]">{completion.skipped > 0 ? `${completion.skipped} ${completion.skipped === 1 ? 'registro repetido se omitió' : 'registros repetidos se omitieron'} al guardar. ` : ''}El archivo original se retiró de esta sesión. Puedes consultar y editar tus movimientos cuando lo necesites.</p>
          <div className="relative mt-7 flex flex-col justify-center gap-3 sm:flex-row"><button type="button" className={PRIMARY} onClick={() => onNavigateTab?.('transactions')}>Ver movimientos <ArrowRight size={16} aria-hidden="true" /></button><button type="button" className={SECONDARY} onClick={clearDocument}>Importar otro archivo</button></div>
          {completion.added > 0 && onOpenAssistant && <button type="button" onClick={onOpenAssistant} className="relative mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-lg px-3 text-sm text-[#B8AFF8] hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B8AFF8]"><Sparkles size={15} aria-hidden="true" /> Conversar sobre mis finanzas</button>}
        </div>
      ) : (
        <>
          {!file && <div className="grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(260px,1fr)]">
            <div className={`relative flex min-h-[330px] flex-col items-center justify-center rounded-3xl border border-dashed p-7 text-center transition-colors ${dragging ? 'border-[#7DE4BF] bg-[#7DE4BF]/10' : 'border-[#40516a] bg-[#111B29]'}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files?.[0]); }}>
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#7DE4BF]/20 bg-[#7DE4BF]/10 text-[#7DE4BF]"><UploadCloud size={30} strokeWidth={1.5} aria-hidden="true" /></div>
              <h2 className="text-xl font-semibold tracking-tight">Un archivo. Una vista más clara.</h2>
              <p id={`${id}-file-help`} className="mb-6 mt-2 max-w-sm text-sm leading-relaxed text-[#A4B1C3]">Arrastra tu CSV o PDF aquí.<br />Hasta 3 MB y {MAX_STATEMENT_ROWS} movimientos por archivo.</p>
              <label className={`${PRIMARY} relative cursor-pointer focus-within:ring-2 focus-within:ring-[#7DE4BF] focus-within:ring-offset-2 focus-within:ring-offset-[#111B29]`}><UploadCloud size={16} aria-hidden="true" /> Elegir archivo<input ref={fileInputRef} type="file" accept=".csv,.pdf,text/csv,application/pdf" className="sr-only" aria-label="Elegir estado de cuenta CSV o PDF" aria-describedby={`${id}-file-help`} onChange={(event) => chooseFile(event.target.files?.[0])} /></label>
              <p className="mt-4 text-xs text-[#A4B1C3]">Nada se guarda hasta que tú lo confirmes.</p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex-1 rounded-2xl border border-[#223248] bg-[#111B29] p-5"><div className="mb-4 flex items-center justify-between"><FileSpreadsheet size={22} strokeWidth={1.5} className="text-[#7DE4BF]" aria-hidden="true" /><span className="rounded-full bg-[#7DE4BF]/10 px-2.5 py-1 text-[10px] font-semibold text-[#7DE4BF]">EN TU NAVEGADOR</span></div><h3 className="text-base font-semibold">CSV, directo y privado</h3><p className="mt-2 text-sm leading-relaxed text-[#A4B1C3]">Reconoce columnas, ajusta formatos y revisa posibles duplicados. El archivo se procesa en tu equipo.</p></div>
              <div className="flex-1 rounded-2xl border border-[#B8AFF8]/20 bg-[#111B29] p-5"><div className="mb-4 flex items-center justify-between"><Sparkles size={22} strokeWidth={1.5} className="text-[#B8AFF8]" aria-hidden="true" /><span className="rounded-full bg-[#B8AFF8]/10 px-2.5 py-1 text-[10px] font-semibold text-[#B8AFF8]">CON CLAUDE</span></div><h3 className="text-base font-semibold">PDF, con revisión asistida</h3><p className="mt-2 text-sm leading-relaxed text-[#A4B1C3]">Claude propone los movimientos y su referencia de página. Requiere conexión y tu consentimiento antes de enviar.</p></div>
            </div>
          </div>}

          {file && <div className="rounded-2xl border border-[#223248] bg-[#111B29] p-4 sm:p-5">
            <div className="flex min-w-0 items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${isPDF ? 'bg-[#B8AFF8]/10 text-[#B8AFF8]' : 'bg-[#7DE4BF]/10 text-[#7DE4BF]'}`}>{isPDF ? <FileText size={23} aria-hidden="true" /> : <FileSpreadsheet size={23} aria-hidden="true" />}</span><div className="min-w-0"><h2 className="break-all text-sm font-semibold">{file.name}</h2><p className="mt-1 text-xs text-[#A4B1C3]">{(file.size / 1000).toFixed(0)} KB · {isPDF ? 'PDF · revisión con Claude' : 'CSV · procesado en tu navegador'}</p></div></div><button type="button" onClick={clearDocument} className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[#A4B1C3] transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7DE4BF]" aria-label={busy === 'analyzing' ? 'Cancelar análisis y retirar archivo' : 'Retirar archivo y elegir otro'}><X size={19} aria-hidden="true" /></button></div>
            {busy === 'reading' && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-[#A4B1C3]"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> Leyendo el archivo de forma local…</p>}
            {isPDF && !rows.length && !extraction && !busy && fileHash && <div className="mt-5 border-t border-[#223248] pt-5">
              {pdfReady ? <><label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#B8AFF8]/20 bg-[#B8AFF8]/5 p-4"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#B8AFF8]" /><span><span className="block text-sm font-medium">Enviar este PDF a Claude para extraer movimientos</span><span className="mt-1 block text-xs leading-relaxed text-[#A4B1C3]">El contenido, incluidos los datos bancarios que contenga, se enviará a Anthropic a través del servidor. Envía solo documentos que puedas compartir. El original se mantiene en memoria en esta aplicación; revisa y selecciona las propuestas antes de guardarlas.</span></span></label><button type="button" disabled={!consent} onClick={analyzePDF} className={`${PRIMARY} mt-4`}><Sparkles size={16} aria-hidden="true" /> Analizar con Claude</button></> : <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-[#B8AFF8]" aria-hidden="true" /><div><p className="text-sm font-medium">{!status && !statusError ? 'Verificando conexión con Claude…' : !status?.configured ? 'Conecta Claude para analizar este PDF' : !status.authenticated ? 'Abre una sesión con Claude' : 'El análisis de PDF no está disponible'}</p><p className="mt-1 text-xs leading-relaxed text-[#A4B1C3]">{statusError || 'Puedes importar un CSV en tu navegador mientras habilitas la conexión.'}</p></div></div><div className="flex shrink-0 gap-2">{onOpenAssistant && <button type="button" className={SECONDARY} onClick={onOpenAssistant}>Abrir asistente <ChevronRight size={15} aria-hidden="true" /></button>}<button type="button" className={`${SECONDARY} !px-3`} onClick={() => setStatusRevision((value) => value + 1)} aria-label="Actualizar conexión con Claude"><RefreshCw size={16} aria-hidden="true" /></button></div></div>}
            </div>}
            {busy === 'analyzing' && <div role="status" className="mt-5 flex flex-col justify-between gap-4 border-t border-[#223248] pt-5 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><Loader2 size={19} className="mt-0.5 animate-spin text-[#B8AFF8] motion-reduce:animate-none" aria-hidden="true" /><div><p className="text-sm font-medium">Claude está leyendo tu estado de cuenta…</p><p className="mt-1 text-xs text-[#A4B1C3]">Puede tardar un momento. Aún no se ha guardado ningún movimiento.</p></div></div><button type="button" className={SECONDARY} onClick={clearDocument}>Cancelar y retirar PDF</button></div>}
          </div>}

          {extraction && rows.length === 0 && <div role="status" className="rounded-2xl border border-[#223248] bg-[#111B29] p-6"><h2 className="text-lg font-semibold">No se encontraron movimientos para importar</h2><p className="mt-2 text-sm leading-relaxed text-[#A4B1C3]">Claude reportó {extraction.coverage.pagesProcessed} páginas procesadas y ningún movimiento. Comprueba el documento; si contiene operaciones, intenta con un CSV.</p><button type="button" className={`${SECONDARY} mt-4`} onClick={clearDocument}>Elegir otro archivo</button></div>}

          {parsed && <div className="space-y-5 rounded-2xl border border-[#223248] bg-[#111B29] p-5 sm:p-6">
            <div><h2 className="text-base font-semibold">Confirma cómo leer tu CSV</h2><p className="mt-1 text-xs leading-relaxed text-[#A4B1C3]">Los cambios de formato regeneran la vista previa y restablecen tus ediciones y selecciones.</p></div>
            <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Field label="Formato de fecha"><select className={INPUT} value={options.dateFormat} onChange={(event) => updateOptions({ dateFormat: event.target.value })}><option value="">ISO o sin ambigüedad</option><option value="DMY">Día / mes / año</option><option value="MDY">Mes / día / año</option></select></Field>
              <Field label="Separador decimal"><select className={INPUT} value={options.decimalSeparator} onChange={(event) => updateOptions({ decimalSeparator: event.target.value })}><option value=".">Punto · 1,234.56</option><option value=",">Coma · 1.234,56</option></select></Field>
              <Field label={options.mapping.currency >= 0 ? 'Moneda en el archivo' : 'Moneda de los movimientos'}><select className={INPUT} disabled={options.mapping.currency >= 0} value={options.mapping.currency >= 0 ? 'column' : options.defaultCurrency} onChange={(event) => updateOptions({ defaultCurrency: event.target.value })}>{options.mapping.currency >= 0 ? <option value="column">Usar columna de moneda</option> : <><option value="">Seleccionar moneda…</option><option value="MXN">MXN · pesos mexicanos</option><option value="USD">USD · dólares</option></>}</select></Field>
              <Field label="Importes en el archivo"><select className={INPUT} value={options.amountMode} onChange={(event) => updateOptions({ amountMode: event.target.value })}><option value="signed">Una columna de monto</option><option value="split">Columnas de cargo y abono</option></select></Field>
            </div>
            {options.amountMode === 'signed' && options.mapping.direction < 0 && <Field label="Cómo interpretar el signo del monto"><select className={`${INPUT} sm:max-w-lg`} value={options.signConvention} onChange={(event) => updateOptions({ signConvention: event.target.value })}><option value="negative-expense">Negativo = gasto · positivo = ingreso</option><option value="positive-expense">Positivo = gasto · negativo = ingreso</option></select></Field>}
            <details className="group border-t border-[#223248] pt-4"><summary className="min-h-[36px] cursor-pointer rounded-lg text-sm font-medium text-[#A4B1C3] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#7DE4BF]">Revisar columnas detectadas <span className="ml-2 text-xs font-normal">{parsed.headers.length} columnas · separador {parsed.delimiter === '\t' ? 'tabulador' : `“${parsed.delimiter}”`}</span></summary><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[['date', 'Fecha'], ['description', 'Descripción'], ...(options.amountMode === 'signed' ? [['amount', 'Monto'], ['direction', 'Tipo (opcional)']] : [['debit', 'Cargo'], ['credit', 'Abono']]), ['currency', 'Moneda (opcional)'], ['category', 'Categoría (opcional)']].map(([key, label]) => <Field key={key} label={label}><select className={INPUT} value={options.mapping[key]} onChange={(event) => updateOptions({ mapping: { ...options.mapping, [key]: Number(event.target.value) } })}><option value={-1}>Sin columna</option>{parsed.headers.map((header, index) => <option key={index} value={index}>{index + 1}. {header}</option>)}</select></Field>)}</div></details>
          </div>}

          {rows.length > 0 && <div className="min-w-0 space-y-4">
            {extraction && <div className="rounded-2xl border border-[#B8AFF8]/25 bg-[#B8AFF8]/5 p-4 text-sm"><div className="flex items-center gap-2 font-medium text-[#D7D1FF]"><Sparkles size={16} aria-hidden="true" /> Propuestas de Claude · {extraction.coverage.pagesProcessed} {extraction.coverage.pagesProcessed === 1 ? 'página procesada' : 'páginas procesadas'}</div><p className="mt-2 text-xs leading-relaxed text-[#A4B1C3]">La cobertura reportada está completa, pero la extracción puede tener errores. Compara cada propuesta con el PDF y selecciónala después de revisarla. Los fragmentos de origen son referencias propuestas por Claude.</p>{extraction.coverage.warnings.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-200">{extraction.coverage.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>}</div>}
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h2 className="text-xl font-semibold tracking-tight">Revisa antes de guardar</h2><p className="mt-1 text-xs leading-relaxed text-[#A4B1C3]">{rows.length} movimientos · {selectedRows.length} seleccionados{reviewCount > 0 ? ` · ${reviewCount} con indicación de revisión` : ''}{exactCount > 0 ? ` · ${exactCount} ya importados` : ''}</p></div><div className="flex gap-2">{!isPDF && <button type="button" className={`${SECONDARY} !px-3 !text-xs`} onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: !row.exactDuplicate && !row.potentialDuplicate && !row.needsReview && validateImportRow(row).length === 0 })))}>Seleccionar sin alertas</button>}<button type="button" className={`${SECONDARY} !px-3 !text-xs`} disabled={!selectedRows.length} onClick={() => setRows((current) => current.map((row) => ({ ...row, selected: false })))}>Desmarcar todos</button></div></div>
            <p id={`${id}-review-help`} className="text-xs leading-relaxed text-[#A4B1C3]">Al seleccionar un movimiento confirmas sus datos. Los posibles duplicados pueden ser compras distintas: selecciónalos solo si deben conservarse. Las transferencias y pagos de tarjeta requieren clasificación manual.</p>
            <div className="min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#223248] bg-[#111B29]">
              <p className="border-b border-[#223248] bg-[#192638] px-4 py-2 text-[11px] text-[#A4B1C3] lg:hidden">Desliza la tabla horizontalmente para editar todos los campos →</p>
              <div tabIndex={0} role="region" aria-label="Tabla editable de movimientos a importar" aria-describedby={`${id}-review-help`} className="max-h-[600px] max-w-full overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#7DE4BF]">
                <table className="w-full min-w-[1050px] border-collapse text-left text-xs">
                  <caption className="sr-only">Movimientos propuestos. Corrige campos pendientes y selecciona los que deseas guardar.</caption>
                  <thead className="sticky top-0 z-10 bg-[#192638] text-[#A4B1C3]"><tr>{['Guardar', 'Fecha', 'Descripción', 'Monto', 'Moneda', 'Tipo', 'Categoría'].map((label) => <th key={label} scope="col" className="px-3 py-3 font-medium">{label}</th>)}</tr></thead>
                  <tbody>{validRows.map((row) => <React.Fragment key={row.sourceIndex}>
                    <tr className={`border-t border-[#223248] ${row.exactDuplicate ? 'opacity-55' : row.selected ? 'bg-[#7DE4BF]/[0.035]' : ''}`}>
                      <td className="w-[64px] px-3 py-3 align-top"><label className="flex min-h-[42px] min-w-[42px] cursor-pointer items-center justify-center"><input type="checkbox" checked={row.selected && !row.exactDuplicate && row.issues.length === 0} disabled={row.exactDuplicate || row.issues.length > 0} onChange={(event) => selectRow(row.sourceIndex, event.target.checked)} aria-label={`Guardar movimiento ${row.sourceIndex}: ${row.description || 'sin descripción'}`} aria-describedby={row.issues.length || row.needsReview || row.potentialDuplicate || row.exactDuplicate ? `${id}-row-${row.sourceIndex}-notes` : undefined} className="h-4 w-4 accent-[#7DE4BF] disabled:cursor-not-allowed" /></label></td>
                      <td className="w-[155px] px-3 py-3 align-top"><input type="date" value={row.date} onChange={(event) => editRow(row.sourceIndex, { date: event.target.value })} aria-label={`Fecha del movimiento ${row.sourceIndex}`} className={`${INPUT} !text-xs`} disabled={row.exactDuplicate} />{!row.date && row.originalDate && <p className="mt-1 text-[10px] text-amber-200">Original: {row.originalDate}</p>}</td>
                      <td className="min-w-[210px] px-3 py-3 align-top"><input type="text" value={row.description} maxLength={500} onChange={(event) => editRow(row.sourceIndex, { description: event.target.value })} aria-label={`Descripción del movimiento ${row.sourceIndex}`} className={`${INPUT} !text-xs`} disabled={row.exactDuplicate} /></td>
                      <td className="w-[130px] px-3 py-3 align-top"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={row.amount} onChange={(event) => editRow(row.sourceIndex, { amount: event.target.value })} aria-label={`Monto del movimiento ${row.sourceIndex}`} className={`${INPUT} text-right !text-xs tabular-nums`} disabled={row.exactDuplicate} /></td>
                      <td className="w-[105px] px-3 py-3 align-top"><select value={STATEMENT_CURRENCIES.includes(row.currency) ? row.currency : 'UNKNOWN'} onChange={(event) => editRow(row.sourceIndex, { currency: event.target.value })} aria-label={`Moneda del movimiento ${row.sourceIndex}`} className={`${INPUT} !px-2 !text-xs`} disabled={row.exactDuplicate}><option value="UNKNOWN">Elegir…</option><option value="MXN">MXN</option><option value="USD">USD</option></select></td>
                      <td className="w-[135px] px-3 py-3 align-top"><select value={row.direction} onChange={(event) => editRow(row.sourceIndex, { direction: event.target.value })} aria-label={`Tipo del movimiento ${row.sourceIndex}`} className={`${INPUT} !px-2 !text-xs ${row.direction === 'INGRESO' ? '!text-[#7DE4BF]' : ''}`} disabled={row.exactDuplicate}><option value="UNKNOWN">Clasificar…</option><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></td>
                      <td className="w-[155px] px-3 py-3 align-top"><input type="text" list={`${id}-categories`} value={row.category} maxLength={100} onChange={(event) => editRow(row.sourceIndex, { category: event.target.value })} aria-label={`Categoría del movimiento ${row.sourceIndex}`} className={`${INPUT} !text-xs`} disabled={row.exactDuplicate} /></td>
                    </tr>
                    {(row.issues.length > 0 || row.needsReview || row.potentialDuplicate || row.exactDuplicate || row.format === 'pdf') && <tr className="bg-[#0d1623]/50"><td colSpan={7} className="px-4 pb-3 pt-1"><div id={`${id}-row-${row.sourceIndex}-notes`} className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2 text-[11px] leading-relaxed">
                      {row.exactDuplicate ? <span className="flex items-center gap-1.5 text-[#A4B1C3]"><CheckCircle2 size={13} aria-hidden="true" /> Ya importado desde este archivo</span> : <>{row.issues.length > 0 && <span className="text-amber-200">Pendiente: {row.issues.join(' · ')}</span>}{row.potentialDuplicate && <span className="rounded-md bg-amber-400/10 px-2 py-1 text-amber-200">Posible duplicado · revisa antes de seleccionar</span>}{row.needsReview && <span className="text-[#C5BBFD]">{row.reviewReason}</span>}</>}
                      {row.format === 'pdf' && <details className="w-full text-[#A4B1C3]"><summary className="min-h-[30px] cursor-pointer rounded-md pt-1 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[#B8AFF8]">{row.evidenceEdited ? 'Referencia corregida por ti' : 'Referencia propuesta por Claude'} · {row.pageNumber ? `página ${row.pageNumber}` : 'página pendiente'}</summary><div className="mt-3 grid max-w-3xl gap-3 rounded-xl border border-[#223248] p-3 sm:grid-cols-[140px_minmax(0,1fr)]"><Field label={`Página de origen · movimiento ${row.sourceIndex}`}><input type="number" min="1" max={row.totalPages} step="1" value={row.pageNumber ?? ''} onChange={(event) => editRow(row.sourceIndex, { pageNumber: event.target.value === '' ? null : Number(event.target.value), evidenceEdited: true })} disabled={row.exactDuplicate} className={`${INPUT} !text-xs`} /></Field><Field label={`Fragmento de origen · movimiento ${row.sourceIndex}`}><textarea rows={2} maxLength={1200} value={row.sourceText} onChange={(event) => editRow(row.sourceIndex, { sourceText: event.target.value, evidenceEdited: true })} disabled={row.exactDuplicate} className={`${INPUT} resize-y !text-xs`} placeholder="Copia únicamente el fragmento que respalda este movimiento, sin datos de cuenta." /></Field><p className="text-[11px] leading-relaxed sm:col-span-2">Contrasta la referencia con tu PDF. Si Claude no pudo identificarla, completa la página y el fragmento del movimiento para habilitar su selección.</p></div></details>}
                    </div></td></tr>}
                  </React.Fragment>)}</tbody>
                </table>
              </div>
              <datalist id={`${id}-categories`}>{STATEMENT_CATEGORIES.map((category) => <option key={category} value={category} />)}</datalist>
            </div>

            <div className="rounded-2xl border border-[#7DE4BF]/20 bg-[#111B29] p-5 sm:p-6">
              <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div className="min-w-0 flex-1"><h3 className="text-base font-semibold">Solo se guardará lo que selecciones</h3><p className="mt-1 text-xs text-[#A4B1C3]">{selectedRows.length} de {rows.length} movimientos listos. Los importes se mantienen en su moneda original.</p>{totals.length > 0 && <div className="mt-4 flex flex-wrap gap-5">{totals.map((total) => <div key={total.currency} className="border-l-2 border-[#33445b] pl-3"><p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[#A4B1C3]">{total.currency}</p><p className="text-sm tabular-nums"><span className="text-[#7DE4BF]">+{money(total.income, total.currency)}</span><span className="mx-2 text-slate-600">/</span><span className="text-slate-200">−{money(total.expense, total.currency)}</span></p><p className="mt-1 text-[10px] text-[#A4B1C3]">Ingresos / gastos seleccionados</p></div>)}</div>}</div><div className="w-full space-y-3 lg:w-[260px]"><Field label="Cuenta o método de pago (etiqueta)"><input type="text" value={paymentMethod} maxLength={100} onChange={(event) => setPaymentMethod(event.target.value)} className={INPUT} placeholder="Por ejemplo, débito personal" /></Field><button type="button" onClick={commitImport} disabled={!selectedRows.length || !!busy} className={`${PRIMARY} w-full`}><Check size={17} aria-hidden="true" /> Guardar {selectedRows.length || ''} {selectedRows.length === 1 ? 'movimiento' : 'movimientos'}</button></div></div>
            </div>
          </div>}

          <div className="flex items-start gap-2 px-1 text-xs leading-relaxed text-[#A4B1C3]"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-[#7DE4BF]" aria-hidden="true" /><p>Tu CSV se procesa en el navegador. Un PDF solo se envía a Claude con tu consentimiento. La aplicación guarda los movimientos que confirmas y su referencia de origen; no almacena el documento original.</p></div>
        </>
      )}
    </section>
  );
}

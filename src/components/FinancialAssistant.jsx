import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft, ArrowRight, ArrowUp, Check, CircleHelp, FileText,
  KeyRound, Loader2, LockKeyhole, LogOut, MessageSquare, Plus, RefreshCw,
  ShieldCheck, Sparkles, Square, WalletCards, X,
} from 'lucide-react';
import { buildAIContext } from '../services/aiContext.js';
import { connectAI, disconnectAI, getAIStatus, requestAI } from '../services/aiClient.js';

const SUGGESTIONS = [
  { icon: WalletCards, title: 'Encuentra margen', description: 'Una lectura de tu presupuesto.', question: '¿Qué parte de mi presupuesto podría revisar para tener más margen mensual? Distingue las estimaciones de los gastos registrados.' },
  { icon: ArrowDownLeft, title: 'Entiende tus gastos', description: 'Pon las categorías en perspectiva.', question: '¿Dónde se concentra mi gasto registrado este mes y qué información falta para evaluarlo mejor?' },
  { icon: CircleHelp, title: 'Aclara tus números', description: 'Una explicación, paso a paso.', question: 'Explícame la diferencia entre mi margen mensual estimado y el resultado de los movimientos que he registrado.' },
];

const money = (value, currency = 'MXN') => value == null ? 'Por confirmar' : new Intl.NumberFormat('es-MX', { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
const basisLabel = basis => ({ datos_incompletos: 'Datos incompletos', estimacion_declarada: 'Estimación declarada', presupuesto_incompleto: 'Presupuesto incompleto', presupuesto: 'Presupuesto', estimacion: 'Estimación', movimientos_registrados: 'Movimientos registrados', saldos_registrados: 'Saldo registrado' }[basis] || basis);
const monthLabel = value => new Date(`${value}-01T12:00:00`).toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
const timeLabel = value => new Date(value).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

function AssistantMark({ large = false }) {
  return (
    <div aria-hidden="true" className={`relative grid shrink-0 place-items-center ${large ? 'h-36 w-36' : 'h-9 w-9 rounded-xl border border-[#B8AFF8]/20 bg-[#B8AFF8]/10'}`}>
      {large && <>
        <div className="absolute inset-0 rounded-full border border-[#B8AFF8]/10" />
        <div className="absolute inset-3 rounded-full border border-[#B8AFF8]/20" />
        <div className="absolute inset-7 rounded-full border border-[#B8AFF8]/30 bg-[radial-gradient(circle_at_35%_30%,#B8AFF8_0%,#726AA1_38%,#1E2638_75%)] shadow-[0_0_55px_-15px_#B8AFF8]" />
        <span className="absolute right-4 top-6 h-2 w-2 rounded-full bg-[#7DE4BF] shadow-[0_0_12px_#7DE4BF]" />
      </>}
      <Sparkles className={`relative ${large ? 'h-9 w-9 text-white' : 'h-4 w-4 text-[#B8AFF8]'}`} strokeWidth={1.5} />
    </div>
  );
}

function EvidenceList({ facts }) {
  return <dl className="divide-y divide-white/[0.06]">
    {facts.map(fact => <div key={fact.id} className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <dt className="break-words text-xs leading-relaxed text-slate-300">{fact.label}</dt>
        <dd className="mt-1 text-[10px] text-slate-500">{basisLabel(fact.basis)}</dd>
      </div>
      <dd data-sensitive="" className="shrink-0 pt-0.5 text-xs font-medium tabular-nums text-slate-100">{money(fact.amount, fact.currency)} {fact.amount == null ? '' : fact.currency}</dd>
    </div>)}
  </dl>;
}

function Answer({ message }) {
  const evidence = message.snapshot.facts.filter(fact => message.evidenceIds.includes(fact.id));
  return <article className="flex min-w-0 gap-3 sm:gap-4" aria-label="Respuesta de Claude">
    <AssistantMark />
    <div className="min-w-0 flex-1 pt-1.5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-slate-100">Claude</span>
        <span className="text-[10px] text-slate-500">{timeLabel(message.createdAt)}</span>
      </div>
      <div data-sensitive="" className="whitespace-pre-wrap break-words text-[14px] leading-[1.85] text-slate-300">{message.content}</div>
      <details className="mt-4 rounded-xl border border-white/[0.07] bg-[#080D14]/50 px-3 sm:px-4">
        <summary className="cursor-pointer py-3 text-xs text-[#B8AFF8] marker:text-[#B8AFF8]/50">
          {evidence.length > 0 ? `${evidence.length} cifras citadas` : 'Ver el resumen enviado'}
          <span className="ml-2 text-slate-500">· {monthLabel(message.snapshot.reportingMonth)}</span>
        </summary>
        <div className="pb-3">
          <p className="pb-1 text-[11px] leading-relaxed text-slate-500">Resumen calculado a las {timeLabel(message.snapshot.generatedAt)}. Importes en MXN; los datos de esta respuesta conservan su fecha de consulta.</p>
          <EvidenceList facts={evidence.length ? evidence : message.snapshot.facts} />
          {message.model && <p className="pt-2 text-[10px] text-slate-500">Modelo utilizado: {message.model}</p>}
        </div>
      </details>
    </div>
  </article>;
}

export default function FinancialAssistant({ financialData, exchangeRateData, initialPrompt = '', promptRequest = 0, onImportStatement, onOpenPlans }) {
  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState('');
  const [checking, setChecking] = useState(true);
  const [accessPending, setAccessPending] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState(initialPrompt.slice(0, 1500));
  const [messages, setMessages] = useState([]);
  const [pendingQuestion, setPendingQuestion] = useState('');
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState('');
  const statusController = useRef(null);
  const accessController = useRef(null);
  const chatController = useRef(null);
  const inputRef = useRef(null);
  const latestReplyRef = useRef(null);
  const mounted = useRef(false);
  const profileId = financialData?.profileId;
  const context = useMemo(() => buildAIContext(financialData, exchangeRateData, { timeZone: 'America/Mexico_City' }), [financialData, exchangeRateData]);
  const connected = status?.configured === true && status?.authenticated === true && status?.capabilities?.chat === true;
  const pending = Boolean(pendingQuestion);
  const margin = context.facts.find(fact => fact.id === 'budget.margin');
  const spending = context.facts.find(fact => fact.id === 'recorded.expenses');

  const refreshStatus = async () => {
    statusController.current?.abort();
    const controller = new AbortController();
    statusController.current = controller;
    setChecking(true);
    setStatusError('');
    try {
      const result = await getAIStatus({ signal: controller.signal });
      if (!controller.signal.aborted && mounted.current) setStatus(result);
    } catch (error) {
      if (error.name !== 'AbortError' && mounted.current && !controller.signal.aborted) {
        setStatus(null);
        setStatusError(error.message);
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) setChecking(false);
    }
  };

  useEffect(() => {
    mounted.current = true;
    setMessages([]);
    setConsent(false);
    setPendingQuestion('');
    setFailure(null);
    setNotice('');
    setAccessError('');
    setAccessPending(false);
    setQuestion('');
    refreshStatus();
    return () => {
      mounted.current = false;
      statusController.current?.abort();
      accessController.current?.abort();
      chatController.current?.abort();
    };
  }, [profileId]);

  useEffect(() => {
    if (initialPrompt) {
      setQuestion(initialPrompt.slice(0, 1500));
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [initialPrompt, promptRequest]);

  useEffect(() => {
    if (messages.length) latestReplyRef.current?.scrollIntoView({ behavior: 'auto', block: 'nearest' });
  }, [messages.length]);

  const handleConnect = async event => {
    event.preventDefault();
    if (accessPending) return;
    const controller = new AbortController();
    accessController.current = controller;
    statusController.current?.abort();
    setChecking(false);
    setAccessPending(true);
    setAccessError('');
    try {
      const result = await connectAI('', { signal: controller.signal });
      if (!controller.signal.aborted && mounted.current) {
        setStatus(result);
            setStatusError('');
        setNotice('Conexión lista. Revisa el resumen y autoriza su envío para hacer tu primera pregunta.');
        inputRef.current?.focus({ preventScroll: true });
      }
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted && mounted.current) setAccessError(error.message);
    } finally {
      if (!controller.signal.aborted && mounted.current) setAccessPending(false);
    }
  };

  const handleDisconnect = async () => {
    if (accessPending) return;
    chatController.current?.abort();
    statusController.current?.abort();
    setChecking(false);
    setPendingQuestion('');
    setMessages([]);
    setQuestion('');
    setFailure(null);
    setConsent(false);
    setNotice('');
    setAccessError('');
    setAccessPending(true);
    const controller = new AbortController();
    accessController.current = controller;
    try {
      const result = await disconnectAI({ signal: controller.signal });
      if (!controller.signal.aborted && mounted.current) { setStatus(result); setNotice('Conversación terminada. Autoriza el contexto cuando quieras hacer otra consulta.'); }
    } catch (error) {
      if (error.name !== 'AbortError' && !controller.signal.aborted && mounted.current) {
        setStatus(null);
        setStatusError('No se pudo actualizar la conversación. Revisa la conexión.');
        setAccessError(error.message);
      }
    } finally {
      if (!controller.signal.aborted && mounted.current) setAccessPending(false);
    }
  };

  const sendQuestion = async requestedQuestion => {
    const text = requestedQuestion.trim();
    if (!text || text.length > 1500 || !connected || !consent || pending || accessPending) return;
    const controller = new AbortController();
    chatController.current = controller;
    const snapshot = buildAIContext(financialData, exchangeRateData, { timeZone: 'America/Mexico_City' });
    const history = messages.slice(-8).map(message => ({ role: message.role, content: message.content.slice(0, 4000) }));
    setQuestion(text);
    setPendingQuestion(text);
    setFailure(null);
    setNotice('');
    try {
      const response = await requestAI('chat', { question: text, history, context: snapshot, consent: true }, { signal: controller.signal });
      if (controller.signal.aborted || !mounted.current) return;
      if (typeof response.answer !== 'string' || !response.answer.trim()) throw new Error('Claude no devolvió una respuesta. Tu pregunta sigue aquí para volver a intentarlo.');
      const timestamp = new Date().toISOString();
      const knownIds = new Set(snapshot.facts.map(fact => fact.id));
      const evidenceIds = Array.isArray(response.evidenceIds) ? [...new Set(response.evidenceIds.filter(id => knownIds.has(id)))] : [];
      setMessages(previous => [...previous.slice(-18),
        { role: 'user', content: text, createdAt: timestamp },
        { role: 'assistant', content: response.answer, snapshot, evidenceIds, model: typeof response.model === 'string' ? response.model : '', createdAt: timestamp },
      ]);
      setQuestion('');
    } catch (error) {
      if (controller.signal.aborted || !mounted.current) return;
      if (error.status === 401 || error.status === 403) {
        setStatus(previous => previous ? { ...previous, authenticated: false } : previous);
        setConsent(false);
      }
      setFailure({ question: text, message: error.message });
    } finally {
      if (chatController.current === controller && !controller.signal.aborted && mounted.current) setPendingQuestion('');
    }
  };

  const stopQuestion = () => {
    chatController.current?.abort();
    setPendingQuestion('');
    setNotice('Consulta detenida. Puedes editar tu pregunta y enviarla de nuevo.');
  };

  const newConversation = () => {
    chatController.current?.abort();
    setPendingQuestion('');
    setMessages([]);
    setQuestion('');
    setFailure(null);
    setNotice('Nueva conversación lista.');
    inputRef.current?.focus();
  };

  const useSuggestion = text => {
    setQuestion(text);
    setFailure(null);
    inputRef.current?.focus();
  };

  const statusLabel = checking ? 'Verificando conexión' : statusError ? 'Conexión pendiente' : !status?.configured ? 'Pendiente de configurar'
    : !status.authenticated ? 'Acceso requerido' : connected ? 'Claude conectado' : 'Consulta no habilitada';

  return <div className="mx-auto max-w-[1320px] space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="eyebrow text-[#B8AFF8]">INTELIGENCIA FINANCIERA</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Tu espacio con Claude</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span role="status" className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-300">
          {checking ? <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" /> : <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-[#7DE4BF]' : statusError ? 'bg-amber-300' : 'bg-slate-500'}`} />}
          {statusLabel}
        </span>
        {messages.length > 0 && <button type="button" onClick={newConversation} className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"><Plus className="h-4 w-4" />Nueva conversación</button>}
        {status?.authenticated && <button type="button" onClick={handleDisconnect} disabled={accessPending} aria-label="Terminar conversación" title="Terminar conversación" className="button-secondary grid h-9 w-9 place-items-center disabled:opacity-50"><LogOut className="h-4 w-4" /></button>}
      </div>
    </header>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_310px]">
      <div className="min-w-0 space-y-5">
        {messages.length === 0 && <section className="surface-card relative overflow-hidden rounded-3xl border border-[#B8AFF8]/15 bg-[linear-gradient(115deg,#171E32_0%,#111B29_55%,#17222D_100%)] p-6 sm:p-8">
          <div className="relative z-10 max-w-[440px] sm:pr-16">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#B8AFF8]/20 bg-[#B8AFF8]/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#B8AFF8]"><Sparkles className="h-3 w-3" />Con Claude</div>
            <h2 className="max-w-[360px] text-[28px] font-medium leading-[1.2] tracking-[-0.035em] text-white sm:text-[36px]">Pon tus números<br /><span className="text-[#B8AFF8]">en perspectiva.</span></h2>
            <p className="mt-4 max-w-[330px] text-sm leading-relaxed text-slate-400">Haz una pregunta. Explora tu presupuesto, entiende tus gastos y revisa las cifras detrás de cada respuesta.</p>
          </div>
          <div className="pointer-events-none absolute -right-9 -top-3 opacity-50 sm:right-3 sm:top-12 sm:opacity-100"><AssistantMark large /></div>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-4 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#7DE4BF]" />Tú autorizas el contexto</span>
            <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-[#B8AFF8]" />Cifras consultables</span>
          </div>
        </section>}

        {!checking && (!connected || statusError) && <section aria-label="Conexión con Claude" className="surface-card rounded-2xl border border-white/[0.08] bg-[#111B29] p-5">
          {statusError ? <>
            <p className="text-sm font-medium text-amber-200">No pudimos verificar la conexión</p>
            <p role="alert" className="mt-2 text-xs leading-relaxed text-slate-400">{statusError}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={refreshStatus} className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />Verificar conexión</button>
              <button type="button" onClick={handleDisconnect} disabled={accessPending} className="button-secondary inline-flex items-center gap-2 px-3 py-2 text-xs disabled:opacity-50"><LogOut className="h-3.5 w-3.5" />Terminar conversación</button>
            </div>
          </> : !status?.configured ? <>
            <div className="flex items-start gap-3"><div className="rounded-xl bg-[#B8AFF8]/10 p-2.5 text-[#B8AFF8]"><LockKeyhole className="h-4 w-4" /></div><div><h2 className="text-sm font-medium text-slate-100">Claude está pendiente de configuración</h2><p className="mt-1 text-xs leading-relaxed text-slate-400">Puedes explorar tu resumen y preparar una pregunta. El chat estará disponible cuando se conecte el servicio.</p></div></div>
            <details className="mt-4 rounded-xl bg-[#080D14]/60 px-4">
              <summary className="cursor-pointer py-3 text-xs text-[#B8AFF8]">Cómo habilitar la conexión</summary>
              <div className="space-y-2 pb-4 text-xs leading-relaxed text-slate-400">
                <p>La persona que administra esta instalación debe configurar el servicio seguro de Claude siguiendo la sección de IA del README del proyecto.</p>
                <p>Claude se habilita para tu cuenta cuando el servicio está configurado. No necesitas un código adicional.</p>
                <button type="button" onClick={refreshStatus} className="button-secondary mt-1 inline-flex items-center gap-2 px-3 py-2 text-xs"><RefreshCw className="h-3.5 w-3.5" />Verificar configuración</button>
              </div>
            </details>
          </> : !status.authenticated ? <form onSubmit={handleConnect} className="space-y-3">
            <div className="flex items-center gap-2"><KeyRound className="h-4 w-4 text-[#B8AFF8]" /><h2 className="text-sm font-medium text-slate-100">Conecta tu acceso a Claude</h2></div>
            <p className="text-xs leading-relaxed text-slate-400">El acceso a Claude está vinculado a tu cuenta de Sifran.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button type="submit" disabled={accessPending} className="button-primary inline-flex items-center justify-center gap-2 rounded-xl bg-[#B8AFF8] px-4 py-2.5 text-xs font-semibold text-[#101626] disabled:cursor-not-allowed disabled:opacity-40">{accessPending ? <Loader2 className="h-4 w-4 motion-safe:animate-spin" /> : <ArrowRight className="h-4 w-4" />}{accessPending ? 'Conectando…' : 'Conectar Claude'}</button>
            </div>
            {accessError && <p id="claude-access-error" role="alert" className="text-xs text-rose-300">{accessError}</p>}
          </form> : <><h2 className="text-sm font-medium text-slate-100">El chat no está habilitado para este acceso</h2><p className="mt-2 text-xs text-slate-400">Revisa las funciones disponibles para tu instalación.</p>{onOpenPlans && <button type="button" onClick={onOpenPlans} className="button-secondary mt-3 px-3 py-2 text-xs">Ver funciones</button>}</>}
        </section>}

        {messages.length === 0 && <div className="grid gap-2.5 sm:grid-cols-3" aria-label="Preguntas para comenzar">
          {SUGGESTIONS.map(({ icon: Icon, title, description, question: suggested }) => <button key={title} type="button" disabled={pending} onClick={() => useSuggestion(suggested)} className="group flex flex-col items-start rounded-2xl border border-white/[0.08] bg-[#111B29]/70 p-4 text-left transition duration-200 hover:border-[#B8AFF8]/30 hover:bg-[#B8AFF8]/[0.05] motion-safe:hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8AFF8] disabled:opacity-40">
            <Icon className="mb-3 h-4 w-4 text-[#B8AFF8]" strokeWidth={1.6} />
            <span className="text-xs font-medium text-slate-200">{title}</span><span className="mt-1 text-[11px] leading-relaxed text-slate-500">{description}</span>
          </button>)}
        </div>}

        {(messages.length > 0 || pending) && <section role="log" aria-live="polite" aria-busy={pending} aria-label="Conversación con Claude" className="surface-card space-y-7 rounded-2xl border border-white/[0.07] bg-[#111B29]/70 p-4 sm:p-6">
          {messages.map((message, index) => message.role === 'user'
            ? <div key={`${message.createdAt}-${index}`} className="flex justify-end"><div className="max-w-[92%] rounded-2xl rounded-br-md border border-[#B8AFF8]/15 bg-[#B8AFF8]/[0.08] px-4 py-3 sm:max-w-[85%]"><p className="mb-1 text-[10px] font-medium text-[#B8AFF8]">Tú</p><p data-sensitive="" className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-200">{message.content}</p></div></div>
            : <Answer key={`${message.createdAt}-${index}`} message={message} />)}
          {pending && <>
            <div className="flex justify-end"><div data-sensitive="" className="max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md border border-[#B8AFF8]/15 bg-[#B8AFF8]/[0.08] px-4 py-3 text-sm leading-relaxed text-slate-200">{pendingQuestion}</div></div>
            <div role="status" className="flex items-center gap-3"><AssistantMark /><span className="text-xs text-slate-400">Claude está revisando tu resumen…</span><Loader2 className="h-3.5 w-3.5 text-[#B8AFF8] motion-safe:animate-spin" /></div>
          </>}
          <div ref={latestReplyRef} />
        </section>}

        {failure && <div role="alert" className="rounded-xl border border-rose-300/15 bg-rose-300/[0.04] p-4"><p className="text-xs leading-relaxed text-rose-200">{failure.message}</p><button type="button" disabled={!connected || !consent || pending} onClick={() => sendQuestion(failure.question)} className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-rose-200 disabled:opacity-40"><RefreshCw className="h-3.5 w-3.5" />Reintentar pregunta</button></div>}
        {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"><p className="flex-1 text-xs leading-relaxed text-slate-400">{notice}</p><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')} className="-m-1 shrink-0 p-1 text-slate-400 hover:text-white"><X className="h-3.5 w-3.5" /></button></div>}

        <form onSubmit={event => { event.preventDefault(); sendQuestion(question); }} className="rounded-2xl border border-[#B8AFF8]/25 bg-[#111B29] p-3 shadow-[0_8px_32px_-20px_#B8AFF8] focus-within:border-[#B8AFF8]/60 sm:p-4">
          <label htmlFor="claude-question" className="sr-only">Tu pregunta para Claude</label>
          <textarea ref={inputRef} id="claude-question" value={question} onChange={event => { setQuestion(event.target.value); setFailure(null); }} onKeyDown={event => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) { event.preventDefault(); sendQuestion(question); }
          }} disabled={pending} rows={3} maxLength={1500} placeholder="¿Qué te gustaría entender de tus finanzas?" aria-describedby="claude-question-help" className="w-full resize-y rounded-lg border-0 bg-transparent px-1 py-1 text-sm leading-relaxed text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-60" />
          <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
            <span className="text-[10px] text-slate-500">{question.length}/1,500<span className="ml-3 hidden sm:inline">Ctrl/⌘ + Enter para enviar</span></span>
            {pending ? <button type="button" onClick={stopQuestion} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5"><Square className="h-3.5 w-3.5" />Detener</button>
              : <button type="submit" disabled={!connected || !consent || !question.trim() || accessPending} className="inline-flex items-center gap-2 rounded-xl bg-[#B8AFF8] px-4 py-2.5 text-xs font-semibold text-[#101626] transition hover:bg-[#C9C2FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B8AFF8] disabled:cursor-not-allowed disabled:bg-white/[0.06] disabled:text-slate-500">Preguntar a Claude<ArrowUp className="h-4 w-4" /></button>}
          </div>
          <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-xl bg-[#080D14]/60 px-3 py-3">
            <input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={pending} className="mt-0.5 h-4 w-4 shrink-0 accent-[#B8AFF8]" />
            <span className="text-[11px] leading-relaxed text-slate-400"><span className="font-medium text-slate-200">Enviar resumen financiero a Claude.</span> Autorizo el envío de los agregados visibles, mi pregunta y los últimos mensajes de esta conversación a Anthropic.</span>
          </label>
          <p id="claude-question-help" className="mt-3 px-1 text-[10px] leading-relaxed text-slate-500">Evita números de cuenta o datos personales en tu pregunta. Claude puede equivocarse; contrasta sus respuestas con las cifras consultadas.</p>
        </form>
        <p className="flex items-center justify-center gap-1.5 px-3 text-center text-[10px] leading-relaxed text-slate-500"><MessageSquare className="h-3 w-3 shrink-0" />La conversación permanece en memoria mientras estés en esta vista.</p>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6" aria-label="Resumen y herramientas de Claude">
        <section className="surface-card overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111B29]">
          <div className="border-b border-white/[0.07] p-5">
            <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-medium text-slate-100">El contexto de tu pregunta</h2><span className="rounded bg-[#7DE4BF]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#7DE4BF]">Resumen</span></div>
            <p className="mt-2 text-xs capitalize text-slate-500">{monthLabel(context.reportingMonth)} · MXN</p>
          </div>
          <div className="space-y-4 p-5">
            <div><p className="text-[11px] text-slate-400">Margen mensual estimado</p><p data-sensitive="" className={`mt-1 text-2xl font-medium tracking-tight tabular-nums ${margin?.amount < 0 ? 'text-rose-300' : 'text-[#7DE4BF]'}`}>{margin ? money(margin.amount) : 'Dato pendiente'}</p><p className="mt-1 text-[10px] text-slate-500">Presupuesto · antes del aporte extra</p></div>
            <div className="border-t border-white/[0.06] pt-4"><p className="text-[11px] text-slate-400">Gastos registrados este mes</p><p data-sensitive="" className="mt-1 text-xl font-medium tabular-nums text-slate-100">{spending ? money(spending.amount) : 'Sin movimientos'}</p><p className="mt-1 text-[10px] text-slate-500">{context.coverage.transactionCount} movimientos válidos hasta hoy</p></div>
            <div className="rounded-xl border border-white/[0.05] bg-[#080D14]/50 p-3 text-[10px] leading-relaxed text-slate-500">{context.coverage.transactionCount ? `Cobertura registrada: ${context.coverage.firstDate} al ${context.coverage.lastDate}.` : 'Aún no hay movimientos válidos para este periodo.'} El resumen no acredita una conciliación bancaria completa.</div>
          </div>
          <details className="border-t border-white/[0.07] px-5">
            <summary className="cursor-pointer py-4 text-xs font-medium text-[#B8AFF8] marker:text-[#B8AFF8]/60">Ver los {context.facts.length} agregados del resumen</summary>
            <div className="pb-4"><EvidenceList facts={context.facts} /><p className="mt-3 text-[10px] leading-relaxed text-slate-500">Conversión: 1 USD = {context.fx.rate.toLocaleString('es-MX', { maximumFractionDigits: 4 })} MXN. {context.fx.source}.{context.fx.asOf ? ` Fecha del tipo de cambio: ${new Date(context.fx.asOf).toLocaleDateString('es-MX')}.` : ' Sin fecha de observación disponible.'}</p></div>
          </details>
          <div className="flex items-start gap-2 border-t border-white/[0.07] bg-[#7DE4BF]/[0.025] px-5 py-4"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7DE4BF]" /><p className="text-[10px] leading-relaxed text-slate-400">El resumen omite descripciones de movimientos, nombres de cuentas y datos de tu perfil.</p></div>
        </section>

        <section className="rounded-2xl border border-[#B8AFF8]/15 bg-[linear-gradient(130deg,#1B2337,#111B29)] p-5">
          <div className="flex items-center justify-between"><div className="grid h-10 w-10 place-items-center rounded-xl border border-[#B8AFF8]/15 bg-[#B8AFF8]/10"><FileText className="h-5 w-5 text-[#B8AFF8]" strokeWidth={1.5} /></div><span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[#B8AFF8]">Documentos</span></div>
          <h2 className="mt-4 text-sm font-medium text-slate-100">Del estado de cuenta<br />a tus movimientos</h2>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">Importa un CSV o extrae un PDF con Claude. Revisa la vista previa antes de guardar.</p>
          {onImportStatement && <button type="button" onClick={onImportStatement} className="mt-4 flex w-full items-center justify-between rounded-xl border border-[#B8AFF8]/20 bg-[#B8AFF8]/[0.08] px-3 py-2.5 text-xs font-medium text-[#C7BFFC] transition hover:bg-[#B8AFF8]/15">Importar estado de cuenta<ArrowRight className="h-3.5 w-3.5" /></button>}
          <p className="mt-3 text-[10px] leading-relaxed text-slate-500">PDF requiere acceso habilitado a Claude.</p>
        </section>
      </aside>
    </div>
  </div>;
}

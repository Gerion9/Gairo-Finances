import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Cloud, CloudOff, Download, RefreshCw, Check, ArrowRight } from 'lucide-react';
import App from './App.jsx';
import Login from './components/Login.jsx';
import Brand from './components/Brand.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { claimAccount, getSession, SIGN_IN_PATH, SIGN_OUT_PATH } from './services/auth.js';
import { WorkspaceSync } from './services/workspaceSync.js';
import { createAccountBackup } from './services/backup.js';
import { downloadJSON } from './services/storage.js';
import { bindAIWorkspace, clearAIWorkspace } from './services/aiSession.js';

function ConnectedWorkspace({ account, onAccountChanged }) {
  const engine = useRef(null);
  const [snapshot, setSnapshot] = useState({ data: null, status: 'loading' });
  const [sessionNotice, setSessionNotice] = useState('');
  const recovering = useRef(false);
  const [verifying, setVerifying] = useState(false);
  const epoch = useRef(crypto.randomUUID());
  useEffect(() => {
    const sync = new WorkspaceSync(account.id, { onChange: value => {
      bindAIWorkspace({ accountId: account.id, workspaceRevision: value.revision, ready: value.status === 'saved' && !value.dirty, epoch: epoch.current });
      setSnapshot(value);
    } });
    engine.current = sync; sync.load();
    const check = () => { if (document.visibilityState === 'visible') sync.check(); };
    const timer = setInterval(check, 15_000);
    window.addEventListener('focus', check); window.addEventListener('online', check); document.addEventListener('visibilitychange', check);
    const beforeUnload = event => { if (sync.dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', beforeUnload);
    return () => { sync.dispose(); clearAIWorkspace(epoch.current); clearInterval(timer); window.removeEventListener('focus', check); window.removeEventListener('online', check); document.removeEventListener('visibilitychange', check); window.removeEventListener('beforeunload', beforeUnload); };
  }, [account.id, account.userId]);
  const downloadDraft = () => {
    if (!snapshot.data) return;
    let backup;
    try { backup = createAccountBackup(snapshot.data, account.id, snapshot.revision); }
    catch { backup = { format: 'sifran-account', schemaVersion: 1, accountId: account.id, revision: snapshot.revision, exportedAt: new Date().toISOString(), requiresReview: true, financialData: snapshot.data }; }
    downloadJSON(backup, `Sifran_${account.displayName}_borrador.json`);
  };
  const logout = () => {
    if (engine.current?.dirty && !window.confirm('Hay cambios pendientes de guardar. Descarga un respaldo o espera a que se guarden. ¿Salir y descartar los pendientes de esta pestaña?')) return;
    engine.current?.dispose(); clearAIWorkspace(epoch.current); setSnapshot({ data: null, status: 'leaving' });
    window.location.assign(SIGN_OUT_PATH);
  };
  const resume = async () => {
    if (recovering.current) return;
    recovering.current = true; setVerifying(true);
    const sync = engine.current;
    try {
      const current = await getSession({ signal: sync.controller.signal });
      const result = await sync.resumeSession(current, account.userId);
      if (result === 'pending') { setSessionNotice('La sesión todavía no está verificada. Tu borrador sigue aquí; termina de iniciar sesión y vuelve a verificar.'); return; }
      if (result === 'changed') {
        if (sync.dirty && !window.confirm(`Iniciaste sesión en otra cuenta. Para recuperar los pendientes, vuelve a entrar como ${account.displayName}. ¿Descartar este borrador y abrir la otra cuenta?`)) return;
        sync.dispose(); clearAIWorkspace(epoch.current); onAccountChanged(current);
      }
    } catch { if (sync.active) setSessionNotice('Aún no se pudo verificar la sesión. Mantén esta pestaña abierta para conservar el borrador.'); }
    finally { recovering.current = false; if (sync.active) setVerifying(false); }
  };
  if (snapshot.status === 'session') return <div className="min-h-screen grid place-items-center p-6"><div className="surface-card max-w-lg p-8"><Brand className="h-10 mb-8" /><h1 className="text-2xl text-white font-semibold">Vuelve a verificar tu acceso</h1><p className="text-slate-400 my-4">Tu espacio está oculto. Los cambios pendientes permanecen en esta pestaña y sólo se recuperan al verificar la misma cuenta.</p><p role="alert" className="text-amber-200 text-sm mb-5">{sessionNotice || snapshot.error}</p><button className="button-primary w-full" disabled={verifying} onClick={resume}><RefreshCw size={16} />{verifying ? 'Verificando…' : 'Ya inicié sesión, verificar'}</button><a className="button-secondary w-full mt-3" href={SIGN_IN_PATH} target="_blank" rel="noopener noreferrer">Iniciar sesión en otra pestaña <ArrowRight size={16} /></a></div></div>;
  if (!snapshot.data) return <div className="min-h-screen grid place-items-center p-6"><div className="surface-card max-w-md p-8"><Brand className="h-10 mb-8" /><p role="status" className="text-slate-300">{snapshot.error || 'Abriendo tu espacio sincronizado…'}</p>{snapshot.error && <button className="button-secondary mt-4" onClick={() => engine.current.load()}>Reintentar</button>}<button className="button-ghost mt-4" onClick={logout}>Cerrar sesión</button></div></div>;
  const blocked = ['conflict', 'remote', 'refreshing'].includes(snapshot.status);
  const labels = { saved: 'Guardado en la nube', pending: 'Cambios pendientes', saving: 'Guardando…', error: 'Sincronización pendiente', conflict: 'Hay cambios que revisar', remote: 'Cambios desde otro dispositivo', refreshing: 'Actualizando tu espacio…' };
  const syncBanner = <section id="sync-status" tabIndex={-1} aria-label="Estado de sincronización" className={'sync-strip ' + (blocked || snapshot.status === 'error' ? 'sync-strip-attention' : '')}>
    <div className="flex items-center gap-2 text-sm"><span aria-hidden="true">{snapshot.status === 'saved' ? <Check size={16} /> : snapshot.status === 'error' ? <CloudOff size={16} /> : <Cloud size={16} />}</span><span role="status"><strong>{account.displayName}</strong> · {labels[snapshot.status]}</span><button className="icon-button !w-7 !h-7" onClick={() => engine.current.check()} aria-label="Buscar cambios en la nube"><RefreshCw size={13} /></button></div>
    {(blocked || snapshot.status === 'error') && <div className="w-full pt-2"><p className="text-sm text-slate-300">{snapshot.error || (snapshot.dirty ? 'Conservamos tu borrador aquí. Descárgalo antes de abrir los cambios guardados.' : 'Actualiza para ver la versión guardada. Se cerrarán los formularios abiertos.')}</p><div className="flex flex-wrap gap-2 mt-3">{snapshot.dirty && <button className="button-secondary" onClick={downloadDraft}><Download size={15} />Descargar mi borrador</button>}{blocked ? <button className="button-primary" onClick={() => { if (!snapshot.dirty || window.confirm('Se abrirá la versión guardada y se descartarán los cambios pendientes de esta pestaña. Descarga tu borrador antes de continuar.')) engine.current.useCloud(); }}><RefreshCw size={15} />Abrir versión guardada</button> : <button className="button-primary" onClick={() => snapshot.dirty ? engine.current.flush() : engine.current.check()}>Reintentar sincronización</button>}</div></div>}
  </section>;
  return <ToastProvider key={`${account.userId}:${snapshot.generation}`}><App account={account} initialData={snapshot.data} revision={snapshot.revision} onDataChange={data => engine.current.edit(data)} onLogout={logout} isCurrent={() => Boolean(engine.current?.active && !['session', 'conflict', 'remote', 'refreshing'].includes(engine.current.status))} syncBanner={syncBanner} readOnly={blocked} onRestore={async (data, importBackup) => {
    const sync = engine.current;
    if (sync.status !== 'saved' || sync.dirty || sync.inFlight) throw new Error('Espera a que termine la sincronización antes de reemplazar registros.');
    const migration = importBackup && account.id === 'gairo' && sync.revision === 0;
    sync.edit(data);
    // Replacing a dataset also ends forms, imports and Undo from the previous one.
    sync.generation += 1; sync.emit();
    await sync.flush({ migration });
  }} /></ToastProvider>;
}

export default function SessionGate() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const request = useRef(null);
  const check = useCallback(async (claim = false) => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError('');
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try { const next = await (claim ? claimAccount : getSession)({ signal: controller.signal }); if (mounted.current && request.current === controller) setSession(next); }
    catch (failure) { if (mounted.current && request.current === controller) setError(failure.name === 'AbortError' ? 'La conexión tardó demasiado. Intenta de nuevo.' : failure.message); }
    finally { clearTimeout(timeout); if (mounted.current && request.current === controller) setLoading(false); }
  }, []);
  useEffect(() => { mounted.current = true; check(); return () => { mounted.current = false; request.current?.abort(); }; }, [check]);
  if (session?.access === 'allowed' && session.account) return <ConnectedWorkspace key={session.account.userId} account={session.account} onAccountChanged={setSession} />;
  return <Login session={session} loading={loading} error={error} onRetry={() => check()} onClaim={() => check(true)} />;
}

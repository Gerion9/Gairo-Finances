import React, { useState } from 'react';
import { ArrowRight, Check, Download, RefreshCw, ShieldCheck, Sparkles, Cloud } from 'lucide-react';
import Brand from './Brand';
import { SIGN_IN_PATH, SIGN_OUT_PATH } from '../services/auth.js';
import { downloadLegacyBackup, downloadRawLegacy } from '../services/storage.js';

export default function Login({ session, error = '', loading = false, onRetry, onClaim }) {
  const [localMessage, setLocalMessage] = useState('');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  const exportLegacy = raw => {
    try { raw ? downloadRawLegacy() : downloadLegacyBackup(); setLocalMessage('Copia descargada. Entra como Gairo en la versión conectada para importarla.'); }
    catch (failure) { setLocalMessage(failure.message); }
  };
  return <div className="login-page">
    <header className="login-header"><Brand className="h-11 w-auto" /><span className="login-header-note"><span aria-hidden="true" /> Tu espacio financiero personal</span></header>
    <main className="login-layout">
      <section className="login-editorial" aria-labelledby="login-editorial-title">
        <div className="login-kicker"><Cloud size={16} /> Tu información te acompaña</div>
        <h1 id="login-editorial-title">Tu dinero.<br /><span>En perspectiva.</span></h1>
        <p className="login-intro">Retoma tus movimientos, deudas y planes desde tu computadora, teléfono o tablet.</p>
        <div className="grid grid-cols-2 gap-4 my-8 max-w-sm" aria-label="Cuentas independientes">
          {['Gairo', 'Ricardo'].map((name, i) => <div key={name} className="rounded-2xl border border-slate-700/70 p-5 bg-slate-900/50"><span className={'inline-grid place-items-center w-11 h-11 rounded-xl mb-4 font-semibold ' + (i ? 'bg-violet-400/15 text-violet-200' : 'bg-emerald-300/15 text-emerald-200')}>{name[0]}</span><strong className="block text-lg text-white">{name}</strong><span className="text-sm text-slate-400">Espacio personal</span></div>)}
        </div>
        <div className="login-features"><p><Check size={16} /> Registros separados por cuenta</p><p><Check size={16} /> Guardado en la nube con confirmación</p><p><Check size={16} /> Preguntas a Claude con tu contexto</p></div>
      </section>
      <section className="login-form-card" aria-labelledby="login-form-title">
        <span className="login-form-icon"><ShieldCheck size={23} /></span><p className="eyebrow">Tu cuenta de Sifran</p>
        <h2 id="login-form-title">{session?.access === 'invited' ? `Bienvenido, ${session.invitedName}.` : 'Continúa donde estabas.'}</h2>
        <p className="login-form-intro">Usa el mismo acceso de ChatGPT en todos tus dispositivos. Sifran abrirá la cuenta vinculada a tu identidad.</p>
        {error && <p role="alert" className="login-error mb-5">{error}</p>}
        {loading ? <p role="status" className="flex items-center gap-3 py-4 text-slate-300"><span className="loading-spinner" />Verificando tu acceso…</p>
          : session?.access === 'invited' ? <button className="button-primary login-submit" onClick={onClaim}>Activar mi cuenta <ArrowRight size={18} /></button>
          : session?.authenticated ? <><p role="status" className="rounded-xl bg-amber-300/10 p-4 mb-5 text-sm text-amber-200">El acceso {session.email} todavía no tiene una cuenta asignada. Usa el correo autorizado para Gairo o Ricardo.</p><a href={SIGN_OUT_PATH} target="_top" className="button-secondary w-full">Cambiar acceso de ChatGPT</a></>
          : <a className="button-primary login-submit" href={local ? 'https://sifran.gairo.chatgpt.site' : SIGN_IN_PATH} target="_top">{local ? 'Abrir Sifran conectado' : 'Entrar con ChatGPT'}<ArrowRight size={18} /></a>}
        <button className="button-ghost mt-4 w-full" onClick={onRetry} disabled={loading}><RefreshCw size={15} />Verificar acceso</button>
        <p className="text-sm text-slate-400 mt-5 leading-relaxed">La recuperación de acceso y la contraseña se gestionan desde tu cuenta de ChatGPT.</p>
        {local && <details className="login-initial-access"><summary>Mover mis registros de este navegador</summary><div><p>Descarga tu copia anterior. En la versión conectada, entra como Gairo y selecciona Importar mis registros.</p><button className="button-secondary mt-3 w-full" onClick={() => exportLegacy(false)}><Download size={16} />Descargar copia para Gairo</button><button className="button-ghost mt-2 w-full" onClick={() => exportLegacy(true)}>Recuperar archivo original</button>{localMessage && <p role="status" className="text-sm mt-3">{localMessage}</p>}</div></details>}
      </section>
    </main>
    <footer className="login-footer"><span className="inline-flex items-center gap-2"><Sparkles size={14} />Más claridad para lo que sigue.</span><span>Sifran · {new Date().getFullYear()}</span></footer>
  </div>;
}

import React, { useState } from 'react';
import { CreditCard, Flame, Clock, Coins, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { playVictorySound, playSuccessSound } from '../services/soundEffects.js';

export default function FinancialEducationHub({ debts = [], pendingDebts = [], education = { weeks: [], impulses: [] }, onUpdateEducation = () => {} }) {
  const [activeTab, setActiveTab] = useState('gamification');
  
  const weeksChecked = education.weeks || [];
  const impulseItems = education.impulses || [];
  const [impulseName, setImpulseName] = useState('');
  const [impulseAmount, setImpulseAmount] = useState('');
  const [impulseError, setImpulseError] = useState('');
  const challengeStorageError = '';

  const completedWeeks = weeksChecked.length;
  const challengeProgress = Math.round((completedWeeks / 52) * 100);
  const totalRegistered52Weeks = weeksChecked.reduce((sum, week) => sum + (week * 20), 0);

  const toggleWeek = (weekNum) => {
    const wasChecked = weeksChecked.includes(weekNum);
    const next = wasChecked ? weeksChecked.filter(week => week !== weekNum) : [...weeksChecked, weekNum];
    onUpdateEducation({ ...education, weeks: next });
    if (!wasChecked) playSuccessSound();
  };

  const handleAddImpulse = (e) => {
    e.preventDefault();
    const name = impulseName.trim();
    const amount = Number(impulseAmount);
    if (!name || name.length > 200 || !impulseAmount.trim() || !Number.isFinite(amount) || amount < 0 || amount > 1e14) {
      setImpulseError('Escribe un nombre de hasta 200 caracteres y un precio válido igual o mayor que cero.');
      return;
    }
    if (impulseItems.length >= 1000) { setImpulseError('Resuelve una compra pendiente antes de añadir otra.'); return; }
    const createdAt = Date.now();
    const newItem = {
      id: crypto.randomUUID(), name, amount, createdAt,
      expiresAt: createdAt + (72 * 60 * 60 * 1000)
    };
    const updated = [newItem, ...impulseItems];
    try { onUpdateEducation({ ...education, impulses: updated }); }
    catch (error) { setImpulseError(error.message); return; }
    setImpulseError('');
    setImpulseName('');
    setImpulseAmount('');
    playSuccessSound();
  };

  const handleResolveImpulse = (id, bought) => {
    if (!bought) {
      playVictorySound();
      if (!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
        confetti({ particleCount: 60, spread: 60, disableForReducedMotion: true });
      }
    }
    const updated = impulseItems.filter(i => i.id !== id);
    onUpdateEducation({ ...education, impulses: updated });
  };

  // Count recorded balances without summing unlike currencies or inferring financial health.
  const debtRecords = Array.isArray(debts) ? debts : [];
  const pendingCount = pendingDebts.reduce((sum, debt) => sum + debt.numeroCuentas, 0);
  const validBalances = debtRecords.filter(debt =>
    (typeof debt?.saldo === 'number' || (typeof debt?.saldo === 'string' && debt.saldo.trim() !== ''))
    && Number.isFinite(Number(debt.saldo)) && Number(debt.saldo) >= 0);
  const debtsWithBalance = validBalances.filter(debt => Number(debt.saldo) > 0).length;
  const missingBalances = debtRecords.length - validBalances.length;

  return (
    <div className="space-y-6">
      
      {/* Metrics derived from recorded debts and manually checked challenge weeks. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recorded debt count */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">{pendingCount ? 'Créditos registrados' : 'Deudas con saldo registrado'}</span>
            <CreditCard className="w-5 h-5 text-indigo-300" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{pendingCount ? debtRecords.length + pendingCount : debtsWithBalance}</span>
            <span className="text-xs text-slate-400">{pendingCount ? 'incluidos los pendientes' : 'con saldo positivo'}</span>
          </div>
          <p className="text-sm text-slate-300 mt-1">{pendingCount ? `${debtRecords.length} completos · ${pendingCount} por completar.` : `${debtRecords.length} deudas en tu registro.`}</p>
          <p className="text-xs text-slate-400 mt-3">{pendingCount ? 'Los grupos se cuentan por número de créditos; no se infieren sus saldos individuales.' : missingBalances > 0 ? `${missingBalances} sin un saldo válido para este conteo.` : 'Conteo basado en los saldos capturados.'}</p>
        </div>

        {/* Manual challenge progress */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Tu avance en el reto</span>
            <Flame className="w-5 h-5 text-amber-400" aria-hidden="true" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{completedWeeks}</span>
            <span className="text-xs text-slate-400">de 52 semanas marcadas</span>
          </div>
          <p className="text-xs text-slate-400 mt-2">Registro manual. No indica semanas consecutivas.</p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden" role="progressbar" aria-label="Semanas marcadas en el reto" aria-valuemin={0} aria-valuemax={52} aria-valuenow={completedWeeks}>
            <div className="bg-amber-400 h-full rounded-full transition-all duration-200" style={{ width: `${challengeProgress}%` }} />
          </div>
        </div>

        {/* 52-Week Total */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ahorro marcado en el reto</span>
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-400 sensitive-value">${totalRegistered52Weeks.toLocaleString('es-MX')}</span>
            <span className="text-xs text-slate-400 ml-1">MXN según tu registro</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Importe calculado con las semanas marcadas; sin verificación bancaria.
          </p>
          <button
            onClick={() => setActiveTab('challenge52')}
            className="mt-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
          >
            <span>Ver tablero de 52 semanas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {challengeStorageError && <p role="alert" className="text-sm text-amber-300">{challengeStorageError}</p>}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gamification')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'gamification' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Insignias del reto
        </button>
        <button
          onClick={() => setActiveTab('challenge52')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'challenge52' ? 'bg-emerald-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Reto 52 Semanas de Ahorro
        </button>
        <button
          onClick={() => setActiveTab('impulse')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'impulse' ? 'bg-amber-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Enfriador de Compras (72 Horas)
        </button>
      </div>

      {/* TAB 1: BADGES */}
      {activeTab === 'gamification' && (
        <div className="space-y-4">
          <p className="text-sm text-slate-400">Las insignias reflejan las semanas que marcas manualmente en el reto de ahorro.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { title: 'Primer registro', desc: 'Una semana marcada en tu registro manual.', unlocked: completedWeeks >= 1, icon: '🌱' },
            { title: 'Trece semanas', desc: 'Al menos 13 semanas marcadas en el reto.', unlocked: completedWeeks >= 13, icon: '🥉' },
            { title: 'Mitad del reto', desc: 'Al menos 26 semanas marcadas en el reto.', unlocked: completedWeeks >= 26, icon: '🥈' },
            { title: 'Reto completo', desc: 'Las 52 semanas marcadas en tu registro manual.', unlocked: completedWeeks === 52, icon: '🏆' }
          ].map((b, idx) => (
            <div 
              key={idx}
              className={`p-4 rounded-2xl border transition-all ${
                b.unlocked 
                  ? 'bg-slate-900 border-emerald-500/40 text-white shadow-lg' 
                  : 'bg-slate-950/40 border-slate-800 text-slate-500 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{b.icon}</span>
                <div>
                  <h4 className="font-bold text-sm text-white">{b.title}</h4>
                  <p className="text-xs text-slate-400 mt-0.5">{b.desc}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className={`font-bold ${b.unlocked ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {b.unlocked ? '✓ Según tu registro' : 'Por alcanzar'}
                </span>
              </div>
            </div>
          ))}
          </div>
        </div>
      )}

      {/* TAB 2: RETO 52 SEMANAS */}
      {activeTab === 'challenge52' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Tu registro de 52 semanas</h3>
              <p className="text-xs text-slate-400">Semana 1 = $20 MXN, semana 52 = $1,040 MXN. Meta del reto: $27,560 MXN.</p>
              <p className="text-xs text-slate-400 mt-2">Marca tus aportes manualmente. Puedes desmarcar una semana para corregir el registro.</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-emerald-400 sensitive-value">${totalRegistered52Weeks.toLocaleString('es-MX')} / $27,560 MXN</span>
            </div>
          </div>

          <div className="grid grid-cols-4 sm:grid-cols-8 md:grid-cols-13 gap-2">
            {[...Array(52)].map((_, i) => {
              const week = i + 1;
              const isDone = weeksChecked.includes(week);
              const amount = week * 20;

              return (
                <button
                  key={week}
                  onClick={() => toggleWeek(week)}
                  aria-pressed={isDone}
                  aria-label={`Semana ${week}, ${amount} pesos mexicanos, ${isDone ? 'marcada' : 'sin marcar'}`}
                  className={`p-2 rounded-xl text-center border transition-all ${
                    isDone 
                      ? 'bg-emerald-600 text-slate-950 font-black border-emerald-400 shadow-md scale-105' 
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 border-slate-800'
                  }`}
                  title={`Semana ${week}: $${amount} MXN`}
                >
                  <div className="text-[10px] opacity-75">S{week}</div>
                  <div className="text-xs font-bold">${amount}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: ENFRIADOR 72H */}
      {activeTab === 'impulse' && (
        <div className="space-y-4">
          <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Antídoto de Compra Impulsiva (Regla de las 72 Horas)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              ¿Viste algo que quieres comprar? Anótalo y date 72 horas para revisar si sigue siendo una prioridad para ti.
            </p>

            <form onSubmit={handleAddImpulse} className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                maxLength={200}
                aria-label="Compra que quieres revisar"
                placeholder="¿Qué deseas comprar? (ej. Zapatos nuevos, Gadget...)"
                value={impulseName}
                onChange={e => setImpulseName(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="number"
                min="0" max="100000000000000" step="0.01"
                aria-label="Precio de la compra en pesos mexicanos"
                placeholder="Precio ($ MXN)"
                value={impulseAmount}
                onChange={e => setImpulseAmount(e.target.value)}
                className="w-full sm:w-40 px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                required
              />
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 font-bold text-slate-950 text-xs rounded-xl transition-all"
              >
                Congelar Compra 72h
              </button>
            </form>
            {impulseError && <p role="alert" className="text-sm text-amber-300 mt-3">{impulseError}</p>}
          </div>

          {/* List of cooling items */}
          <div className="space-y-3">
            {impulseItems.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                No hay compras registradas en periodo de enfriamiento.
              </p>
            ) : (
              impulseItems.map(item => {
                const hoursLeft = Math.max(0, Math.round((item.expiresAt - Date.now()) / (1000 * 60 * 60)));

                return (
                  <div key={item.id} className="p-4 bg-slate-900 border border-amber-500/30 rounded-xl flex items-center justify-between gap-4">
                    <div>
                      <h4 className="font-bold text-sm text-white">{item.name}</h4>
                      <p className="text-xs text-amber-400 font-bold">${item.amount.toLocaleString('es-MX')} MXN</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        {hoursLeft > 0 ? `Quedan ${hoursLeft} horas de enfriamiento` : '¡Periodo de 72h cumplido! ¿Aún lo deseas?'}
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolveImpulse(item.id, false)}
                        className="px-3 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg transition-colors"
                      >
                        Decidí no comprarlo
                      </button>
                      <button
                        onClick={() => handleResolveImpulse(item.id, true)}
                        className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg transition-colors"
                      >
                        Sí lo compré
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

    </div>
  );
}

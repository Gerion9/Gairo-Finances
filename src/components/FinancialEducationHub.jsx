import React, { useState, useEffect } from 'react';
import { 
  Trophy, Flame, Award, Clock, HeartHandshake, 
  Sparkles, CheckCircle, AlertTriangle, ShieldCheck, 
  Coins, Download, ArrowRight, BookOpen, Share2
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { playVictorySound, playSuccessSound } from '../services/soundEffects.js';

export default function FinancialEducationHub({ debts = [], cashFlow = {}, onAddExtraPayment }) {
  const [activeTab, setActiveTab] = useState('gamification');
  
  // 52-Week Challenge state
  const [weeksChecked, setWeeksChecked] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gairo_52_weeks') || '[]');
    } catch {
      return [];
    }
  });

  // 72h Impulse Cooling state
  const [impulseItems, setImpulseItems] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('gairo_impulse_cooling') || '[]');
    } catch {
      return [];
    }
  });
  const [impulseName, setImpulseName] = useState('');
  const [impulseAmount, setImpulseAmount] = useState('');

  // Daily Streak
  const streakDays = 14;

  const totalSaved52Weeks = weeksChecked.reduce((sum, w) => sum + (w * 20), 0);

  const toggleWeek = (weekNum) => {
    setWeeksChecked(prev => {
      const next = prev.includes(weekNum) ? prev.filter(w => w !== weekNum) : [...prev, weekNum];
      try { localStorage.setItem('gairo_52_weeks', JSON.stringify(next)); } catch {}
      if (!prev.includes(weekNum)) {
        playSuccessSound();
      }
      return next;
    });
  };

  const handleAddImpulse = (e) => {
    e.preventDefault();
    if (!impulseName || !impulseAmount) return;
    const newItem = {
      id: Date.now(),
      name: impulseName,
      amount: Number(impulseAmount),
      createdAt: Date.now(),
      expiresAt: Date.now() + (72 * 60 * 60 * 1000)
    };
    const updated = [newItem, ...impulseItems];
    setImpulseItems(updated);
    try { localStorage.setItem('gairo_impulse_cooling', JSON.stringify(updated)); } catch {}
    setImpulseName('');
    setImpulseAmount('');
    playSuccessSound();
  };

  const handleResolveImpulse = (id, bought) => {
    if (!bought) {
      playVictorySound();
      confetti({ particleCount: 60, spread: 60 });
    }
    const updated = impulseItems.filter(i => i.id !== id);
    setImpulseItems(updated);
    try { localStorage.setItem('gairo_impulse_cooling', JSON.stringify(updated)); } catch {}
  };

  // Level calculation (Level 1 to 10)
  const totalDebt = debts.reduce((sum, d) => sum + (Number(d.saldo) || 0), 0);
  let currentLevel = 1;
  let levelTitle = "Nivel 1: Enfoque en Rescate";
  if (totalDebt === 0) {
    currentLevel = 10;
    levelTitle = "Nivel 10: Libertad Financiera Absoluta (FIRE)";
  } else if (totalDebt < 10000) {
    currentLevel = 8;
    levelTitle = "Nivel 8: A Punto de la Libertad";
  } else if (totalDebt < 30000) {
    currentLevel = 6;
    levelTitle = "Nivel 6: Control Acelerado";
  } else if (totalDebt < 80000) {
    currentLevel = 4;
    levelTitle = "Nivel 4: Rompiendo Inercia";
  } else {
    currentLevel = 2;
    levelTitle = "Nivel 2: Diagnóstico Inicial";
  }

  return (
    <div className="space-y-6">
      
      {/* Top Banner: Level & Streak */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Level */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Tu Nivel Financiero</span>
            <Trophy className="w-5 h-5 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{currentLevel}</span>
            <span className="text-xs text-slate-400">/ 10</span>
          </div>
          <p className="text-sm font-bold text-indigo-300 mt-1">{levelTitle}</p>
          <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${currentLevel * 10}%` }} />
          </div>
        </div>

        {/* Streak */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Racha de Disciplina</span>
            <Flame className="w-5 h-5 text-amber-500 animate-bounce" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">{streakDays}</span>
            <span className="text-xs text-slate-400">días seguidos</span>
          </div>
          <p className="text-sm text-slate-300 mt-1">¡Mantén el fuego encendido revisando tu presupuesto!</p>
          <div className="flex gap-1.5 mt-3">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex-1 h-2 rounded-full bg-amber-500 shadow-sm" />
            ))}
          </div>
        </div>

        {/* 52-Week Total */}
        <div className="p-5 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl shadow-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Reto 52 Semanas</span>
            <Coins className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="mt-2">
            <span className="text-3xl font-black text-emerald-400">${totalSaved52Weeks.toLocaleString('es-MX')}</span>
            <span className="text-xs text-slate-400 ml-1">MXN acumulados</span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            {weeksChecked.length} de 52 semanas completadas ({((weeksChecked.length / 52) * 100).toFixed(0)}%)
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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('gamification')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'gamification' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Insignias & Logros (Badges)
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { title: 'Primer Golpe a Capital', desc: 'Realizaste un abono por encima del pago mínimo.', unlocked: true, icon: '🥉' },
            { title: 'Cazador de Intereses', desc: 'Ahorraste más de $5,000 en intereses con la estrategia.', unlocked: true, icon: '🥈' },
            { title: 'Escudo Fiscal SAT', desc: 'Apartaste tu provisión del SAT a tiempo 3 meses seguidos.', unlocked: true, icon: '🛡️' },
            { title: 'Cero Gastos Hormiga', desc: 'Una semana completa sin compras por impulso.', unlocked: streakDays >= 7, icon: '☕' },
            { title: 'Tarjeta Destruida', desc: 'Liquidaste al 100% tu primera tarjeta bancaria.', unlocked: totalDebt < 100000, icon: '💳' },
            { title: 'Libertad FIRE', desc: 'Cero deudas de consumo y 6 meses de fondo de reserva.', unlocked: totalDebt === 0, icon: '👑' }
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
                  {b.unlocked ? '✓ Desbloqueado' : '🔒 Bloqueado'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: RETO 52 SEMANAS */}
      {activeTab === 'challenge52' && (
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Matriz Interactiva del Reto de 52 Semanas</h3>
              <p className="text-xs text-slate-400">Semana 1 = $20 MXN, Semana 52 = $1,040 MXN. Meta anual: $27,560 MXN.</p>
            </div>
            <div className="text-right">
              <span className="text-sm font-extrabold text-emerald-400">${totalSaved52Weeks.toLocaleString('es-MX')} / $27,560 MXN</span>
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
              ¿Viste algo que quieres comprar? Anótalo aquí y espera 72 horas. El 80% del deseo compulsivo desaparece al enfriarse la emoción.
            </p>

            <form onSubmit={handleAddImpulse} className="mt-4 flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                placeholder="¿Qué deseas comprar? (ej. Zapatos nuevos, Gadget...)"
                value={impulseName}
                onChange={e => setImpulseName(e.target.value)}
                className="flex-1 px-4 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                required
              />
              <input
                type="number"
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
          </div>

          {/* List of cooling items */}
          <div className="space-y-3">
            {impulseItems.length === 0 ? (
              <p className="text-center py-6 text-xs text-slate-500 bg-slate-950/40 rounded-xl border border-slate-800">
                No tienes compras en periodo de enfriamiento. ¡Excelente autocontrol!
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
                        ¡No lo compré! (Ahorro)
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

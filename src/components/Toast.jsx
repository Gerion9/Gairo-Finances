import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, RotateCcw } from 'lucide-react';
import { hapticFeedback } from '../services/haptics.js';
import { playSuccessSound, playAlertSound } from '../services/soundEffects.js';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ message, type = 'success', duration = 5000, onUndo = null }) => {
    const id = Date.now() + Math.random().toString(36).substr(2, 4);

    if (type === 'success') {
      hapticFeedback.success();
      playSuccessSound();
    } else if (type === 'error' || type === 'warning') {
      hapticFeedback.warning();
      playAlertSound();
    } else {
      hapticFeedback.light();
    }

    const newToast = { id, message, type, onUndo };
    setToasts(prev => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      {/* Toast Render Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map(toast => {
          const isSuccess = toast.type === 'success';
          const isError = toast.type === 'error';
          const isWarning = toast.type === 'warning';

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-center justify-between gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md animate-in slide-in-from-bottom-5 duration-200 ${
                isSuccess 
                  ? 'bg-slate-900/95 border-emerald-500/50 text-white shadow-emerald-950/30' 
                  : isError 
                  ? 'bg-slate-900/95 border-rose-500/50 text-white shadow-rose-950/30'
                  : isWarning
                  ? 'bg-slate-900/95 border-amber-500/50 text-white shadow-amber-950/30'
                  : 'bg-slate-900/95 border-slate-700 text-white shadow-slate-950/30'
              }`}
            >
              <div className="flex items-center gap-2.5">
                {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />}
                {isWarning && <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
                {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-cyan-400 shrink-0" />}
                <p className="text-xs sm:text-sm font-medium leading-snug">{toast.message}</p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {toast.onUndo && (
                  <button
                    onClick={() => {
                      toast.onUndo();
                      removeToast(toast.id);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded-lg transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Deshacer</span>
                  </button>
                )}
                <button
                  onClick={() => removeToast(toast.id)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    return {
      addToast: (msg) => console.log('Toast:', msg),
      removeToast: () => {}
    };
  }
  return context;
}

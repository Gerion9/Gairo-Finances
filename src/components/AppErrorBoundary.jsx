import React from 'react';
import { RefreshCw } from 'lucide-react';

export default class AppErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="surface-card p-8 text-center"><h1 className="text-xl font-semibold text-white">Esta página no pudo cargarse.</h1><p className="text-sm text-slate-400 mt-2 mb-5">Los guardados confirmados permanecen en tu cuenta. Vuelve al resumen para continuar.</p><button className="button-secondary" onClick={() => { this.setState({ failed: false }); this.props.onReset?.(); }}><RefreshCw size={16} />Volver al resumen</button></div>;
  }
}

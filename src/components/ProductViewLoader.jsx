import React, { Suspense, useEffect, useRef, useState } from 'react';
import { captureProductFocusIntent } from './ProductViewLoader.js';

class ProductViewBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="credit-library-load-state is-error" role="alert">
      <h2>{this.props.errorLabel}</h2>
      <p>Intenta de nuevo. Tu selección se conserva.</p>
      <button className="credit-library-button" type="button" onClick={this.props.onRetry}>Reintentar</button>
    </div>;
  }
}

function LoadedProductView({ View, active, componentProps, onReady }) {
  useEffect(() => { if (active) onReady?.(); }, [active, onReady]);
  return <View {...componentProps} active={active} />;
}

export default function ProductViewLoader({ resource, active, loadingLabel, errorLabel, componentProps, onReady, retryFocusRef }) {
  const [visited, setVisited] = useState(active);
  const [attempt, setAttempt] = useState(() => ({ View: resource.createAttempt(), number: 0 }));
  const retryIntent = useRef(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  useEffect(() => { if (active) setVisited(true); }, [active]);
  useEffect(() => {
    const intent = retryIntent.current;
    retryIntent.current = null;
    if (intent?.isCurrent() && activeRef.current) {
      const heading = retryFocusRef?.current;
      if (heading && !heading.closest('[hidden], [inert]')) heading.focus({ preventScroll: true });
    }
    intent?.cancel();
  }, [attempt.number, retryFocusRef]);
  useEffect(() => () => retryIntent.current?.cancel(), []);

  const retry = event => {
    retryIntent.current?.cancel();
    const ownerDocument = event.currentTarget.ownerDocument;
    retryIntent.current = ownerDocument.activeElement === event.currentTarget ? captureProductFocusIntent(ownerDocument) : null;
    setAttempt(previous => ({ View: resource.createAttempt(), number: previous.number + 1 }));
  };

  if (!active && !visited) return null;
  return <div hidden={!active}>
    <ProductViewBoundary key={attempt.number} errorLabel={errorLabel} onRetry={retry}>
      <Suspense fallback={<div className="credit-library-load-state" role="status"><p>{loadingLabel}</p><div className="credit-library-load-skeleton" aria-hidden="true"><span /><span /><span /></div></div>}>
        <LoadedProductView View={attempt.View} active={active} componentProps={componentProps} onReady={onReady} />
      </Suspense>
    </ProductViewBoundary>
  </div>;
}

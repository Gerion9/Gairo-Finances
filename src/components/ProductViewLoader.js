import { lazy } from 'react';

// Keep successful imports shared, but release a rejected request so retry really
// invokes the importer again. Each attempt also gets a fresh React.lazy identity.
export function createProductViewResource(importView) {
  let pending;
  const load = () => {
    if (!pending) {
      pending = Promise.resolve().then(importView).catch(error => {
        pending = undefined;
        throw error;
      });
    }
    return pending;
  };
  return { load, createAttempt: () => lazy(load) };
}

// A delayed view must not take focus after the person has moved elsewhere.
export function captureProductFocusIntent(ownerDocument) {
  if (!ownerDocument) return null;
  const origin = ownerDocument.activeElement;
  let current = true;
  const cancel = () => {
    current = false;
    ownerDocument.removeEventListener('focusin', onFocus, true);
  };
  const onFocus = event => {
    if (event.target !== origin && event.target !== ownerDocument.body && event.target !== ownerDocument.documentElement) cancel();
  };
  ownerDocument.addEventListener('focusin', onFocus, true);
  return { isCurrent: () => current, cancel };
}

import { useEffect, useRef } from 'react';

const modalStack = [];
let scrollLocks = 0;
let originalOverflow = '';
const focusableSelector = ['button:not([disabled])', 'a[href]', 'input:not([disabled]):not([type="hidden"])', 'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'].join(',');

/** Focus containment, Escape, nested scroll locks and return focus for dialogs. */
export default function useModalFocus(isOpen, onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return undefined;
    const node = ref.current;
    if (!node) return undefined;
    const previousFocus = document.activeElement;
    const token = {};
    modalStack.push(token);
    if (scrollLocks === 0) {
      originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    scrollLocks += 1;
    const isTopmost = () => modalStack[modalStack.length - 1] === token;
    const getFocusable = () => Array.from(node.querySelectorAll(focusableSelector))
      .filter(element => element.tabIndex >= 0 && element.getClientRects().length > 0 && element.getAttribute('aria-hidden') !== 'true' && !element.closest('[inert]'));
    const focusFirst = () => { const options = getFocusable(); (options.find(element => element.hasAttribute('data-autofocus')) || options[0] || node).focus({ preventScroll: true }); };
    const frame = requestAnimationFrame(focusFirst);
    const handleKeyDown = event => {
      if (!isTopmost()) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current?.();
      }
      if (event.key !== 'Tab') return;
      const focusable = getFocusable();
      if (!focusable.length) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const handleFocus = event => { if (isTopmost() && !node.contains(event.target)) focusFirst(); };
    const handlePrivacy = () => closeRef.current?.();
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('focusin', handleFocus);
    window.addEventListener('gairo:privacy', handlePrivacy);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('focusin', handleFocus);
      window.removeEventListener('gairo:privacy', handlePrivacy);
      const index = modalStack.indexOf(token);
      const wasTopmost = isTopmost();
      if (index >= 0) modalStack.splice(index, 1);
      scrollLocks = Math.max(0, scrollLocks - 1);
      if (scrollLocks === 0) document.body.style.overflow = originalOverflow;
      if (wasTopmost && previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [isOpen]);
  return ref;
}

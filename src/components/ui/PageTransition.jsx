import React, { useEffect } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';

/** Animate the surface, never remount a form or an import when the route changes. */
export default function PageTransition({ routeKey, children }) {
  const controls = useAnimationControls();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    controls.set({ opacity: reducedMotion ? 1 : 0, y: reducedMotion ? 0 : 7 });
    controls.start({ opacity: 1, y: 0, transition: { duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0.75, 0.25, 1] } });
    return () => controls.stop();
  }, [routeKey, controls, reducedMotion]);
  return <motion.div className="page-transition" initial={false} animate={controls}>{children}</motion.div>;
}

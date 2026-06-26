import { createContext, useContext, useCallback, useState, useRef, type ReactNode } from 'react';
import FPSOverlay from './FPSOverlay';

interface FPSContextValue {
  triggerDive: (callback: () => void) => void;
  isDiving: boolean;
}

const FPSContext = createContext<FPSContextValue | null>(null);

// Hook export — colocated with provider for shared FPS context
// eslint-disable-next-line react-refresh/only-export-components
export function useFPSDive() {
  const ctx = useContext(FPSContext);
  if (!ctx) throw new Error('useFPSDive must be used within FPSDiveProvider');
  return ctx;
}

export default function FPSDiveProvider({ children }: { children: ReactNode }) {
  const [isDiving, setIsDiving] = useState(false);
  const callbackRef = useRef<(() => void) | null>(null);

  const triggerDive = useCallback((callback: () => void) => {
    if (isDiving) return;
    callbackRef.current = callback;
    setIsDiving(true);
  }, [isDiving]);

  const onDiveComplete = useCallback(() => {
    setIsDiving(false);
    if (callbackRef.current) {
      const cb = callbackRef.current;
      callbackRef.current = null;
      setTimeout(cb, 50);
    }
  }, []);

  return (
    <FPSContext.Provider value={{ triggerDive, isDiving }}>
      {children}
      <FPSOverlay isActive={isDiving} onComplete={onDiveComplete} />
    </FPSContext.Provider>
  );
}
import type { ReactNode } from "react";

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

function Overlay({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="absolute inset-0 bg-background-950/40"
      onClick={onClose}
      aria-hidden
    />
  );
}

export function BottomSheet({ open, onClose, title, children }: OverlayProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <Overlay onClose={onClose} />
      <div className="relative w-full max-w-md animate-fade-up rounded-t-3xl border-t border-background-200 bg-background-50 px-5 pb-8 pt-3">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-background-300" />
        {title && (
          <h3 className="mb-3 font-heading text-lg font-semibold text-foreground-950">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children }: OverlayProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <Overlay onClose={onClose} />
      <div className="relative w-full max-w-sm animate-fade-up rounded-3xl border border-background-200 bg-background-50 p-5">
        {title && (
          <h3 className="mb-3 font-heading text-lg font-semibold text-foreground-950">
            {title}
          </h3>
        )}
        {children}
      </div>
    </div>
  );
}
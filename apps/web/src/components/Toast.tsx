import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";

import { ToastContext, type ToastItem } from "../hooks/useToast";

const BORDER: Record<ToastItem["kind"], string> = {
  success: "border-l-lime",
  error: "border-l-red",
  info: "border-l-amber",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const show = useCallback((t: Omit<ToastItem, "id">) => {
    nextId.current += 1;
    const id = nextId.current;
    setItems((xs) => [...xs, { ...t, id }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 6_000);
  }, []);
  const api = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
        role="status"
        aria-live="polite"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`card px-4 py-3 text-sm shadow-lg border-l-4 ${BORDER[t.kind]}`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

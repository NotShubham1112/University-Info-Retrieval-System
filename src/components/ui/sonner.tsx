"use client";

import * as React from "react";

type Toast = { id: number; message: string; variant: "default" | "success" | "error" };

const ToastCtx = React.createContext<{
  toast: (m: string) => void;
  success: (m: string) => void;
  error: (m: string) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastCtx);
  if (!ctx) {
    // fallback no-op when outside provider (e.g., tests)
    return {
      toast: (m: string) => console.info(m),
      success: (m: string) => console.info(m),
      error: (m: string) => console.error(m),
    };
  }
  return ctx;
}

// Simple imperative helper for non-react code (hooks)
export const toast = {
  success: (m: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: m, variant: "success" } }));
    }
    console.info(`[toast success] ${m}`);
  },
  error: (m: string) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("app-toast", { detail: { message: m, variant: "error" } }));
    }
    console.error(`[toast error] ${m}`);
  },
};

export function Toaster({ children }: React.PropsWithChildren) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const push = React.useCallback((message: string, variant: Toast["variant"]) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  const api = React.useMemo(
    () => ({
      toast: (m: string) => push(m, "default"),
      success: (m: string) => push(m, "success"),
      error: (m: string) => push(m, "error"),
    }),
    [push],
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ message: string; variant: Toast["variant"] }>;
      push(ce.detail.message, ce.detail.variant ?? "default");
    };
    window.addEventListener("app-toast", handler as EventListener);
    return () => window.removeEventListener("app-toast", handler as EventListener);
  }, [push]);

  // Also bridge to window.__sonner for hook fallback
  React.useEffect(() => {
    (window as unknown as Record<string, unknown>)["__sonner"] = { toast: api };
  }, [api]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto min-w-[280px] max-w-[420px] rounded-lg border px-3 py-2 text-sm shadow-lg " +
              (t.variant === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : t.variant === "success"
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950 dark:border-green-800 dark:text-green-100"
                  : "bg-popover border-border text-popover-foreground")
            }
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

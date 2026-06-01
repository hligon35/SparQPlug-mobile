import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
}

let toastListeners: Array<(toasts: Toast[]) => void> = [];
let toasts: Toast[] = [];

function notifyListeners() {
  const snapshot = [...toasts];
  toastListeners.forEach((fn) => fn(snapshot));
}

export function toast(opts: Omit<Toast, 'id'>) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { ...opts, id }];
  notifyListeners();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, 4000);
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    const listener = (updated: Toast[]) => setItems(updated);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    toasts = toasts.filter((t) => t.id !== id);
    notifyListeners();
  }, []);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-full max-w-sm">
      {items.map((t) => (
        <div
          key={t.id}
          className={cn(
            'flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg bg-popover text-popover-foreground animate-fade-in',
            t.variant === 'destructive' && 'border-destructive/40 bg-destructive/10 text-destructive',
            t.variant === 'success' && 'border-green-500/40 bg-green-500/10 text-green-600 dark:text-green-400',
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">{t.title}</p>
            {t.description && <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>}
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

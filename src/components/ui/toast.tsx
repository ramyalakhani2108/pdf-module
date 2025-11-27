'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';

// Toast types
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  isExiting?: boolean;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// Toast Provider Component
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    // First mark as exiting for animation
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, isExiting: true } : toast
      )
    );
    // Then remove after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = 'info', duration: number = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newToast: Toast = { id, message, type, duration, isExiting: false };

      setToasts((prev) => [...prev, newToast]);

      // Auto remove after duration
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (message: string, duration?: number) => addToast(message, 'success', duration),
    [addToast]
  );

  const error = useCallback(
    (message: string, duration?: number) => addToast(message, 'error', duration),
    [addToast]
  );

  const warning = useCallback(
    (message: string, duration?: number) => addToast(message, 'warning', duration),
    [addToast]
  );

  const info = useCallback(
    (message: string, duration?: number) => addToast(message, 'info', duration),
    [addToast]
  );

  return (
    <ToastContext.Provider
      value={{ toasts, addToast, removeToast, success, error, warning, info }}
    >
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Hook to use toast
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Toast Container Component - Top Center Position
function ToastContainer({
  toasts,
  removeToast,
}: {
  toasts: Toast[];
  removeToast: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-9999 flex flex-col items-center gap-3 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

// Individual Toast Item Component - Theme Consistent
function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => {
      setIsVisible(true);
    });
  }, []);

  const icons = {
    success: CheckCircle,
    error: XCircle,
    warning: AlertCircle,
    info: Info,
  };

  // Theme-consistent styles using project's yellow/off-white color scheme
  const styles = {
    success: {
      container: 'bg-surface border-2 border-green-400/50 shadow-xl',
      iconBg: 'bg-green-500',
      icon: 'text-white',
      title: 'text-green-700',
      message: 'text-foreground',
    },
    error: {
      container: 'bg-surface border-2 border-red-400/50 shadow-xl',
      iconBg: 'bg-red-500',
      icon: 'text-white',
      title: 'text-red-700',
      message: 'text-foreground',
    },
    warning: {
      container: 'bg-surface border-2 border-primary/50 shadow-xl',
      iconBg: 'bg-primary',
      icon: 'text-primary-foreground',
      title: 'text-primary',
      message: 'text-foreground',
    },
    info: {
      container: 'bg-surface border-2 border-blue-400/50 shadow-xl',
      iconBg: 'bg-blue-500',
      icon: 'text-white',
      title: 'text-blue-700',
      message: 'text-foreground',
    },
  };

  const titles = {
    success: 'Success!',
    error: 'Error',
    warning: 'Warning',
    info: 'Info',
  };

  const Icon = icons[toast.type];
  const style = styles[toast.type];

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-center gap-4 min-w-[320px] max-w-[480px] px-5 py-4 rounded-xl',
        'backdrop-blur-sm transition-all duration-300 ease-out',
        style.container,
        // Animation states
        isVisible && !toast.isExiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 -translate-y-4 scale-95'
      )}
      role="alert"
    >
      {/* Icon with colored background */}
      <div className={cn('p-2 rounded-full shrink-0', style.iconBg)}>
        <Icon className={cn('w-5 h-5', style.icon)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold', style.title)}>
          {titles[toast.type]}
        </p>
        <p className={cn('text-sm mt-0.5', style.message)}>{toast.message}</p>
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all duration-200"
        aria-label="Close notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

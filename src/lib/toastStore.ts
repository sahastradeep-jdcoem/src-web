export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

type ToastListener = (toasts: ToastMessage[]) => void;

let toastsList: ToastMessage[] = [];
const listeners = new Set<ToastListener>();

function notify() {
  listeners.forEach((l) => l([...toastsList]));
}

export const toast = {
  show(message: string, type: ToastType = "info", options?: { title?: string; duration?: number }) {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastMessage = {
      id,
      message,
      type,
      title: options?.title,
      duration: options?.duration || 4000,
    };
    toastsList = [...toastsList, newToast];
    notify();

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        toast.dismiss(id);
      }, newToast.duration);
    }
    return id;
  },

  success(message: string, title?: string) {
    return toast.show(message, "success", { title });
  },

  error(message: string, title?: string) {
    return toast.show(message, "error", { title });
  },

  warning(message: string, title?: string) {
    return toast.show(message, "warning", { title });
  },

  info(message: string, title?: string) {
    return toast.show(message, "info", { title });
  },

  dismiss(id: string) {
    toastsList = toastsList.filter((t) => t.id !== id);
    notify();
  },

  subscribe(listener: ToastListener) {
    listeners.add(listener);
    listener([...toastsList]);
    return () => {
      listeners.delete(listener);
    };
  },
};

import { h, list } from "./dom.js";
import { computed, signal } from "./reactive.js";
import { icons } from "./icons.js";

export type ToastType = "success" | "error" | "warning" | "info";
export type ToastPosition = "top-right" | "top-left" | "bottom-right" | "bottom-left";

export interface ToastOptions {
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** ms before auto-dismiss; 0 disables auto-dismiss entirely. Default 4000. */
  duration?: number;
}

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration: number;
  stopped: boolean;
  closing: boolean;
}

const POSITION_KEY = "hearth_toast_position";
const POSITIONS: ToastPosition[] = ["top-right", "top-left", "bottom-right", "bottom-left"];

function loadPosition(): ToastPosition {
  const stored = localStorage.getItem(POSITION_KEY);
  return (POSITIONS as string[]).includes(stored ?? "") ? (stored as ToastPosition) : "top-right";
}

export const toastPosition = signal<ToastPosition>(loadPosition());

export function setToastPosition(pos: ToastPosition): void {
  localStorage.setItem(POSITION_KEY, pos);
  toastPosition.set(pos);
}

const toasts = signal<ToastItem[]>([]);
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const EXIT_ANIM_MS = 220;

function push(type: ToastType, title: string, opts?: ToastOptions): string {
  const id = crypto.randomUUID();
  const duration = opts?.duration ?? 4000;
  const item: ToastItem = {
    id,
    type,
    title,
    message: opts?.message,
    actionLabel: opts?.actionLabel,
    onAction: opts?.onAction,
    duration,
    stopped: false,
    closing: false,
  };
  toasts.update((cur) => [...cur, item]);

  if (duration > 0) {
    timers.set(
      id,
      setTimeout(() => dismiss(id), duration),
    );
  }
  return id;
}

export function dismiss(id: string): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);

  toasts.update((cur) => cur.map((t) => (t.id === id ? { ...t, closing: true } : t)));
  setTimeout(() => {
    toasts.update((cur) => cur.filter((t) => t.id !== id));
  }, EXIT_ANIM_MS);
}

function stopAutoDismiss(id: string): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  toasts.update((cur) => cur.map((t) => (t.id === id ? { ...t, stopped: true } : t)));
}

export const toast = {
  success: (title: string, opts?: ToastOptions) => push("success", title, opts),
  error: (title: string, opts?: ToastOptions) => push("error", title, opts),
  warning: (title: string, opts?: ToastOptions) => push("warning", title, opts),
  info: (title: string, opts?: ToastOptions) => push("info", title, opts),
  dismiss,
};

const TYPE_ICON: Record<ToastType, (size?: number) => Node> = {
  success: icons.checkCircle,
  error: icons.xCircle,
  warning: icons.alertTriangle,
  info: icons.infoCircle,
};

function ToastCard(t: ToastItem): Node {
  return h(
    `div.toast.toast-${t.type}`,
    { class: [t.closing ? "closing" : "", t.stopped ? "stopped" : ""].filter(Boolean).join(" ") },
    h(
      "div.toast-header",
      {},
      h("span.toast-icon", {}, TYPE_ICON[t.type](18)),
      h("span.toast-title", {}, t.title),
      h("button.toast-close", { onclick: () => dismiss(t.id) }, icons.x(14)),
    ),
    t.message ? h("div.toast-body", {}, t.message) : null,
    t.actionLabel && t.onAction
      ? h(
          "button.btn.btn-secondary.toast-action",
          {
            onclick: () => {
              t.onAction?.();
              dismiss(t.id);
            },
          },
          t.actionLabel,
        )
      : null,
    t.duration > 0
      ? h(
          "div.toast-footer",
          {},
          h("button.toast-stop-link", { onclick: () => stopAutoDismiss(t.id) }, "Click to stop"),
          h(
            "div.toast-progress-track",
            {},
            h("div.toast-progress-fill", { style: { animationDuration: `${t.duration}ms` } }),
          ),
        )
      : null,
  );
}

/** Mount once, anywhere — renders the live toast stack at the user's chosen corner. */
export function ToastContainer(): Node {
  return h(
    "div.toast-stack",
    { class: computed(() => `toast-stack-${toastPosition()}`) },
    list(toasts, (t) => ToastCard(t)),
  );
}

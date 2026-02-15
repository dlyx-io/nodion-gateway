/** Simple toast notification store for Svelte 5 */

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

let nextId = 0;
let toasts: Toast[] = $state([]);

export function getToasts(): Toast[] {
  return toasts;
}

export function addToast(message: string, type: Toast['type'] = 'info', duration = 4000): void {
  const id = nextId++;
  toasts = [...toasts, { id, message, type }];
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
  }, duration);
}

export function removeToast(id: number): void {
  toasts = toasts.filter((t) => t.id !== id);
}

export function toast(message: string): void {
  addToast(message, 'info');
}

export function success(message: string): void {
  addToast(message, 'success');
}

export function error(message: string): void {
  addToast(message, 'error', 6000);
}

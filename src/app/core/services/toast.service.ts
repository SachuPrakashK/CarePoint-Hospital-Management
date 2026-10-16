import { Injectable, signal } from '@angular/core';
export type ToastKind = 'success' | 'error' | 'warning' | 'info';
export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}
@Injectable({ providedIn: 'root' })
export class ToastService {
  private state = signal<Toast[]>([]);
  private sessionExpiryActive = false;
  readonly toasts = this.state.asReadonly();
  show(message: string, kind: ToastKind = 'info', duration = 4500) {
    const id = crypto.randomUUID();
    this.state.update((v) => [...v, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), duration);
  }
  success(m: string) {
    this.show(m, 'success');
  }
  error(m: string) {
    if (this.sessionExpiryActive) return;
    this.show(m, 'error');
  }
  warning(m: string) {
    this.show(m, 'warning');
  }
  info(m: string) {
    this.show(m, 'info');
  }
  dismiss(id: string) {
    this.state.update((v) => v.filter((x) => x.id !== id));
  }
  beginSessionExpiry(message: string) {
    if (this.sessionExpiryActive) return false;
    this.sessionExpiryActive = true;
    this.state.update((items) => items.filter((item) => item.kind !== 'error'));
    this.show(message, 'error', 7000);
    return true;
  }
  resetSessionExpiry() {
    this.sessionExpiryActive = false;
  }
}

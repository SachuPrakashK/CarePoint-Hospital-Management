import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ActionsMenuService {
  readonly activeId = signal<string | null>(null);
  toggle(id: string) {
    this.activeId.update((active) => (active === id ? null : id));
  }
  close() {
    this.activeId.set(null);
  }
}

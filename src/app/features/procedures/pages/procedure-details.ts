import { Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProcedureStore } from '../procedure.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { EmptyState } from '../../../shared/components/empty-state/empty-state';

@Component({ imports: [StatusBadge, EmptyState], templateUrl: './procedure-details.html', styleUrl: './procedure-details.scss' })
export class ProcedureDetailsPage {
  readonly id = input(''); private store = inject(ProcedureStore); private dates = inject(AppDateTimeService); private router = inject(Router);
  readonly record = signal<any | null>(null); readonly loading = signal(true); readonly error = signal('');
  constructor() { effect(() => { const id = this.id(); if (id) void this.load(id); }); }
  async load(id = this.id()) { this.loading.set(true); this.error.set(''); try { this.record.set(await this.store.details(id)); } catch (error: any) { this.error.set(error?.error?.message ?? 'Procedure details could not be loaded.'); } finally { this.loading.set(false); } }
  display(value: any) { return value === null || value === undefined || value === '' ? 'Not available' : String(value); }
  format(value?: string) { return value ? this.dates.formatDateTime(value) : 'Not available'; }
  back() { void this.router.navigate(['/procedures']); }
}

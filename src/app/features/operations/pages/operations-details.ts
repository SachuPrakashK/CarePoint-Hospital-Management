import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { AppDateTimePipe } from '../../../core/services/app-date-time.service';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';

type DetailKind = 'inventory' | 'procurement' | 'suppliers' | 'ambulance';

@Component({
  imports: [StatusBadge, AppDateTimePipe],
  templateUrl: './operations-details.html',
  styleUrl: './operations-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OperationsDetails {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(Phase23ApiService);
  readonly kind = this.route.snapshot.data['kind'] as DetailKind;
  readonly record = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');

  constructor() {
    void this.load();
  }

  async load() {
    this.loading.set(true);
    this.error.set('');
    const id = this.route.snapshot.paramMap.get('id')!;
    try {
      const request =
        this.kind === 'inventory'
          ? this.api.inventoryItem(id)
          : this.kind === 'procurement'
            ? this.api.purchaseOrder(id)
            : this.kind === 'suppliers'
              ? this.api.supplier(id)
              : this.api.ambulance(id);
      this.record.set((await firstValueFrom(request)).data);
    } catch (error: any) {
      this.error.set(
        error?.status === 404
          ? 'The requested record was not found.'
          : 'The record could not be loaded.',
      );
    } finally {
      this.loading.set(false);
    }
  }

  back() {
    const query = this.route.snapshot.queryParamMap;
    void this.router.navigate(['/operations'], {
      queryParams: {
        tab: query.get('fromTab') ?? this.kind,
        search: query.get('search') || null,
        page: query.get('page') || null,
        pageSize: query.get('pageSize') || null,
        sortField: query.get('sortField') || null,
        sortDirection: query.get('sortDirection') || null,
      },
    });
  }

  title(record: any) {
    if (this.kind === 'inventory') return record.name;
    if (this.kind === 'procurement') return record.number;
    if (this.kind === 'suppliers') return record.name;
    return record.number;
  }

  label() {
    return {
      inventory: 'Inventory item',
      procurement: 'Purchase request',
      suppliers: 'Supplier',
      ambulance: 'Ambulance',
    }[this.kind];
  }

  display(value: unknown) {
    return value === null || value === undefined || value === '' ? '—' : String(value);
  }
}

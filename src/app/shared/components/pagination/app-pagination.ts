import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { AppIcon } from '../icon/app-icon';
import { ApplicationSettingsService } from '../../../core/services/application-settings.service';

@Component({
  selector: 'app-pagination',
  imports: [AppIcon],
  templateUrl: './app-pagination.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppPagination {
  private config = inject(ApplicationSettingsService);
  readonly page = input(1);
  readonly pageSize = input<number>(this.config.defaultRowsPerPage());
  readonly totalItems = input(0);
  readonly totalPages = input(0);
  readonly loading = input(false);
  readonly itemLabel = input('records');
  readonly pageChange = output<number>();
  readonly pageSizeChange = output<number>();
  readonly pageSizes = [10, 25, 50, 100];
  readonly start = computed(() =>
    this.totalItems() ? (this.page() - 1) * this.pageSize() + 1 : 0,
  );
  readonly end = computed(() => Math.min(this.page() * this.pageSize(), this.totalItems()));
  readonly pages = computed<Array<number | 'ellipsis'>>(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
    const selected = new Set([
      1,
      total,
      current - 2,
      current - 1,
      current,
      current + 1,
      current + 2,
    ]);
    const values = [...selected]
      .filter((value) => value >= 1 && value <= total)
      .sort((a, b) => a - b);
    const result: Array<number | 'ellipsis'> = [];
    values.forEach((value, index) => {
      if (index && value - values[index - 1] > 1) result.push('ellipsis');
      result.push(value);
    });
    return result;
  });
  go(page: number) {
    if (page >= 1 && page <= this.totalPages() && page !== this.page()) this.pageChange.emit(page);
  }
}

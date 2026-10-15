import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-chart-empty-state',
  templateUrl: './chart-empty-state.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChartEmptyState {
  readonly title = input('No data available');
  readonly message = input('Data will appear when records are available.');
}

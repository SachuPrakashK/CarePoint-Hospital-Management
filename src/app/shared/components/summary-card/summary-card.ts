import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { AppIcon } from '../icon/app-icon';
export type SummaryCardVariant =
  | 'blue'
  | 'green'
  | 'purple'
  | 'amber'
  | 'cyan'
  | 'red'
  | 'teal'
  | 'violet'
  | 'coral'
  | 'rose'
  | 'indigo';
@Component({
  selector: 'app-summary-card',
  imports: [AppIcon],
  templateUrl: './summary-card.html',
  styleUrl: './summary-card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SummaryCard {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly icon = input.required<string>();
  readonly note = input('');
  readonly variant = input<SummaryCardVariant>('blue');
}

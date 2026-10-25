import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { AppIcon } from '../icon/app-icon';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';
export type ExportScope = 'current-page' | 'filtered-results';
export interface ExportRequest {
  format: ExportFormat;
  scope: ExportScope;
  visibleColumns?: readonly string[];
}
export interface ExportDefinition {
  format: ExportFormat;
  label: string;
  permission?: string;
}

@Component({
  selector: 'app-shared-export',
  imports: [AppIcon],
  templateUrl: './shared-export.html',
  styleUrl: './shared-export.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SharedExport {
  readonly disabled = input(false);
  readonly exporting = input(false);
  readonly label = input('Export');
  readonly exportRequested = output<void>();
}

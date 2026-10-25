import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SettingsState } from '../settings-state';
@Component({
  selector: 'app-application-settings-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './application-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApplicationSettingsTab {
  readonly state = inject(SettingsState);
}

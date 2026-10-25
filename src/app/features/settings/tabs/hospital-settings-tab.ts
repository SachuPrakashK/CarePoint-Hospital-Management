import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SettingsState } from '../settings-state';

@Component({
  selector: 'app-hospital-settings-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './hospital-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HospitalSettingsTab {
  readonly state = inject(SettingsState);
}

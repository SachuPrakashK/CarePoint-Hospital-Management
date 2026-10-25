import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SettingsState } from '../settings-state';
@Component({
  selector: 'app-security-settings-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './security-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecuritySettingsTab {
  readonly state = inject(SettingsState);
}

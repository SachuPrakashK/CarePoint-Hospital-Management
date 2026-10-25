import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { SettingsState } from '../settings-state';
@Component({
  selector: 'app-notification-settings-tab',
  imports: [ReactiveFormsModule],
  templateUrl: './notification-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationSettingsTab {
  readonly state = inject(SettingsState);
}

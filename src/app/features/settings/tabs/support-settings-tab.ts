import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { SettingsState } from '../settings-state';
@Component({
  selector: 'app-support-settings-tab',
  imports: [ReactiveFormsModule, AppIcon, AppModal],
  templateUrl: './support-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportSettingsTab {
  readonly state = inject(SettingsState);
}

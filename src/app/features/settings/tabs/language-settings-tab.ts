import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { SearchField } from '../../../shared/components/search/search-field';
import { SharedMultiSelect } from '../../../shared/components/multi-select/shared-multi-select';
import { SettingsState } from '../settings-state';
@Component({
  selector: 'app-language-settings-tab',
  imports: [AppActionsMenu, AppModal, SearchField, SharedMultiSelect],
  templateUrl: './language-settings-tab.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSettingsTab {
  readonly state = inject(SettingsState);
}

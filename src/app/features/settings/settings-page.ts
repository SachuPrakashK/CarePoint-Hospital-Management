import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  inject,
  signal,
} from '@angular/core';
import { CanDeactivateFn } from '@angular/router';
import { ApplicationSettingsTab } from './tabs/application-settings-tab';
import { HospitalSettingsTab } from './tabs/hospital-settings-tab';
import { LanguageSettingsTab } from './tabs/language-settings-tab';
import { NotificationSettingsTab } from './tabs/notification-settings-tab';
import { SecuritySettingsTab } from './tabs/security-settings-tab';
import { SupportSettingsTab } from './tabs/support-settings-tab';
import { SettingsSection, SettingsState } from './settings-state';

@Component({
  imports: [
    ApplicationSettingsTab,
    HospitalSettingsTab,
    LanguageSettingsTab,
    NotificationSettingsTab,
    SecuritySettingsTab,
    SupportSettingsTab,
  ],
  providers: [SettingsState],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {
  readonly state = inject(SettingsState);
  readonly tab = signal<SettingsSection>('hospital');

  canLeave() {
    return this.state.canLeave();
  }
}

export const settingsUnsavedGuard: CanDeactivateFn<SettingsPage> = (component) =>
  component.canLeave();

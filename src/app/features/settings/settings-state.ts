import { Injectable, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import {
  AdministrationApiService,
  LanguageCatalogEntry,
} from '../administration/administration-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ApplicationSettingsService } from '../../core/services/application-settings.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AppLanguage, LanguageService } from '../../core/i18n/language.service';
import { MultiSelectOption } from '../../shared/components/multi-select/shared-multi-select';
export type SettingsSection =
  'hospital' | 'application' | 'notifications' | 'security' | 'languages' | 'support';
@Injectable()
export class SettingsState implements OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(AdministrationApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmationService);
  private config = inject(ApplicationSettingsService);
  readonly auth = inject(AuthStore);
  readonly language = inject(LanguageService);
  readonly loading = signal(true);
  readonly saving = signal<SettingsSection | null>(null);
  readonly logoUrl = signal('');
  readonly uploadingLogo = signal(false);
  readonly logoError = signal(false);
  readonly languages = signal<AppLanguage[]>([]);
  readonly updatingLanguage = signal('');
  readonly catalog = signal<LanguageCatalogEntry[]>([]);
  readonly languageSearch = signal('');
  readonly configuredLanguageSearch = signal('');
  readonly selectedCatalogLanguage = signal<LanguageCatalogEntry | null>(null);
  readonly selectedLanguageCodes = signal<string[]>([]);
  readonly catalogOpen = signal(false);
  readonly catalogLoading = signal(false);
  readonly addingLanguage = signal(false);
  readonly languageMenu = signal('');
  readonly translationLanguage = signal<AppLanguage | null>(null);
  readonly translationKeys = signal<string[]>([]);
  readonly translationValues = signal<Record<string, string>>({});
  readonly translationsLoading = signal(false);
  readonly translationsSaving = signal(false);
  readonly translationsDirty = signal(false);
  readonly isSuperAdmin = computed(
    () => this.auth.user()?.roles.some((role) => role.code === 'HOSPITAL_ADMIN') ?? false,
  );
  readonly defaultLanguage = computed(
    () => this.languages().find((item) => item.isDefault) ?? this.languages()[0],
  );
  readonly filteredCatalog = computed(() => {
    const query = this.languageSearch().trim().toLocaleLowerCase();
    return this.catalog().filter(
      (item) =>
        !query ||
        item.name.toLocaleLowerCase().includes(query) ||
        item.nativeName.toLocaleLowerCase().includes(query) ||
        item.code.toLocaleLowerCase().includes(query),
    );
  });
  readonly catalogOptions = computed<MultiSelectOption[]>(() => {
    const configured = new Set(this.languages().map((item) => item.code.toLowerCase()));
    return this.catalog()
      .filter((item) => !['en', 'hi', 'ml', 'ta'].includes(item.code.toLowerCase()))
      .map((item) => ({
        value: item.code,
        label: item.name,
        secondary: item.nativeName,
        disabled: configured.has(item.code.toLowerCase()),
      }));
  });
  readonly filteredLanguages = computed(() => {
    const query = this.configuredLanguageSearch().trim().toLocaleLowerCase();
    return this.languages().filter(
      (item) =>
        !query ||
        item.name.toLocaleLowerCase().includes(query) ||
        item.nativeName.toLocaleLowerCase().includes(query) ||
        item.code.toLocaleLowerCase().includes(query),
    );
  });
  readonly articles = signal<any[]>([]);
  readonly editingArticle = signal<any | null>(null);
  readonly articleEditorOpen = signal(false);
  readonly savingArticle = signal(false);
  readonly forms: Record<Exclude<SettingsSection, 'languages' | 'support'>, FormGroup> = {
    hospital: this.fb.nonNullable.group({
      hospitalName: ['', Validators.required],
      hospitalCode: ['', Validators.required],
      address: [''],
      phone: [''],
      email: ['', Validators.email],
      website: [''],
      registrationNumber: [''],
    }),
    application: this.fb.nonNullable.group({
      applicationName: ['', Validators.required],
      dateFormat: ['DD-MM-YYYY', Validators.required],
      timeFormat: ['12-hour', Validators.required],
      timezone: ['Asia/Kolkata', Validators.required],
      defaultRowsPerPage: [10, Validators.required],
    }),
    notifications: this.fb.nonNullable.group({
      appointmentCreated: [true],
      appointmentCancelled: [true],
      laboratoryResultVerified: [true],
      radiologyResultVerified: [true],
      lowInventory: [true],
      paymentReceived: [true],
    }),
    security: this.fb.nonNullable.group({
      sessionTimeoutMinutes: [15, [Validators.required, Validators.min(5), Validators.max(1440)]],
      passwordMinimumLength: [12, [Validators.required, Validators.min(8), Validators.max(128)]],
      requireUppercase: [true],
      requireLowercase: [true],
      requireNumber: [true],
      requireSpecial: [true],
      maximumLoginAttempts: [5, [Validators.required, Validators.min(3), Validators.max(20)]],
      accountLockMinutes: [30, [Validators.required, Validators.min(5), Validators.max(1440)]],
    }),
  };
  readonly supportForm = this.fb.nonNullable.group({
    email: ['', Validators.email],
    phone: ['', Validators.maxLength(30)],
    workingHours: ['', Validators.maxLength(160)],
    portalUrl: [''],
  });
  readonly articleForm = this.fb.nonNullable.group({
    category: ['', [Validators.required, Validators.minLength(2)]],
    title: ['', [Validators.required, Validators.minLength(3)]],
    content: ['', [Validators.required, Validators.minLength(20)]],
    relatedModule: [''],
    status: ['', Validators.required],
  });
  constructor() {
    void this.load();
    void this.loadLogo();
    void this.loadLanguages();
    void this.loadSupport();
  }
  ngOnDestroy() {
    this.revokeLogoUrl();
  }
  private revokeLogoUrl() {
    const current = this.logoUrl();
    if (current) URL.revokeObjectURL(current);
    this.logoUrl.set('');
  }
  private async loadLogo() {
    try {
      const blob = await firstValueFrom(this.api.logo());
      this.revokeLogoUrl();
      this.logoUrl.set(URL.createObjectURL(blob));
      this.logoError.set(false);
    } catch {
      this.revokeLogoUrl();
      this.logoError.set(true);
    }
  }
  async load() {
    this.loading.set(true);
    try {
      await Promise.all(
        (Object.keys(this.forms) as Exclude<SettingsSection, 'languages' | 'support'>[]).map(
          async (section) => {
            const r = await firstValueFrom(this.api.setting<any>(section));
            this.forms[section].reset(r.data);
            this.forms[section].markAsPristine();
          },
        ),
      );
    } finally {
      this.loading.set(false);
    }
  }
  async save(section: Exclude<SettingsSection, 'languages' | 'support'>) {
    const form = this.forms[section];
    if (this.saving() || form.invalid || form.pristine) return;
    this.saving.set(section);
    try {
      const r = await firstValueFrom(this.api.saveSetting<any>(section, form.getRawValue()));
      form.reset(r.data);
      form.markAsPristine();
      if (section === 'application') this.config.set(r.data);
      this.toast.success(`${section[0].toUpperCase() + section.slice(1)} settings saved.`);
    } finally {
      this.saving.set(null);
    }
  }
  async loadLanguages() {
    try {
      this.languages.set((await firstValueFrom(this.api.languages())).data);
      if (this.isSuperAdmin()) await this.loadCatalog();
    } catch {
      this.toast.error('Language configuration could not be loaded.');
    }
  }
  async loadCatalog() {
    this.catalogLoading.set(true);
    try {
      this.catalog.set((await firstValueFrom(this.api.languageCatalog())).data);
    } finally {
      this.catalogLoading.set(false);
    }
  }
  chooseCatalogLanguage(item: LanguageCatalogEntry) {
    this.selectedCatalogLanguage.set(item);
    this.languageSearch.set(`${item.name} (${item.code})`);
    this.catalogOpen.set(false);
  }
  async addLanguage() {
    const selected = this.selectedCatalogLanguage();
    if (!selected || this.addingLanguage()) return;
    this.addingLanguage.set(true);
    try {
      await firstValueFrom(this.api.addLanguage(selected.code));
      this.selectedCatalogLanguage.set(null);
      this.languageSearch.set('');
      await this.loadLanguages();
      this.toast.success(`${selected.name} added. Translation resources are still required.`);
    } finally {
      this.addingLanguage.set(false);
    }
  }
  async addSelectedLanguages() {
    const codes = this.selectedLanguageCodes();
    if (!codes.length || this.addingLanguage()) return;
    this.addingLanguage.set(true);
    try {
      await firstValueFrom(this.api.addLanguages(codes));
      await this.loadLanguages();
      this.selectedLanguageCodes.set([]);
      this.toast.success(`${codes.length} ${codes.length === 1 ? 'language' : 'languages'} added.`);
    } catch {
      this.toast.error('The selected languages could not be added. No changes were made.');
    } finally {
      this.addingLanguage.set(false);
    }
  }
  async toggleLanguage(item: AppLanguage) {
    if (this.updatingLanguage() || item.isDefault) return;
    this.updatingLanguage.set(item.code);
    try {
      await firstValueFrom(this.api.setLanguageEnabled(item.id, !item.enabled));
      await Promise.all([this.loadLanguages(), this.language.load()]);
      this.toast.success(`${item.name} ${item.enabled ? 'disabled' : 'enabled'}.`);
    } finally {
      this.updatingLanguage.set('');
    }
  }
  async openTranslations(item: AppLanguage) {
    if (!item.enabled || this.translationsLoading()) return;
    this.translationLanguage.set(item);
    this.translationsLoading.set(true);
    try {
      const response = await firstValueFrom(this.api.languageTranslations(item.id));
      this.translationKeys.set(response.data.keys);
      this.translationValues.set(response.data.values);
      this.translationsDirty.set(false);
    } catch {
      this.translationLanguage.set(null);
      this.toast.error('Translations could not be loaded.');
    } finally {
      this.translationsLoading.set(false);
    }
  }
  setTranslation(key: string, value: string) {
    this.translationValues.update((values) => ({ ...values, [key]: value }));
    this.translationsDirty.set(true);
  }
  closeTranslations() {
    if (this.translationsSaving()) return;
    this.translationLanguage.set(null);
    this.translationKeys.set([]);
    this.translationValues.set({});
    this.translationsDirty.set(false);
  }
  async saveTranslations() {
    const item = this.translationLanguage();
    if (!item || this.translationsSaving()) return;
    this.translationsSaving.set(true);
    try {
      await firstValueFrom(this.api.saveLanguageTranslations(item.id, this.translationValues()));
      await Promise.all([this.loadLanguages(), this.language.load()]);
      this.toast.success(`${item.name} translations saved.`);
      this.closeTranslations();
    } catch {
      this.toast.error('Translations could not be saved.');
    } finally {
      this.translationsSaving.set(false);
    }
  }
  async setDefaultLanguage(item: AppLanguage) {
    if (this.updatingLanguage() || item.isDefault) return;
    this.updatingLanguage.set(item.code);
    try {
      await firstValueFrom(this.api.updateLanguage(item.id, { isDefault: true }));
      await Promise.all([this.loadLanguages(), this.language.load()]);
      this.toast.success(`${item.name} is now the default language.`);
    } finally {
      this.updatingLanguage.set('');
      this.languageMenu.set('');
    }
  }
  async removeLanguage(item: AppLanguage) {
    if (
      item.isDefault ||
      this.updatingLanguage() ||
      !(await this.confirm.confirm({
        title: `Remove ${item.name}?`,
        message: 'Users selecting this language will safely fall back to the default language.',
        confirmLabel: 'Remove language',
        danger: true,
      }))
    )
      return;
    this.updatingLanguage.set(item.code);
    try {
      await firstValueFrom(this.api.removeLanguage(item.id));
      await Promise.all([this.loadLanguages(), this.language.load()]);
      this.toast.success(`${item.name} removed from configured languages.`);
    } finally {
      this.updatingLanguage.set('');
      this.languageMenu.set('');
    }
  }
  async loadSupport() {
    try {
      const contacts = await firstValueFrom(this.api.supportContacts());
      this.supportForm.reset(contacts.data);
      this.supportForm.markAsPristine();
      if (this.auth.has('support.article.manage'))
        this.articles.set((await firstValueFrom(this.api.supportArticles())).data);
    } catch {
      this.toast.error('Support configuration could not be loaded.');
    }
  }
  async saveSupport() {
    if (this.supportForm.invalid || this.supportForm.pristine || this.saving()) return;
    this.saving.set('support');
    try {
      const r = await firstValueFrom(this.api.saveSupportContacts(this.supportForm.getRawValue()));
      this.supportForm.reset(r.data);
      this.supportForm.markAsPristine();
      this.toast.success('Support contact details saved.');
    } finally {
      this.saving.set(null);
    }
  }
  editArticle(article: any = null) {
    this.editingArticle.set(article);
    this.articleEditorOpen.set(true);
    this.articleForm.reset(
      article
        ? {
            category: article.category,
            title: article.title,
            content: article.content,
            relatedModule: article.relatedModule ?? '',
            status: article.status,
          }
        : { category: '', title: '', content: '', relatedModule: '', status: '' },
    );
  }
  closeArticleEditor() {
    this.editingArticle.set(null);
    this.articleEditorOpen.set(false);
    this.articleForm.reset({
      category: '',
      title: '',
      content: '',
      relatedModule: '',
      status: '',
    });
    this.articleForm.markAsPristine();
  }
  async saveArticle() {
    if (this.articleForm.invalid || this.savingArticle()) return;
    this.savingArticle.set(true);
    try {
      const value = {
        ...this.articleForm.getRawValue(),
        relatedModule: this.articleForm.controls.relatedModule.value || null,
      };
      const current = this.editingArticle();
      await firstValueFrom(
        current
          ? this.api.updateSupportArticle(current.id, value)
          : this.api.createSupportArticle(value),
      );
      this.closeArticleEditor();
      this.articles.set((await firstValueFrom(this.api.supportArticles())).data);
      this.toast.success('Help article saved.');
    } finally {
      this.savingArticle.set(false);
    }
  }
  async removeArticle(article: any) {
    if (
      !(await this.confirm.confirm({
        title: `Delete ${article.title}?`,
        message: 'This permanently removes the help article.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    await firstValueFrom(this.api.deleteSupportArticle(article.id));
    this.articles.update((values) => values.filter((value) => value.id !== article.id));
    this.toast.success('Help article deleted.');
  }
  dirty() {
    return (
      Object.values(this.forms).some((f) => f.dirty) ||
      this.supportForm.dirty ||
      this.articleForm.dirty
    );
  }
  async canLeave() {
    return (
      !this.dirty() ||
      this.confirm.confirm({
        title: 'Leave without saving?',
        message: 'You have unsaved settings changes.',
        confirmLabel: 'Leave',
        danger: true,
      })
    );
  }
  async uploadLogo(event: Event) {
    const input = event.target as HTMLInputElement,
      file = input.files?.[0];
    if (!file || this.uploadingLogo()) return;
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      this.toast.error('Choose a JPEG, PNG or WebP logo up to 2 MB.');
      input.value = '';
      return;
    }
    this.uploadingLogo.set(true);
    try {
      await firstValueFrom(this.api.uploadLogo(file));
      await this.loadLogo();
      this.toast.success('Hospital logo updated.');
    } finally {
      this.uploadingLogo.set(false);
      input.value = '';
    }
  }
  async deleteLogo() {
    if (
      this.uploadingLogo() ||
      !(await this.confirm.confirm({
        title: 'Delete hospital logo?',
        message: 'The default application logo will be used.',
        confirmLabel: 'Delete',
        danger: true,
      }))
    )
      return;
    this.uploadingLogo.set(true);
    try {
      await firstValueFrom(this.api.deleteLogo());
      this.revokeLogoUrl();
      this.logoError.set(true);
      this.toast.success('Hospital logo deleted.');
    } finally {
      this.uploadingLogo.set(false);
    }
  }
}

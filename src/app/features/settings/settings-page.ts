import { ChangeDetectionStrategy, Component, OnDestroy, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CanDeactivateFn } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdministrationApiService } from '../administration/administration-api.service';
import { ToastService } from '../../core/services/toast.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ApplicationSettingsService } from '../../core/services/application-settings.service';
import { AuthStore } from '../../core/auth/auth.store';
import { AppLanguage, LanguageService } from '../../core/i18n/language.service';
type Section = 'hospital' | 'application' | 'notifications' | 'security' | 'languages'|'support';
@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './settings-page.html',
  styleUrl: './settings-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage implements OnDestroy {
  private fb = inject(FormBuilder);
  private api = inject(AdministrationApiService);
  private toast = inject(ToastService);
  private confirm = inject(ConfirmationService);
  private config = inject(ApplicationSettingsService);
  readonly auth=inject(AuthStore);readonly language=inject(LanguageService);
  readonly tab = signal<Section>('hospital');
  readonly loading = signal(true);
  readonly saving = signal<Section | null>(null);
  readonly logoUrl = signal('');
  readonly uploadingLogo = signal(false);
  readonly logoError = signal(false);
  readonly languages=signal<AppLanguage[]>([]);readonly updatingLanguage=signal('');
  readonly articles=signal<any[]>([]);readonly editingArticle=signal<any|null>(null);readonly articleEditorOpen=signal(false);readonly savingArticle=signal(false);
  readonly forms: Record<Exclude<Section,'languages'|'support'>, FormGroup> = {
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
  readonly supportForm=this.fb.nonNullable.group({email:['',Validators.email],phone:['',Validators.maxLength(30)],workingHours:['',Validators.maxLength(160)],portalUrl:['']});
  readonly articleForm=this.fb.nonNullable.group({category:['',[Validators.required,Validators.minLength(2)]],title:['',[Validators.required,Validators.minLength(3)]],content:['',[Validators.required,Validators.minLength(20)]],relatedModule:[''],status:['DRAFT',Validators.required]});
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
        (Object.keys(this.forms) as Exclude<Section,'languages'|'support'>[]).map(async (section) => {
          const r = await firstValueFrom(this.api.setting<any>(section));
          this.forms[section].reset(r.data);
          this.forms[section].markAsPristine();
        }),
      );
    } finally {
      this.loading.set(false);
    }
  }
  async save(section: Exclude<Section,'languages'|'support'>) {
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
  async loadLanguages(){try{this.languages.set((await firstValueFrom(this.api.languages())).data);}catch{this.toast.error('Language configuration could not be loaded.');}}
  async toggleLanguage(item:AppLanguage){if(this.updatingLanguage()||item.isDefault)return;this.updatingLanguage.set(item.code);try{await firstValueFrom(this.api.setLanguageEnabled(item.code,!item.enabled));await Promise.all([this.loadLanguages(),this.language.load()]);this.toast.success(`${item.name} ${item.enabled?'disabled':'enabled'}.`);}finally{this.updatingLanguage.set('');}}
  async loadSupport(){try{const contacts=await firstValueFrom(this.api.supportContacts());this.supportForm.reset(contacts.data);this.supportForm.markAsPristine();if(this.auth.has('support.article.manage'))this.articles.set((await firstValueFrom(this.api.supportArticles())).data);}catch{this.toast.error('Support configuration could not be loaded.');}}
  async saveSupport(){if(this.supportForm.invalid||this.supportForm.pristine||this.saving())return;this.saving.set('support');try{const r=await firstValueFrom(this.api.saveSupportContacts(this.supportForm.getRawValue()));this.supportForm.reset(r.data);this.supportForm.markAsPristine();this.toast.success('Support contact details saved.');}finally{this.saving.set(null);}}
  editArticle(article:any=null){this.editingArticle.set(article);this.articleEditorOpen.set(true);this.articleForm.reset(article?{category:article.category,title:article.title,content:article.content,relatedModule:article.relatedModule??'',status:article.status}:{category:'',title:'',content:'',relatedModule:'',status:'DRAFT'});}
  closeArticleEditor(){this.editingArticle.set(null);this.articleEditorOpen.set(false);this.articleForm.reset({category:'',title:'',content:'',relatedModule:'',status:'DRAFT'});this.articleForm.markAsPristine();}
  async saveArticle(){if(this.articleForm.invalid||this.savingArticle())return;this.savingArticle.set(true);try{const value={...this.articleForm.getRawValue(),relatedModule:this.articleForm.controls.relatedModule.value||null};const current=this.editingArticle();await firstValueFrom(current?this.api.updateSupportArticle(current.id,value):this.api.createSupportArticle(value));this.closeArticleEditor();this.articles.set((await firstValueFrom(this.api.supportArticles())).data);this.toast.success('Help article saved.');}finally{this.savingArticle.set(false);}}
  async removeArticle(article:any){if(!(await this.confirm.confirm({title:`Delete ${article.title}?`,message:'This permanently removes the help article.',confirmLabel:'Delete',danger:true})))return;await firstValueFrom(this.api.deleteSupportArticle(article.id));this.articles.update(values=>values.filter(value=>value.id!==article.id));this.toast.success('Help article deleted.');}
  dirty() {
    return Object.values(this.forms).some((f) => f.dirty)||this.supportForm.dirty||this.articleForm.dirty;
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
export const settingsUnsavedGuard: CanDeactivateFn<SettingsPage> = (component) =>
  component.canLeave();

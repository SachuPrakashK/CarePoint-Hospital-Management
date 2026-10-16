import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DocumentStore } from '../../core/services/document.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { SearchField } from '../../shared/components/search/search-field';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { AppModal } from '../../shared/components/modal/app-modal';
import { ClickOutsideDirective } from '../../shared/directives/click-outside.directive';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { FormsModule } from '@angular/forms';
import { PatientStore } from '../patients/patient.store';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
@Component({
  imports: [
    SearchField,
    AppPagination,
    EmptyState,
    AppActionsMenu,
    AppModal,
    ClickOutsideDirective,
    AppIcon,
    FormsModule,
    TableSortHeader,ColumnConfig,
  ],
  templateUrl: './documents-page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {
  readonly store = inject(DocumentStore);
  private dates = inject(AppDateTimeService);
  readonly error = signal('');
  readonly auth = inject(AuthStore);
  readonly patients = inject(PatientStore);
  private confirm = inject(ConfirmationService);
  private toast = inject(ToastService);
  private tablePreferences=inject(TablePreferencesService);
  readonly search = signal('');
  readonly ownerType = signal('');
  readonly mimeType = signal('');
  readonly filtersOpen = signal(false);
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly uploadOpen = signal(false);
  readonly selected = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly sort=signal<TableSort|null>(null);
  readonly columns:readonly TableColumnDefinition[]=[{id:'name',header:'File name',visibleByDefault:true,required:true,sortable:true,sortKey:'originalName'},{id:'owner',header:'Related record',visibleByDefault:true,sortable:true,sortKey:'ownerType'},{id:'type',header:'Type',visibleByDefault:true,sortable:true,sortKey:'mimeType'},{id:'size',header:'Size',visibleByDefault:true,sortable:true,sortKey:'size'},{id:'uploader',header:'Uploaded by',visibleByDefault:true,sortable:true,sortKey:'uploadedBy'},{id:'date',header:'Uploaded date',visibleByDefault:true,sortable:true,sortKey:'createdAt'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}];
  readonly visibleColumns=signal(this.tablePreferences.load('documents',this.columns));
  ownerId = '';
  sensitive = true;
  constructor() {
    void this.patients.load();
    void this.load();
    void this.tablePreferences.loadRemote('documents',this.columns).then(ids=>this.visibleColumns.set(ids));
  }
  load() {
    return this.store.load({
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      ownerType: this.ownerType(),
      mimeType: this.mimeType(),
      sortBy:this.sort()?.field,sortOrder:this.sort()?.direction,
    });
  }
  query(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  apply() {
    this.page.set(1);
    this.filtersOpen.set(false);
    void this.load();
  }
  clear() {
    this.ownerType.set('');
    this.mimeType.set('');
    this.apply();
  }
  go(v: number) {
    this.page.set(v);
    void this.load();
  }
  resize(v: number) {
    this.pageSize.set(v);
    this.page.set(1);
    void this.load();
  }
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.load();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const sort=this.sort();return sort?.field===field?(sort.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(column=>ids.includes(column.id)&&column.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.tablePreferences.save('documents',ids);}
  async resetColumns(){await this.tablePreferences.reset('documents');this.visibleColumns.set(this.tablePreferences.load('documents',this.columns));}
  choose(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      this.store.validate(file);
      this.selected.set(file);
      this.error.set('');
    } catch (e) {
      this.selected.set(null);
      this.error.set((e as Error).message);
    }
  }
  async upload() {
    const file = this.selected();
    if (!file || !this.ownerId || this.uploading()) return;
    this.uploading.set(true);
    try {
      await this.store.add(file, 'Patient', this.ownerId, this.sensitive);
      this.toast.success('Document uploaded.');
      this.uploadOpen.set(false);
      this.selected.set(null);
      this.ownerId = '';
      await this.load();
    } finally {
      this.uploading.set(false);
    }
  }
  async remove(id: string) {
    if (
      await this.confirm.confirm({
        title: 'Delete document?',
        message:
          'The document will be removed from normal access while its legal audit trail is retained.',
        confirmLabel: 'Delete',
        danger: true,
      })
    ) {
      await this.store.remove(id);
      this.toast.success('Document deleted.');
      await this.load();
    }
  }
  size(v: number) {
    return `${(v / 1024).toFixed(1)} KB`;
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
}

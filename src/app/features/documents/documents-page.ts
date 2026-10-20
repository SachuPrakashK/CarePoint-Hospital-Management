import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  DOCUMENT_ALLOWED_TYPES,
  DOCUMENT_MAX_SIZE,
  DocumentStore,
} from '../../core/services/document.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { SearchField } from '../../shared/components/search/search-field';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppActionsMenu } from '../../shared/components/actions-menu/app-actions-menu';
import { AppModal } from '../../shared/components/modal/app-modal';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { FormsModule } from '@angular/forms';
import { PatientStore } from '../patients/patient.store';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { ToastService } from '../../core/services/toast.service';
import { AuthStore } from '../../core/auth/auth.store';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { SharedFileUpload } from '../../shared/components/file-upload/shared-file-upload';
@Component({
  imports: [
    SearchField,
    AppPagination,
    EmptyState,
    AppActionsMenu,
    AppModal,
    SharedFilter,
    FormsModule,
    TableSortHeader,
    ColumnConfig,
    SharedFileUpload,
  ],
  templateUrl: './documents-page.html',
  styleUrl: './documents-page.scss',
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
  private tablePreferences = inject(TablePreferencesService);
  readonly search = signal('');
  readonly ownerType = signal('');
  readonly mimeType = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly uploadOpen = signal(false);
  readonly selected = signal<File | null>(null);
  readonly uploading = signal(false);
  readonly uploadProgress = signal<number | null>(null);
  readonly documentAllowedTypes = DOCUMENT_ALLOWED_TYPES;
  readonly documentMaxSize = DOCUMENT_MAX_SIZE;
  readonly sort = signal<TableSort | null>(null);
  readonly columns: readonly TableColumnDefinition[] = [
    {
      id: 'name',
      header: 'File name',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'originalName',
    },
    {
      id: 'owner',
      header: 'Related record',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'ownerType',
    },
    { id: 'type', header: 'Type', visibleByDefault: true, sortable: true, sortKey: 'mimeType' },
    { id: 'size', header: 'Size', visibleByDefault: true, sortable: true, sortKey: 'size' },
    {
      id: 'uploader',
      header: 'Uploaded by',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'uploadedBy',
    },
    {
      id: 'date',
      header: 'Uploaded date',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'createdAt',
    },
    { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
  ];
  readonly visibleColumns = signal(this.tablePreferences.load('documents', this.columns));
  ownerId = '';
  sensitive = true;
  constructor() {
    void this.patients.load();
    void this.load();
    void this.tablePreferences
      .loadRemote('documents', this.columns)
      .then((ids) => this.visibleColumns.set(ids));
  }
  load() {
    return this.store.load({
      page: this.page(),
      pageSize: this.pageSize(),
      search: this.search(),
      ownerType: this.ownerType(),
      mimeType: this.mimeType(),
      sortBy: this.sort()?.field,
      sortOrder: this.sort()?.direction,
    });
  }
  query(v: string) {
    this.search.set(v);
    this.page.set(1);
    void this.load();
  }
  apply() {
    this.page.set(1);
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
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.load();
  }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const sort = this.sort();
    return sort?.field === field ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none';
  }
  columnVisible(id: string) {
    return this.visibleColumns().includes(id);
  }
  async applyColumns(ids: string[]) {
    const active = this.sort();
    if (
      active &&
      !this.columns.some((column) => ids.includes(column.id) && column.sortKey === active.field)
    )
      this.sort.set(null);
    this.visibleColumns.set(ids);
    await this.tablePreferences.save('documents', ids);
  }
  async resetColumns() {
    await this.tablePreferences.reset('documents');
    this.visibleColumns.set(this.tablePreferences.load('documents', this.columns));
  }
  openUpload() {
    this.resetUpload();
    this.uploadOpen.set(true);
  }
  closeUpload() {
    this.uploadOpen.set(false);
    this.resetUpload();
  }
  selectFile(file: File | null) {
    this.uploadProgress.set(null);
    if (!file) {
      this.selected.set(null);
      this.error.set('');
      return;
    }
    try {
      this.store.validate(file);
      this.selected.set(file);
      this.error.set('');
    } catch (e) {
      this.selected.set(null);
      this.error.set((e as Error).message);
    }
  }
  rejectFile(message: string) {
    this.selected.set(null);
    this.uploadProgress.set(null);
    this.error.set(message);
  }
  async upload() {
    const file = this.selected();
    if (!file || !this.ownerId || this.uploading()) return;
    this.uploading.set(true);
    this.error.set('');
    this.uploadProgress.set(0);
    try {
      await this.store.add(file, 'Patient', this.ownerId, this.sensitive, (progress) =>
        this.uploadProgress.set(progress),
      );
      this.toast.success('Document uploaded.');
      this.closeUpload();
      await this.load();
    } catch (error: unknown) {
      const response = error as { error?: { message?: string }; message?: string };
      this.error.set(
        response.error?.message ||
          response.message ||
          'Document could not be uploaded. Please try again.',
      );
      this.uploadProgress.set(null);
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
    if (v < 1024) return `${v} B`;
    if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`;
    return `${(v / (1024 * 1024)).toFixed(1)} MB`;
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
  private resetUpload() {
    this.selected.set(null);
    this.error.set('');
    this.uploadProgress.set(null);
    this.ownerId = '';
    this.sensitive = true;
  }
}

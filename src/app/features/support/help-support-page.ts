import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { SharedFilter } from '../../shared/components/filters/shared-filter';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { AppModal } from '../../shared/components/modal/app-modal';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { SearchField } from '../../shared/components/search/search-field';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import {
  HelpArticle,
  SupportApiService,
  SupportTicket,
  SupportTicketStatus,
} from './support-api.service';

@Component({
  imports: [
    ReactiveFormsModule,
    SearchField,
    EmptyState,
    StatusBadge,
    AppPagination,
    TableSortHeader,
    ColumnConfig,
    SharedFilter,
    AppIcon,
    AppModal,
  ],
  templateUrl: './help-support-page.html',
  styleUrl: './help-support-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpSupportPage {
  private readonly api = inject(SupportApiService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly prefs = inject(TablePreferencesService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthStore);
  readonly dates = inject(AppDateTimeService);

  readonly canCreate = this.auth.has('support.ticket.create');
  readonly canManage = this.auth.has('support.ticket.manage');
  readonly articles = signal<HelpArticle[]>([]);
  readonly articleCategories = signal<string[]>([]);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly contacts = signal<Record<string, string> | null>(null);
  readonly articlesLoading = signal(true);
  readonly ticketsLoading = signal(true);
  readonly contactsLoading = signal(true);
  readonly articlesError = signal('');
  readonly ticketsError = signal('');
  readonly contactsError = signal('');
  readonly submitting = signal(false);
  readonly updatingTicket = signal<string | null>(null);
  readonly detailsLoading = signal(false);
  readonly selectedTicket = signal<SupportTicket | null>(null);
  readonly createOpen = signal(false);
  readonly articleSearch = signal('');
  readonly articleCategory = signal('');
  readonly ticketSearch = signal('');
  readonly statusFilter = signal('');
  readonly priorityFilter = signal('');
  readonly draftStatus = signal('');
  readonly draftPriority = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly sort = signal<TableSort | null>(null);
  readonly activeTicketFilters = computed(
    () => Number(!!this.statusFilter()) + Number(!!this.priorityFilter()),
  );

  private articleRequest = 0;
  private ticketRequest = 0;

  readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    module: ['', Validators.required],
    issueType: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    priority: ['NORMAL', Validators.required],
  });

  readonly modules = [
    'Patients',
    'Appointments',
    'OPD & Queue',
    'Clinical EMR',
    'Laboratory',
    'Radiology',
    'Admissions & Beds',
    'Nursing',
    'Procedures & OT',
    'Pharmacy',
    'Billing',
    'Insurance',
    'Inventory & Operations',
    'Reports',
    'Documents',
    'Users & Roles',
    'Settings',
    'Other',
  ];

  readonly columns: readonly TableColumnDefinition[] = [
    {
      id: 'number',
      header: 'Ticket number',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'ticketNumber',
    },
    ...(this.canManage ? [{ id: 'requester', header: 'Requester', visibleByDefault: true }] : []),
    {
      id: 'subject',
      header: 'Subject',
      visibleByDefault: true,
      required: true,
      sortable: true,
      sortKey: 'subject',
    },
    { id: 'module', header: 'Module', visibleByDefault: true, sortable: true, sortKey: 'module' },
    {
      id: 'priority',
      header: 'Priority',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'priority',
    },
    { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
    {
      id: 'created',
      header: 'Created',
      visibleByDefault: true,
      sortable: true,
      sortKey: 'createdAt',
    },
    {
      id: 'updated',
      header: 'Updated',
      visibleByDefault: false,
      sortable: true,
      sortKey: 'updatedAt',
    },
  ];
  readonly preferenceKey = this.canManage ? 'support-requests-manage' : 'support-requests';
  readonly visibleColumns = signal(this.prefs.load(this.preferenceKey, this.columns));

  constructor() {
    void this.loadArticles(true);
    void this.loadTickets();
    void this.loadContacts();
    void this.prefs
      .loadRemote(this.preferenceKey, this.columns)
      .then((ids) => this.visibleColumns.set(ids));
  }

  async loadArticles(captureCategories = false) {
    const request = ++this.articleRequest;
    this.articlesLoading.set(true);
    this.articlesError.set('');
    try {
      const response = await firstValueFrom(
        this.api.articles(this.articleSearch(), this.articleCategory()),
      );
      if (request !== this.articleRequest) return;
      this.articles.set(response.data);
      if (captureCategories && !this.articleSearch() && !this.articleCategory()) {
        this.articleCategories.set([...new Set(response.data.map((article) => article.category))]);
      }
    } catch {
      if (request === this.articleRequest)
        this.articlesError.set('Help articles could not be loaded.');
    } finally {
      if (request === this.articleRequest) this.articlesLoading.set(false);
    }
  }

  async loadTickets() {
    const request = ++this.ticketRequest;
    this.ticketsLoading.set(true);
    this.ticketsError.set('');
    try {
      const response = await firstValueFrom(
        this.api.tickets({
          page: this.page(),
          pageSize: this.pageSize(),
          search: this.ticketSearch(),
          status: this.statusFilter(),
          priority: this.priorityFilter(),
          sortBy: this.sort()?.field,
          sortOrder: this.sort()?.direction,
        }),
      );
      if (request !== this.ticketRequest) return;
      this.tickets.set(response.data);
      this.total.set(response.pagination.total);
      this.totalPages.set(response.pagination.total_pages);
    } catch {
      if (request === this.ticketRequest)
        this.ticketsError.set('Support requests could not be loaded.');
    } finally {
      if (request === this.ticketRequest) this.ticketsLoading.set(false);
    }
  }

  async loadContacts() {
    this.contactsLoading.set(true);
    this.contactsError.set('');
    try {
      this.contacts.set((await firstValueFrom(this.api.contacts())).data);
    } catch {
      this.contactsError.set('Support contact details could not be loaded.');
    } finally {
      this.contactsLoading.set(false);
    }
  }

  queryArticles(value: string) {
    this.articleSearch.set(value);
    void this.loadArticles();
  }
  selectCategory(category: string) {
    this.articleCategory.set(category);
    void this.loadArticles();
  }
  queryTickets(value: string) {
    this.ticketSearch.set(value);
    this.page.set(1);
    void this.loadTickets();
  }
  applyTicketFilters() {
    this.statusFilter.set(this.draftStatus());
    this.priorityFilter.set(this.draftPriority());
    this.page.set(1);
    void this.loadTickets();
  }
  clearTicketFilters() {
    this.draftStatus.set('');
    this.draftPriority.set('');
    this.statusFilter.set('');
    this.priorityFilter.set('');
    this.page.set(1);
    void this.loadTickets();
  }
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.loadTickets();
  }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const value = this.sort();
    return value?.field === field
      ? value.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
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
    await this.prefs.save(this.preferenceKey, ids);
  }
  async resetColumns() {
    await this.prefs.reset(this.preferenceKey);
    this.visibleColumns.set(this.prefs.load(this.preferenceKey, this.columns));
  }
  go(page: number) {
    this.page.set(page);
    void this.loadTickets();
  }
  resize(size: number) {
    this.pageSize.set(size);
    this.page.set(1);
    void this.loadTickets();
  }

  openCreate() {
    if (this.canCreate) this.createOpen.set(true);
  }
  closeCreate() {
    if (!this.submitting()) this.createOpen.set(false);
  }
  fieldError(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) return '';
    if (control.errors['required']) return 'This field is required.';
    if (control.errors['minlength'])
      return `Enter at least ${control.errors['minlength'].requiredLength} characters.`;
    return '';
  }

  async submit() {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    try {
      const response = await firstValueFrom(
        this.api.create({
          ...this.form.getRawValue(),
          currentRoute: this.router.url,
          appVersion: '1.0.0',
        }),
      );
      this.toast.success(`Support request ${response.data.ticketNumber} submitted.`);
      this.form.reset({
        subject: '',
        module: '',
        issueType: '',
        description: '',
        priority: 'NORMAL',
      });
      this.createOpen.set(false);
      this.page.set(1);
      await this.loadTickets();
    } catch {
      this.toast.error(
        'The support request could not be submitted. Please review the form and try again.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async viewTicket(ticket: SupportTicket) {
    this.detailsLoading.set(true);
    try {
      this.selectedTicket.set((await firstValueFrom(this.api.ticket(ticket.id))).data);
    } catch {
      this.toast.error('The support request details could not be loaded.');
    } finally {
      this.detailsLoading.set(false);
    }
  }

  async updateStatus(ticket: SupportTicket, status: string) {
    if (!this.canManage || status === ticket.status || this.updatingTicket()) return;
    this.updatingTicket.set(ticket.id);
    try {
      await firstValueFrom(this.api.updateTicket(ticket.id, status as SupportTicketStatus));
      this.toast.success(`${ticket.ticketNumber} updated.`);
      await this.loadTickets();
      if (this.selectedTicket()?.id === ticket.id) await this.viewTicket(ticket);
    } catch {
      this.toast.error(`${ticket.ticketNumber} could not be updated.`);
      await this.loadTickets();
    } finally {
      this.updatingTicket.set(null);
    }
  }

  hasContacts() {
    const contact = this.contacts();
    return !!(
      contact?.['email'] ||
      contact?.['phone'] ||
      contact?.['workingHours'] ||
      contact?.['portalUrl']
    );
  }
  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

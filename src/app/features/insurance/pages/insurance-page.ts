import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { Phase23ApiService } from '../../../core/services/phase23-api.service';
import { Phase23Store } from '../../../core/services/phase23.store';
import { TablePreferencesService } from '../../../core/services/table-preferences.service';
import { ToastService } from '../../../core/services/toast.service';
import { AppActionsMenu } from '../../../shared/components/actions-menu/app-actions-menu';
import { ColumnConfig } from '../../../shared/components/column-config/column-config';
import { SharedExport } from '../../../shared/components/export/shared-export';
import { SharedFilter } from '../../../shared/components/filters/shared-filter';
import { AppIcon } from '../../../shared/components/icon/app-icon';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { AppPagination } from '../../../shared/components/pagination/app-pagination';
import { SearchField } from '../../../shared/components/search/search-field';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { SummaryCard } from '../../../shared/components/summary-card/summary-card';
import { TableSortHeader } from '../../../shared/components/table-sort-header/table-sort-header';
import { TableColumnDefinition, TableSort } from '../../../shared/models/table.models';
import { InsuranceForm, InsuranceFormKind } from './insurance-form';
import { PatientStore } from '../../patients/patient.store';

type InsuranceTab = 'claims' | 'coverage' | 'providers';

@Component({
  imports: [
    FormsModule,
    DatePipe,
    AppModal,
    InsuranceForm,
    StatusBadge,
    SearchField,
    AppPagination,
    TableSortHeader,
    ColumnConfig,
    SummaryCard,
    SharedFilter,
    SharedExport,
    AppActionsMenu,
    AppIcon,
  ],
  templateUrl: './insurance-page.html',
  styleUrl: './insurance-page.scss',
})
export class InsurancePage {
  readonly store = inject(Phase23Store);
  readonly auth = inject(AuthStore);
  readonly patients = inject(PatientStore);
  private readonly api = inject(Phase23ApiService);
  private readonly preferences = inject(TablePreferencesService);
  private readonly router = inject(Router);
  private readonly confirmation = inject(ConfirmationService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<InsuranceTab>('claims');
  readonly formKind = signal<InsuranceFormKind | null>(null);
  readonly editing = signal<any | null>(null);
  readonly dirty = signal(false);
  readonly rows = signal<any[]>([]);
  readonly summary = signal<any | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly sort = signal<TableSort | null>(null);
  readonly exporting = signal(false);
  readonly filters = signal<Record<string, string>>({});
  readonly draftFilters = signal<Record<string, string>>({});

  readonly tableColumns: Record<InsuranceTab, readonly TableColumnDefinition[]> = {
    claims: [
      {
        id: 'claim',
        header: 'Claim',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'number',
      },
      {
        id: 'patient',
        header: 'Patient',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'patient',
      },
      { id: 'provider', header: 'Provider', visibleByDefault: true },
      { id: 'policy', header: 'Policy', visibleByDefault: true },
      {
        id: 'invoice',
        header: 'Invoice',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'invoice',
      },
      { id: 'date', header: 'Claim Date', visibleByDefault: true },
      {
        id: 'claimed',
        header: 'Claimed',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'claimedAmount',
      },
      {
        id: 'approved',
        header: 'Approved',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'approvedAmount',
      },
      { id: 'status', header: 'Status', visibleByDefault: true, sortable: true, sortKey: 'status' },
      { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
    ],
    coverage: [
      {
        id: 'patient',
        header: 'Patient',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'patient',
      },
      {
        id: 'provider',
        header: 'Provider',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'provider',
      },
      {
        id: 'policy',
        header: 'Policy',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'policyNumber',
      },
      {
        id: 'member',
        header: 'Member',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'memberNumber',
      },
      {
        id: 'coverage',
        header: 'Coverage',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'coverageLimit',
      },
      {
        id: 'validity',
        header: 'Validity',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'startsAt',
      },
      { id: 'status', header: 'Status', visibleByDefault: true },
      { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
    ],
    providers: [
      {
        id: 'provider',
        header: 'Provider',
        visibleByDefault: true,
        required: true,
        sortable: true,
        sortKey: 'name',
      },
      { id: 'code', header: 'Code', visibleByDefault: true, sortable: true, sortKey: 'code' },
      {
        id: 'contact',
        header: 'Contact',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'contact',
      },
      {
        id: 'address',
        header: 'Address',
        visibleByDefault: true,
        sortable: true,
        sortKey: 'address',
      },
      { id: 'status', header: 'Status', visibleByDefault: true },
      { id: 'actions', header: 'Actions', visibleByDefault: true, required: true },
    ],
  };
  readonly visibleColumns = signal<string[]>(
    this.preferences.load('insurance-claims', this.tableColumns.claims),
  );

  constructor() {
    this.patients.pageSize.set(100);
    void this.patients.load();
    void Promise.all([this.loadTable(), this.loadSummary()]);
    void this.preferences
      .loadRemote('insurance-claims', this.columns())
      .then((ids) => this.visibleColumns.set(ids));
  }

  columns() {
    return this.tableColumns[this.tab()];
  }
  tableId() {
    return `insurance-${this.tab()}`;
  }
  columnVisible(id: string) {
    return this.visibleColumns().includes(id);
  }
  activeFilterCount() {
    return Object.values(this.filters()).filter(Boolean).length;
  }

  open(kind: InsuranceFormKind, item: any = null) {
    this.formKind.set(kind);
    this.editing.set(item);
    this.dirty.set(false);
  }
  close() {
    this.formKind.set(null);
    this.editing.set(null);
  }
  async saved() {
    this.toast.success(`${this.formKind()} ${this.editing() ? 'updated' : 'created'}.`);
    this.close();
    await Promise.all([this.loadTable(), this.loadSummary()]);
  }
  async loadSummary() {
    try {
      this.summary.set((await firstValueFrom(this.api.insuranceSummary())).data);
    } catch {
      this.summary.set(null);
    }
  }
  async selectTab(value: InsuranceTab) {
    if (this.tab() === value) return;
    this.tab.set(value);
    this.page.set(1);
    this.sort.set(null);
    this.search.set('');
    this.filters.set({});
    this.draftFilters.set({});
    this.visibleColumns.set(this.preferences.load(this.tableId(), this.columns()));
    this.visibleColumns.set(await this.preferences.loadRemote(this.tableId(), this.columns()));
    await this.loadTable();
  }
  private requestQuery(page = this.page(), pageSize = this.pageSize()) {
    const f = this.filters();
    return {
      page,
      page_size: pageSize,
      search: this.search() || undefined,
      sort_by: this.sort()?.field,
      sort_order: this.sort()?.direction,
      status: f['status'] || undefined,
      provider_id: f['providerId'] || undefined,
      patient_id: f['patientId'] || undefined,
      date_from: f['dateFrom'] || undefined,
      date_to: f['dateTo'] || undefined,
      expiry_from: f['expiryFrom'] || undefined,
      expiry_to: f['expiryTo'] || undefined,
    };
  }
  async loadTable() {
    this.loading.set(true);
    this.error.set('');
    try {
      const request =
        this.tab() === 'claims'
          ? this.api.claims(this.requestQuery())
          : this.tab() === 'coverage'
            ? this.api.policies(this.requestQuery())
            : this.api.providers(this.requestQuery());
      const response = await firstValueFrom(request);
      this.rows.set(response.data);
      this.total.set(response.pagination.total);
      this.totalPages.set(response.pagination.total_pages);
    } catch {
      this.error.set('Insurance records could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }
  query(value: string) {
    this.search.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  go(value: number) {
    this.page.set(value);
    void this.loadTable();
  }
  resize(value: number) {
    this.pageSize.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  changeSort(value: TableSort | null) {
    this.sort.set(value);
    this.page.set(1);
    void this.loadTable();
  }
  ariaSort(field: string): 'ascending' | 'descending' | 'none' {
    const value = this.sort();
    return value?.field === field
      ? value.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';
  }
  updateDraft(key: string, value: string) {
    this.draftFilters.update((item) => ({ ...item, [key]: value }));
  }
  applyFilters() {
    this.filters.set({ ...this.draftFilters() });
    this.page.set(1);
    void this.loadTable();
  }
  clearFilters() {
    this.filters.set({});
    this.draftFilters.set({});
    this.page.set(1);
    void this.loadTable();
  }
  async applyColumns(ids: string[]) {
    this.visibleColumns.set(ids);
    await this.preferences.save(this.tableId(), ids);
  }
  async resetColumns() {
    await this.preferences.reset(this.tableId());
    this.visibleColumns.set(this.preferences.load(this.tableId(), this.columns()));
  }
  patientName(item: any) {
    return `${item?.firstName ?? ''} ${item?.lastName ?? ''}`.trim() || '—';
  }
  money(value: unknown) {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(
      Number(value ?? 0),
    );
  }
  policyStatus(item: any) {
    return !item.isActive ? 'Inactive' : new Date(item.endsAt) < new Date() ? 'Expired' : 'Active';
  }
  async approve(item: any) {
    if (
      !(await this.confirmation.confirm({
        title: 'Approve claim?',
        message: `Approve ${item.number} for ${this.money(item.claimedAmount)}?`,
        confirmLabel: 'Approve claim',
        cancelLabel: 'Cancel',
        danger: false,
        icon: 'check-circle',
      }))
    )
      return;
    try {
      await this.store.updateClaim(item.id, 'Approved', Number(item.claimedAmount), 'Approved');
      this.toast.success('Claim approved.');
      await Promise.all([this.loadTable(), this.loadSummary()]);
    } catch (error: any) {
      this.toast.error(error?.error?.message ?? 'Claim could not be approved.');
    }
  }
  async remove(kind: 'policy' | 'provider', item: any) {
    if (
      !(await this.confirmation.confirm({
        title: `Deactivate ${kind}?`,
        message: 'The record will remain in history but will no longer be active.',
        confirmLabel: 'Deactivate',
        danger: true,
      }))
    )
      return;
    if (kind === 'policy') await this.store.removePolicy(item.id);
    else await this.store.removeProvider(item.id);
    this.toast.success(`${kind} deactivated.`);
    await Promise.all([this.loadTable(), this.loadSummary()]);
  }
  details(item: any) {
    const kind =
      this.tab() === 'claims' ? 'claims' : this.tab() === 'coverage' ? 'policies' : 'providers';
    void this.router.navigate(['/insurance', kind, item.id]);
  }
  rowKey(event: KeyboardEvent, item: any) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.details(item);
    }
  }
  async exportFiltered() {
    this.exporting.set(true);
    try {
      const all: any[] = [];
      let page = 1;
      let pages = 1;
      do {
        const request =
          this.tab() === 'claims'
            ? this.api.claims(this.requestQuery(page, 100))
            : this.tab() === 'coverage'
              ? this.api.policies(this.requestQuery(page, 100))
              : this.api.providers(this.requestQuery(page, 100));
        const response = await firstValueFrom(request);
        all.push(...response.data);
        pages = response.pagination.total_pages;
        page += 1;
      } while (page <= pages);
      const headers =
        this.tab() === 'claims'
          ? [
              'Claim',
              'Patient',
              'Provider',
              'Policy',
              'Invoice',
              'Claim Date',
              'Claimed',
              'Approved',
              'Status',
            ]
          : this.tab() === 'coverage'
            ? [
                'Patient',
                'Provider',
                'Policy',
                'Member',
                'Coverage',
                'Valid From',
                'Valid To',
                'Status',
              ]
            : ['Provider', 'Code', 'Contact', 'Address', 'Status'];
      const values = (item: any) =>
        this.tab() === 'claims'
          ? [
              item.number,
              this.patientName(item.patient),
              item.insurance?.provider?.name,
              item.insurance?.policyNumber,
              item.invoice?.number,
              item.createdAt,
              item.claimedAmount,
              item.approvedAmount,
              item.status,
            ]
          : this.tab() === 'coverage'
            ? [
                this.patientName(item.patient),
                item.provider?.name,
                item.policyNumber,
                item.memberNumber,
                item.coverageLimit,
                item.startsAt,
                item.endsAt,
                this.policyStatus(item),
              ]
            : [
                item.name,
                item.code,
                item.contact,
                item.address,
                item.isActive ? 'Active' : 'Inactive',
              ];
      const escape = (value: unknown) => `"${String(value ?? '—').replaceAll('"', '""')}"`;
      const csv = [
        headers.map(escape).join(','),
        ...all.map((item) => values(item).map(escape).join(',')),
      ].join('\r\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `medicare-insurance-${this.tab()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      this.exporting.set(false);
    }
  }
}

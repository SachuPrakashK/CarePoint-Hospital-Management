import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { ColumnConfig } from '../../shared/components/column-config/column-config';
import { EmptyState } from '../../shared/components/empty-state/empty-state';
import { AppPagination } from '../../shared/components/pagination/app-pagination';
import { SearchField } from '../../shared/components/search/search-field';
import { StatusBadge } from '../../shared/components/status-badge/status-badge';
import { TableSortHeader } from '../../shared/components/table-sort-header/table-sort-header';
import { TableColumnDefinition, TableSort } from '../../shared/models/table.models';
import { HelpArticle, SupportApiService, SupportTicket } from './support-api.service';

@Component({
  imports: [ReactiveFormsModule, SearchField, EmptyState, StatusBadge, AppPagination, TableSortHeader, ColumnConfig],
  templateUrl: './help-support-page.html',
  styleUrl: './help-support-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HelpSupportPage {
  private api = inject(SupportApiService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private prefs = inject(TablePreferencesService);
  private toast = inject(ToastService);
  private auth = inject(AuthStore);
  readonly dates = inject(AppDateTimeService);
  readonly canManage = this.auth.has('support.ticket.manage');
  readonly articles = signal<HelpArticle[]>([]);
  readonly tickets = signal<SupportTicket[]>([]);
  readonly contacts = signal<any>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly updatingTicket = signal<string | null>(null);
  readonly search = signal('');
  readonly page = signal(1);
  readonly pageSize = signal(10);
  readonly total = signal(0);
  readonly totalPages = signal(0);
  readonly sort = signal<TableSort | null>(null);
  readonly form = this.fb.nonNullable.group({
    subject: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    module: ['', Validators.required], issueType: ['', Validators.required],
    description: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(5000)]],
    priority: ['NORMAL', Validators.required],
  });
  readonly modules = ['Patients','Appointments','OPD & Queue','Clinical EMR','Laboratory','Radiology','Admissions & Beds','Nursing','Procedures & OT','Pharmacy','Billing','Insurance','Inventory & Operations','Reports','Documents','Users & Roles','Settings','Other'];
  readonly columns: readonly TableColumnDefinition[] = [
    {id:'number',header:'Ticket number',visibleByDefault:true,required:true,sortable:true,sortKey:'ticketNumber'},
    ...(this.canManage ? [{id:'requester',header:'Requester',visibleByDefault:true}] : []),
    {id:'subject',header:'Subject',visibleByDefault:true,required:true,sortable:true,sortKey:'subject'},
    {id:'module',header:'Module',visibleByDefault:true,sortable:true,sortKey:'module'},
    {id:'priority',header:'Priority',visibleByDefault:true,sortable:true,sortKey:'priority'},
    {id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},
    {id:'created',header:'Created',visibleByDefault:true,sortable:true,sortKey:'createdAt'},
    {id:'updated',header:'Updated',visibleByDefault:false,sortable:true,sortKey:'updatedAt'},
  ];
  readonly preferenceKey = this.canManage ? 'support-requests-manage' : 'support-requests';
  readonly visibleColumns = signal(this.prefs.load(this.preferenceKey, this.columns));

  constructor() {
    void Promise.all([this.loadArticles(), this.loadTickets(), this.loadContacts()]).finally(() => this.loading.set(false));
    void this.prefs.loadRemote(this.preferenceKey, this.columns).then(ids => this.visibleColumns.set(ids));
  }
  async loadArticles(){const r=await firstValueFrom(this.api.articles(this.search()));this.articles.set(r.data);}
  async loadTickets(){const r=await firstValueFrom(this.api.tickets({page:this.page(),pageSize:this.pageSize(),sortBy:this.sort()?.field,sortOrder:this.sort()?.direction}));this.tickets.set(r.data);this.total.set(r.pagination.total);this.totalPages.set(r.pagination.total_pages);}
  async loadContacts(){this.contacts.set((await firstValueFrom(this.api.contacts())).data);}
  query(value:string){this.search.set(value);void this.loadArticles();}
  changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.loadTickets();}
  ariaSort(field:string):'ascending'|'descending'|'none'{const value=this.sort();return value?.field===field?(value.direction==='asc'?'ascending':'descending'):'none';}
  columnVisible(id:string){return this.visibleColumns().includes(id);}
  async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns.some(x=>ids.includes(x.id)&&x.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.prefs.save(this.preferenceKey,ids);}
  async resetColumns(){await this.prefs.reset(this.preferenceKey);this.visibleColumns.set(this.prefs.load(this.preferenceKey,this.columns));}
  go(page:number){this.page.set(page);void this.loadTickets();}
  resize(size:number){this.pageSize.set(size);this.page.set(1);void this.loadTickets();}
  async submit(){if(this.form.invalid||this.submitting()){this.form.markAllAsTouched();return;}this.submitting.set(true);try{const response=await firstValueFrom(this.api.create({...this.form.getRawValue(),currentRoute:this.router.url,appVersion:'1.0.0'}));this.toast.success(`Support request ${response.data.ticketNumber} submitted.`);this.form.reset({subject:'',module:'',issueType:'',description:'',priority:'NORMAL'});await this.loadTickets();}finally{this.submitting.set(false);}}
  async updateStatus(ticket:SupportTicket,status:string){if(!this.canManage||status===ticket.status)return;this.updatingTicket.set(ticket.id);try{await firstValueFrom(this.api.updateTicket(ticket.id,status));this.toast.success(`${ticket.ticketNumber} updated.`);await this.loadTickets();}finally{this.updatingTicket.set(null);}}
  hasContacts(){const c=this.contacts();return !!(c?.email||c?.phone||c?.workingHours||c?.portalUrl);}
}

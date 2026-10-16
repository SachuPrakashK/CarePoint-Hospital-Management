import { Component, inject, signal } from '@angular/core';import{firstValueFrom}from'rxjs';
import{DatePipe}from'@angular/common';
import { FormsModule } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { ClinicalStore } from '../../../core/services/clinical.store';
import { AppModal } from '../../../shared/components/modal/app-modal';import { InsuranceForm,InsuranceFormKind } from './insurance-form';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import{Phase23ApiService}from'../../../core/services/phase23-api.service';import{SearchField}from'../../../shared/components/search/search-field';import{AppPagination}from'../../../shared/components/pagination/app-pagination';import{TableSortHeader}from'../../../shared/components/table-sort-header/table-sort-header';import{ColumnConfig}from'../../../shared/components/column-config/column-config';import{TableColumnDefinition,TableSort}from'../../../shared/models/table.models';import{TablePreferencesService}from'../../../core/services/table-preferences.service';
@Component({ imports: [FormsModule,DatePipe,AppModal,InsuranceForm,StatusBadge,SearchField,AppPagination,TableSortHeader,ColumnConfig], templateUrl: './insurance-page.html' })
export class InsurancePage {
  readonly store = inject(Phase23Store);
  private clinical = inject(ClinicalStore);
  private api=inject(Phase23ApiService);private preferences=inject(TablePreferencesService);
  readonly tab = signal<'claims' | 'coverage' | 'providers'>('claims');
  readonly formKind=signal<InsuranceFormKind|null>(null);readonly editing=signal<any|null>(null);readonly dirty=signal(false);readonly message=signal('');open(kind:InsuranceFormKind,item:any=null){this.formKind.set(kind);this.editing.set(item);this.dirty.set(false);}close(){this.formKind.set(null);this.editing.set(null);}saved(){this.message.set(`${this.formKind()} ${this.editing()?'updated':'created'}.`);}
  readonly rows=signal<any[]>([]);readonly loading=signal(false);readonly error=signal('');readonly search=signal('');readonly page=signal(1);readonly pageSize=signal(10);readonly total=signal(0);readonly totalPages=signal(0);readonly sort=signal<TableSort|null>(null);
  readonly tableColumns:Record<string,readonly TableColumnDefinition[]>={claims:[{id:'claim',header:'Claim',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},{id:'patient',header:'Patient',visibleByDefault:true,sortable:true,sortKey:'patient'},{id:'invoice',header:'Invoice',visibleByDefault:true,sortable:true,sortKey:'invoice'},{id:'claimed',header:'Claimed',visibleByDefault:true,sortable:true,sortKey:'claimedAmount'},{id:'approved',header:'Approved',visibleByDefault:true,sortable:true,sortKey:'approvedAmount'},{id:'responsibility',header:'Responsibility',visibleByDefault:true,sortable:true,sortKey:'patientResponsibility'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}],coverage:[{id:'patient',header:'Patient',visibleByDefault:true,required:true,sortable:true,sortKey:'patient'},{id:'provider',header:'Provider',visibleByDefault:true,sortable:true,sortKey:'provider'},{id:'policy',header:'Policy',visibleByDefault:true,sortable:true,sortKey:'policyNumber'},{id:'member',header:'Member',visibleByDefault:true,sortable:true,sortKey:'memberNumber'},{id:'coverage',header:'Coverage',visibleByDefault:true,sortable:true,sortKey:'coverageLimit'},{id:'validity',header:'Validity',visibleByDefault:true,sortable:true,sortKey:'startsAt'},{id:'priority',header:'Priority',visibleByDefault:true,sortable:true,sortKey:'priority'}],providers:[{id:'provider',header:'Provider',visibleByDefault:true,required:true,sortable:true,sortKey:'name'},{id:'code',header:'Code',visibleByDefault:true,sortable:true,sortKey:'code'},{id:'contact',header:'Contact',visibleByDefault:true,sortable:true,sortKey:'contact'},{id:'address',header:'Address',visibleByDefault:true,sortable:true,sortKey:'address'},{id:'status',header:'Status',visibleByDefault:true}]};readonly visibleColumns=signal<string[]>(this.preferences.load('insurance-claims',this.tableColumns['claims']));
  constructor(){void this.loadTable();void this.preferences.loadRemote('insurance-claims',this.columns()).then(ids=>this.visibleColumns.set(ids));}columns(){return this.tableColumns[this.tab()];}tableId(){return`insurance-${this.tab()}`;}columnVisible(id:string){return this.visibleColumns().includes(id);}async selectTab(value:'claims'|'coverage'|'providers'){this.tab.set(value);this.page.set(1);this.sort.set(null);this.search.set('');this.visibleColumns.set(this.preferences.load(this.tableId(),this.columns()));this.visibleColumns.set(await this.preferences.loadRemote(this.tableId(),this.columns()));await this.loadTable();}async loadTable(){this.loading.set(true);this.error.set('');try{const q={page:this.page(),page_size:this.pageSize(),search:this.search(),sort_by:this.sort()?.field,sort_order:this.sort()?.direction};const request=this.tab()==='claims'?this.api.claims(q):this.tab()==='coverage'?this.api.policies(q):this.api.providers(q);const r=await firstValueFrom(request);this.rows.set(r.data);this.total.set(r.pagination.total);this.totalPages.set(r.pagination.total_pages);}catch{this.error.set('Insurance records could not be loaded.');}finally{this.loading.set(false);}}query(value:string){this.search.set(value);this.page.set(1);void this.loadTable();}go(value:number){this.page.set(value);void this.loadTable();}resize(value:number){this.pageSize.set(value);this.page.set(1);void this.loadTable();}changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.loadTable();}ariaSort(field:string):'ascending'|'descending'|'none'{const value=this.sort();return value?.field===field?(value.direction==='asc'?'ascending':'descending'):'none';}async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns().some(x=>ids.includes(x.id)&&x.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.preferences.save(this.tableId(),ids);}async resetColumns(){await this.preferences.reset(this.tableId());this.visibleColumns.set(this.preferences.load(this.tableId(),this.columns()));}
  patient(id: string) {
    const p = this.clinical.patients().find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}` : id;
  }
  provider(id: string) {
    return this.store.providers().find((p) => p.id === id)?.name ?? id;
  }
  invoice(id: string) {
    return this.store.invoices().find((i) => i.id === id)?.number ?? id;
  }
  claimed() {
    return this.store.claims().reduce((s, c) => s + c.claimedAmount, 0);
  }
  approved() {
    return this.store.claims().reduce((s, c) => s + c.approvedAmount, 0);
  }
  responsibility() {
    return this.store.claims().reduce((s, c) => s + c.patientResponsibility, 0);
  }
}

import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Phase23Store } from '../../../core/services/phase23.store';
import { PharmacyStore } from '../../../core/services/pharmacy.store';
import { PatientStore } from '../../patients/patient.store';
import { NotificationStore } from '../../../core/notifications/notification.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { AppModal } from '../../../shared/components/modal/app-modal';
import { OperationsForm, OperationsFormKind } from './operations-form';
import { StatusBadge } from '../../../shared/components/status-badge/status-badge';
import { firstValueFrom } from 'rxjs';import{Phase23ApiService}from'../../../core/services/phase23-api.service';import{SearchField}from'../../../shared/components/search/search-field';import{AppPagination}from'../../../shared/components/pagination/app-pagination';import{TableSortHeader}from'../../../shared/components/table-sort-header/table-sort-header';import{ColumnConfig}from'../../../shared/components/column-config/column-config';import{TableColumnDefinition,TableSort}from'../../../shared/models/table.models';import{TablePreferencesService}from'../../../core/services/table-preferences.service';
@Component({
  imports: [FormsModule,AppModal,OperationsForm,StatusBadge,SearchField,AppPagination,TableSortHeader,ColumnConfig],
  templateUrl: './operations-page.html',
  styleUrl: './operations-page.scss',
})
export class OperationsPage {
  readonly store = inject(Phase23Store);
  readonly pharmacy = inject(PharmacyStore);
  readonly patients = inject(PatientStore);
  readonly notifications = inject(NotificationStore);
  private dates = inject(AppDateTimeService);
  private api=inject(Phase23ApiService);private preferences=inject(TablePreferencesService);
  readonly tab = signal<'inventory' | 'procurement' | 'suppliers' | 'ambulance' | 'notifications'>(
    'inventory',
  );
  readonly message = signal('');
  readonly formKind=signal<OperationsFormKind|null>(null);readonly editing=signal<any|null>(null);
  readonly formDirty=signal(false);
  patientId = '';
  ambulanceId = '';
  pickup = '';
  destination = '';
  charges = 0;
  readonly rows=signal<any[]>([]);readonly tableLoading=signal(false);readonly tableError=signal('');readonly search=signal('');readonly page=signal(1);readonly pageSize=signal(10);readonly total=signal(0);readonly totalPages=signal(0);readonly sort=signal<TableSort|null>(null);
  readonly tableColumns:Record<string,readonly TableColumnDefinition[]>={inventory:[{id:'item',header:'Item',visibleByDefault:true,required:true,sortable:true,sortKey:'name'},{id:'category',header:'Category',visibleByDefault:true,sortable:true,sortKey:'category'},{id:'store',header:'Store',visibleByDefault:true},{id:'unit',header:'Unit',visibleByDefault:true,sortable:true,sortKey:'unit'},{id:'stock',header:'Stock',visibleByDefault:true,sortable:true,sortKey:'quantity'},{id:'reorder',header:'Reorder',visibleByDefault:true,sortable:true,sortKey:'reorderLevel'},{id:'alert',header:'Alert',visibleByDefault:true}],procurement:[{id:'po',header:'PO',visibleByDefault:true,required:true,sortable:true,sortKey:'number'},{id:'supplier',header:'Supplier',visibleByDefault:true,sortable:true,sortKey:'supplier'},{id:'item',header:'Item',visibleByDefault:true,sortable:true,sortKey:'item'},{id:'ordered',header:'Ordered',visibleByDefault:true,sortable:true,sortKey:'quantity'},{id:'received',header:'Received',visibleByDefault:true,sortable:true,sortKey:'receivedQuantity'},{id:'value',header:'Value',visibleByDefault:true,sortable:true,sortKey:'unitPrice'},{id:'status',header:'Status',visibleByDefault:true,sortable:true,sortKey:'status'},{id:'actions',header:'Actions',visibleByDefault:true,required:true}],suppliers:[{id:'supplier',header:'Supplier',visibleByDefault:true,required:true,sortable:true,sortKey:'name'},{id:'contact',header:'Contact person',visibleByDefault:true,sortable:true,sortKey:'contactPerson'},{id:'phone',header:'Phone',visibleByDefault:true,sortable:true,sortKey:'phone'},{id:'email',header:'Email',visibleByDefault:true,sortable:true,sortKey:'email'},{id:'tax',header:'Tax number',visibleByDefault:true,sortable:true,sortKey:'taxNumber'},{id:'status',header:'Status',visibleByDefault:true}]};readonly visibleColumns=signal<string[]>(this.preferences.load('operations-inventory',this.tableColumns['inventory']));
  constructor(){void this.patients.load();void this.notifications.load();void this.loadTable();void this.preferences.loadRemote('operations-inventory',this.columns()).then(ids=>this.visibleColumns.set(ids));}
  tableTab(){return ['inventory','procurement','suppliers'].includes(this.tab());}columns(){return this.tableColumns[this.tab()]??[];}tableId(){return`operations-${this.tab()}`;}columnVisible(id:string){return this.visibleColumns().includes(id);}async selectTab(value:'inventory'|'procurement'|'suppliers'|'ambulance'|'notifications'){this.tab.set(value);if(!this.tableTab())return;this.page.set(1);this.search.set('');this.sort.set(null);this.visibleColumns.set(this.preferences.load(this.tableId(),this.columns()));this.visibleColumns.set(await this.preferences.loadRemote(this.tableId(),this.columns()));await this.loadTable();}async loadTable(){if(!this.tableTab())return;this.tableLoading.set(true);this.tableError.set('');try{const q={page:this.page(),page_size:this.pageSize(),search:this.search(),sort_by:this.sort()?.field,sort_order:this.sort()?.direction};const request=this.tab()==='inventory'?this.api.inventory(q):this.tab()==='procurement'?this.api.purchaseOrders(q):this.api.suppliers(q);const r=await firstValueFrom(request);this.rows.set(r.data.map((x:any)=>this.tab()==='inventory'?{...x,category:x.category?.name,openingQuantity:x.quantity}:x));this.total.set(r.pagination.total);this.totalPages.set(r.pagination.total_pages);}catch{this.tableError.set('Operations records could not be loaded.');}finally{this.tableLoading.set(false);}}query(value:string){this.search.set(value);this.page.set(1);void this.loadTable();}go(value:number){this.page.set(value);void this.loadTable();}resize(value:number){this.pageSize.set(value);this.page.set(1);void this.loadTable();}changeSort(value:TableSort|null){this.sort.set(value);this.page.set(1);void this.loadTable();}ariaSort(field:string):'ascending'|'descending'|'none'{const value=this.sort();return value?.field===field?(value.direction==='asc'?'ascending':'descending'):'none';}async applyColumns(ids:string[]){const active=this.sort();if(active&&!this.columns().some(x=>ids.includes(x.id)&&x.sortKey===active.field))this.sort.set(null);this.visibleColumns.set(ids);await this.preferences.save(this.tableId(),ids);}async resetColumns(){await this.preferences.reset(this.tableId());this.visibleColumns.set(this.preferences.load(this.tableId(),this.columns()));}
  open(kind:OperationsFormKind,item:any=null){this.formKind.set(kind);this.editing.set(item);this.formDirty.set(false);}
  close(){this.formKind.set(null);this.editing.set(null);this.formDirty.set(false);}
  saved(){this.message.set(this.editing()?'Record updated.':'Record created.');}
  title(){const labels={inventory:'Inventory item',supplier:'Supplier',ambulance:'Ambulance',purchase:'Purchase order'};return `${this.editing()?'Edit':'Create'} ${labels[this.formKind()!]}`;}
  supplier(id: string) {
    return this.store.suppliers().find((s) => s.id === id)?.name ?? id;
  }
  item(id: string) {
    return (
      this.pharmacy.medicines().find((m) => m.id === id)?.name ??
      this.store.inventory().find((i) => i.id === id)?.name ??
      id
    );
  }
  async receive(id: string, qty: number) {
    const po = this.store.purchaseOrders().find((x) => x.id === id)!;
    const batch = this.pharmacy.batches().find((b) => b.medicineId === po.itemId);
    try {
      await this.store.receivePurchaseOrder(id, qty, batch?.id);
      this.message.set('Goods receipt posted to the stock ledger.');
      await this.loadTable();
    } catch (e) {
      this.message.set((e as Error).message);
    }
  }
  async book() {
    const a = this.store.ambulances().find((x) => x.id === this.ambulanceId);
    try {
      await this.store.bookAmbulance({
        patientId: this.patientId,
        pickup: this.pickup,
        destination: this.destination,
        ambulanceId: this.ambulanceId || undefined,
        charges: this.charges,
      });
      this.message.set('Ambulance booking created.');
    } catch (e) {
      this.message.set((e as Error).message);
    }
  }
  format(v: string) {
    return this.dates.formatDateTime(v);
  }
}

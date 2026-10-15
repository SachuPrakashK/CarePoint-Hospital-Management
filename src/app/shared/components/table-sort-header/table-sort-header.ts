import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { TableSort } from '../../models/table.models';
@Component({ selector: 'app-table-sort-header', templateUrl: './table-sort-header.html', styleUrl: './table-sort-header.scss', changeDetection: ChangeDetectionStrategy.OnPush })
export class TableSortHeader {
  label=input.required<string>(); field=input.required<string>(); sort=input<TableSort|null>(null); sortChange=output<TableSort|null>();
  readonly direction=computed(()=>this.sort()?.field===this.field()?this.sort()!.direction:null);
  toggle(){const value=this.direction();this.sortChange.emit(value===null?{field:this.field(),direction:'asc'}:value==='asc'?{field:this.field(),direction:'desc'}:null);}
}

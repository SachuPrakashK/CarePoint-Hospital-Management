import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../auth/auth.store';
import { TableColumnDefinition } from '../../shared/models/table.models';

@Injectable({ providedIn: 'root' })
export class TablePreferencesService {
  private http=inject(HttpClient);private auth=inject(AuthStore);
  private key(tableId: string) { return `hms.table.${this.auth.user()?.id ?? 'anonymous'}.${tableId}.columns`; }
  load(tableId: string, columns: readonly TableColumnDefinition[]): string[] {
    const defaults = columns.filter(column => column.required || column.visibleByDefault).map(column => column.id);
    try {
      const saved = JSON.parse(localStorage.getItem(this.key(tableId)) ?? 'null');
      if (!Array.isArray(saved)) return defaults;
      const allowed = new Set(columns.map(column => column.id));
      const selected = saved.filter((id): id is string => typeof id === 'string' && allowed.has(id));
      for (const column of columns) if (column.required && !selected.includes(column.id)) selected.push(column.id);
      return selected.length ? selected : defaults;
    } catch { return defaults; }
  }
  async loadRemote(tableId:string,columns:readonly TableColumnDefinition[]){
    try{const response=await firstValueFrom(this.http.get<{data:{visibleColumnIds:string[]}|null}>(`/api/v1/preferences/tables/${encodeURIComponent(tableId)}`));if(response.data){localStorage.setItem(this.key(tableId),JSON.stringify(response.data.visibleColumnIds));return this.validate(response.data.visibleColumnIds,columns);}}catch{}return this.load(tableId,columns);
  }
  async save(tableId: string, ids: readonly string[]) { localStorage.setItem(this.key(tableId), JSON.stringify(ids));try{await firstValueFrom(this.http.put(`/api/v1/preferences/tables/${encodeURIComponent(tableId)}`,{visibleColumnIds:ids}));}catch{} }
  async reset(tableId: string) { localStorage.removeItem(this.key(tableId));try{await firstValueFrom(this.http.delete(`/api/v1/preferences/tables/${encodeURIComponent(tableId)}`));}catch{} }
  private validate(ids:string[],columns:readonly TableColumnDefinition[]){const allowed=new Set(columns.map(column=>column.id));const selected=ids.filter(id=>allowed.has(id));for(const column of columns)if(column.required&&!selected.includes(column.id))selected.push(column.id);return selected.length?selected:columns.filter(column=>column.required||column.visibleByDefault).map(column=>column.id);}
}

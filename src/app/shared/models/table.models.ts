export type SortDirection = 'asc' | 'desc';
export interface TableSort {
  field: string;
  direction: SortDirection;
}
export interface TableColumnDefinition {
  id: string;
  header: string;
  visibleByDefault: boolean;
  required?: boolean;
  sortable?: boolean;
  sortKey?: string;
}

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TableSortHeader } from './table-sort-header';
describe('TableSortHeader', () => {
  let fixture: ComponentFixture<TableSortHeader>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [TableSortHeader] }).compileComponents();
    fixture = TestBed.createComponent(TableSortHeader);
    fixture.componentRef.setInput('label', 'Name');
    fixture.componentRef.setInput('field', 'name');
    fixture.detectChanges();
  });
  it('cycles ascending, descending, then default', () => {
    const values: any[] = [];
    fixture.componentInstance.sortChange.subscribe((value) => {
      values.push(value);
      fixture.componentRef.setInput('sort', value);
      fixture.detectChanges();
    });
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    button.click();
    button.click();
    expect(values).toEqual([
      { field: 'name', direction: 'asc' },
      { field: 'name', direction: 'desc' },
      null,
    ]);
  });
});

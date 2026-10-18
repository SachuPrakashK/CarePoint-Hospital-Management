import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchField } from './search-field';

describe('SearchField', () => {
  let fixture: ComponentFixture<SearchField>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SearchField] }).compileComponents();
    fixture = TestBed.createComponent(SearchField);
    fixture.detectChanges();
  });
  it('normalizes, debounces and de-duplicates queries', async () => {
    const values: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => values.push(value));
    fixture.componentInstance.update('  Ravi   Kumar ');
    await new Promise((resolve) => setTimeout(resolve, 320));
    fixture.componentInstance.update('Ravi Kumar');
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(values).toEqual(['Ravi Kumar']);
  });
  it('clears immediately and cancels a pending query', async () => {
    const values: string[] = [];
    fixture.componentInstance.valueChange.subscribe((value) => values.push(value));
    fixture.componentInstance.update('stale');
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.clear(input);
    await new Promise((resolve) => setTimeout(resolve, 320));
    expect(values).toEqual(['']);
  });
});

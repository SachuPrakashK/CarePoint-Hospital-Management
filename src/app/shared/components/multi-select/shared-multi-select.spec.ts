import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedMultiSelect } from './shared-multi-select';

describe('SharedMultiSelect', () => {
  let fixture: ComponentFixture<SharedMultiSelect>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SharedMultiSelect] }).compileComponents();
    fixture = TestBed.createComponent(SharedMultiSelect);
    fixture.componentRef.setInput('options', [
      { value: 'fr', label: 'French', secondary: 'Français' },
      { value: 'de', label: 'German', secondary: 'Deutsch', disabled: true },
    ]);
    fixture.detectChanges();
  });

  it('selects multiple options, protects disabled options, and clears selection', () => {
    const values: string[][] = [];
    fixture.componentInstance.selectedChange.subscribe((value) => values.push(value));
    fixture.componentInstance.toggle({ value: 'fr', label: 'French' });
    fixture.componentInstance.toggle({ value: 'de', label: 'German', disabled: true });
    fixture.componentRef.setInput('selected', ['fr']);
    fixture.detectChanges();
    fixture.componentInstance.clear();
    expect(values).toEqual([['fr'], []]);
  });
});

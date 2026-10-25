import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColumnConfig } from './column-config';
describe('ColumnConfig', () => {
  let fixture: ComponentFixture<ColumnConfig>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ColumnConfig] }).compileComponents();
    fixture = TestBed.createComponent(ColumnConfig);
    fixture.componentRef.setInput('columns', [
      { id: 'name', header: 'Name', visibleByDefault: true, required: true },
      { id: 'phone', header: 'Phone', visibleByDefault: true },
    ]);
    fixture.componentRef.setInput('visible', ['name', 'phone']);
    fixture.detectChanges();
  });
  it('protects required columns and applies optional changes', () => {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    const inputs = fixture.nativeElement.querySelectorAll('input');
    expect(inputs[0].disabled).toBe(true);
    expect(inputs[1].disabled).toBe(false);
    const emitted: string[][] = [];
    fixture.componentInstance.apply.subscribe((value) => emitted.push(value));
    inputs[1].click();
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.primary').click();
    expect(emitted).toEqual([['name']]);
  });
  it('closes on escape', () => {
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(fixture.componentInstance.open()).toBe(false);
  });
  it('disables the trigger and closes an open panel when the list becomes unavailable', () => {
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.open()).toBe(true);

    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('button') as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(fixture.componentInstance.open()).toBe(false);
  });
});

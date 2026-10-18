import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SharedFilter } from './shared-filter';

describe('SharedFilter', () => {
  let fixture: ComponentFixture<SharedFilter>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SharedFilter] }).compileComponents();
    fixture = TestBed.createComponent(SharedFilter);
    fixture.detectChanges();
  });
  it('toggles and closes on Escape', () => {
    fixture.nativeElement.querySelector('button').click();
    expect(fixture.componentInstance.open()).toBe(true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(fixture.componentInstance.open()).toBe(false);
  });
  it('emits apply and clear independently and closes the panel', () => {
    let applied = 0,
      cleared = 0;
    fixture.componentInstance.applied.subscribe(() => applied++);
    fixture.componentInstance.cleared.subscribe(() => cleared++);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.primary').click();
    expect(applied).toBe(1);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.filter-clear-btn').click();
    expect(cleared).toBe(1);
    expect(fixture.componentInstance.open()).toBe(false);
  });
  it('renders the shared clear icon and blocks clear while loading', () => {
    let cleared = 0;
    fixture.componentInstance.cleared.subscribe(() => cleared++);
    fixture.componentRef.setInput('loading', true);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    const clear = fixture.nativeElement.querySelector('.filter-clear-btn') as HTMLButtonElement;
    expect(clear.disabled).toBe(true);
    expect(clear.querySelector('app-icon')).not.toBeNull();
    clear.click();
    expect(cleared).toBe(0);
  });
});

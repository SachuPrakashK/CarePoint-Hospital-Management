import { TestBed } from '@angular/core/testing';
import { AppPagination } from './app-pagination';

describe('AppPagination', () => {
  it('renders nothing when there are no visible results', async () => {
    await TestBed.configureTestingModule({ imports: [AppPagination] }).compileComponents();
    const fixture = TestBed.createComponent(AppPagination);
    fixture.componentRef.setInput('totalItems', 0);
    fixture.componentRef.setInput('totalPages', 0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });

  it('renders when the result set has records', async () => {
    await TestBed.configureTestingModule({ imports: [AppPagination] }).compileComponents();
    const fixture = TestBed.createComponent(AppPagination);
    fixture.componentRef.setInput('totalItems', 11);
    fixture.componentRef.setInput('totalPages', 2);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Showing 1–10 of 11 records');
  });

  it('does not flash stale pagination while a new result set is loading', async () => {
    await TestBed.configureTestingModule({ imports: [AppPagination] }).compileComponents();
    const fixture = TestBed.createComponent(AppPagination);
    fixture.componentRef.setInput('totalItems', 100);
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nav')).toBeNull();
  });
});

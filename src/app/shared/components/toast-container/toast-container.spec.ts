import { TestBed } from '@angular/core/testing';
import { ToastService } from '../../../core/services/toast.service';
import { ToastContainer } from './toast-container';

describe('ToastContainer', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ToastContainer] }).compileComponents();
  });

  it('renders success feedback with its success class and check icon', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    TestBed.inject(ToastService).success('Saved successfully.');
    fixture.detectChanges();

    const toast: HTMLElement = fixture.nativeElement.querySelector('article.success');
    expect(toast).not.toBeNull();
    expect(toast.querySelector('use')?.getAttribute('href')).toBe('icons.svg#check-circle');
  });

  it('renders error feedback with its error class and alert icon', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    TestBed.inject(ToastService).error('Save failed.');
    fixture.detectChanges();

    const toast: HTMLElement = fixture.nativeElement.querySelector('article.error');
    expect(toast).not.toBeNull();
    expect(toast.querySelector('use')?.getAttribute('href')).toBe('icons.svg#alert-circle');
  });

  it('dismisses a notification from its close button', () => {
    const fixture = TestBed.createComponent(ToastContainer);
    const service = TestBed.inject(ToastService);
    service.error('Dismiss me.');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();
    expect(service.toasts()).toHaveLength(0);
  });
});

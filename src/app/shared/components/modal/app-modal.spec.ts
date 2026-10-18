import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { AppModal } from './app-modal';

describe('AppModal', () => {
  const confirmation = { confirm: vi.fn() };
  beforeEach(async () => {
    confirmation.confirm.mockReset();
    await TestBed.configureTestingModule({
      imports: [AppModal],
      providers: [{ provide: ConfirmationService, useValue: confirmation }],
    }).compileComponents();
  });
  it('does not close on backdrop click or Escape', () => {
    const fixture = TestBed.createComponent(AppModal);
    fixture.componentRef.setInput('title', 'Create record');
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.modal-overlay').click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(closed).not.toHaveBeenCalled();
  });
  it('closes through the X without prompting when pristine', async () => {
    const fixture = TestBed.createComponent(AppModal);
    fixture.componentRef.setInput('title', 'Create record');
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Close"]').click();
    await Promise.resolve();
    expect(confirmation.confirm).not.toHaveBeenCalled();
    expect(closed).toHaveBeenCalledOnce();
  });
  it('renders an optional header icon without changing the title', () => {
    const fixture = TestBed.createComponent(AppModal);
    fixture.componentRef.setInput('title', 'Change Password');
    fixture.componentRef.setInput('icon', 'shield');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.crud-modal__header-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Change Password');
  });
  it('keeps editing when discard confirmation is declined', async () => {
    confirmation.confirm.mockResolvedValue(false);
    const fixture = TestBed.createComponent(AppModal);
    fixture.componentRef.setInput('title', 'Edit record');
    fixture.componentRef.setInput('dirty', true);
    const closed = vi.fn();
    fixture.componentInstance.closed.subscribe(closed);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('[aria-label="Close"]').click();
    await Promise.resolve();
    expect(closed).not.toHaveBeenCalled();
  });
});

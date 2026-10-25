import { TestBed } from '@angular/core/testing';
import { ConfirmationService } from '../../../core/services/confirmation.service';
import { ConfirmationDialog } from './confirmation-dialog';

describe('ConfirmationDialog', () => {
  it('renders an approval confirmation with a check icon instead of trash', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmationDialog] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmationDialog);
    void TestBed.inject(ConfirmationService).confirm({
      title: 'Approve claim?',
      message: 'Approve this eligible claim?',
      danger: false,
      icon: 'check-circle',
    });
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('.approval-icon use');
    expect(icon?.getAttribute('href')).toBe('icons.svg#check-circle');
  });
});

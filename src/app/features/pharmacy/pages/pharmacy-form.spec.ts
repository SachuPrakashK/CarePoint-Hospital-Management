import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { PharmacyStore } from '../../../core/services/pharmacy.store';
import { PharmacyForm } from './pharmacy-form';

describe('PharmacyForm', () => {
  let fixture: ComponentFixture<PharmacyForm>;
  let component: PharmacyForm;
  const store = {
    medicines: () => [{ id: 'm1', name: 'Paracetamol' }],
    saveMedicine: vi.fn(async () => undefined),
    saveBatch: vi.fn(async () => undefined),
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PharmacyForm],
      providers: [
        { provide: PharmacyStore, useValue: store },
        {
          provide: AppDateTimeService,
          useValue: { formValueToApi: (date: string) => `${date}T00:00:00.000Z` },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(PharmacyForm);
    component = fixture.componentInstance;
  });
  it('provides meaningful medicine placeholders and validation', () => {
    fixture.componentRef.setInput('kind', 'medicine');
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Enter medicine name"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Enter generic name"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.querySelector('input[placeholder="Enter barcode"]')).toBeTruthy();
    expect(component.form.invalid).toBe(true);
  });
  it('shows the medicine placeholder by default and rejects zero quantity', () => {
    fixture.componentRef.setInput('kind', 'batch');
    fixture.detectChanges();
    const medicineSelect = fixture.nativeElement.querySelector(
      'select[formControlName="medicineId"]',
    );
    expect(component.form.controls.medicineId.value).toBe('');
    expect(medicineSelect.value).toBe('');
    expect(medicineSelect.selectedOptions[0].textContent).toContain('Select medicine');
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Enter batch number"]'),
    ).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('input[placeholder="Enter received quantity"]'),
    ).toBeTruthy();
    component.form.controls.quantity.setValue(0);
    expect(component.form.controls.quantity.invalid).toBe(true);
  });
  it('prevents duplicate stock receipt submission', async () => {
    fixture.componentRef.setInput('kind', 'batch');
    fixture.detectChanges();
    component.form.patchValue({
      medicineId: 'm1',
      batchNumber: 'B-1',
      expiresAt: '2099-01-01',
      purchasePrice: 1,
      sellingPrice: 2,
      quantity: 3,
      reorderLevel: 1,
    });
    let resolve!: () => void;
    (store.saveBatch as any).mockImplementationOnce(
      () => new Promise<void>((done) => (resolve = done)),
    );
    const first = component.submit();
    const second = component.submit();
    expect(store.saveBatch).toHaveBeenCalledTimes(1);
    resolve();
    await Promise.all([first, second]);
  });
});

import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthStore } from '../../../core/auth/auth.store';
import { AppDateTimeService } from '../../../core/services/app-date-time.service';
import { PharmacyStore } from '../../../core/services/pharmacy.store';
import { PharmacyPage } from './pharmacy-page';

describe('PharmacyPage', () => {
  let fixture: ComponentFixture<PharmacyPage>; let component: PharmacyPage;
  const store = {
    medicines: signal<any[]>([{ id: 'm1', name: 'Paracetamol', genericName: 'Acetaminophen', brand: 'Care' }]), batches: signal<any[]>([]), dispenses: signal<any[]>([]), stockLedger: signal<any[]>([]),
    stockBatches: signal<any[]>([]), stockLoading: signal(false), stockError: signal(''), stockTotal: signal(0), stockTotalPages: signal(0), stockBaseTotal: signal(1), categories: signal(['Analgesic']), expirySoonDays: signal(90), stockStats: signal({ lowStock: 0, expiring: 0 }), ledgerLoading: signal(false), ledgerError: signal(''), ledgerTotal: signal(0),
    lowStock: signal<any[]>([]), expiring: signal<any[]>([]), lowStockCount: signal(0), expiringCount: signal(0), loadStock: vi.fn(async () => undefined), loadLedger: vi.fn(async () => undefined), batchQuantity: () => 0, medicineQuantity: () => 0, dispense: vi.fn(),
  };
  beforeEach(async () => {
    store.stockBatches.set([]); store.stockBaseTotal.set(1); store.stockLedger.set([]); store.loadStock.mockClear();
    await TestBed.configureTestingModule({ imports: [PharmacyPage], providers: [
      { provide: PharmacyStore, useValue: store }, { provide: AuthStore, useValue: { has: () => true } },
      { provide: AppDateTimeService, useValue: { formatDateTime: (value: string) => `date-time:${value}`, formatDate: (value: string) => value ? '03-10-2027' : '—' } },
    ] }).compileComponents();
    fixture = TestBed.createComponent(PharmacyPage); component = fixture.componentInstance; fixture.detectChanges();
  });
  it('uses equally styled, spaced pharmacy actions', () => { const actions = fixture.nativeElement.querySelector('.pharmacy-actions'); const buttons = actions.querySelectorAll('button.primary'); expect(buttons.length).toBe(2); expect(actions).toBeTruthy(); });
  it('resets page and preserves active filters when search changes', () => { component.category.set('Analgesic'); component.page.set(3); component.onSearch('para'); expect(component.page()).toBe(1); expect(component.category()).toBe('Analgesic'); expect(store.loadStock).toHaveBeenCalledWith(expect.objectContaining({ search: 'para', category: 'Analgesic' })); });
  it('applies and clears combined server filters', () => { component.draftCategory.set('Analgesic'); component.draftLowStock.set(true); component.draftExpiry.set('expiring_soon'); component.applyFilters(); expect(component.activeFilterCount()).toBe(3); expect(store.loadStock).toHaveBeenCalledWith(expect.objectContaining({ category: 'Analgesic', lowStock: true, expiry: 'expiring_soon' })); component.search.set('para'); component.clearFilters(); expect(component.search()).toBe('para'); expect(component.activeFilterCount()).toBe(0); });
  it('disables filters only when the underlying inventory is empty', () => { store.stockBaseTotal.set(0); expect(component.filtersDisabled()).toBe(true); store.stockBaseTotal.set(20); store.stockBatches.set([]); expect(component.filtersDisabled()).toBe(false); });
  it('formats expiry as a date and handles a missing value', () => { expect(component.formatExpiry('2027-10-03T00:00:00.000Z')).toBe('03-10-2027'); expect(component.formatExpiry(null)).toBe('Not available'); });
  it('renders relational ledger values instead of internal IDs', () => { store.stockLedger.set([{ id: 'x1', type: 'Stock Receipt', quantity: 5, createdAt: 'now', medicine: { name: 'Paracetamol' }, batch: { batchNumber: 'B-100' }, reference: 'RCV-100', createdBy: { displayName: 'A Pharmacist' } }]); component.selectTab('ledger'); fixture.detectChanges(); const text = fixture.nativeElement.textContent; expect(text).toContain('Paracetamol'); expect(text).toContain('B-100'); expect(text).toContain('A Pharmacist'); });
});

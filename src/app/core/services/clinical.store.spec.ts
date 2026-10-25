import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ClinicalStore } from './clinical.store';
describe('ClinicalStore API state', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('starts without seeded clinical records', () => {
    const store = TestBed.inject(ClinicalStore);
    expect(store.appointments()).toEqual([]);
    expect(store.consultations()).toEqual([]);
    expect(store.queue()).toEqual([]);
  });
});

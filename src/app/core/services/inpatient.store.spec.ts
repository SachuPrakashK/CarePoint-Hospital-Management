import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InpatientStore } from './inpatient.store';
describe('InpatientStore API state', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('does not use seeded admissions, beds or procedures', () => {
    const store = TestBed.inject(InpatientStore);
    expect(store.admissions()).toEqual([]);
    expect(store.beds()).toEqual([]);
    expect(store.procedures()).toEqual([]);
  });
  it('loads timelines through the patient API', () => {
    const store = TestBed.inject(InpatientStore);
    expect(store.timeline('00000000-0000-4000-8000-000000000000')()).toEqual([]);
  });
});

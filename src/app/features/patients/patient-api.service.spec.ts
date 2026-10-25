import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { PatientApiService } from './patient-api.service';
describe('PatientApiService', () => {
  let service: PatientApiService, http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PatientApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('sends server-side list parameters', () => {
    service
      .list({
        page: 2,
        pageSize: 25,
        search: 'Meera',
        status: 'Active',
        gender: 'Female',
        minAge: 18,
        createdFrom: '2026-01-01',
        sortBy: 'firstName',
        sortOrder: 'asc',
      })
      .subscribe();
    const request = http.expectOne((r) => r.url === '/api/v1/patients');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('search')).toBe('Meera');
    expect(request.request.params.get('gender')).toBe('Female');
    expect(request.request.params.get('min_age')).toBe('18');
    expect(request.request.params.get('created_from')).toBe('2026-01-01');
    expect(request.request.params.get('sort_by')).toBe('firstName');
    expect(request.request.params.get('sort_order')).toBe('asc');
    request.flush({
      data: [],
      pagination: { page: 2, page_size: 25, total: 0, total_pages: 0, all_total: 4 },
    });
  });
});

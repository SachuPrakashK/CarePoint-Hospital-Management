import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppointmentApiService } from './appointment-api.service';

describe('AppointmentApiService', () => {
  let service: AppointmentApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AppointmentApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('preserves combined server-side search, filters, range and pagination', () => {
    service.list({ page: 2, pageSize: 25, search: 'Arun', departmentId: 'dep', doctorId: 'doc', status: 'CONFIRMED', startDate: '2026-09-26T18:30:00.000Z', endDate: '2026-10-03T18:30:00.000Z' }).subscribe();
    const request = http.expectOne((item) => item.url === '/api/v1/appointments');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('page_size')).toBe('25');
    expect(request.request.params.get('search')).toBe('Arun');
    expect(request.request.params.get('department_id')).toBe('dep');
    expect(request.request.params.get('doctor_id')).toBe('doc');
    expect(request.request.params.get('status')).toBe('CONFIRMED');
    expect(request.request.params.get('start_date')).toContain('2026-09-26');
    request.flush({ data: [], pagination: { page: 2, page_size: 25, total: 0, total_pages: 0 } });
  });
});

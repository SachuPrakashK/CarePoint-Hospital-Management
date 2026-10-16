import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ProcedureApiService } from './procedure-api.service';

describe('ProcedureApiService', () => {
  let api: ProcedureApiService; let http: HttpTestingController;
  beforeEach(() => { TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }); api = TestBed.inject(ProcedureApiService); http = TestBed.inject(HttpTestingController); });
  afterEach(() => http.verify());
  it('sends combined server-side search, date, theatre, status and pagination', () => {
    api.list({ page: 2, pageSize: 25, search: 'Rahul', fromDate: '2026-10-01', toDate: '2026-10-03', theatreId: 'theatre-id', status: 'Scheduled' }).subscribe();
    const request = http.expectOne((item) => item.url === '/api/v1/procedures');
    expect(request.request.params.get('page')).toBe('2'); expect(request.request.params.get('page_size')).toBe('25'); expect(request.request.params.get('search')).toBe('Rahul'); expect(request.request.params.get('from_date')).toBe('2026-10-01'); expect(request.request.params.get('to_date')).toBe('2026-10-03'); expect(request.request.params.get('theatre_id')).toBe('theatre-id'); expect(request.request.params.get('status')).toBe('Scheduled');
    request.flush({ data: [], pagination: { total: 0, total_pages: 0 } });
  });
  it('uses stats, lookups, details, create and update endpoints', () => {
    api.stats().subscribe(); http.expectOne('/api/v1/procedures/stats').flush({ data: {} });
    api.lookups().subscribe(); http.expectOne('/api/v1/procedure-lookups').flush({ data: {} });
    api.details('id').subscribe(); http.expectOne('/api/v1/procedures/id').flush({ data: {} });
    api.create({ name: 'Procedure' }).subscribe(); expect(http.expectOne('/api/v1/procedures').request.method).toBe('POST');
    api.update('id', { status: 'Completed' }).subscribe(); expect(http.expectOne('/api/v1/procedures/id').request.method).toBe('PUT');
  });
});

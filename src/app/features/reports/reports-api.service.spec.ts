import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ReportsApiService } from './reports-api.service';

describe('ReportsApiService', () => {
  it('sends the selected server-side report scope', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ReportsApiService);
    const http = TestBed.inject(HttpTestingController);
    api
      .overview({ from: '2026-10-01', to: '2026-10-19', departmentId: 'department-1' })
      .subscribe();
    const request = http.expectOne((value) => value.url === '/api/v1/reports/overview');
    expect(request.request.params.get('from')).toBe('2026-10-01');
    expect(request.request.params.get('to')).toBe('2026-10-19');
    expect(request.request.params.get('department_id')).toBe('department-1');
    request.flush({ data: {} });
    http.verify();
  });
  it('requests a complete CSV export with the applied server-side scope', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ReportsApiService);
    const http = TestBed.inject(HttpTestingController);
    api
      .exportCsv({
        from: '2026-10-01',
        to: '2026-10-19',
        departmentId: 'department-1',
      })
      .subscribe();
    const request = http.expectOne((value) => value.url === '/api/v1/reports/export.csv');
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('department_id')).toBe('department-1');
    expect(request.request.headers.has('X-Handle-Error-Locally')).toBe(true);
    request.flush(new Blob(['Department,Total Activity']), {
      headers: { 'content-type': 'text/csv; charset=utf-8' },
    });
    http.verify();
  });
});

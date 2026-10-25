import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InpatientApiService } from './inpatient-api.service';

describe('InpatientApiService', () => {
  let api: InpatientApiService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(InpatientApiService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends combined server-side search, department, status and pagination', () => {
    api
      .admissions({
        page: 3,
        pageSize: 25,
        search: 'Rahul',
        departmentId: 'department-id',
        status: 'ADMITTED',
      })
      .subscribe();
    const request = http.expectOne((item) => item.url === '/api/v1/admissions');
    expect(request.request.params.get('page')).toBe('3');
    expect(request.request.params.get('page_size')).toBe('25');
    expect(request.request.params.get('search')).toBe('Rahul');
    expect(request.request.params.get('department_id')).toBe('department-id');
    expect(request.request.params.get('status')).toBe('ADMITTED');
    request.flush({ data: [], pagination: { page: 3, page_size: 25, total: 0, total_pages: 0 } });
  });

  it('uses admission-scoped lazy endpoints', () => {
    api.bedHistory('admission-id').subscribe();
    http.expectOne('/api/v1/admissions/admission-id/bed-history').flush({ data: [] });
    api.admissionNursing('admission-id').subscribe();
    http
      .expectOne('/api/v1/admissions/admission-id/nursing')
      .flush({ data: { notes: [], carePlans: [], intakeOutputs: [] } });
  });

  it('uses database-backed nursing workflow endpoints', () => {
    api.assignedPatients().subscribe();
    http.expectOne('/api/v1/nursing/assigned-patients').flush({ data: [] });
    api.notes('admission-id').subscribe();
    const notes = http.expectOne('/api/v1/nursing-notes?admission_id=admission-id');
    expect(notes.request.method).toBe('GET');
    notes.flush({ data: [] });
    api.medications('admission-id').subscribe();
    http
      .expectOne('/api/v1/medication-administrations?admission_id=admission-id')
      .flush({ data: [] });
    api.createHandover({ admissionId: 'admission-id' }).subscribe();
    const handover = http.expectOne('/api/v1/nursing/handovers');
    expect(handover.request.method).toBe('POST');
    handover.flush({ data: { id: 'handover-id' } });
    api.acknowledgeHandover('handover-id').subscribe();
    const acknowledgement = http.expectOne('/api/v1/nursing/handovers/handover-id/acknowledge');
    expect(acknowledgement.request.method).toBe('POST');
    acknowledgement.flush({ data: { id: 'handover-id', status: 'ACKNOWLEDGED' } });
  });
});

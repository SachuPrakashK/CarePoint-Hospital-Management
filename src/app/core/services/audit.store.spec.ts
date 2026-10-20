import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuditStore } from './audit.store';

describe('AuditStore', () => {
  let store: AuditStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(AuditStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends server-side filters and preserves persisted audit fields', async () => {
    const pending = store.load({
      search: 'patient',
      module: 'patients',
      action: 'updated',
      userId: 'actor-1',
      entityType: 'Patient',
      from: '2026-10-01',
      to: '2026-10-18',
      page: 2,
      pageSize: 25,
      sortBy: 'action',
      sortOrder: 'asc',
    });
    const request = http.expectOne((value) => value.url === '/api/v1/audit');
    expect(request.request.params.get('search')).toBe('patient');
    expect(request.request.params.get('user_id')).toBe('actor-1');
    expect(request.request.params.get('entity_type')).toBe('Patient');
    expect(request.request.params.get('created_from')).toBe('2026-10-01');
    expect(request.request.params.get('created_to')).toBe('2026-10-18');
    request.flush({
      data: [
        {
          id: 'event-1',
          createdAt: '2026-10-18T10:00:00.000Z',
          userId: 'actor-1',
          action: 'updated',
          module: 'patients',
          entityType: 'Patient',
          entityId: 'patient-1',
          metadata: { changed: 'email' },
          ipAddress: '127.0.0.1',
          user: { firstName: 'Asha', lastName: 'Rao', email: 'asha@example.test' },
        },
      ],
      pagination: { total: 1, total_pages: 1 },
    });
    await pending;
    expect(store.events()[0]).toEqual(
      expect.objectContaining({
        id: 'event-1',
        userId: 'actor-1',
        actor: 'Asha Rao',
        actorEmail: 'asha@example.test',
        entityId: 'patient-1',
        metadata: { changed: 'email' },
        ipAddress: '127.0.0.1',
      }),
    );
  });

  it('loads one audit event by its real identifier for refresh-safe details', async () => {
    const pending = store.get('event/id');
    const request = http.expectOne('/api/v1/audit/event%2Fid');
    request.flush({
      data: {
        id: 'event/id',
        createdAt: '2026-10-18T10:00:00.000Z',
        userId: null,
        action: 'created',
        module: 'system',
        entityType: 'Job',
        entityId: null,
        metadata: null,
        ipAddress: null,
        user: null,
      },
    });
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ id: 'event/id', actor: 'System' }),
    );
  });
});

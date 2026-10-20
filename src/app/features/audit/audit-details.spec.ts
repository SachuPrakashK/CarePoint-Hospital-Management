import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { AuditStore } from '../../core/services/audit.store';
import { AuditDetails } from './audit-details';

describe('AuditDetails', () => {
  let fixture: ComponentFixture<AuditDetails>;
  const get = vi.fn();

  beforeEach(async () => {
    get.mockResolvedValue({
      id: 'event-1',
      createdAt: '2026-10-18T10:00:00.000Z',
      userId: 'user-1',
      actor: 'Asha Rao',
      actorEmail: 'asha@example.test',
      module: 'patients',
      action: 'record_updated',
      entityType: 'Patient',
      entityId: 'patient-1',
      metadata: { password: '[REDACTED]', field: 'email' },
      ipAddress: '127.0.0.1',
    });
    await TestBed.configureTestingModule({
      imports: [AuditDetails],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: 'event-1' }) } },
        },
        { provide: AuditStore, useValue: { get, events: signal([]) } },
        { provide: AppDateTimeService, useValue: { formatDateTime: (value: string) => value } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AuditDetails);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('loads the routed event and renders real read-only details', () => {
    expect(get).toHaveBeenCalledWith('event-1');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Asha Rao');
    expect(text).toContain('patient-1');
    expect(text).toContain('[REDACTED]');
    expect(text).not.toMatch(/\b(Edit|Delete)\b/);
  });
});

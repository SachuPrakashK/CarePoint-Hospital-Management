import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { ConfirmationService } from '../../core/services/confirmation.service';
import { TablePreferencesService } from '../../core/services/table-preferences.service';
import { ToastService } from '../../core/services/toast.service';
import { HelpSupportPage } from './help-support-page';
import { SupportApiService, SupportTicket } from './support-api.service';

describe('HelpSupportPage', () => {
  let fixture: ComponentFixture<HelpSupportPage>;
  let component: HelpSupportPage;
  const ticket: SupportTicket = {
    id: 'ticket-1',
    ticketNumber: 'SUP-2026-TEST',
    subject: 'Cannot open settings',
    module: 'Settings',
    issueType: 'ACCESS',
    description: 'Settings access is unavailable.',
    priority: 'NORMAL',
    status: 'OPEN',
    createdAt: '2026-10-17T00:00:00Z',
    updatedAt: '2026-10-17T00:00:00Z',
  };
  const api = {
    articles: vi.fn(() =>
      of({
        data: [
          {
            id: 'a1',
            category: 'Getting Started',
            title: 'Approved article',
            content: 'Approved content',
            updatedAt: '2026-10-17',
          },
        ],
        pagination: { page: 1, page_size: 100, total: 1, total_pages: 1 },
      }),
    ),
    contacts: vi.fn(() => of({ data: { email: 'support@example.test' } })),
    tickets: vi.fn(() =>
      of({ data: [ticket], pagination: { page: 1, page_size: 10, total: 1, total_pages: 1 } }),
    ),
    ticket: vi.fn(() =>
      of({
        data: {
          ...ticket,
          history: [
            {
              id: 'h1',
              status: 'OPEN',
              createdAt: ticket.createdAt,
              actor: { firstName: 'Test', lastName: 'User' },
            },
          ],
        },
      }),
    ),
    create: vi.fn(() => of({ data: ticket })),
    updateTicket: vi.fn(() => of({ data: { ...ticket, status: 'IN_PROGRESS' } })),
  };
  const toast = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    Object.values(api).forEach((mock) => mock.mockClear());
    toast.success.mockClear();
    toast.error.mockClear();
    await TestBed.configureTestingModule({
      imports: [HelpSupportPage],
      providers: [
        { provide: SupportApiService, useValue: api },
        { provide: AuthStore, useValue: { has: () => true } },
        { provide: Router, useValue: { url: '/help-support' } },
        { provide: ToastService, useValue: toast },
        { provide: AppDateTimeService, useValue: { formatDate: (value: string) => value } },
        { provide: ConfirmationService, useValue: { confirm: vi.fn(async () => true) } },
        {
          provide: TablePreferencesService,
          useValue: {
            load: (_key: string, columns: any[]) =>
              columns.filter((column) => column.visibleByDefault).map((column) => column.id),
            loadRemote: vi.fn(async (_key: string, columns: any[]) =>
              columns.filter((column) => column.visibleByDefault).map((column) => column.id),
            ),
            save: vi.fn(),
            reset: vi.fn(),
          },
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HelpSupportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('renders the support options, approved articles, contact details, and persisted tickets', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Help Center');
    expect(text).toContain('Approved article');
    expect(text).toContain('support@example.test');
    expect(text).toContain('SUP-2026-TEST');
  });

  it('searches and filters articles using the API without inventing content', async () => {
    component.queryArticles('approved');
    component.selectCategory('Getting Started');
    await fixture.whenStable();
    expect(api.articles).toHaveBeenLastCalledWith('approved', 'Getting Started');
  });

  it('keeps ticket filters independent from search and resets pagination', async () => {
    component.ticketSearch.set('settings');
    component.page.set(3);
    component.draftStatus.set('OPEN');
    component.draftPriority.set('HIGH');
    component.applyTicketFilters();
    await fixture.whenStable();
    expect(component.page()).toBe(1);
    expect(api.tickets).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'settings', status: 'OPEN', priority: 'HIGH' }),
    );
  });

  it('validates the create form and submits exactly one persisted request', async () => {
    component.openCreate();
    await component.submit();
    expect(api.create).not.toHaveBeenCalled();
    component.form.setValue({
      subject: 'Settings issue',
      module: 'Settings',
      issueType: 'ACCESS',
      description: 'Settings access is unavailable.',
      priority: 'NORMAL',
    });
    await component.submit();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'Settings issue', currentRoute: '/help-support' }),
    );
    expect(component.createOpen()).toBe(false);
    expect(toast.success).toHaveBeenCalled();
  });

  it('loads persisted ticket details and status history', async () => {
    await component.viewTicket(ticket);
    expect(api.ticket).toHaveBeenCalledWith('ticket-1');
    expect(component.selectedTicket()?.history?.[0].status).toBe('OPEN');
  });
});

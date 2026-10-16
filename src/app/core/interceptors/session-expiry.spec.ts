import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthStore } from '../auth/auth.store';
import { ToastService } from '../services/toast.service';
import { apiErrorInterceptor } from './api-error.interceptor';
import { authInterceptor } from './auth.interceptor';

const apiUser = {
  id: 'user-1',
  email: 'admin@example.test',
  first_name: 'Hospital',
  last_name: 'Admin',
  role: { id: 'role-1', code: 'HOSPITAL_ADMIN', name: 'Hospital Admin' },
  roles: [{ id: 'role-1', code: 'HOSPITAL_ADMIN', name: 'Hospital Admin' }],
  permissions: [],
};

const storedSession = {
  user: {
    id: 'user-1',
    name: 'Hospital Admin',
    email: apiUser.email,
    role: apiUser.role,
    roles: apiUser.roles,
    permissions: [],
  },
  accessToken: 'expired-access',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() - 1,
  remember: true,
};

describe('session expiry handling', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let auth: AuthStore;
  let toast: ToastService;
  const router = { navigateByUrl: vi.fn(async () => true) };

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('carepoint.auth.session', JSON.stringify(storedSession));
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiErrorInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthStore);
    toast = TestBed.inject(ToastService);
  });

  afterEach(() => {
    try {
      controller.verify();
    } finally {
      TestBed.resetTestingModule();
    }
  });

  it('coordinates concurrent 401 responses through one refresh request', async () => {
    const results: unknown[] = [];
    http.get('/api/v1/a').subscribe({ next: (value) => results.push(value) });
    http.get('/api/v1/b').subscribe({ next: (value) => results.push(value) });
    controller.expectOne('/api/v1/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/v1/b').flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = controller.expectOne('/api/v1/auth/refresh');
    expect(controller.match('/api/v1/auth/refresh')).toHaveLength(0);
    refresh.flush({
      data: {
        access_token: 'new-access',
        refresh_token: 'new-refresh',
        expires_in: 900,
        user: apiUser,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 0));

    const retries = controller.match((request) => ['/api/v1/a', '/api/v1/b'].includes(request.url));
    expect(retries).toHaveLength(2);
    retries.forEach((request) => {
      expect(request.request.headers.get('Authorization')).toBe('Bearer new-access');
      request.flush({ ok: true });
    });
    expect(results).toHaveLength(2);
    expect(toast.toasts()).toHaveLength(0);
  });

  it('clears and redirects once when the shared refresh fails', async () => {
    const failures: unknown[] = [];
    http.get('/api/v1/a').subscribe({ error: (error) => failures.push(error) });
    http.get('/api/v1/b').subscribe({ error: (error) => failures.push(error) });
    controller.expectOne('/api/v1/a').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne('/api/v1/b').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller
      .expectOne('/api/v1/auth/refresh')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(failures).toHaveLength(2);
    expect(auth.authenticated()).toBe(false);
    expect(router.navigateByUrl).toHaveBeenCalledTimes(1);
    expect(toast.toasts().filter((item) => item.kind === 'error')).toHaveLength(1);
    expect(toast.toasts()[0].message).toContain('session has expired');
  });

  it('does not treat a 403 response as session expiry', () => {
    http.get('/api/v1/admin-only').subscribe({ error: () => undefined });
    controller
      .expectOne('/api/v1/admin-only')
      .flush({}, { status: 403, statusText: 'Forbidden' });
    expect(auth.authenticated()).toBe(true);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
    expect(toast.toasts()[0].message).toContain('permission');
  });

  it('keeps invalid sign-in credentials local to the sign-in flow', async () => {
    auth.clear();
    const login = auth.login({ email: 'wrong@example.test', password: 'wrong', remember: false });
    controller
      .expectOne('/api/v1/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(await login).toBe(false);
    expect(auth.error()).toContain('incorrect');
    expect(toast.toasts()).toHaveLength(0);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});

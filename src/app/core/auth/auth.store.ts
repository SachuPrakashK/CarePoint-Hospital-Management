import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ToastService } from '../services/toast.service';
import { ApplicationSettingsService } from '../services/application-settings.service';
import { LanguageService } from '../i18n/language.service';
import {
  AuthSession,
  LoginRequest,
  Permission,
  RoleCode,
  SessionUser,
  UserRole,
} from '../models/auth.models';

type ApiUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: UserRole;
  roles: UserRole[];
  permissions: Permission[];
};
type LoginResponse = {
  data: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    user: ApiUser;
  };
};
type RefreshResponse = LoginResponse;
type MeResponse = { data: ApiUser };

const localSessionKey = 'carepoint.auth.session';
const tabSessionKey = 'carepoint.auth.tab-session';

const mapUser = (user: ApiUser): SessionUser => ({
  id: user.id,
  name: `${user.first_name} ${user.last_name}`.trim(),
  email: user.email,
  phone: user.phone ?? undefined,
  role: user.role,
  roles: user.roles,
  permissions: user.permissions,
});

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private http = inject(HttpClient);
  private router = inject(Router);
  private toast = inject(ToastService);
  private applicationSettings = inject(ApplicationSettingsService);
  private language = inject(LanguageService);
  private sessionState = signal<AuthSession | null>(this.readStoredSession());
  private refreshFlight?: Promise<boolean>;
  private sessionExpiryFlight?: Promise<void>;

  readonly session = this.sessionState.asReadonly();
  readonly user = computed(() => this.sessionState()?.user ?? null);
  readonly authenticated = computed(() => !!this.sessionState());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async initialize() {
    if (!this.sessionState()) return;
    if (!(await this.refresh())) {
      await this.handleSessionExpiry();
      return;
    }
    try {
      const response = await firstValueFrom(this.http.get<MeResponse>('/api/v1/auth/me'));
      this.updateSession((session) => ({ ...session, user: mapUser(response.data) }));
      await this.applicationSettings.load();
      await this.language.load();
    } catch {
      this.clear();
    }
  }

  async login(request: LoginRequest) {
    if (this.loading()) return false;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(
          '/api/v1/auth/login',
          { email: request.email, password: request.password },
          { headers: { 'X-Handle-Error-Locally': 'true' } },
        ),
      );
      this.setSession({
        user: mapUser(response.data.user),
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: Date.now() + response.data.expires_in * 1000,
        remember: request.remember,
      });
      this.toast.resetSessionExpiry();
      await this.applicationSettings.load();
      await this.language.load();
      this.sessionExpiryFlight = undefined;
      return true;
    } catch (error: unknown) {
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? Number((error as { status?: number }).status)
          : 0;
      this.error.set(
        status === 401
          ? 'Email or password is incorrect.'
          : status === 0
            ? 'The authentication service is unreachable. Please try again.'
            : 'Sign in is temporarily unavailable. Please try again shortly.',
      );
      return false;
    } finally {
      this.loading.set(false);
    }
  }

  async refresh() {
    if (this.refreshFlight) return this.refreshFlight;
    const session = this.sessionState();
    if (!session) return false;
    this.refreshFlight = (async () => {
      try {
        const response = await firstValueFrom(
          this.http.post<RefreshResponse>(
            '/api/v1/auth/refresh',
            { refresh_token: session.refreshToken },
            { headers: { 'X-Skip-Auth-Refresh': 'true', 'X-Auth-Refresh': 'true' } },
          ),
        );
        this.setSession({
          ...session,
          user: mapUser(response.data.user),
          accessToken: response.data.access_token,
          refreshToken: response.data.refresh_token,
          expiresAt: Date.now() + response.data.expires_in * 1000,
        });
        return true;
      } catch {
        return false;
      } finally {
        this.refreshFlight = undefined;
      }
    })();
    return this.refreshFlight;
  }

  async logout() {
    const token = this.sessionState()?.accessToken;
    try {
      if (token) await firstValueFrom(this.http.post('/api/v1/auth/logout', {}));
    } finally {
      this.clear();
      void this.router.navigateByUrl('/auth/login');
    }
  }

  handleSessionExpiry() {
    if (this.sessionExpiryFlight) return this.sessionExpiryFlight;
    this.sessionExpiryFlight = (async () => {
      this.toast.beginSessionExpiry('Your session has expired. Please sign in again.');
      this.clear();
      await this.router.navigateByUrl('/auth/login');
    })();
    return this.sessionExpiryFlight;
  }

  clear() {
    this.sessionState.set(null);
    this.removeStoredSessions();
  }

  has(permission: Permission) {
    const user = this.user();
    return !!user && user.permissions.includes(permission);
  }

  updateProfile(changes: Pick<SessionUser, 'name' | 'email'> & { phone?: string }) {
    this.updateSession((session) => ({ ...session, user: { ...session.user, ...changes } }));
  }

  updateAvatar(avatarUrl?: string) {
    this.updateSession((session) => ({
      ...session,
      user: { ...session.user, avatarUrl },
    }));
  }

  private updateSession(update: (session: AuthSession) => AuthSession) {
    const current = this.sessionState();
    if (current) this.setSession(update(current));
  }

  private setSession(session: AuthSession) {
    this.sessionState.set(session);
    this.removeStoredSessions();
    (session.remember ? localStorage : sessionStorage).setItem(
      session.remember ? localSessionKey : tabSessionKey,
      JSON.stringify(session),
    );
  }

  private readStoredSession(): AuthSession | null {
    try {
      const raw = localStorage.getItem(localSessionKey) ?? sessionStorage.getItem(tabSessionKey);
      if (!raw) return null;
      const session = JSON.parse(raw) as AuthSession;
      if (
        !session.accessToken ||
        !session.refreshToken ||
        !session.user?.role?.code ||
        !session.user.role.name
      ) {
        this.removeStoredSessions();
        return null;
      }
      return session;
    } catch {
      this.removeStoredSessions();
      return null;
    }
  }

  private removeStoredSessions() {
    localStorage.removeItem(localSessionKey);
    sessionStorage.removeItem(tabSessionKey);
  }
}

import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { apiErrorInterceptor } from './core/interceptors/api-error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { AuthStore } from './core/auth/auth.store';
import { AppTitleService } from './core/services/app-title.service';
import { DomLocalizationService } from './core/i18n/dom-localization.service';
import { LanguageService } from './core/i18n/language.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAppInitializer(() => void inject(AppTitleService)),
    provideAppInitializer(() => void inject(DomLocalizationService)),
    provideAppInitializer(() => inject(LanguageService).loadPublic()),
    provideAppInitializer(() => inject(AuthStore).initialize()),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([loadingInterceptor, apiErrorInterceptor, authInterceptor])),
  ],
};

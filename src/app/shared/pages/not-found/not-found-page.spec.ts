import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  let fixture: ComponentFixture<NotFoundPage>;
  const authenticated = signal(false);
  const navigateByUrl = vi.fn().mockResolvedValue(true);

  beforeEach(async () => {
    authenticated.set(false);
    navigateByUrl.mockClear();
    await TestBed.configureTestingModule({
      imports: [NotFoundPage],
      providers: [
        { provide: AuthStore, useValue: { authenticated } },
        { provide: Router, useValue: { navigateByUrl } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(NotFoundPage);
    fixture.detectChanges();
  });

  it('renders branded, responsive-safe not-found content', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('img')?.getAttribute('src')).toBe('logo-full.svg');
    expect(element.textContent).toContain('404');
    expect(element.textContent).toContain('Page Not Found');
  });

  it('sends guests to the canonical login route', () => {
    fixture.componentInstance.goPrimary();
    expect(navigateByUrl).toHaveBeenCalledWith('/auth/login');
  });

  it('sends authenticated users to the dashboard', () => {
    authenticated.set(true);
    fixture.detectChanges();
    fixture.componentInstance.goPrimary();
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});

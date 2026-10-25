import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthStore } from '../../core/auth/auth.store';
import { AppIcon } from '../../shared/components/icon/app-icon';
import { Breadcrumbs } from '../../shared/components/breadcrumbs/breadcrumbs';
import { AppNotification, NotificationStore } from '../../core/notifications/notification.store';
import { AppDateTimeService } from '../../core/services/app-date-time.service';
import { LanguageService } from '../../core/i18n/language.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import {
  NavigationGroup,
  resolveNavigation,
  SIDEBAR_BOTTOM_ITEMS,
  SIDEBAR_NAVIGATION_GROUPS,
} from '../../core/navigation/navigation.config';
@Component({
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AppIcon, Breadcrumbs, TranslatePipe],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MainLayout {
  readonly auth = inject(AuthStore);
  readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly dates = inject(AppDateTimeService);
  readonly language = inject(LanguageService);
  readonly collapsed = signal(localStorage.getItem('hms.sidebar.collapsed') === 'true');
  readonly mobileOpen = signal(false);
  readonly userMenu = signal(false);
  readonly notificationMenu = signal(false);
  readonly languageMenu = signal(false);
  readonly sidebarTooltip = signal<{ label: string; top: number } | null>(null);
  readonly navigationGroups = SIDEBAR_NAVIGATION_GROUPS;
  readonly bottomNavigation = SIDEBAR_BOTTOM_ITEMS;
  readonly currentUrl = signal(this.router.url);
  readonly activeNavigation = computed(() => resolveNavigation(this.currentUrl()));
  constructor() {
    void this.notifications.load();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => this.currentUrl.set(event.urlAfterRedirects));
  }
  groupVisible(group: NavigationGroup) {
    return group.items.some((item) => this.auth.has(item.permission as never));
  }
  toggleSidebar() {
    if (window.innerWidth <= 850) {
      this.mobileOpen.update((value) => !value);
      return;
    }
    this.collapsed.update((v) => !v);
    this.sidebarTooltip.set(null);
    localStorage.setItem('hms.sidebar.collapsed', String(this.collapsed()));
  }
  closeMobile() {
    this.mobileOpen.set(false);
  }
  toggleNotifications(event: Event) {
    event.stopPropagation();
    this.userMenu.set(false);
    this.notificationMenu.update((value) => !value);
    if (this.notificationMenu()) void this.notifications.load();
  }
  async openNotification(item: AppNotification) {
    await this.notifications.markRead(item);
    this.notificationMenu.set(false);
    const path =
      item.relatedEntityType === 'User'
        ? '/users'
        : item.relatedEntityType === 'Appointment'
          ? '/appointments'
          : '/notifications';
    await this.router.navigateByUrl(path);
  }
  timeAgo(value: string) {
    return this.dates.relativeTime(value);
  }
  t(key: string) {
    return this.language.translate(key);
  }
  showSidebarTooltip(event: Event, label: string) {
    if (!this.collapsed() || window.innerWidth <= 850) return;
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.sidebarTooltip.set({ label, top: bounds.top + bounds.height / 2 });
  }
  hideSidebarTooltip() {
    this.sidebarTooltip.set(null);
  }
  @HostListener('document:click') closeUserMenu() {
    this.userMenu.set(false);
    this.notificationMenu.set(false);
    this.languageMenu.set(false);
  }
  @HostListener('document:keydown.escape') closeOverlays() {
    this.userMenu.set(false);
    this.notificationMenu.set(false);
    this.languageMenu.set(false);
    this.mobileOpen.set(false);
    this.sidebarTooltip.set(null);
  }
}

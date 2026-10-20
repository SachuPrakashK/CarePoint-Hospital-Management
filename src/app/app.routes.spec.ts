import { routes } from './app.routes';
import { AUTH_ROUTES } from './features/auth/auth.routes';

describe('application routes', () => {
  it('supports only /auth/login for the login page', () => {
    expect(routes.some((route) => route.path === 'login')).toBe(false);
    expect(AUTH_ROUTES.some((route) => route.path === 'login')).toBe(true);
    expect(AUTH_ROUTES.some((route) => route.path === 'sign-in')).toBe(false);
    const authWildcard = AUTH_ROUTES.at(-1);
    expect(authWildcard?.path).toBe('**');
    expect(authWildcard?.redirectTo).toBeUndefined();
  });

  it('keeps the global not-found route last without a redirect', () => {
    const wildcard = routes.at(-1);
    expect(wildcard?.path).toBe('**');
    expect(wildcard?.redirectTo).toBeUndefined();
    expect(wildcard?.loadComponent).toBeTypeOf('function');
  });

  it('registers only supported administration master routes instead of a catch-all parameter', () => {
    const protectedRoot = routes.find((route) => route.path === '');
    const paths = protectedRoot?.children?.map((route) => route.path) ?? [];
    expect(paths).not.toContain(':entity');
    expect(paths).toEqual(
      expect.arrayContaining([
        'departments',
        'specializations',
        'radiology-investigations',
        'laboratory-tests',
      ]),
    );
  });
});

import { OPERATIONS_ROUTES } from './operations.routes';

describe('operations routes', () => {
  it('registers refresh-safe detail routes before the listing route', () => {
    expect(OPERATIONS_ROUTES.map((route) => route.path)).toEqual([
      'inventory/:id',
      'procurement/:id',
      'suppliers/:id',
      'ambulance/:id',
      '',
    ]);
    for (const route of OPERATIONS_ROUTES.slice(0, 4)) {
      expect(route.canActivate).toBeTruthy();
      expect(route.loadComponent).toBeTypeOf('function');
    }
  });
});

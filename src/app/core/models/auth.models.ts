export type RoleCode = 'SUPER_ADMIN' | 'HOSPITAL_ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST' | 'PATIENT';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'print' | 'export';
export type Permission = `${string}.${PermissionAction}` | `${string}.${'cancel'|'manage'|'collect'|'result'|'verify'|'order'|'report'|'transfer'|'discharge'|'notes'|'medication'|'schedule'|'dispense'|'stock'|'payment'|'refund'|'claim'|'receive'}`;
export interface SessionUser { id: string; name: string; email: string; role: RoleCode; permissions: readonly Permission[]; avatarUrl?: string; }
export interface AuthSession { user: SessionUser; accessToken: string; refreshToken: string; expiresAt: number; }
export interface LoginRequest { email: string; password: string; remember: boolean; }

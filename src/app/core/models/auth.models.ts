export type RoleCode = string;
export type PermissionAction = 'view' | 'create' | 'edit' | 'update' | 'delete' | 'print' | 'export' | 'download' | 'reset_password';
export type Permission =
  | `${string}.${PermissionAction}`
  | `${string}.${'cancel' | 'manage' | 'collect' | 'result' | 'verify' | 'order' | 'report' | 'transfer' | 'discharge' | 'notes' | 'medication' | 'schedule' | 'dispense' | 'stock' | 'payment' | 'refund' | 'claim' | 'receive'}`;
export interface UserRole {
  id: string;
  code: RoleCode;
  name: string;
}
export interface SessionUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  roles: readonly UserRole[];
  permissions: readonly Permission[];
  avatarUrl?: string;
}
export interface AuthSession {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  remember: boolean;
}
export interface LoginRequest {
  email: string;
  password: string;
  remember: boolean;
}

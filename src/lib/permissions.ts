import { UserRole } from '../types';

/**
 * Role-Based Access Control (RBAC) Definition & Utilities
 * Target: Smart Light Trap IoT Agritech Dashboard
 * Roles:
 *   - admin: Akses penuh administrasi, pengelolaan perangkat, pengguna, dan konfigurasi sistem.
 *   - operator: Pengoperasian armada, kontrol aktuator (kuras air, lampu, kamera), konfirmasi peringatan, dan validasi deteksi.
 *   - analyst: Analisis data populasi hama, grafik, perbandingan waktu/lokasi, dan ekspor laporan.
 *   - viewer: Hak akses baca-saja (read-only) untuk ringkasan dashboard dan monitoring.
 */

export type { UserRole };

export type Permission =
  | 'view:dashboard'
  | 'view:devices'
  | 'view:telemetry'
  | 'view:pests'
  | 'view:gallery'
  | 'view:energy'
  | 'view:water'
  | 'view:alerts'
  | 'view:settings'
  | 'view:architecture'
  | 'view:user_management'
  | 'export:reports'
  | 'control:devices'
  | 'manage:devices'
  | 'manage:device_settings'
  | 'manage:device_ota'
  | 'manage:devices_create_delete'
  | 'action:acknowledge_alert'
  | 'action:verify_detection'
  | 'manage:users'
  | 'manage:system_settings';

export interface RoleMetadata {
  id: UserRole;
  label: string;
  shortLabel: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ROLE_METADATA: Record<UserRole, RoleMetadata> = {
  admin: {
    id: 'admin',
    label: 'Administrator Sistem',
    shortLabel: 'Admin',
    description: 'Akses penuh ke seluruh sistem, pengelolaan pengguna & role, pengaturan perangkat, dan tindakan administratif.',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
  },
  operator: {
    id: 'operator',
    label: 'Operator Teknis Lapangan',
    shortLabel: 'Operator',
    description: 'Pengoperasian perangkap lampu, kontrol aktuator baki air/lampu, pengakuan peringatan, dan validasi deteksi AI.',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
  },
  analyst: {
    id: 'analyst',
    label: 'Analis Data & PHT',
    shortLabel: 'Analyst',
    description: 'Analisis populasi hama nokturnal, evaluasi tren PHT, perbandingan data historis, dan ekspor laporan.',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    badgeBorder: 'border-sky-300',
  },
  viewer: {
    id: 'viewer',
    label: 'Pengamat (Viewer)',
    shortLabel: 'Viewer',
    description: 'Akses pemantauan baca-saja pada ringkasan dashboard, status armada, dan grafik monitoring.',
    badgeBg: 'bg-gray-100',
    badgeText: 'text-gray-700',
    badgeBorder: 'border-gray-300',
  },
};

/**
 * Matriks Hak Akses Terpusat (Single Source of Truth untuk Frontend RBAC)
 */
export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  admin: [
    'view:dashboard',
    'view:devices',
    'view:telemetry',
    'view:pests',
    'view:gallery',
    'view:energy',
    'view:water',
    'view:alerts',
    'view:settings',
    'view:architecture',
    'view:user_management',
    'export:reports',
    'control:devices',
    'manage:devices',
    'manage:device_settings',
    'manage:device_ota',
    'manage:devices_create_delete',
    'action:acknowledge_alert',
    'action:verify_detection',
    'manage:users',
    'manage:system_settings',
  ],
  operator: [
    'view:dashboard',
    'view:devices',
    'view:telemetry',
    'view:pests',
    'view:gallery',
    'view:energy',
    'view:water',
    'view:alerts',
    'view:settings',
    'view:architecture',
    'export:reports',
    'control:devices',
    'manage:devices',
    'manage:device_settings',
    'manage:device_ota',
    'action:acknowledge_alert',
    'action:verify_detection',
    'manage:system_settings',
  ],
  analyst: [
    'view:dashboard',
    'view:devices',
    'view:telemetry',
    'view:pests',
    'view:gallery',
    'view:energy',
    'view:water',
    'view:alerts',
    'view:architecture',
    'export:reports',
  ],
  viewer: [
    'view:dashboard',
    'view:devices',
    'view:telemetry',
    'view:pests',
    'view:gallery',
    'view:energy',
    'view:water',
    'view:alerts',
  ],
};

/**
 * Pemetaan izin akses tab navigasi utama dashboard
 */
export const TAB_PERMISSIONS: Record<string, Permission> = {
  overview: 'view:dashboard',
  devices: 'view:devices',
  controls: 'view:devices',
  pests: 'view:pests',
  gallery: 'view:gallery',
  energy: 'view:energy',
  water: 'view:water',
  alerts: 'view:alerts',
  settings: 'view:settings',
  architecture: 'view:architecture',
  users: 'view:user_management',
};

/**
 * Memvalidasi apakah role pengguna memiliki hak akses tertentu (Deny by default).
 */
export function hasPermission(role: UserRole | undefined | null, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) {
    return false; // Deny by default jika role tidak ada atau invalid
  }
  return ROLE_PERMISSIONS[role].includes(permission);
}

/**
 * Memeriksa apakah role saat ini termasuk dalam daftar role yang diizinkan.
 */
export function hasRole(role: UserRole | undefined | null, allowedRoles: UserRole[]): boolean {
  if (!role) return false;
  return allowedRoles.includes(role);
}

/**
 * Memeriksa apakah role saat ini diizinkan membuka tab navigasi tertentu.
 */
export function canAccessTab(role: UserRole | undefined | null, tab: string): boolean {
  const requiredPermission = TAB_PERMISSIONS[tab];
  if (!requiredPermission) {
    return false; // Tab tidak terdaftar -> Deny by default
  }
  return hasPermission(role, requiredPermission);
}

/**
 * Helper untuk sanitasi role yang aman (Default selalu 'viewer' jika tidak valid)
 */
export function sanitizeRole(rawRole: any): UserRole {
  if (rawRole === 'admin' || rawRole === 'operator' || rawRole === 'analyst' || rawRole === 'viewer') {
    return rawRole;
  }
  return 'viewer';
}

/**
 * Helper untuk mendapatkan metadata visual badge role
 */
export function getRoleMetadata(role: UserRole | undefined | null): RoleMetadata {
  const safeRole = sanitizeRole(role);
  return ROLE_METADATA[safeRole];
}

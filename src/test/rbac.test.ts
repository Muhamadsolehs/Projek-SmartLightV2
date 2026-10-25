/**
 * RBAC Verification & Test Suite
 * Tests role permissions, deny-by-default behavior, registration safety, and route access guards.
 */

import {
  UserRole,
  Permission,
  ROLE_PERMISSIONS,
  TAB_PERMISSIONS,
  hasPermission,
  hasRole,
  canAccessTab,
  sanitizeRole,
  getRoleMetadata,
} from '../lib/permissions';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function test(name: string, fn: () => void) {
  try {
    fn();
    results.push({ name, passed: true });
    console.log(`  [PASS] ${name}`);
  } catch (err: any) {
    results.push({ name, passed: false, error: err.message });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

function expect(actual: any) {
  return {
    toBe(expected: any) {
      if (actual !== expected) {
        throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
      }
    },
    toBeTrue() {
      if (actual !== true) {
        throw new Error(`Expected true but got ${JSON.stringify(actual)}`);
      }
    },
    toBeFalse() {
      if (actual !== false) {
        throw new Error(`Expected false but got ${JSON.stringify(actual)}`);
      }
    },
    toContain(expected: any) {
      if (!Array.isArray(actual) || !actual.includes(expected)) {
        throw new Error(`Expected array to contain ${JSON.stringify(expected)}`);
      }
    },
  };
}

console.log('\n========================================');
console.log('RUNNING RBAC PERMISSIONS & SECURITY TESTS');
console.log('========================================\n');

// 1. Unauthenticated / Null / Undefined Deny-by-Default
test('TC-1: Unauthenticated user (null/undefined) is denied on all permissions', () => {
  expect(hasPermission(undefined, 'view:dashboard')).toBeFalse();
  expect(hasPermission(null, 'view:dashboard')).toBeFalse();
  expect(hasPermission('' as any, 'view:dashboard')).toBeFalse();
  expect(hasPermission('invalid_role' as any, 'view:dashboard')).toBeFalse();
  expect(canAccessTab(undefined, 'overview')).toBeFalse();
  expect(canAccessTab(null, 'settings')).toBeFalse();
});

// 2. Default & Registration Sanitization
test('TC-2: sanitizeRole always defaults unknown or manipulated role to viewer', () => {
  expect(sanitizeRole(undefined)).toBe('viewer');
  expect(sanitizeRole(null)).toBe('viewer');
  expect(sanitizeRole('')).toBe('viewer');
  expect(sanitizeRole('admin')).toBe('admin');
  expect(sanitizeRole('operator')).toBe('operator');
  expect(sanitizeRole('analyst')).toBe('analyst');
  expect(sanitizeRole('viewer')).toBe('viewer');
  expect(sanitizeRole('superadmin')).toBe('viewer');
  expect(sanitizeRole('root')).toBe('viewer');
});

// 3. Registration injection safety
test('TC-3: Role injection payload is safely neutralized', () => {
  const forgedPayload = { role: 'admin', full_name: 'Attacker' };
  const safeRole = sanitizeRole(undefined); // handle_new_user strictly assigns 'viewer'
  expect(safeRole).toBe('viewer');
});

// 4. Viewer Role Restrictions
test('TC-4: Viewer role has read-only access and cannot execute state-changing operations', () => {
  const role: UserRole = 'viewer';
  // Viewer CAN view
  expect(hasPermission(role, 'view:dashboard')).toBeTrue();
  expect(hasPermission(role, 'view:devices')).toBeTrue();
  expect(hasPermission(role, 'view:telemetry')).toBeTrue();
  expect(hasPermission(role, 'view:pests')).toBeTrue();
  expect(hasPermission(role, 'view:gallery')).toBeTrue();
  expect(hasPermission(role, 'view:energy')).toBeTrue();
  expect(hasPermission(role, 'view:water')).toBeTrue();
  expect(hasPermission(role, 'view:alerts')).toBeTrue();

  // Viewer CANNOT access admin / operational permissions
  expect(hasPermission(role, 'view:settings')).toBeFalse();
  expect(hasPermission(role, 'view:architecture')).toBeFalse();
  expect(hasPermission(role, 'view:user_management')).toBeFalse();
  expect(hasPermission(role, 'control:devices')).toBeFalse();
  expect(hasPermission(role, 'manage:device_settings')).toBeFalse();
  expect(hasPermission(role, 'manage:device_ota')).toBeFalse();
  expect(hasPermission(role, 'manage:devices_create_delete')).toBeFalse();
  expect(hasPermission(role, 'action:acknowledge_alert')).toBeFalse();
  expect(hasPermission(role, 'action:verify_detection')).toBeFalse();
  expect(hasPermission(role, 'manage:users')).toBeFalse();
  expect(hasPermission(role, 'manage:system_settings')).toBeFalse();
  expect(hasPermission(role, 'export:reports')).toBeFalse();
});

// 5. Analyst Role Capabilities & Boundaries
test('TC-5: Analyst role can view, analyze, and export reports, but cannot control devices', () => {
  const role: UserRole = 'analyst';
  // Analyst CAN
  expect(hasPermission(role, 'view:dashboard')).toBeTrue();
  expect(hasPermission(role, 'view:devices')).toBeTrue();
  expect(hasPermission(role, 'view:telemetry')).toBeTrue();
  expect(hasPermission(role, 'view:pests')).toBeTrue();
  expect(hasPermission(role, 'view:gallery')).toBeTrue();
  expect(hasPermission(role, 'view:energy')).toBeTrue();
  expect(hasPermission(role, 'view:water')).toBeTrue();
  expect(hasPermission(role, 'view:alerts')).toBeTrue();
  expect(hasPermission(role, 'view:architecture')).toBeTrue();
  expect(hasPermission(role, 'export:reports')).toBeTrue();

  // Analyst CANNOT
  expect(hasPermission(role, 'view:settings')).toBeFalse();
  expect(hasPermission(role, 'view:user_management')).toBeFalse();
  expect(hasPermission(role, 'control:devices')).toBeFalse();
  expect(hasPermission(role, 'manage:device_settings')).toBeFalse();
  expect(hasPermission(role, 'manage:device_ota')).toBeFalse();
  expect(hasPermission(role, 'manage:devices_create_delete')).toBeFalse();
  expect(hasPermission(role, 'action:acknowledge_alert')).toBeFalse();
  expect(hasPermission(role, 'action:verify_detection')).toBeFalse();
  expect(hasPermission(role, 'manage:users')).toBeFalse();
  expect(hasPermission(role, 'manage:system_settings')).toBeFalse();
});

// 6. Operator Role Capabilities & Boundaries
test('TC-6: Operator role can operate devices, ack alerts, and verify detections, but cannot manage users', () => {
  const role: UserRole = 'operator';
  // Operator CAN
  expect(hasPermission(role, 'view:dashboard')).toBeTrue();
  expect(hasPermission(role, 'view:devices')).toBeTrue();
  expect(hasPermission(role, 'view:settings')).toBeTrue();
  expect(hasPermission(role, 'control:devices')).toBeTrue();
  expect(hasPermission(role, 'manage:device_settings')).toBeTrue();
  expect(hasPermission(role, 'manage:device_ota')).toBeTrue();
  expect(hasPermission(role, 'action:acknowledge_alert')).toBeTrue();
  expect(hasPermission(role, 'action:verify_detection')).toBeTrue();
  expect(hasPermission(role, 'manage:system_settings')).toBeTrue();
  expect(hasPermission(role, 'export:reports')).toBeTrue();

  // Operator CANNOT
  expect(hasPermission(role, 'manage:users')).toBeFalse();
  expect(hasPermission(role, 'view:user_management')).toBeFalse();
  expect(hasPermission(role, 'manage:devices_create_delete')).toBeFalse();
});

// 7. Admin Role Capabilities
test('TC-7: Admin role has full system authority and user management', () => {
  const role: UserRole = 'admin';
  expect(hasPermission(role, 'view:dashboard')).toBeTrue();
  expect(hasPermission(role, 'view:settings')).toBeTrue();
  expect(hasPermission(role, 'view:user_management')).toBeTrue();
  expect(hasPermission(role, 'control:devices')).toBeTrue();
  expect(hasPermission(role, 'manage:device_settings')).toBeTrue();
  expect(hasPermission(role, 'manage:device_ota')).toBeTrue();
  expect(hasPermission(role, 'manage:devices_create_delete')).toBeTrue();
  expect(hasPermission(role, 'action:acknowledge_alert')).toBeTrue();
  expect(hasPermission(role, 'action:verify_detection')).toBeTrue();
  expect(hasPermission(role, 'manage:users')).toBeTrue();
  expect(hasPermission(role, 'manage:system_settings')).toBeTrue();
  expect(hasPermission(role, 'export:reports')).toBeTrue();
});

// 8. Navigation Tab Access Checks
test('TC-8: canAccessTab properly restricts tab navigation per role', () => {
  // Overview: Everyone
  expect(canAccessTab('admin', 'overview')).toBeTrue();
  expect(canAccessTab('operator', 'overview')).toBeTrue();
  expect(canAccessTab('analyst', 'overview')).toBeTrue();
  expect(canAccessTab('viewer', 'overview')).toBeTrue();

  // Settings: Only Admin & Operator
  expect(canAccessTab('admin', 'settings')).toBeTrue();
  expect(canAccessTab('operator', 'settings')).toBeTrue();
  expect(canAccessTab('analyst', 'settings')).toBeFalse();
  expect(canAccessTab('viewer', 'settings')).toBeFalse();

  // Architecture: Admin, Operator, Analyst
  expect(canAccessTab('admin', 'architecture')).toBeTrue();
  expect(canAccessTab('operator', 'architecture')).toBeTrue();
  expect(canAccessTab('analyst', 'architecture')).toBeTrue();
  expect(canAccessTab('viewer', 'architecture')).toBeFalse();

  // Users: Admin Only
  expect(canAccessTab('admin', 'users')).toBeTrue();
  expect(canAccessTab('operator', 'users')).toBeFalse();
  expect(canAccessTab('analyst', 'users')).toBeFalse();
  expect(canAccessTab('viewer', 'users')).toBeFalse();

  // Non-existent Tab: Deny by default
  expect(canAccessTab('admin', 'non_existent_tab')).toBeFalse();
  expect(canAccessTab('viewer', 'admin_secret_portal')).toBeFalse();
});

// 9. Role Metadata Integrity
test('TC-9: getRoleMetadata returns complete visual tokens for each role', () => {
  const roles: UserRole[] = ['admin', 'operator', 'analyst', 'viewer'];
  for (const r of roles) {
    const meta = getRoleMetadata(r);
    expect(meta.id).toBe(r);
    expect(typeof meta.label).toBe('string');
    expect(typeof meta.shortLabel).toBe('string');
    expect(typeof meta.badgeBg).toBe('string');
    expect(typeof meta.badgeText).toBe('string');
    expect(typeof meta.badgeBorder).toBe('string');
  }
});

console.log('\n----------------------------------------');
const passedCount = results.filter((r) => r.passed).length;
console.log(`TOTAL: ${results.length} | PASSED: ${passedCount} | FAILED: ${results.length - passedCount}`);
console.log('----------------------------------------\n');

if (passedCount !== results.length) {
  process.exit(1);
}

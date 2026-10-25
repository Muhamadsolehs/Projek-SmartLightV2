import React from 'react';
import { useDevice } from '../../context/DeviceContext';
import { Permission, UserRole, hasPermission, hasRole } from '../../lib/permissions';

interface PermissionGuardProps {
  permission?: Permission;
  allowedRoles?: UserRole[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * PermissionGuard: Conditionally renders children only if the current authenticated
 * user holds the required permission or one of the allowed roles.
 * Uses Deny-by-default logic.
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  allowedRoles,
  fallback = null,
  children,
}) => {
  const { currentUser } = useDevice();
  const currentRole = currentUser?.role;

  if (permission && !hasPermission(currentRole, permission)) {
    return <>{fallback}</>;
  }

  if (allowedRoles && !hasRole(currentRole, allowedRoles)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

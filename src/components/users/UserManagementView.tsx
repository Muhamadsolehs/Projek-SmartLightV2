import React, { useState, useEffect } from 'react';
import {
  Users,
  Shield,
  ShieldAlert,
  ShieldCheck,
  RotateCw,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  UserCheck,
  Lock,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { userService, UserManagementRecord } from '../../services/userService';
import { UserRole, hasPermission, getRoleMetadata } from '../../lib/permissions';
import { AccessDenied } from '../common/AccessDenied';

export const UserManagementView: React.FC = () => {
  const { currentUser } = useDevice();
  const [users, setUsers] = useState<UserManagementRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingUserId, setIsUpdatingUserId] = useState<string | null>(null);

  // RBAC Access Check: Only Admins can access this view
  const canManageUsers = hasPermission(currentUser?.role, 'manage:users');

  const fetchUsers = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const fetched = await userService.getUsers();
      setUsers(fetched);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengambil daftar pengguna dari Supabase.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    }
  }, [canManageUsers]);

  if (!canManageUsers) {
    return (
      <AccessDenied
        requiredPermissionDescription="Halaman Manajemen Pengguna dan Pengaturan Role dibatasi khusus untuk Administrator Sistem."
      />
    );
  }

  const handleRoleChange = async (targetUser: UserManagementRecord, newRole: UserRole) => {
    if (targetUser.role === newRole) return;

    if (
      targetUser.id === currentUser?.id &&
      targetUser.role === 'admin' &&
      newRole !== 'admin'
    ) {
      const confirmSelf = window.confirm(
        'PERINGATAN KEAMANAN: Anda akan menurunkan hak akses akun Admin Anda sendiri. Anda akan kehilangan akses ke halaman manajemen ini jika tidak ada admin lain. Apakah Anda yakin ingin melanjutkan?'
      );
      if (!confirmSelf) return;
    }

    setIsUpdatingUserId(targetUser.id);
    setErrorMsg(null);
    setSuccessMsg(null);

    const result = await userService.updateUserRole(targetUser.id, newRole);
    setIsUpdatingUserId(null);

    if (result.success) {
      setSuccessMsg(`Hak akses ${targetUser.name} berhasil diubah menjadi ${newRole.toUpperCase()}.`);
      setUsers((prev) =>
        prev.map((u) => (u.id === targetUser.id ? { ...u, role: newRole } : u))
      );
      setTimeout(() => setSuccessMsg(null), 4000);
    } else {
      setErrorMsg(result.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.assignedRegion.toLowerCase().includes(q)
    );
  });

  const adminCount = users.filter((u) => u.role === 'admin').length;
  const operatorCount = users.filter((u) => u.role === 'operator').length;
  const analystCount = users.filter((u) => u.role === 'analyst').length;
  const viewerCount = users.filter((u) => u.role === 'viewer').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Manajemen Pengguna &amp; RBAC
          </h1>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#90A955]/40 bg-white text-xs font-semibold text-[#132A13] hover:bg-[#ECF39E]/20 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCw className={`h-3 w-3 text-[#31572C] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyinkronkan...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Security Context Banner */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-2.5 text-xs text-[#132A13] space-y-1 shadow-2xs">
        <div className="flex items-center gap-1.5 font-bold text-[#1B4332] text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-[#2D6A4F]" />
          <span>Kebijakan Keamanan Supabase RLS Aktif</span>
        </div>
        <p className="text-[#4A5568] leading-relaxed text-[11px]">
          Akun baru otomatis berstatus <strong>Viewer</strong>. Perubahan role hanya dapat diproses oleh Administrator aktif melalui trigger database.
        </p>
      </div>

      {/* Role Counts KPI */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="p-2.5 rounded-lg border border-purple-200 bg-purple-50/50">
          <div className="text-[10px] font-bold text-purple-700 uppercase">Administrator</div>
          <div className="text-lg font-bold font-mono text-purple-900 mt-0.5">{adminCount}</div>
          <div className="text-[9px] text-purple-600">Akses penuh</div>
        </div>

        <div className="p-2.5 rounded-lg border border-emerald-200 bg-emerald-50/50">
          <div className="text-[10px] font-bold text-emerald-700 uppercase">Operator Lapangan</div>
          <div className="text-lg font-bold font-mono text-emerald-900 mt-0.5">{operatorCount}</div>
          <div className="text-[9px] text-emerald-600">Kendali aktuator</div>
        </div>

        <div className="p-2.5 rounded-lg border border-sky-200 bg-sky-50/50">
          <div className="text-[10px] font-bold text-sky-700 uppercase">Analis PHT</div>
          <div className="text-lg font-bold font-mono text-sky-900 mt-0.5">{analystCount}</div>
          <div className="text-[9px] text-sky-600">Analisis &amp; ekspor</div>
        </div>

        <div className="p-2.5 rounded-lg border border-gray-200 bg-gray-50/50">
          <div className="text-[10px] font-bold text-gray-700 uppercase">Viewer</div>
          <div className="text-lg font-bold font-mono text-gray-900 mt-0.5">{viewerCount}</div>
          <div className="text-[9px] text-gray-600">Akses baca-saja</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-2.5 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-lg text-xs flex items-center gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-2.5 bg-red-50 text-red-900 border border-red-200 rounded-lg text-xs flex items-center gap-2">
          <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Table Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-2xs overflow-hidden space-y-0">
        {/* Search Bar */}
        <div className="p-2.5 border-b border-[#E2E8F0] bg-[#F8FAF9] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-[#90A955]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari pengguna, email, role..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-white py-1 pl-8 pr-2.5 text-xs text-[#132A13] focus:border-[#2D6A4F] focus:outline-hidden"
            />
          </div>
          <span className="text-[11px] text-slate-500 font-mono">
            {filteredUsers.length} Pengguna
          </span>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAF9] text-[#718096] uppercase text-[9px] font-bold">
              <tr>
                <th className="py-2 px-3">Pengguna</th>
                <th className="py-2 px-3">Wilayah Tugas</th>
                <th className="py-2 px-3">Role Saat Ini</th>
                <th className="py-2 px-3 text-center">Ubah Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {filteredUsers.map((user) => {
                const meta = getRoleMetadata(user.role);
                const isUpdating = isUpdatingUserId === user.id;
                const isCurrentUser = user.id === currentUser?.id;

                return (
                  <tr key={user.id} className="hover:bg-[#F6F9F5] transition-colors">
                    {/* User Info */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-lg bg-[#31572C] text-[#ECF39E] font-bold text-[10px] flex items-center justify-center shrink-0">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#132A13] text-xs flex items-center gap-1.5">
                            <span>{user.name}</span>
                            {isCurrentUser && (
                              <span className="text-[9px] bg-blue-100 text-blue-800 font-semibold px-1 py-0.2 rounded">
                                Akun Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-[#718096]">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Region */}
                    <td className="py-2 px-3 text-[#4A5568] text-[11px]">
                      {user.assignedRegion}
                    </td>

                    {/* Current Role */}
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                        <Shield className="h-2.5 w-2.5" />
                        <span>{meta.label}</span>
                      </span>
                    </td>

                    {/* Role Dropdown / Selector */}
                    <td className="py-2 px-3 text-center">
                      <div className="inline-flex items-center gap-1.5">
                        <select
                          value={user.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2 py-0.5 text-xs font-semibold text-[#132A13] focus:border-[#2D6A4F] focus:outline-hidden shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="analyst">Analyst</option>
                          <option value="operator">Operator</option>
                          <option value="admin">Admin</option>
                        </select>
                        {isUpdating && (
                          <div className="h-3 w-3 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-xs text-[#718096]">
                    Tidak ada pengguna yang sesuai dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

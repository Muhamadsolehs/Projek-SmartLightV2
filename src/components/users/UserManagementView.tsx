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
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Manajemen Pengguna & RBAC</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Manajemen Pengguna & Otorisasi RBAC
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Pengelolaan hak akses pengguna, penugasan role (Admin, Operator, Analyst, Viewer), dan proteksi eskalasi hak akses sistem.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={fetchUsers}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#90A955]/40 bg-white text-xs font-semibold text-[#132A13] hover:bg-[#ECF39E]/20 transition-all cursor-pointer shadow-2xs"
          >
            <RotateCw className={`h-3.5 w-3.5 text-[#31572C] ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
          </button>
        </div>
      </div>

      {/* Security Context Banner */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-4 text-xs text-[#132A13] space-y-1.5 shadow-2xs">
        <div className="flex items-center gap-2 font-bold text-[#1B4332]">
          <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
          <span>Kebijakan Keamanan PostgreSQL & Supabase RLS Terpasang</span>
        </div>
        <p className="text-[#4A5568] leading-relaxed text-[11px]">
          Pendaftaran baru secara default selalu mendapatkan role <strong>Viewer</strong>. Perubahan role hanya dapat dieksekusi oleh Administrator aktif melalui trigger database <code className="font-mono bg-white px-1 py-0.5 rounded border border-[#CBD5E1]">prevent_role_self_escalation()</code>. Pengguna biasa tidak dapat menaikkan hak aksesnya sendiri melalui browser atau form registrasi.
        </p>
      </div>

      {/* Role Counts KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/50">
          <div className="text-[11px] font-bold text-purple-700 uppercase">Administrator</div>
          <div className="text-2xl font-bold font-mono text-purple-900 mt-1">{adminCount}</div>
          <div className="text-[10px] text-purple-600 mt-0.5">Akses penuh sistem</div>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50">
          <div className="text-[11px] font-bold text-emerald-700 uppercase">Operator Lapangan</div>
          <div className="text-2xl font-bold font-mono text-emerald-900 mt-1">{operatorCount}</div>
          <div className="text-[10px] text-emerald-600 mt-0.5">Kontrol & interlock armada</div>
        </div>

        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/50">
          <div className="text-[11px] font-bold text-sky-700 uppercase">Analis Data PHT</div>
          <div className="text-2xl font-bold font-mono text-sky-900 mt-1">{analystCount}</div>
          <div className="text-[10px] text-sky-600 mt-0.5">Analisis & ekspor laporan</div>
        </div>

        <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
          <div className="text-[11px] font-bold text-gray-700 uppercase">Viewer (Pengamat)</div>
          <div className="text-2xl font-bold font-mono text-gray-900 mt-1">{viewerCount}</div>
          <div className="text-[10px] text-gray-600 mt-0.5">Akses pemantauan baca-saja</div>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-3 bg-[#EAF4EE] text-[#1B4332] border border-[#A7D7C5] rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-red-50 text-red-900 border border-red-200 rounded-xl text-xs flex items-center gap-2 animate-fadeIn">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Search & Table Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-[#E2E8F0] bg-[#F8FAF9] flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#90A955]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, email, role, atau wilayah..."
              className="w-full rounded-lg border border-[#CBD5E1] bg-white py-1.5 pl-9 pr-3 text-xs text-[#132A13] focus:border-[#2D6A4F] focus:outline-hidden"
            />
          </div>
          <span className="text-xs text-[#718096]">
            Total Pengguna: <strong className="text-[#132A13]">{filteredUsers.length}</strong>
          </span>
        </div>

        {/* User Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#E2E8F0] bg-[#F8FAF9] text-[#718096] uppercase text-[10px] font-bold">
              <tr>
                <th className="py-3 px-4">Pengguna</th>
                <th className="py-3 px-4">Wilayah Tugas</th>
                <th className="py-3 px-4">Role Saat Ini</th>
                <th className="py-3 px-4 text-center">Ubah Otorisasi Role</th>
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
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#31572C] text-[#ECF39E] font-bold text-xs flex items-center justify-center shrink-0">
                          {user.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-bold text-[#132A13] flex items-center gap-1.5">
                            <span>{user.name}</span>
                            {isCurrentUser && (
                              <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-1.5 py-0.2 rounded">
                                Akun Anda
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[#718096]">{user.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Region */}
                    <td className="py-3 px-4 text-[#4A5568]">
                      {user.assignedRegion}
                    </td>

                    {/* Current Role */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
                        <Shield className="h-3 w-3" />
                        <span>{meta.label}</span>
                      </span>
                    </td>

                    {/* Role Dropdown / Selector */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <select
                          value={user.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          className="rounded-lg border border-[#CBD5E1] bg-white px-2.5 py-1 text-xs font-semibold text-[#132A13] focus:border-[#2D6A4F] focus:outline-hidden shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <option value="viewer">Viewer (Pengamat)</option>
                          <option value="analyst">Analyst (Analis PHT)</option>
                          <option value="operator">Operator (Teknis)</option>
                          <option value="admin">Admin (Administrator)</option>
                        </select>
                        {isUpdating && (
                          <div className="h-3.5 w-3.5 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin shrink-0" />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-xs text-[#718096]">
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

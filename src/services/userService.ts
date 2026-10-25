import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { sanitizeRole } from '../lib/permissions';

export interface UserManagementRecord {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  assignedRegion: string;
  createdAt?: string;
  updatedAt?: string;
}

export const userService = {
  /**
   * Mengambil seluruh daftar profil pengguna (Khusus Admin, terlindungi RLS)
   */
  async getUsers(): Promise<UserManagementRecord[]> {
    if (!isSupabaseConfigured) {
      return [
        {
          id: 'usr_01',
          name: 'Dr. Hendra',
          email: 'hendra@smarttrap.id',
          role: 'admin',
          assignedRegion: 'Jawa Barat (Pusat)',
          createdAt: '2026-09-01T08:00:00Z',
        },
        {
          id: 'usr_02',
          name: 'Siti Aminah',
          email: 'siti@smarttrap.id',
          role: 'operator',
          assignedRegion: 'Pagaden & Binong',
          createdAt: '2026-09-10T09:30:00Z',
        },
        {
          id: 'usr_03',
          name: 'Dewi Lestari',
          email: 'dewi@smarttrap.id',
          role: 'analyst',
          assignedRegion: 'Laboratorium PHT Subang',
          createdAt: '2026-09-15T11:00:00Z',
        },
        {
          id: 'usr_04',
          name: 'Pak Rahmat',
          email: 'rahmat@smarttrap.id',
          role: 'viewer',
          assignedRegion: 'Subang, Jawa Barat',
          createdAt: '2026-09-20T14:15:00Z',
        },
      ];
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      if (!data) return [];

      return data.map((p: any) => ({
        id: p.id,
        name: p.full_name,
        email: p.email || 'Email belum diisi',
        role: sanitizeRole(p.role),
        assignedRegion: p.assigned_region || 'Subang, Jawa Barat',
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }));
    } catch (err: any) {
      console.error('Error fetching users:', err);
      throw err;
    }
  },

  /**
   * Mengubah role pengguna (Khusus Admin, terlindungi RLS, trigger, dan RPC)
   */
  async updateUserRole(
    targetUserId: string,
    newRole: UserRole
  ): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured) {
      return {
        success: true,
        message: `Role pengguna berhasil diperbarui menjadi '${newRole}' (Simulasi Demo).`,
      };
    }

    try {
      // Coba panggil RPC aman admin_set_user_role terlebih dahulu jika fungsi SQL terpasang
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_set_user_role', {
        target_user_id: targetUserId,
        new_role: newRole,
      });

      if (!rpcError && rpcData?.success) {
        return {
          success: true,
          message: `Role berhasil diperbarui menjadi '${newRole}' via RPC terverifikasi.`,
        };
      }

      // Fallback: Direct table update yang dilindungi oleh RLS policy "profiles_admin_update" dan trigger "trg_check_role_change"
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (updateError) {
        return {
          success: false,
          message: updateError.message || 'Gagal mengubah role pengguna di Supabase.',
        };
      }

      return {
        success: true,
        message: `Role berhasil diperbarui menjadi '${newRole}'.`,
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Terjadi kesalahan sistem saat memperbarui role.',
      };
    }
  },
};

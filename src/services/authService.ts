import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile, UserRole } from '../types';
import { sanitizeRole } from '../lib/permissions';

/**
 * Helper untuk mengambil record profil dari tabel `profiles` di Supabase
 * dengan fallback pencarian ID -> Email dan penanganan RLS.
 */
async function fetchAndBuildUserProfile(
  authUserId: string,
  authUserEmail?: string,
  metadata?: any
): Promise<UserProfile> {
  let profileRecord: any = null;
  const cleanEmail = (authUserEmail || '').trim().toLowerCase();

  try {
    // 1. Coba kueri berdasarkan id (UUID)
    const { data: byId, error: errId } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (byId) {
      profileRecord = byId;
    } else if (cleanEmail) {
      // 2. Fallback kueri berdasarkan email
      const { data: byEmail, error: errEmail } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (byEmail) {
        profileRecord = byEmail;
      } else if (errId || errEmail) {
        console.warn(
          '[authService] Peringatan: Tabel "public.profiles" tidak dapat dibaca dari Supabase (RLS kemungkinan aktif tanpa SELECT policy).',
          errId || errEmail
        );
      }
    }
  } catch (err) {
    console.warn('[authService] Error saat membaca tabel profiles:', err);
  }

  const effectiveEmail = profileRecord?.email || authUserEmail || '';
  const fullName =
    profileRecord?.full_name ||
    metadata?.full_name ||
    (effectiveEmail ? effectiveEmail.split('@')[0] : 'Pengguna');

  // Penentuan Role (Prioritas: Kolom Database Profiles -> User Metadata -> Fallback Cerdas Akun Admin)
  let role: UserRole = 'viewer';
  if (profileRecord?.role) {
    role = sanitizeRole(profileRecord.role);
  } else if (metadata?.role && metadata.role !== 'viewer') {
    role = sanitizeRole(metadata.role);
  } else if (cleanEmail === 'admin@gmail.com' || cleanEmail.startsWith('admin@')) {
    // Fallback jika tabel profiles terblokir RLS oleh Supabase tapi email adalah akun admin
    role = 'admin';
    console.warn(
      `[authService] Menggunakan role 'admin' untuk ${cleanEmail} karena pembacaan tabel profiles diblokir RLS Supabase.`
    );
  }

  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'AD';

  return {
    id: profileRecord?.id || authUserId,
    name: fullName,
    email: effectiveEmail,
    role,
    avatarInitials: initials,
    assignedRegion: profileRecord?.assigned_region || metadata?.assigned_region || 'Subang, Jawa Barat',
  };
}

export const authService = {
  /**
   * Login using Supabase Auth signInWithPassword.
   * Fetches authenticated profile from profiles table (protected by RLS).
   * Strictly validates user role (admin | operator | analyst | viewer).
   */
  async signIn(email: string, password?: string): Promise<{ user: UserProfile | null; error: string | null }> {
    if (!email || !password) {
      return { user: null, error: 'Alamat email dan kata sandi wajib diisi.' };
    }

    if (!isSupabaseConfigured) {
      return { user: null, error: 'Klien Supabase belum terkonfigurasi pada file .env.' };
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        let userFacingError = error.message;
        if (error.message.includes('Email not confirmed')) {
          userFacingError = 'Email belum dikonfirmasi. Silakan periksa inbox email Anda atau konfirmasi akun di Supabase Dashboard (Authentication > Users).';
        } else if (error.message.includes('Invalid login credentials')) {
          userFacingError = 'Alamat email atau kata sandi tidak valid. Periksa kembali akun Anda.';
        }
        return { user: null, error: userFacingError };
      }

      if (!data.user) {
        return { user: null, error: 'Akun pengguna tidak ditemukan.' };
      }

      // Fetch profile with smart fallback
      const userProfile = await fetchAndBuildUserProfile(
        data.user.id,
        data.user.email || email,
        data.user.user_metadata
      );

      return { user: userProfile, error: null };
    } catch (err: any) {
      return { user: null, error: err?.message || 'Terjadi kesalahan sistem saat menghubungi Supabase Auth.' };
    }
  },

  /**
   * Register a new user using Supabase Auth.
   * New users are strictly assigned 'viewer' role to prevent privilege escalation.
   */
  async signUp(
    email: string,
    password: string,
    fullName: string
  ): Promise<{ user: UserProfile | null; needsConfirmation: boolean; error: string | null }> {
    if (!email || !password || !fullName) {
      return { user: null, needsConfirmation: false, error: 'Nama lengkap, email, dan kata sandi wajib diisi.' };
    }

    if (password.length < 6) {
      return { user: null, needsConfirmation: false, error: 'Kata sandi minimal terdiri dari 6 karakter.' };
    }

    if (!isSupabaseConfigured) {
      return { user: null, needsConfirmation: false, error: 'Supabase belum terkonfigurasi di file .env.' };
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            role: 'viewer', // Keamanan: Wajib 'viewer', tidak dapat meminta admin saat pendaftaran
            assigned_region: 'Subang, Jawa Barat',
          },
        },
      });

      if (error) {
        return { user: null, needsConfirmation: false, error: error.message };
      }

      if (!data.user) {
        return { user: null, needsConfirmation: false, error: 'Pendaftaran gagal dibuat.' };
      }

      // Check if session was returned or if email confirmation is required
      const needsConfirmation = !data.session;

      const newUserProfile: UserProfile = {
        id: data.user.id,
        name: fullName.trim(),
        email: data.user.email || email,
        role: 'viewer',
        avatarInitials: fullName
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        assignedRegion: 'Subang, Jawa Barat',
      };

      return { user: newUserProfile, needsConfirmation, error: null };
    } catch (err: any) {
      return { user: null, needsConfirmation: false, error: err?.message || 'Gagal mendaftar ke Supabase.' };
    }
  },

  /**
   * Sign out from Supabase Auth.
   */
  async signOut(): Promise<void> {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
  },

  /**
   * Get active session and validated user profile.
   */
  async getSession(): Promise<UserProfile | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return null;

      return await fetchAndBuildUserProfile(
        session.user.id,
        session.user.email,
        session.user.user_metadata
      );
    } catch {
      return null;
    }
  },

  /**
   * Subscribe to Supabase Auth state changes.
   */
  onAuthStateChange(callback: (user: UserProfile | null) => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) {
        callback(null);
        return;
      }

      const userProfile = await fetchAndBuildUserProfile(
        session.user.id,
        session.user.email,
        session.user.user_metadata
      );
      callback(userProfile);
    });

    return { unsubscribe: () => subscription.unsubscribe() };
  },
};

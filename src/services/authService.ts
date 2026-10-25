import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { UserProfile } from '../types';
import { sanitizeRole } from '../lib/permissions';

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

      // Fetch profile from profiles table (protected by RLS)
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileErr || !profileData) {
        // Fallback profile if profile row is not yet created
        // IMPORTANT: Default role is strictly 'viewer', NEVER elevated to admin!
        const fallbackProfile: UserProfile = {
          id: data.user.id,
          name: data.user.user_metadata?.full_name || email.split('@')[0],
          email: data.user.email || email,
          role: 'viewer', // Strict base viewer role
          avatarInitials: (data.user.email || email).slice(0, 2).toUpperCase(),
          assignedRegion: 'Subang, Jawa Barat',
        };
        return { user: fallbackProfile, error: null };
      }

      const userProfile: UserProfile = {
        id: profileData.id,
        name: profileData.full_name,
        email: profileData.email || email,
        role: sanitizeRole(profileData.role),
        avatarInitials: profileData.full_name
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        assignedRegion: profileData.assigned_region || 'Subang, Jawa Barat',
      };

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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        return {
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Pengguna',
          email: session.user.email || '',
          role: 'viewer', // default safe viewer
          avatarInitials: (session.user.email || 'US').slice(0, 2).toUpperCase(),
          assignedRegion: 'Subang, Jawa Barat',
        };
      }

      return {
        id: profile.id,
        name: profile.full_name,
        email: profile.email || session.user.email || '',
        role: sanitizeRole(profile.role),
        avatarInitials: profile.full_name
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        assignedRegion: profile.assigned_region || 'Subang, Jawa Barat',
      };
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (!profile) {
        callback({
          id: session.user.id,
          name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Pengguna',
          email: session.user.email || '',
          role: 'viewer',
          avatarInitials: (session.user.email || 'US').slice(0, 2).toUpperCase(),
          assignedRegion: 'Subang, Jawa Barat',
        });
        return;
      }

      callback({
        id: profile.id,
        name: profile.full_name,
        email: profile.email || session.user.email || '',
        role: sanitizeRole(profile.role),
        avatarInitials: profile.full_name
          .split(' ')
          .map((n: string) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        assignedRegion: profile.assigned_region || 'Subang, Jawa Barat',
      });
    });

    return { unsubscribe: () => subscription.unsubscribe() };
  },
};

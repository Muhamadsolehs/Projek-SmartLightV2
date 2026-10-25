import { supabase, isSupabaseConfigured } from '../lib/supabase';

export const storageService = {
  /**
   * Generates a temporary secure signed URL to view a private insect photo.
   * Does NOT make the storage bucket public!
   */
  async getSignedImageUrl(storagePath: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!isSupabaseConfigured || !storagePath) {
      return '';
    }

    try {
      const { data, error } = await supabase.storage
        .from('device-images')
        .createSignedUrl(storagePath, expiresInSeconds);

      if (error || !data) {
        return '';
      }

      return data.signedUrl;
    } catch {
      return '';
    }
  },

  /**
   * Uploads an image to the private device-images bucket.
   */
  async uploadImage(
    deviceId: string,
    file: File | Blob,
    filename: string
  ): Promise<{ path: string | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { path: null, error: 'Supabase belum terkonfigurasi' };
    }

    try {
      const date = new Date();
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const storagePath = `devices/${deviceId}/${year}/${month}/${filename}`;

      const { data, error } = await supabase.storage
        .from('device-images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (error) {
        return { path: null, error: error.message };
      }

      return { path: data.path, error: null };
    } catch (err: any) {
      return { path: null, error: err?.message || 'Gagal mengunggah foto' };
    }
  },
};

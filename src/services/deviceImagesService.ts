import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';

export interface DeviceImageRecord {
  id: number;
  device_id: string;
  image_url: string;
  file_path: string;
  trigger_source: string;
  captured_at: string;
  [key: string]: any;
}

export const deviceImagesService = {
  /**
   * Mengunggah file foto ke Supabase Storage bucket 'device_images'
   * dan mencatat metadata di tabel 'public.device_images'.
   */
  async uploadAndSaveImage(
    imageBlob: Blob,
    deviceId = 'SLT-SBG-01',
    triggerSource = 'manual_admin',
    dataUrlFallback?: string
  ): Promise<{ data: DeviceImageRecord | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { data: null, error: 'Klien Supabase belum terkonfigurasi.' };
    }

    try {
      const timestamp = Date.now();
      const filename = `baki_${deviceId}_${timestamp}.jpg`;
      const filePath = `captures/${filename}`;

      let finalImageUrl = '';
      let storageUploaded = false;

      // 1. Coba upload ke Supabase Storage bucket 'device_images'
      try {
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('device_images')
          .upload(filePath, imageBlob, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (!uploadErr && uploadData) {
          storageUploaded = true;
          const { data: urlData } = supabase.storage
            .from('device_images')
            .getPublicUrl(filePath);

          finalImageUrl = urlData?.publicUrl || '';
        } else {
          console.warn('[deviceImagesService] Upload ke storage bucket gagal/dibatasi RLS:', uploadErr?.message);
        }
      } catch (storageErr) {
        console.warn('[deviceImagesService] Storage upload exception:', storageErr);
      }

      // Jika storage gagal atau finalImageUrl kosong, gunakan fallback dataUrl atau direct URL
      if (!finalImageUrl) {
        if (dataUrlFallback) {
          finalImageUrl = dataUrlFallback;
        } else {
          // Buat format URL publik terprediksi
          finalImageUrl = `${supabaseUrl}/storage/v1/object/public/device_images/${filePath}`;
        }
      }

      // 2. Simpan record ke tabel database 'public.device_images'
      const { data: dbData, error: dbErr } = await supabase
        .from('device_images')
        .insert({
          device_id: deviceId,
          image_url: finalImageUrl,
          file_path: filePath,
          trigger_source: triggerSource,
          captured_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (dbErr) {
        console.error('[deviceImagesService] Gagal insert ke tabel device_images:', dbErr.message);
        return { data: null, error: `Gagal menyimpan ke database: ${dbErr.message}` };
      }

      return {
        data: dbData as DeviceImageRecord,
        error: null,
      };
    } catch (err: any) {
      console.error('[deviceImagesService] Error uploadAndSaveImage:', err);
      return { data: null, error: err?.message || 'Terjadi kesalahan sistem saat menyimpan foto.' };
    }
  },

  /**
   * Mengambil semua foto dari database tabel 'public.device_images'
   * serta mencocokkan dengan file yang ada di bucket 'device_images'.
   */
  async getAllDeviceImages(): Promise<DeviceImageRecord[]> {
    if (!isSupabaseConfigured) return [];

    try {
      // 1. Ambil dari tabel public.device_images
      const { data: rows, error: rowsErr } = await supabase
        .from('device_images')
        .select('*')
        .order('captured_at', { ascending: false });

      if (rowsErr) {
        console.warn('[deviceImagesService] Gagal membaca tabel device_images:', rowsErr.message);
      }

      const tableImages: DeviceImageRecord[] = (rows || []).map((row: any) => ({
        id: row.id,
        device_id: row.device_id || 'SLT-SBG-01',
        image_url: row.image_url || '',
        file_path: row.file_path || '',
        trigger_source: row.trigger_source || 'manual_admin',
        captured_at: row.captured_at || new Date().toISOString(),
      }));

      // 2. Coba periksa file di bucket storage 'device_images/captures'
      try {
        const { data: storageFiles } = await supabase.storage
          .from('device_images')
          .list('captures', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } });

        if (Array.isArray(storageFiles) && storageFiles.length > 0) {
          const knownPaths = new Set(tableImages.map((img) => img.file_path));

          for (const file of storageFiles) {
            const filePath = `captures/${file.name}`;
            if (!knownPaths.has(filePath) && file.name !== '.emptyFolderPlaceholder') {
              const { data: urlData } = supabase.storage
                .from('device_images')
                .getPublicUrl(filePath);

              tableImages.push({
                id: Math.floor(Math.random() * 1000000) + 10000,
                device_id: 'SLT-SBG-01',
                image_url: urlData?.publicUrl || '',
                file_path: filePath,
                trigger_source: 'storage_bucket',
                captured_at: file.created_at || new Date().toISOString(),
              });
            }
          }
        }
      } catch (storageListErr) {
        // Abaikan jika list storage dibatasi RLS
      }

      // Sortir ulang berdasarkan tanggal terbaru
      tableImages.sort(
        (a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime()
      );

      return tableImages;
    } catch (err) {
      console.error('[deviceImagesService] Error getAllDeviceImages:', err);
      return [];
    }
  },

  /**
   * Menghapus foto dari database dan storage bucket
   */
  async deleteImage(id: number, filePath?: string): Promise<{ success: boolean; error: string | null }> {
    if (!isSupabaseConfigured) return { success: false, error: 'Supabase belum terkonfigurasi' };

    try {
      // 1. Hapus dari database tabel
      const { error: dbErr } = await supabase
        .from('device_images')
        .delete()
        .eq('id', id);

      if (dbErr) {
        return { success: false, error: dbErr.message };
      }

      // 2. Hapus dari storage bucket jika filePath tersedia
      if (filePath) {
        try {
          await supabase.storage.from('device_images').remove([filePath]);
        } catch {}
      }

      return { success: true, error: null };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Gagal menghapus gambar' };
    }
  },

  /**
   * Berlangganan perubahan realtime tabel 'device_images'
   */
  subscribeToDeviceImages(callback: () => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('realtime_device_images_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_images' },
        () => {
          callback();
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};

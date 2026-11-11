import { supabase, isSupabaseConfigured, supabaseUrl } from '../lib/supabase';

const DELETED_CAPTURES_KEY = 'slt_deleted_captures';

export function getDeletedCaptureTombstones(): Set<string> {
  try {
    const raw = localStorage.getItem(DELETED_CAPTURES_KEY);
    if (!raw) return new Set();
    const list: string[] = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function addDeletedCaptureTombstone(...keys: (string | number | undefined | null)[]) {
  try {
    const tombstones = getDeletedCaptureTombstones();
    for (const k of keys) {
      if (k !== undefined && k !== null && String(k).trim()) {
        tombstones.add(String(k).trim());
      }
    }
    localStorage.setItem(DELETED_CAPTURES_KEY, JSON.stringify(Array.from(tombstones)));
  } catch {}
}

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

      const tombstones = getDeletedCaptureTombstones();

      const tableImages: DeviceImageRecord[] = (rows || [])
        .filter((row: any) => {
          if (!row) return false;
          if (
            tombstones.has(`IMG-DB-${row.id}`) ||
            tombstones.has(String(row.id)) ||
            tombstones.has(`db-${row.id}`)
          ) {
            return false;
          }
          if (row.file_path && tombstones.has(row.file_path)) return false;
          if (row.image_url && tombstones.has(row.image_url)) return false;
          return true;
        })
        .map((row: any) => ({
          id: row.id,
          device_id: row.device_id || 'SLT-SBG-01',
          image_url: row.image_url || '',
          file_path: row.file_path || '',
          trigger_source: row.trigger_source || 'manual_admin',
          captured_at: row.captured_at || new Date().toISOString(),
          total_pests: typeof row.total_pests === 'number' ? row.total_pests : undefined,
          target_pests_count: typeof row.target_pests_count === 'number' ? row.target_pests_count : undefined,
          other_insects_count: typeof row.other_insects_count === 'number' ? row.other_insects_count : undefined,
          bboxes: Array.isArray(row.bboxes) ? row.bboxes : Array.isArray(row.detection_result?.bboxes) ? row.detection_result.bboxes : undefined,
          detection_result: row.detection_result || undefined,
          capture_session_id: row.capture_session_id || undefined,
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
            if (tombstones.has(filePath) || tombstones.has(file.name)) continue;

            if (!knownPaths.has(filePath) && file.name !== '.emptyFolderPlaceholder') {
              const { data: urlData } = supabase.storage
                .from('device_images')
                .getPublicUrl(filePath);

              if (urlData?.publicUrl && tombstones.has(urlData.publicUrl)) continue;

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
   * Menghapus foto dari database dan storage bucket,
   * serta membersihkan sesi deteksi hama yang terkait.
   */
  async deleteImage(
    id?: number,
    filePath?: string,
    captureId?: string,
    imageUrl?: string
  ): Promise<{ success: boolean; error: string | null }> {
    // Catat tombstone segera di browser agar tidak pernah muncul lagi di antarmuka
    addDeletedCaptureTombstone(
      id,
      id ? `db-${id}` : undefined,
      id ? `IMG-DB-${id}` : undefined,
      captureId,
      captureId ? `SES-${captureId}` : undefined,
      filePath,
      imageUrl
    );

    if (!isSupabaseConfigured) return { success: true, error: null };

    try {
      let recordId = id;
      let targetFilePath = filePath;
      let targetSessionId: string | null = null;
      let targetImageUrl = imageUrl;

      // 1. Ambil informasi lengkap record dari database jika tersedia
      if (recordId) {
        const { data: row } = await supabase
          .from('device_images')
          .select('id, file_path, image_url, capture_session_id')
          .eq('id', recordId)
          .maybeSingle();

        if (row) {
          targetFilePath = targetFilePath || row.file_path;
          targetSessionId = row.capture_session_id;
          targetImageUrl = targetImageUrl || row.image_url;
        }
      } else if (targetFilePath) {
        const { data: row } = await supabase
          .from('device_images')
          .select('id, file_path, image_url, capture_session_id')
          .eq('file_path', targetFilePath)
          .maybeSingle();

        if (row) {
          recordId = row.id;
          targetSessionId = row.capture_session_id;
          targetImageUrl = targetImageUrl || row.image_url;
        }
      }

      // 2. Hapus data dari public.insect_detections & public.capture_sessions
      const sessionCodesToDelete: string[] = [];
      if (captureId) {
        sessionCodesToDelete.push(`SES-${captureId}`);
        sessionCodesToDelete.push(captureId);
      }
      if (recordId) {
        sessionCodesToDelete.push(`SES-IMG-DB-${recordId}`);
      }

      if (targetSessionId) {
        await supabase.from('insect_detections').delete().eq('capture_session_id', targetSessionId);
        await supabase.from('capture_sessions').delete().eq('id', targetSessionId);
      }

      for (const sc of sessionCodesToDelete) {
        try {
          const { data: sess } = await supabase
            .from('capture_sessions')
            .select('id')
            .eq('session_code', sc)
            .maybeSingle();

          if (sess?.id) {
            await supabase.from('insect_detections').delete().eq('capture_session_id', sess.id);
            await supabase.from('capture_sessions').delete().eq('id', sess.id);
          }
        } catch (sessDelErr) {
          console.warn('[deviceImagesService] Peringatan hapus capture_sessions:', sessDelErr);
        }
      }

      // 3. Hapus baris dari tabel public.device_images
      if (recordId) {
        const { error: dbErr } = await supabase
          .from('device_images')
          .delete()
          .eq('id', recordId);

        if (dbErr) {
          console.warn('[deviceImagesService] Gagal delete device_images by id:', dbErr.message);
        }
      }

      if (targetFilePath) {
        await supabase
          .from('device_images')
          .delete()
          .eq('file_path', targetFilePath);
      }

      if (targetImageUrl) {
        await supabase
          .from('device_images')
          .delete()
          .eq('image_url', targetImageUrl);
      }

      // 4. Hapus berkas foto dari Supabase Storage (coba bucket 'device_images' dan 'device-images')
      if (targetFilePath) {
        const cleanFile = targetFilePath.replace(/^captures\//, '');
        const filesToRemove = [targetFilePath, cleanFile, `captures/${cleanFile}`];

        try {
          await supabase.storage.from('device_images').remove(filesToRemove);
        } catch {}

        try {
          await supabase.storage.from('device-images').remove(filesToRemove);
        } catch {}
      }

      return { success: true, error: null };
    } catch (err: any) {
      console.error('[deviceImagesService] Error saat deleteImage:', err);
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


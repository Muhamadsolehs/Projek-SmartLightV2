-- ============================================================================
-- MIGRATION 00013: FIX PHOTO DELETION & STORAGE BUCKET RLS POLICIES
-- Target Database: PostgreSQL 15+ (Supabase)
-- Resolves:
--   1. Izinkan operasi DELETE pada tabel public.device_images untuk klien web (anon & authenticated)
--   2. Izinkan operasi DELETE pada tabel public.capture_sessions dan public.insect_detections
--   3. Izinkan operasi DELETE & INSERT pada Supabase Storage bucket 'device_images' & 'device-images'
--      sehingga penghapusan foto baki air bersih tuntas dan tidak muncul kembali saat refresh.
-- ============================================================================

-- 1. Izin Penuh & RLS Permisif pada public.device_images
ALTER TABLE public.device_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "images_allow_all" ON public.device_images;
DROP POLICY IF EXISTS "images_manage_admin" ON public.device_images;
DROP POLICY IF EXISTS "images_select_authenticated" ON public.device_images;

CREATE POLICY "images_allow_all" ON public.device_images
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.device_images TO anon, authenticated, service_role;

-- 2. Izin Penuh & RLS Permisif pada public.capture_sessions
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "captures_allow_all" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_manage_admin" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_select_authenticated" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_allow_anon_read" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_allow_anon_write" ON public.capture_sessions;

CREATE POLICY "captures_allow_all" ON public.capture_sessions
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.capture_sessions TO anon, authenticated, service_role;

-- 3. Izin Penuh & RLS Permisif pada public.insect_detections
ALTER TABLE public.insect_detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detections_allow_all" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_manage_admin" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_select_authenticated" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_allow_anon_read" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_allow_anon_write" ON public.insect_detections;

CREATE POLICY "detections_allow_all" ON public.insect_detections
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON TABLE public.insect_detections TO anon, authenticated, service_role;

-- 4. Kebijakan Row Level Security pada storage.objects untuk Bucket 'device_images' & 'device-images'
-- Memungkinkan klien web menghapus file foto dari storage bucket Supabase secara permanen
DROP POLICY IF EXISTS "device_images_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "device_images_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "device_images_storage_delete" ON storage.objects;
DROP POLICY IF EXISTS "device_images_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete device images" ON storage.objects;
DROP POLICY IF EXISTS "Operators and Admins can upload device images" ON storage.objects;

CREATE POLICY "device_images_storage_select" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id IN ('device_images', 'device-images'));

CREATE POLICY "device_images_storage_insert" ON storage.objects
    FOR INSERT TO anon, authenticated
    WITH CHECK (bucket_id IN ('device_images', 'device-images'));

CREATE POLICY "device_images_storage_delete" ON storage.objects
    FOR DELETE TO anon, authenticated
    USING (bucket_id IN ('device_images', 'device-images'));

CREATE POLICY "device_images_storage_update" ON storage.objects
    FOR UPDATE TO anon, authenticated
    USING (bucket_id IN ('device_images', 'device-images'))
    WITH CHECK (bucket_id IN ('device_images', 'device-images'));


-- ============================================================================
-- MIGRATION 00003: SUPABASE STORAGE BUCKET CONFIGURATION
-- Target: Private bucket 'device-images' for insect capture photos
-- Access: Signed URLs for authorized users
-- ============================================================================

-- Create private storage bucket for device images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'device-images',
    'device-images',
    false, -- Private bucket: access requires signed URLs or authenticated RLS
    10485760, -- 10MB limit per image
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS Policies
CREATE POLICY "Authenticated users can read device images"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'device-images');

CREATE POLICY "Operators and Admins can upload device images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id = 'device-images' AND
    public.is_operator_or_admin()
);

CREATE POLICY "Admins can delete device images"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'device-images' AND
    public.is_admin()
);

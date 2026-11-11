-- ============================================================================
-- MIGRATION 00012: ENABLE PEST DETECTION SAVING & RLS POLICIES FOR FRONTEND CLIENT
-- Target Database: PostgreSQL 15+ (Supabase)
-- Resolves:
--   1. Permissive RLS policies for capture_sessions, insect_detections, insect_species, and device_images
--   2. Ensures master seed for default device ('SLT-SBG-01') and 6 IP102 insect species
--   3. Adds detection columns to device_images for direct one-to-one analysis metadata
--   4. Creates unique index on capture_sessions(session_code) for idempotent upserts
-- ============================================================================

-- 1. Pastikan Perangkat Utama 'SLT-SBG-01' Tersedia di tabel devices
INSERT INTO public.devices (
    id,
    device_code,
    device_name,
    location_name,
    farm_sector,
    latitude,
    longitude,
    crop_type,
    planting_date,
    firmware_version,
    esp32_chip_id,
    api_key_hash,
    last_seen_at,
    connection_status,
    lamp_status,
    operational_status,
    battery_cutoff_threshold_v,
    pest_threshold_per_night,
    is_simulated
) VALUES (
    'a1111111-1111-1111-1111-111111111111',
    'SLT-SBG-01',
    'Smart Trap Unit 1 (Subang Sawah Inti)',
    'Pusat Benih Padi Subang',
    'Sektor Benih Inti IPB 3S (Subang)',
    -6.5512000,
    107.7588000,
    'Padi Varietas Ciherang (HST 42)',
    '2026-09-08',
    'v2.3.1-prod',
    'ESP32S3-7C2A31',
    'slt_token_sbg01_secret_2026_hash',
    NOW(),
    'online',
    true,
    'active',
    11.80,
    50,
    false
) ON CONFLICT (device_code) DO NOTHING;

-- 2. Pastikan Master Spesies Taksonomi IP102 Tersedia di tabel insect_species
INSERT INTO public.insect_species (id, common_name, scientific_name, family, is_target_pest, economic_threshold_per_night, risk_level, preferred_wavelength_nm, description)
VALUES
    ('scirpophaga_incertulas', 'Penggerek Batang Padi Kuning', 'Scirpophaga incertulas', 'Crambidae (Lepidoptera)', true, 50, 'critical', 365, 'Hama utama padi penyebab sundep dan beluk.'),
    ('nilaparvata_lugens', 'Wereng Batang Coklat (WBC)', 'Nilaparvata lugens', 'Delphacidae (Hemiptera)', true, 80, 'critical', 395, 'Vektor virus kerdil rumput dan kerdil hampa pembawa hopperburn.'),
    ('spodoptera_frugiperda', 'Ulat Grayak / Fall Armyworm', 'Spodoptera frugiperda', 'Noctuidae (Lepidoptera)', true, 35, 'high', 365, 'Ngengat nokturnal perusak daun dan titik tumbuh padi/jagung.'),
    ('leptocorisa_oratoria', 'Walang Sangit', 'Leptocorisa oratoria', 'Alydidae (Hemiptera)', true, 40, 'medium', 420, 'Penghisap bulir gabah pada fase matang susu.'),
    ('cnaphalocrocis_medinalis', 'Hama Putih Palsu / Penggulung Daun', 'Cnaphalocrocis medinalis', 'Pyralidae (Lepidoptera)', true, 45, 'medium', 365, 'Larva penggulung daun padi pengikis klorofil.'),
    ('other_neutral', 'Serangga Netral / Non-Hama', 'Non-Target Arthropoda', 'Aneka Ordo (Coleoptera/Diptera)', false, 500, 'low', 400, 'Serangga malam non-hama tanaman padi.')
ON CONFLICT (id) DO UPDATE SET
    common_name = EXCLUDED.common_name,
    scientific_name = EXCLUDED.scientific_name;

-- 3. Indeks Unik pada capture_sessions.session_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_capture_sessions_code ON public.capture_sessions (session_code);

-- 4. Tambahkan Kolom Metadata Analisis AI ke tabel device_images (jika belum ada)
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS capture_session_id UUID REFERENCES public.capture_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS total_pests INT DEFAULT 0;
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS target_pests_count INT DEFAULT 0;
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS other_insects_count INT DEFAULT 0;
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS bboxes JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.device_images ADD COLUMN IF NOT EXISTS detection_result JSONB DEFAULT '{}'::jsonb;

-- 5. Kebijakan Row Level Security (RLS) Permisif untuk Akses Web Client (Anon & Authenticated)

-- A. capture_sessions
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "captures_allow_all" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_allow_anon_read" ON public.capture_sessions;
DROP POLICY IF EXISTS "captures_allow_anon_write" ON public.capture_sessions;

CREATE POLICY "captures_allow_all" ON public.capture_sessions
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- B. insect_detections
ALTER TABLE public.insect_detections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "detections_allow_all" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_allow_anon_read" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_allow_anon_write" ON public.insect_detections;

CREATE POLICY "detections_allow_all" ON public.insect_detections
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- C. insect_species
ALTER TABLE public.insect_species ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "species_allow_all" ON public.insect_species;

CREATE POLICY "species_allow_all" ON public.insect_species
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- D. device_images
ALTER TABLE public.device_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "images_allow_all" ON public.device_images;

CREATE POLICY "images_allow_all" ON public.device_images
    FOR ALL TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- E. devices
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "devices_allow_all_read" ON public.devices;

CREATE POLICY "devices_allow_all_read" ON public.devices
    FOR SELECT TO anon, authenticated
    USING (true);


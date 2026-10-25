-- ============================================================================
-- MIGRATION 00005: ROLE-BASED ACCESS CONTROL (RBAC) ENHANCEMENTS
-- Target: Supabase PostgreSQL
-- Roles: admin, operator, analyst, viewer
-- Description:
--   1. Expands profiles.role check constraint to include 'analyst'.
--   2. Secures handle_new_user() to strictly enforce 'viewer' role on signup.
--   3. Adds helper functions (is_admin, is_operator_or_admin, is_analyst_or_above).
--   4. Hardens prevent_role_self_escalation() to protect role assignments.
--   5. Updates and hardens RLS policies across all tables.
--   6. Provides secure admin functions for user management.
-- ============================================================================

-- 1. Update profiles check constraint to allow 4 roles: admin, operator, analyst, viewer
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_role_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_role_check
    CHECK (role IN ('admin', 'operator', 'analyst', 'viewer'));

-- 2. Ensure default role on profiles table is 'viewer'
ALTER TABLE public.profiles
    ALTER COLUMN role SET DEFAULT 'viewer';

-- 3. Hardened helper function to get current authenticated user role
CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS TEXT AS $$
DECLARE
    v_role TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN 'anon';
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();
    
    RETURN COALESCE(v_role, 'viewer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Role helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_operator_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() IN ('admin', 'operator'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_analyst_or_above()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_current_user_role() IN ('admin', 'operator', 'analyst'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5. Hardened handle_new_user trigger function
-- Keamanan: Wajib selalu 'viewer' untuk pendaftaran publik.
-- Metadata role dari pengguna (raw_user_meta_data->>'role') mutlak diabaikan!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, assigned_region)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        'viewer', -- STRICT: Default role selalu 'viewer', mencegah privilege escalation
        COALESCE(NEW.raw_user_meta_data->>'assigned_region', 'Subang, Jawa Barat')
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
        -- Perhatian: Role TIDAK diperbarui saat konflik untuk menjaga integritas role yang sudah diset admin
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Hardened prevent_role_self_escalation trigger function
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Jika kolom role berubah
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        -- Pastikan hanya admin aktif yang berhak mengubah role
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Akses ditolak: Hanya akun Administrator yang memiliki wewenang mengubah peran (role) pengguna.';
        END IF;

        -- Proteksi diri: Jangan izinkan admin mencabut role admin miliknya sendiri jika dia adalah satu-satunya admin
        IF OLD.id = auth.uid() AND OLD.role = 'admin' AND NEW.role != 'admin' THEN
            IF (SELECT COUNT(*) FROM public.profiles WHERE role = 'admin') <= 1 THEN
                RAISE EXCEPTION 'Operasi dibatalkan: Anda adalah satu-satunya Administrator di sistem. Angkat akun lain sebagai Admin terlebih dahulu sebelum menurunkan peran akun Anda.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_check_role_change ON public.profiles;
CREATE TRIGGER trg_check_role_change
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- ============================================================================
-- 7. REFRESH & HARDEN ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- A. PROFILES TABLE POLICIES
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;

-- Pengguna terautentikasi dapat melihat profil pengguna lain (untuk nama operator, verifikator)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT TO authenticated
    USING (true);

-- Pengguna dapat mengupdate nama dan avatar profil miliknya sendiri (role diproteksi oleh trigger)
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin dapat mengupdate profil siapa pun (termasuk role dan assigned_region)
CREATE POLICY "profiles_admin_update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- B. DEVICES TABLE POLICIES
DROP POLICY IF EXISTS "devices_select_authenticated" ON public.devices;
DROP POLICY IF EXISTS "devices_update_operator" ON public.devices;
DROP POLICY IF EXISTS "devices_insert_admin" ON public.devices;
DROP POLICY IF EXISTS "devices_delete_admin" ON public.devices;

-- Seluruh pengguna login (Admin, Operator, Analyst, Viewer) dapat melihat perangkat
CREATE POLICY "devices_select_authenticated" ON public.devices
    FOR SELECT TO authenticated
    USING (true);

-- Hanya Operator dan Admin yang dapat mengupdate status operasional dan lampu perangkat
CREATE POLICY "devices_update_operator" ON public.devices
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- Hanya Admin yang dapat menambah perangkat baru
CREATE POLICY "devices_insert_admin" ON public.devices
    FOR INSERT TO authenticated
    WITH CHECK (public.is_admin());

-- Hanya Admin yang dapat menghapus perangkat
CREATE POLICY "devices_delete_admin" ON public.devices
    FOR DELETE TO authenticated
    USING (public.is_admin());

-- C. DEVICE_COMMANDS TABLE POLICIES
DROP POLICY IF EXISTS "commands_select_authenticated" ON public.device_commands;
DROP POLICY IF EXISTS "commands_insert_operator" ON public.device_commands;
DROP POLICY IF EXISTS "commands_update_operator" ON public.device_commands;

-- Pengguna terautentikasi dapat melihat log audit perintah
CREATE POLICY "commands_select_authenticated" ON public.device_commands
    FOR SELECT TO authenticated
    USING (true);

-- Hanya Operator dan Admin yang berwenang mengirim perintah jarak jauh
CREATE POLICY "commands_insert_operator" ON public.device_commands
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "commands_update_operator" ON public.device_commands
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- D. DEVICE_SETTINGS TABLE POLICIES
DROP POLICY IF EXISTS "settings_select_authenticated" ON public.device_settings;
DROP POLICY IF EXISTS "settings_update_operator" ON public.device_settings;

-- Pengguna terautentikasi dapat melihat setting
CREATE POLICY "settings_select_authenticated" ON public.device_settings
    FOR SELECT TO authenticated
    USING (true);

-- Hanya Operator dan Admin yang dapat memperbarui pengaturan perangkat operasional
CREATE POLICY "settings_update_operator" ON public.device_settings
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

-- E. DEVICE_ALERTS TABLE POLICIES
DROP POLICY IF EXISTS "alerts_select_authenticated" ON public.device_alerts;
DROP POLICY IF EXISTS "alerts_update_operator" ON public.device_alerts;
DROP POLICY IF EXISTS "alerts_insert_operator" ON public.device_alerts;

-- Seluruh pengguna login dapat memantau peringatan
CREATE POLICY "alerts_select_authenticated" ON public.device_alerts
    FOR SELECT TO authenticated
    USING (true);

-- Hanya Operator dan Admin yang dapat mengonfirmasi / menyelesaikan peringatan
CREATE POLICY "alerts_update_operator" ON public.device_alerts
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "alerts_insert_operator" ON public.device_alerts
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- F. INSECT_DETECTIONS TABLE POLICIES
DROP POLICY IF EXISTS "detections_select_authenticated" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_update_operator" ON public.insect_detections;
DROP POLICY IF EXISTS "detections_insert_operator" ON public.insect_detections;

-- Seluruh pengguna login (Admin, Operator, Analyst, Viewer) dapat membaca deteksi serangga
CREATE POLICY "detections_select_authenticated" ON public.insect_detections
    FOR SELECT TO authenticated
    USING (true);

-- Hanya Operator dan Admin yang berwenang memvalidasi / mengoreksi hasil deteksi AI
CREATE POLICY "detections_update_operator" ON public.insect_detections
    FOR UPDATE TO authenticated
    USING (public.is_operator_or_admin())
    WITH CHECK (public.is_operator_or_admin());

CREATE POLICY "detections_insert_operator" ON public.insect_detections
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- G. WATER_CHANGE_LOGS TABLE POLICIES
DROP POLICY IF EXISTS "water_logs_select_authenticated" ON public.water_change_logs;
DROP POLICY IF EXISTS "water_logs_insert_operator" ON public.water_change_logs;

CREATE POLICY "water_logs_select_authenticated" ON public.water_change_logs
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "water_logs_insert_operator" ON public.water_change_logs
    FOR INSERT TO authenticated
    WITH CHECK (public.is_operator_or_admin());

-- H. STORAGE BUCKET POLICIES (device-images)
DROP POLICY IF EXISTS "Authenticated users can read device images" ON storage.objects;
DROP POLICY IF EXISTS "Operators and Admins can upload device images" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete device images" ON storage.objects;

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

-- ============================================================================
-- 8. SECURE RPC FOR ADMIN USER ROLE MANAGEMENT
-- ============================================================================
-- Fungsi tersimpan untuk mengubah role pengguna secara aman dari dashboard admin
CREATE OR REPLACE FUNCTION public.admin_set_user_role(
    target_user_id UUID,
    new_role TEXT
)
RETURNS JSONB AS $$
DECLARE
    caller_role TEXT;
    target_current_role TEXT;
    admin_count INT;
BEGIN
    -- Validasi pemanggil adalah Admin
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya akun Administrator yang dapat menjalankan fungsi ini.';
    END IF;

    -- Validasi nilai new_role
    IF new_role NOT IN ('admin', 'operator', 'analyst', 'viewer') THEN
        RAISE EXCEPTION 'Role tidak valid. Pilihan role yang sah: admin, operator, analyst, viewer.';
    END IF;

    -- Ambil role pengguna target saat ini
    SELECT role INTO target_current_role
    FROM public.profiles
    WHERE id = target_user_id;

    IF target_current_role IS NULL THEN
        RAISE EXCEPTION 'Pengguna target tidak ditemukan pada tabel profiles.';
    END IF;

    -- Proteksi: Jangan biarkan admin terakhir mencabut hak adminnya sendiri
    IF target_user_id = auth.uid() AND new_role != 'admin' THEN
        SELECT COUNT(*) INTO admin_count
        FROM public.profiles
        WHERE role = 'admin';

        IF admin_count <= 1 THEN
            RAISE EXCEPTION 'Operasi ditolak: Anda adalah satu-satunya Administrator yang tersisa.';
        END IF;
    END IF;

    -- Eksekusi pembaruan
    UPDATE public.profiles
    SET role = new_role,
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN jsonb_build_object(
        'success', true,
        'user_id', target_user_id,
        'old_role', target_current_role,
        'new_role', new_role,
        'updated_at', NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

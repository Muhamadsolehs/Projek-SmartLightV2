-- ============================================================================
-- MIGRATION 00006: SUPPORT 'SET_RELAY' COMMAND IN DEVICE_COMMANDS
-- Memungkinkan kontrol individual 4 channel relay fisik ESP32 dari dashboard
-- ============================================================================

-- 1. Perbarui CHECK constraint pada device_commands untuk mengizinkan 'SET_RELAY'
ALTER TABLE public.device_commands 
DROP CONSTRAINT IF EXISTS device_commands_command_type_check;

ALTER TABLE public.device_commands 
ADD CONSTRAINT device_commands_command_type_check 
CHECK (command_type IN (
    'FORCE_WATER_CHANGE', 
    'TOGGLE_LAMP', 
    'CAPTURE_NOW', 
    'SYNC_MICROSD', 
    'REBOOT_ESP32', 
    'UPDATE_FIRMWARE_OTA', 
    'SET_SCHEDULE',
    'SET_RELAY'
));

-- 2. Komentar dokumentasi
COMMENT ON CONSTRAINT device_commands_command_type_check ON public.device_commands IS 
'Daftar perintah yang diizinkan untuk dikirimkan ke ESP32 termasuk kontrol 4-channel relay fisik (SET_RELAY).';

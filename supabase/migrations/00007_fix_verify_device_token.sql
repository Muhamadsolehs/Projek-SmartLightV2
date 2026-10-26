-- ============================================================================
-- Migration 00007: Fix verify_device_token Schema Qualification & Search Path
-- Description: Ensures digest('sha256') resolves reliably to extensions.digest
--              and sets explicit search_path = public, extensions.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.verify_device_token(
    p_device_code VARCHAR(64),
    p_raw_token TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stored_hash VARCHAR(256);
    v_computed_hash VARCHAR(256);
    v_is_active BOOLEAN;
BEGIN
    -- Query stored hash and active status for device
    SELECT api_key_hash, (operational_status = 'active')
    INTO v_stored_hash, v_is_active
    FROM public.devices
    WHERE device_code = p_device_code;

    -- Return false if device not found or inactive
    IF v_stored_hash IS NULL OR v_is_active IS NOT TRUE THEN
        RETURN FALSE;
    END IF;

    -- Compute SHA-256 hash of provided token using extensions.digest
    v_computed_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    RETURN (v_stored_hash = v_computed_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions;

-- Grant execution permission to service_role, postgres, and authenticated roles
GRANT EXECUTE ON FUNCTION public.verify_device_token(VARCHAR, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_device_token(VARCHAR, TEXT) TO postgres;

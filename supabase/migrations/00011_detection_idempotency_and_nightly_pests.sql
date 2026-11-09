-- ============================================================================
-- MIGRATION 00011: DETECTION IDEMPOTENCY, NIGHTLY ACCUMULATION & PEST THRESHOLD
-- Target Database: PostgreSQL 15+ (Supabase)
-- Resolves:
--   1. Idempotency for capture_sessions detections (prevents duplicate rows on retry/concurrency)
--   2. Nightly operational pest accumulation (Asia/Jakarta, 18:00 - 06:00 WIB)
--   3. Economic threshold evaluation across the active night
-- ============================================================================

-- 1. Helper Function: get_operational_night_bounds
-- Determines the start, end, and reference date of the active 12-hour light trap night (18:00 - 06:00 WIB).
CREATE OR REPLACE FUNCTION public.get_operational_night_bounds(
    p_time TIMESTAMPTZ DEFAULT NOW(),
    OUT p_night_start TIMESTAMPTZ,
    OUT p_night_end TIMESTAMPTZ,
    OUT p_night_date DATE
) AS $$
DECLARE
    v_local_time TIMESTAMP;
    v_local_date DATE;
    v_local_hour INT;
BEGIN
    -- Convert to Asia/Jakarta (WIB = UTC+7)
    v_local_time := p_time AT TIME ZONE 'Asia/Jakarta';
    v_local_date := v_local_time::DATE;
    v_local_hour := EXTRACT(HOUR FROM v_local_time)::INT;

    -- Operational Night Cycle Definition:
    -- A light trap night runs from 18:00 WIB on Date D to 06:00 WIB on Date D+1.
    IF v_local_hour >= 18 THEN
        -- Started today at 18:00 WIB
        p_night_date := v_local_date;
        p_night_start := (v_local_date || ' 18:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
        p_night_end := ((v_local_date + INTERVAL '1 day')::DATE || ' 06:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
    ELSIF v_local_hour < 6 THEN
        -- Started yesterday at 18:00 WIB
        p_night_date := (v_local_date - INTERVAL '1 day')::DATE;
        p_night_start := ((v_local_date - INTERVAL '1 day')::DATE || ' 18:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
        p_night_end := (v_local_date || ' 06:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
    ELSE
        -- Daytime calibration window (06:00 - 17:59 WIB): Default to previous night bounds
        p_night_date := (v_local_date - INTERVAL '1 day')::DATE;
        p_night_start := ((v_local_date - INTERVAL '1 day')::DATE || ' 18:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
        p_night_end := (v_local_date || ' 06:00:00')::TIMESTAMP AT TIME ZONE 'Asia/Jakarta';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Function: get_nightly_cumulative_pests
-- Calculates cumulative target pests and total insects for a specific device during its active night.
CREATE OR REPLACE FUNCTION public.get_nightly_cumulative_pests(
    p_device_id UUID,
    p_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
    device_id UUID,
    night_date DATE,
    night_start TIMESTAMPTZ,
    night_end TIMESTAMPTZ,
    total_sessions INT,
    cumulative_target_pests INT,
    cumulative_all_insects INT
) AS $$
DECLARE
    v_start TIMESTAMPTZ;
    v_end TIMESTAMPTZ;
    v_date DATE;
BEGIN
    SELECT p_night_start, p_night_end, p_night_date
    INTO v_start, v_end, v_date
    FROM public.get_operational_night_bounds(p_time);

    RETURN QUERY
    SELECT 
        p_device_id,
        v_date,
        v_start,
        v_end,
        COUNT(s.id)::INT AS total_sessions,
        COALESCE(SUM(s.target_pests_count), 0)::INT AS cumulative_target_pests,
        COALESCE(SUM(s.total_pests), 0)::INT AS cumulative_all_insects
    FROM public.capture_sessions s
    WHERE s.device_id = p_device_id
      AND s.captured_at >= v_start
      AND s.captured_at < v_end
      AND s.processing_status IN ('completed', 'verified');
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Stored Procedure / RPC: process_capture_session_detections
-- Atomically processes insect detection batch for a capture session.
-- Features:
--   - Row-level lock (FOR UPDATE) to prevent concurrent race conditions
--   - Idempotent: If session is already completed, returns existing data without duplicating rows
--   - FK Protection: Unmapped/unidentified species safely converted to 'other_neutral'
--   - Strict 0-100% bounding box & 0-1 confidence clamping
--   - Calculates cumulative nightly pest count and threshold breach
CREATE OR REPLACE FUNCTION public.process_capture_session_detections(
    p_session_id UUID,
    p_device_id UUID,
    p_model_version VARCHAR(64),
    p_detections JSONB
)
RETURNS JSONB AS $$
DECLARE
    v_session RECORD;
    v_device RECORD;
    v_det JSONB;
    v_det_count INT := 0;
    v_target_count INT := 0;
    v_other_count INT := 0;
    v_conf_sum NUMERIC := 0.0;
    v_avg_conf NUMERIC := 0.0;
    v_species_code VARCHAR(64);
    v_species_name VARCHAR(128);
    v_classification VARCHAR(32);
    v_conf NUMERIC(5, 4);
    v_bbox JSONB;
    v_is_target BOOLEAN;
    v_valid_species_codes TEXT[] := ARRAY['scirpophaga_incertulas', 'nilaparvata_lugens', 'spodoptera_frugiperda', 'leptocorisa_oratoria', 'cnaphalocrocis_medinalis', 'other_neutral'];
    v_night RECORD;
    v_cum_target INT;
    v_threshold INT;
    v_threshold_exceeded BOOLEAN := false;
BEGIN
    -- 1. Validate device
    SELECT id, device_code, device_name, pest_threshold_per_night
    INTO v_device
    FROM public.devices
    WHERE id = p_device_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Device not found: %', p_device_id USING ERRCODE = 'P0002';
    END IF;

    v_threshold := COALESCE(v_device.pest_threshold_per_night, 50);

    -- 2. Lock capture_session row atomically to prevent concurrent double-processing
    SELECT id, device_id, processing_status, total_pests, target_pests_count, other_insects_count, avg_confidence, captured_at
    INTO v_session
    FROM public.capture_sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Capture session not found: %', p_session_id USING ERRCODE = 'P0002';
    END IF;

    -- Validate device ownership of this session
    IF v_session.device_id != p_device_id THEN
        RAISE EXCEPTION 'Session % does not belong to device %', p_session_id, p_device_id USING ERRCODE = '42501';
    END IF;

    -- 3. Idempotency Check: If already completed or verified, return existing metrics without re-inserting
    IF v_session.processing_status IN ('completed', 'verified') THEN
        -- Get cumulative nightly stats
        SELECT cumulative_target_pests INTO v_cum_target
        FROM public.get_nightly_cumulative_pests(p_device_id, v_session.captured_at);

        RETURN jsonb_build_object(
            'success', true,
            'session_id', p_session_id,
            'device_id', p_device_id,
            'already_processed', true,
            'total_detections', v_session.total_pests,
            'target_pests', v_session.target_pests_count,
            'other_insects', v_session.other_insects_count,
            'avg_confidence', v_session.avg_confidence,
            'cumulative_target_pests', COALESCE(v_cum_target, v_session.target_pests_count),
            'threshold', v_threshold,
            'threshold_exceeded', COALESCE(v_cum_target, v_session.target_pests_count) >= v_threshold,
            'message', 'Session was previously processed and finalized. Duplicate insertion prevented.'
        );
    END IF;

    -- 4. Delete any partial/stale detections for this session before batch insert
    DELETE FROM public.insect_detections WHERE capture_session_id = p_session_id;

    -- 5. Parse and insert detections
    IF p_detections IS NOT NULL AND jsonb_array_length(p_detections) > 0 THEN
        FOR v_det IN SELECT * FROM jsonb_array_elements(p_detections)
        LOOP
            v_det_count := v_det_count + 1;
            v_species_code := v_det->>'species_code';
            v_species_name := COALESCE(v_det->>'species_name', v_species_code, 'Hama Padi');

            -- Foreign Key Protection: If species code is not in master table, fallback safely to other_neutral
            IF v_species_code IS NULL OR NOT (v_species_code = ANY(v_valid_species_codes)) THEN
                v_species_code := 'other_neutral';
                v_is_target := false;
                v_classification := 'neutral_insect';
            ELSE
                v_is_target := (v_species_code != 'other_neutral' AND v_species_code != 'unidentified');
                v_classification := CASE WHEN v_is_target THEN 'target_pest' ELSE 'neutral_insect' END;
            END IF;

            IF v_is_target THEN
                v_target_count := v_target_count + 1;
            ELSE
                v_other_count := v_other_count + 1;
            END IF;

            -- Clamped confidence (0.0000 - 1.0000)
            v_conf := LEAST(1.0, GREATEST(0.0, COALESCE((v_det->>'confidence')::NUMERIC, 0.9)))::NUMERIC(5, 4);
            v_conf_sum := v_conf_sum + v_conf;

            -- Clamped bounding box percentages (0-100%)
            v_bbox := jsonb_build_object(
                'x', LEAST(100.0, GREATEST(0.0, COALESCE((v_det->'bbox'->>'x')::NUMERIC, 20.0))),
                'y', LEAST(100.0, GREATEST(0.0, COALESCE((v_det->'bbox'->>'y')::NUMERIC, 20.0))),
                'width', LEAST(100.0, GREATEST(0.0, COALESCE((v_det->'bbox'->>'width')::NUMERIC, 10.0))),
                'height', LEAST(100.0, GREATEST(0.0, COALESCE((v_det->'bbox'->>'height')::NUMERIC, 10.0)))
            );

            INSERT INTO public.insect_detections (
                capture_session_id,
                device_id,
                species_code,
                species_name,
                classification,
                count,
                confidence_score,
                bounding_box,
                verification_status,
                model_version
            ) VALUES (
                p_session_id,
                p_device_id,
                v_species_code,
                v_species_name,
                v_classification,
                COALESCE((v_det->>'count')::INT, 1),
                v_conf,
                v_bbox,
                'ai_detected',
                COALESCE(p_model_version, 'YOLOv8-AgriPest v1.4-Edge')
            );
        END LOOP;
    END IF;

    v_avg_conf := CASE WHEN v_det_count > 0 THEN ROUND(v_conf_sum / v_det_count, 4) ELSE 0.0 END;

    -- 6. Update capture_sessions to 'completed'
    UPDATE public.capture_sessions
    SET processing_status = 'completed',
        model_version = COALESCE(p_model_version, 'YOLOv8-AgriPest v1.4-Edge'),
        total_pests = v_det_count,
        target_pests_count = v_target_count,
        other_insects_count = v_other_count,
        avg_confidence = v_avg_conf,
        updated_at = NOW()
    WHERE id = p_session_id;

    -- 7. Calculate Nightly Cumulative Target Pests
    SELECT cumulative_target_pests INTO v_cum_target
    FROM public.get_nightly_cumulative_pests(p_device_id, v_session.captured_at);

    v_threshold_exceeded := (v_cum_target >= v_threshold);

    -- 8. Insert alert if threshold is exceeded
    IF v_threshold_exceeded THEN
        INSERT INTO public.device_alerts (
            device_id,
            alert_type,
            severity,
            title,
            message,
            status,
            metadata
        ) VALUES (
            p_device_id,
            'pest_threshold',
            'critical',
            'Ambang Batas Hama Terlampaui (' || v_cum_target || ' ekor/malam)',
            'Tangkapan hama sasaran pada ' || v_device.device_name || ' akumulasi malam ini (' || v_cum_target || ' ekor) telah melewati batas kendali PHT (' || v_threshold || ' ekor/malam).',
            'triggered',
            jsonb_build_object(
                'session_id', p_session_id,
                'session_target_count', v_target_count,
                'cumulative_target_count', v_cum_target,
                'threshold', v_threshold,
                'evaluated_at', NOW()
            )
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'session_id', p_session_id,
        'device_id', p_device_id,
        'already_processed', false,
        'total_detections', v_det_count,
        'target_pests', v_target_count,
        'other_insects', v_other_count,
        'avg_confidence', v_avg_conf,
        'cumulative_target_pests', v_cum_target,
        'threshold', v_threshold,
        'threshold_exceeded', v_threshold_exceeded
    );
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Grant permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.get_operational_night_bounds(TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_nightly_cumulative_pests(UUID, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.process_capture_session_detections(UUID, UUID, VARCHAR, JSONB) TO authenticated, service_role;


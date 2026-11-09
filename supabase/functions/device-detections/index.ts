import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';
import { notifyTelegram } from '../_shared/telegramNotifier.ts';

/**
 * Calculates start and end of the active 12-hour light trap night (18:00 - 06:00 WIB).
 * Timezone: Asia/Jakarta (UTC+7).
 */
function getActiveNightCycle(targetTime: Date = new Date()): { nightStart: Date; nightEnd: Date; nightDateStr: string } {
  // Convert UTC time to WIB (UTC + 7 hours in ms)
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibDate = new Date(targetTime.getTime() + wibOffsetMs);

  const year = wibDate.getUTCFullYear();
  const month = wibDate.getUTCMonth();
  const day = wibDate.getUTCDate();
  const hour = wibDate.getUTCHours();

  let refYear = year;
  let refMonth = month;
  let refDay = day;

  if (hour < 6) {
    // Current time is past midnight (00:00 - 05:59 WIB), belongs to previous evening's night cycle
    const prevDay = new Date(Date.UTC(year, month, day - 1));
    refYear = prevDay.getUTCFullYear();
    refMonth = prevDay.getUTCMonth();
    refDay = prevDay.getUTCDate();
  }

  // 18:00 WIB = 11:00 UTC of reference day
  const nightStart = new Date(Date.UTC(refYear, refMonth, refDay, 11, 0, 0, 0));
  // 06:00 WIB next day = 23:00 UTC of reference day
  const nightEnd = new Date(Date.UTC(refYear, refMonth, refDay, 23, 0, 0, 0));

  const pad = (n: number) => String(n).padStart(2, '0');
  const nightDateStr = `${refYear}-${pad(refMonth + 1)}-${pad(refDay)}`;

  return { nightStart, nightEnd, nightDateStr };
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const device = await verifyDeviceAuth(req);
    const body = await req.json().catch(() => ({}));
    const supabase = getAdminClient();

    const sessionId = body.session_id;
    if (!sessionId) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const detectionsList: any[] = body.detections || [];
    const modelVersion = body.model_version || 'YOLOv8-AgriPest v1.4-Edge';

    // -------------------------------------------------------------------------
    // 1. Try atomic PostgreSQL RPC 'process_capture_session_detections'
    // -------------------------------------------------------------------------
    let result: any = null;
    let rpcAttempted = false;

    try {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('process_capture_session_detections', {
        p_session_id: sessionId,
        p_device_id: device.id,
        p_model_version: modelVersion,
        p_detections: detectionsList,
      });

      if (!rpcErr && rpcData) {
        result = rpcData;
        rpcAttempted = true;
      }
    } catch (_rpcCallErr) {
      // Fall back to TypeScript implementation if RPC is not yet migrated in DB
      rpcAttempted = false;
    }

    // -------------------------------------------------------------------------
    // 2. TypeScript-level Idempotency & Validation Fallback
    // -------------------------------------------------------------------------
    if (!result) {
      // Verify session existence and device ownership
      const { data: session, error: sesErr } = await supabase
        .from('capture_sessions')
        .select('id, device_id, processing_status, total_pests, target_pests_count, other_insects_count, avg_confidence, captured_at')
        .eq('id', sessionId)
        .single();

      if (sesErr || !session) {
        return new Response(JSON.stringify({ error: `Capture session not found: ${sessionId}` }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (session.device_id !== device.id) {
        return new Response(JSON.stringify({ error: 'Forbidden: Session does not belong to this device.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // IDEMPOTENCY CHECK: If session is already completed or verified, return existing stats without duplicate insertion
      if (session.processing_status === 'completed' || session.processing_status === 'verified') {
        return new Response(
          JSON.stringify({
            success: true,
            session_id: sessionId,
            device_id: device.id,
            already_processed: true,
            total_detections: session.total_pests,
            target_pests: session.target_pests_count,
            other_insects: session.other_insects_count,
            avg_confidence: session.avg_confidence,
            message: 'Session detections previously finalized. Duplicate insertion prevented.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Delete any stale/partial detections for this session before inserting
      await supabase.from('insect_detections').delete().eq('capture_session_id', sessionId);

      const VALID_DB_SPECIES = [
        'scirpophaga_incertulas',
        'nilaparvata_lugens',
        'spodoptera_frugiperda',
        'leptocorisa_oratoria',
        'cnaphalocrocis_medinalis',
        'other_neutral',
      ];

      let targetCount = 0;
      let otherCount = 0;
      let confidenceSum = 0;

      const rowsToInsert = detectionsList.map((det) => {
        let spCode = String(det.species_code || 'other_neutral');
        // Foreign Key safety: Fallback unmapped codes to 'other_neutral'
        if (!VALID_DB_SPECIES.includes(spCode)) {
          spCode = 'other_neutral';
        }

        const isTarget = spCode !== 'other_neutral';
        if (isTarget) targetCount++;
        else otherCount++;

        const rawConf = Number(det.confidence ?? det.confidence_score) || 0.9;
        const conf = Math.max(0.0, Math.min(1.0, rawConf));
        confidenceSum += conf;

        const rawBbox = det.bbox || {};
        const clampedBbox = {
          x: Math.max(0, Math.min(100, Number(rawBbox.x) || 20)),
          y: Math.max(0, Math.min(100, Number(rawBbox.y) || 20)),
          width: Math.max(0, Math.min(100, Number(rawBbox.width) || 10)),
          height: Math.max(0, Math.min(100, Number(rawBbox.height) || 10)),
        };

        return {
          capture_session_id: sessionId,
          device_id: device.id,
          species_code: spCode,
          species_name: String(det.species_name || spCode),
          classification: isTarget ? 'target_pest' : 'neutral_insect',
          count: Number(det.count) || 1,
          confidence_score: conf,
          bounding_box: clampedBbox,
          verification_status: 'ai_detected',
          model_version: modelVersion,
        };
      });

      if (rowsToInsert.length > 0) {
        const { error: insErr } = await supabase.from('insect_detections').insert(rowsToInsert);
        if (insErr) throw insErr;
      }

      const avgConfidence = detectionsList.length > 0 ? Number((confidenceSum / detectionsList.length).toFixed(4)) : 0.0;

      // Finalize session
      await supabase
        .from('capture_sessions')
        .update({
          processing_status: 'completed',
          model_version: modelVersion,
          total_pests: rowsToInsert.length,
          target_pests_count: targetCount,
          other_insects_count: otherCount,
          avg_confidence: avgConfidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      // Calculate cumulative target pests for the active night cycle (Asia/Jakarta)
      const { nightStart, nightEnd, nightDateStr } = getActiveNightCycle(new Date(session.captured_at || Date.now()));

      const { data: nightlySessions } = await supabase
        .from('capture_sessions')
        .select('target_pests_count')
        .eq('device_id', device.id)
        .gte('captured_at', nightStart.toISOString())
        .lt('captured_at', nightEnd.toISOString())
        .in('processing_status', ['completed', 'verified']);

      const cumulativeTargetPests = (nightlySessions || []).reduce(
        (acc: number, s: any) => acc + (Number(s.target_pests_count) || 0),
        0
      );

      const threshold = Number(device.pest_threshold_per_night) || 50;
      const thresholdExceeded = cumulativeTargetPests >= threshold;

      if (thresholdExceeded) {
        await supabase.from('device_alerts').insert({
          device_id: device.id,
          alert_type: 'pest_threshold',
          severity: 'critical',
          title: `Ambang Batas Hama Terlampaui (${cumulativeTargetPests} ekor/malam)`,
          message: `Tangkapan hama sasaran pada ${device.device_name} akumulasi malam ini (${cumulativeTargetPests} ekor) telah melewati ambang kendali PHT (${threshold} ekor/malam).`,
          status: 'triggered',
          metadata: {
            session_id: sessionId,
            session_target_count: targetCount,
            cumulative_target_count: cumulativeTargetPests,
            threshold: threshold,
            night_date: nightDateStr,
          },
        });
      }

      result = {
        success: true,
        session_id: sessionId,
        device_id: device.id,
        already_processed: false,
        total_detections: rowsToInsert.length,
        target_pests: targetCount,
        other_insects: otherCount,
        avg_confidence: avgConfidence,
        cumulative_target_pests: cumulativeTargetPests,
        threshold: threshold,
        threshold_exceeded: thresholdExceeded,
        night_date: nightDateStr,
      };
    }

    // -------------------------------------------------------------------------
    // 3. Telegram Notification Dispatch with Deduplication
    // -------------------------------------------------------------------------
    if (result.threshold_exceeded && !result.already_processed) {
      try {
        const thresholdLimit = Number(result.threshold) || 50;
        const cumTarget = Number(result.cumulative_target_pests) || Number(result.target_pests) || 0;
        const nightKey = result.night_date || new Date().toISOString().substring(0, 10);
        // Tiered deduplication: One alert per tier (Tier 1: 50+, Tier 2: 100+, Tier 3: 150+)
        const tier = Math.max(1, Math.floor(cumTarget / thresholdLimit));
        const deduplicationKey = `pest_thresh_${device.device_code}_${nightKey}_tier${tier}`;

        // Top pest name from request
        const topPestName = detectionsList.find(
          (d) => d.species_code && d.species_code !== 'other_neutral'
        )?.species_name || 'Hama Sasaran PHT';

        // Non-blocking dispatch to telegram-notify
        notifyTelegram({
          event_type: 'PEST_THRESHOLD',
          event_key: deduplicationKey,
          device_id: device.id,
          device_code: device.device_code,
          target_count: cumTarget,
          threshold: thresholdLimit,
          dominant_pest: topPestName,
          session_id: sessionId,
          timestamp: new Date().toISOString(),
        }).catch((err) => {
          console.warn('[device-detections] Non-blocking Telegram dispatch error:', err?.message || err);
        });
      } catch (tgErr: any) {
        console.warn('[device-detections] Failed to initiate Telegram notification:', tgErr?.message || tgErr);
      }
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    if (error instanceof Response) return error;

    console.error('[device-detections] Unhandled error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

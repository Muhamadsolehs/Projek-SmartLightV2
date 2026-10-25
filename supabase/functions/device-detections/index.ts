import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { getAdminClient } from '../_shared/supabaseClient.ts';
import { verifyDeviceAuth } from '../_shared/auth.ts';

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
    const body = await req.json();
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

    let targetCount = 0;
    let otherCount = 0;
    let confidenceSum = 0;

    const rowsToInsert = detectionsList.map((det) => {
      const isTarget = det.species_code !== 'other_neutral' && det.species_code !== 'unidentified';
      if (isTarget) targetCount++;
      else otherCount++;

      const conf = Number(det.confidence) || 0.9;
      confidenceSum += conf;

      return {
        capture_session_id: sessionId,
        device_id: device.id,
        species_code: det.species_code || 'unidentified',
        species_name: det.species_name || det.species_code || 'Hama Padi',
        classification: isTarget ? 'target_pest' : 'neutral_insect',
        count: Number(det.count) || 1,
        confidence_score: conf,
        bounding_box: det.bbox || { x: 20, y: 20, width: 10, height: 10 },
        verification_status: 'ai_detected',
        model_version: modelVersion,
      };
    });

    if (rowsToInsert.length > 0) {
      const { error: insErr } = await supabase.from('insect_detections').insert(rowsToInsert);
      if (insErr) throw insErr;
    }

    const avgConfidence = detectionsList.length > 0 ? confidenceSum / detectionsList.length : 0.95;

    // Update capture_sessions aggregate
    await supabase
      .from('capture_sessions')
      .update({
        processing_status: 'completed',
        model_version: modelVersion,
        total_pests: rowsToInsert.length,
        target_pests_count: targetCount,
        other_insects_count: otherCount,
        avg_confidence: avgConfidence,
      })
      .eq('id', sessionId);

    // Evaluate Economic Pest Threshold for Subang PHT
    if (targetCount >= device.pest_threshold_per_night) {
      await supabase.from('device_alerts').insert({
        device_id: device.id,
        alert_type: 'pest_threshold',
        severity: 'critical',
        title: `Ambang Batas Hama Terlampaui (${targetCount} ekor/malam)`,
        message: `Tangkapan hama sasaran pada ${device.device_name} (${targetCount} ekor) telah melewati ambang kendali PHT (${device.pest_threshold_per_night} ekor/malam). Rekomendasi tindakan agronomis aktif.`,
        status: 'triggered',
        metadata: {
          session_id: sessionId,
          target_count: targetCount,
          threshold: device.pest_threshold_per_night,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        session_id: sessionId,
        total_detections: rowsToInsert.length,
        target_pests: targetCount,
        other_insects: otherCount,
        threshold_exceeded: targetCount >= device.pest_threshold_per_night,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

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
    const contentType = req.headers.get('content-type') || '';
    const supabase = getAdminClient();

    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const timestampStr = date.toISOString().replace(/[:.]/g, '-');

    if (contentType.includes('application/json')) {
      // 1. Pre-signed upload URL request for direct ESP32 PUT streaming
      const body = await req.json();
      const filename = body.filename || `cap_${device.device_code}_${timestampStr}.jpg`;
      const storagePath = `devices/${device.device_code}/${year}/${month}/${filename}`;

      // Create capture session
      const { data: session, error: sesErr } = await supabase
        .from('capture_sessions')
        .insert({
          device_id: device.id,
          session_code: `ses_${timestampStr}`,
          processing_status: 'pending',
          model_version: body.model_version || 'YOLOv8-AgriPest v1.4-Edge',
        })
        .select()
        .single();

      if (sesErr) throw sesErr;

      // Register device_image metadata
      const { data: imgMeta, error: imgErr } = await supabase
        .from('device_images')
        .insert({
          device_id: device.id,
          capture_session_id: session.id,
          storage_path: storagePath,
          image_width: body.width || 1920,
          image_height: body.height || 1080,
          content_type: 'image/jpeg',
          file_size: body.file_size || null,
        })
        .select()
        .single();

      if (imgErr) throw imgErr;

      // Create signed upload URL in private bucket
      const { data: signedUpload, error: signErr } = await supabase.storage
        .from('device-images')
        .createSignedUploadUrl(storagePath);

      if (signErr) throw signErr;

      return new Response(
        JSON.stringify({
          success: true,
          session_id: session.id,
          image_id: imgMeta.id,
          storage_path: storagePath,
          upload_url: signedUpload.signedUrl,
          token: signedUpload.token,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else if (contentType.includes('multipart/form-data')) {
      // 2. Direct Multipart Upload
      const formData = await req.formData();
      const file = formData.get('file') as File;
      if (!file) {
        return new Response(JSON.stringify({ error: 'File is required in form-data' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const filename = file.name || `photo_${timestampStr}.jpg`;
      const storagePath = `devices/${device.device_code}/${year}/${month}/${filename}`;

      // Upload file to private bucket
      const { error: uploadErr } = await supabase.storage
        .from('device-images')
        .upload(storagePath, file, { contentType: 'image/jpeg', upsert: true });

      if (uploadErr) throw uploadErr;

      // Create session & image record
      const { data: session } = await supabase
        .from('capture_sessions')
        .insert({
          device_id: device.id,
          session_code: `ses_${timestampStr}`,
          processing_status: 'pending',
        })
        .select()
        .single();

      await supabase.from('device_images').insert({
        device_id: device.id,
        capture_session_id: session?.id || null,
        storage_path: storagePath,
        content_type: 'image/jpeg',
        file_size: file.size,
      });

      return new Response(
        JSON.stringify({
          success: true,
          session_id: session?.id,
          storage_path: storagePath,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported Content-Type. Use application/json or multipart/form-data' }),
        { status: 415, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    if (error instanceof Response) return error;

    return new Response(
      JSON.stringify({ error: error?.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { InsectSpecies, CaptureImage, InsectSpeciesId, BoundingBox } from '../types';
import { INSECT_SPECIES_LIST, MOCK_CAPTURES, MOCK_DAILY_TRENDS, DailyPestTrend } from '../data/mockData';
import { storageService } from './storageService';

export const pestService = {
  async getInsectSpecies(): Promise<InsectSpecies[]> {
    if (!isSupabaseConfigured) return INSECT_SPECIES_LIST;

    try {
      const { data, error } = await supabase
        .from('insect_species')
        .select('*')
        .order('is_target_pest', { ascending: false });

      if (error || !data || data.length === 0) return INSECT_SPECIES_LIST;

      return data.map((item: any) => ({
        id: item.id as InsectSpeciesId,
        commonName: item.common_name,
        scientificName: item.scientific_name,
        family: item.family,
        isTargetPest: item.is_target_pest,
        economicThresholdPerNight: item.economic_threshold_per_night,
        riskLevel: item.risk_level,
        preferredWavelengthNm: item.preferred_wavelength_nm,
        description: item.description || '',
      }));
    } catch {
      return INSECT_SPECIES_LIST;
    }
  },

  async getCaptureSessions(deviceId?: string): Promise<CaptureImage[]> {
    if (!isSupabaseConfigured) return MOCK_CAPTURES;

    try {
      let query = supabase
        .from('capture_sessions')
        .select(`
          id,
          device_id,
          captured_at,
          total_pests,
          target_pests_count,
          other_insects_count,
          avg_confidence,
          model_version,
          is_manually_verified,
          notes,
          device_images ( storage_path, image_width, image_height ),
          insect_detections (
            id,
            species_code,
            confidence_score,
            bounding_box,
            verification_status,
            verified_by,
            verified_at
          )
        `)
        .order('captured_at', { ascending: false })
        .limit(20);

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching capture sessions from Supabase:', error.message);
        throw new Error(`Gagal memuat sesi tangkapan citra: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      const sessionsWithImages: CaptureImage[] = await Promise.all(
        data.map(async (row: any) => {
          let signedUrl = '';
          const firstImage = row.device_images?.[0];
          if (firstImage?.storage_path) {
            signedUrl = await storageService.getSignedImageUrl(firstImage.storage_path);
          }

          const bboxes: BoundingBox[] = (row.insect_detections || []).map((det: any) => ({
            id: det.id,
            speciesId: det.species_code as InsectSpeciesId,
            confidence: Number(det.confidence_score),
            x: det.bounding_box?.x || 20,
            y: det.bounding_box?.y || 20,
            width: det.bounding_box?.width || 10,
            height: det.bounding_box?.height || 10,
            isManuallyVerified: det.verification_status !== 'ai_detected',
            verifiedBy: det.verified_by,
            verifiedAt: det.verified_at,
          }));

          return {
            id: row.id,
            deviceId: row.device_id,
            timestamp: row.captured_at,
            imageUrl: signedUrl,
            resolution: `${firstImage?.image_width || 1920}x${firstImage?.image_height || 1080} (OV5640 Sensor)`,
            totalPests: row.total_pests || bboxes.length,
            targetPestsCount: row.target_pests_count || bboxes.filter((b) => b.speciesId !== 'other_neutral').length,
            otherInsectsCount: row.other_insects_count || bboxes.filter((b) => b.speciesId === 'other_neutral').length,
            avgConfidence: Number(row.avg_confidence) || 0.94,
            modelVersion: row.model_version || 'YOLOv8-AgriPest v1.4-Edge',
            isManuallyVerified: row.is_manually_verified || false,
            bboxes,
            notes: row.notes || undefined,
          };
        })
      );

      return sessionsWithImages;
    } catch (err: any) {
      console.error('pestService.getCaptureSessions error:', err);
      throw err;
    }
  },

  async updateDetectionVerification(
    detectionId: string,
    newSpeciesId: InsectSpeciesId,
    operatorName: string
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return true;

    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('insect_detections')
        .update({
          species_code: newSpeciesId,
          verification_status: 'human_corrected',
          verified_by: user.user?.id || null,
          verified_at: new Date().toISOString(),
        })
        .eq('id', detectionId);

      return !error;
    } catch {
      return false;
    }
  },

  /**
   * Mengambil tren harian hama secara agregat dari tabel capture_sessions dan insect_detections.
   */
  async getDailyPestTrends(deviceId?: string, days: number = 14): Promise<DailyPestTrend[]> {
    if (!isSupabaseConfigured) {
      return MOCK_DAILY_TRENDS.slice(-days);
    }

    try {
      const sinceDate = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

      let query = supabase
        .from('capture_sessions')
        .select(`
          id,
          captured_at,
          device_id,
          total_pests,
          target_pests_count,
          other_insects_count,
          insect_detections (
            species_code,
            count
          )
        `)
        .gte('captured_at', sinceDate)
        .order('captured_at', { ascending: true });

      if (deviceId && deviceId !== 'all') {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Error fetching pest trends from Supabase:', error.message);
        throw new Error(`Gagal memuat tren hama: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Group by date (YYYY-MM-DD)
      const dayMap = new Map<string, DailyPestTrend>();

      data.forEach((session: any) => {
        const dObj = new Date(session.captured_at);
        const dateStr = dObj.toISOString().split('T')[0];
        const dayLabel = dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

        if (!dayMap.has(dateStr)) {
          dayMap.set(dateStr, {
            date: dateStr,
            dayLabel,
            stemBorer: 0,
            planthopper: 0,
            armyworm: 0,
            riceBug: 0,
            leafFolder: 0,
            otherInsects: 0,
            totalTarget: 0,
            totalAll: 0,
            thresholdAlert: false,
          });
        }

        const entry = dayMap.get(dateStr)!;

        (session.insect_detections || []).forEach((det: any) => {
          const count = det.count || 1;
          if (det.species_code === 'scirpophaga_incertulas') {
            entry.stemBorer += count;
          } else if (det.species_code === 'nilaparvata_lugens') {
            entry.planthopper += count;
          } else if (det.species_code === 'spodoptera_frugiperda') {
            entry.armyworm += count;
          } else if (det.species_code === 'leptocorisa_oratoria') {
            entry.riceBug += count;
          } else if (det.species_code === 'cnaphalocrocis_medinalis') {
            entry.leafFolder += count;
          } else {
            entry.otherInsects += count;
          }
        });

        entry.totalTarget =
          entry.stemBorer + entry.planthopper + entry.armyworm + entry.riceBug + entry.leafFolder;
        entry.totalAll = entry.totalTarget + entry.otherInsects;
        if (entry.totalTarget >= 50) {
          entry.thresholdAlert = true;
        }
      });

      return Array.from(dayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    } catch (err: any) {
      console.error('pestService.getDailyPestTrends error:', err);
      throw err;
    }
  },
};

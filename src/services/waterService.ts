import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { WaterChangeLog } from '../types';
import { MOCK_WATER_LOGS } from '../data/mockData';

export const waterService = {
  async getWaterLogs(deviceId?: string): Promise<WaterChangeLog[]> {
    if (!isSupabaseConfigured) {
      return deviceId ? MOCK_WATER_LOGS.filter((l) => l.deviceId === deviceId) : MOCK_WATER_LOGS;
    }

    try {
      let query = supabase
        .from('water_change_logs')
        .select('*')
        .order('started_at', { ascending: false });

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching water logs from Supabase:', error.message);
        throw new Error(`Gagal memuat log air: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        deviceId: item.device_id,
        startedAt: item.started_at,
        completedAt: item.completed_at || item.started_at,
        triggerReason: item.trigger_reason,
        initialTurbidityNtu: Number(item.initial_turbidity_ntu) || 100,
        finalTurbidityNtu: Number(item.final_turbidity_ntu) || 30,
        waterUsedLiters: Number(item.water_used_liters) || 5.0,
        status: item.status,
      }));
    } catch (err: any) {
      console.error('waterService.getWaterLogs error:', err);
      throw err;
    }
  },

  async recordWaterChange(log: Omit<WaterChangeLog, 'id'>): Promise<WaterChangeLog | null> {
    if (!isSupabaseConfigured) {
      const newLog: WaterChangeLog = {
        id: `wlog_${Date.now()}`,
        ...log,
      };
      return newLog;
    }

    try {
      const { data, error } = await supabase
        .from('water_change_logs')
        .insert({
          device_id: log.deviceId,
          started_at: log.startedAt,
          completed_at: log.completedAt,
          trigger_reason: log.triggerReason,
          initial_turbidity_ntu: log.initialTurbidityNtu,
          final_turbidity_ntu: log.finalTurbidityNtu,
          water_used_liters: log.waterUsedLiters,
          status: log.status,
        })
        .select()
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        deviceId: data.device_id,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        triggerReason: data.trigger_reason,
        initialTurbidityNtu: Number(data.initial_turbidity_ntu),
        finalTurbidityNtu: Number(data.final_turbidity_ntu),
        waterUsedLiters: Number(data.water_used_liters),
        status: data.status,
      };
    } catch {
      return null;
    }
  },
};

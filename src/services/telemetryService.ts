import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface TelemetryHistoryRecord {
  id: string;
  deviceId: string;
  timestamp: string;
  timeLabel: string;
  busVoltageV: number;
  shuntVoltageMv: number;
  currentMa: number;
  powerMw: number;
  isCharging: boolean;
  trayLevelPercent: number;
  tankLevelPercent: number;
  turbidityNtu: number;
  isTurbid: boolean;
  temperatureC: number;
  humidityPercent: number;
}

export const telemetryService = {
  /**
   * Mengambil riwayat telemetri dari tabel device_telemetry dalam N jam terakhir.
   * Mengembalikan data riil tanpa mengarang data palsu jika kosong.
   */
  async getTelemetryHistory(
    deviceId: string,
    hours: number = 24
  ): Promise<TelemetryHistoryRecord[]> {
    if (!isSupabaseConfigured || !deviceId) {
      return [];
    }

    try {
      const sinceTime = new Date(Date.now() - hours * 3600 * 1000).toISOString();

      const { data, error } = await supabase
        .from('device_telemetry')
        .select('*')
        .eq('device_id', deviceId)
        .gte('recorded_at', sinceTime)
        .order('recorded_at', { ascending: true })
        .limit(100);

      if (error) {
        console.error('Error fetching telemetry history:', error.message);
        throw new Error(`Gagal mengambil data telemetri: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((row: any) => {
        const dateObj = new Date(row.recorded_at);
        const timeLabel = dateObj.toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        return {
          id: row.id,
          deviceId: row.device_id,
          timestamp: row.recorded_at,
          timeLabel,
          busVoltageV: Number(row.battery_voltage) || 0,
          shuntVoltageMv: Number(row.shunt_voltage_mv) || 0,
          currentMa: Number(row.battery_current) || 0,
          powerMw: Number(row.power_mw) || 0,
          isCharging: Boolean(row.is_charging),
          trayLevelPercent: Number(row.tray_level) || 0,
          tankLevelPercent: Number(row.tank_level) || 0,
          turbidityNtu: Number(row.turbidity) || 0,
          isTurbid: Boolean(row.is_turbid),
          temperatureC: Number(row.temperature) || 0,
          humidityPercent: Number(row.humidity) || 0,
        };
      });
    } catch (err: any) {
      console.error('telemetryService.getTelemetryHistory error:', err);
      throw err;
    }
  },
};

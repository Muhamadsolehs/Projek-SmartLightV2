import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { DeviceAlert } from '../types';
import { INITIAL_ALERTS } from '../data/mockData';

export const alertService = {
  async getAlerts(): Promise<DeviceAlert[]> {
    if (!isSupabaseConfigured) return INITIAL_ALERTS;

    try {
      const { data, error } = await supabase
        .from('device_alerts')
        .select(`
          id,
          device_id,
          alert_type,
          severity,
          title,
          message,
          status,
          triggered_at,
          acknowledged_at,
          acknowledged_by_name,
          action_taken,
          devices ( device_name, farm_sector )
        `)
        .order('triggered_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts from Supabase:', error.message);
        throw new Error(`Gagal memuat peringatan: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map((item: any) => ({
        id: item.id,
        deviceId: item.device_id,
        deviceName: item.devices?.device_name || 'Smart Light Trap Unit',
        location: item.devices?.farm_sector || 'Subang, Jawa Barat',
        severity: item.severity,
        category: item.alert_type,
        title: item.title,
        message: item.message,
        timestamp: item.triggered_at,
        isAcknowledged: item.status !== 'triggered',
        acknowledgedBy: item.acknowledged_by_name,
        actionTaken: item.action_taken,
      }));
    } catch (err: any) {
      console.error('alertService.getAlerts error:', err);
      throw err;
    }
  },

  async acknowledgeAlert(alertId: string, operatorName: string): Promise<boolean> {
    if (!isSupabaseConfigured) return true;

    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('device_alerts')
        .update({
          status: 'acknowledged',
          acknowledged_at: new Date().toISOString(),
          acknowledged_by: user.user?.id || null,
          acknowledged_by_name: operatorName,
          action_taken: 'Ditinjau dan dikonfirmasi melalui dashboard web',
        })
        .eq('id', alertId);

      return !error;
    } catch {
      return false;
    }
  },

  subscribeToAlerts(onUpdate: (payload: any) => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('realtime_alerts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'device_alerts' },
        (payload) => onUpdate(payload)
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};

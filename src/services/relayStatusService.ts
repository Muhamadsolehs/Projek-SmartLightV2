import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

export interface RelayStatusRecord {
  id: number;
  device_code: string;
  channel_1: boolean;
  channel_2: boolean;
  channel_3: boolean;
  channel_4: boolean;
  updated_at?: string;
  [key: string]: any;
}

export const relayStatusService = {
  /**
   * Mengambil URL REST API endpoint spesifik tabel relay_status
   */
  getRestUrl(id = 1): string {
    const base = supabaseUrl || 'https://xzzjfwstrpayhnpymqpq.supabase.co';
    return `${base}/rest/v1/relay_status?id=eq.${id}`;
  },

  /**
   * Mengambil status seluruh channel relay dari Supabase (id = 1)
   */
  async getRelayStatus(id = 1): Promise<RelayStatusRecord | null> {
    if (!isSupabaseConfigured) return null;

    try {
      const { data, error } = await supabase
        .from('relay_status')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          device_code: data.device_code || 'SLT-SBG-01',
          channel_1: Boolean(data.channel_1),
          channel_2: Boolean(data.channel_2),
          channel_3: Boolean(data.channel_3),
          channel_4: Boolean(data.channel_4),
          updated_at: data.updated_at,
        };
      }

      // Fallback via HTTP REST API
      return await this.fetchViaRest(id);
    } catch {
      return await this.fetchViaRest(id);
    }
  },

  /**
   * Fallback pengambilan data langsung via HTTP REST API Supabase
   */
  async fetchViaRest(id = 1): Promise<RelayStatusRecord | null> {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    try {
      const endpoint = this.getRestUrl(id);
      const res = await fetch(endpoint, {
        headers: {
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
      });
      if (!res.ok) return null;
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const item = json[0];
        return {
          id: item.id,
          device_code: item.device_code || 'SLT-SBG-01',
          channel_1: Boolean(item.channel_1),
          channel_2: Boolean(item.channel_2),
          channel_3: Boolean(item.channel_3),
          channel_4: Boolean(item.channel_4),
          updated_at: item.updated_at,
        };
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Mengubah status channel tertentu (1=Pompa, 2=Solenoid, 3=LED UV, 4=Aux/Kipas)
   * Menulis boolean true (ON) atau false (OFF) ke kolom channel_X pada tabel relay_status
   */
  async updateChannel(
    channel: 1 | 2 | 3 | 4,
    status: boolean,
    id = 1
  ): Promise<{ success: boolean; data?: RelayStatusRecord; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Klien Supabase belum terkonfigurasi pada .env' };
    }

    const columnName = `channel_${channel}`;
    const payload = {
      [columnName]: status,
      updated_at: new Date().toISOString(),
    };

    try {
      // 1. Coba update via Supabase JS Client
      const { data, error } = await supabase
        .from('relay_status')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        return {
          success: true,
          data: {
            id: data.id,
            device_code: data.device_code || 'SLT-SBG-01',
            channel_1: Boolean(data.channel_1),
            channel_2: Boolean(data.channel_2),
            channel_3: Boolean(data.channel_3),
            channel_4: Boolean(data.channel_4),
            updated_at: data.updated_at,
          },
        };
      }

      // 2. Fallback update via Direct HTTP PATCH REST API
      const patchRes = await fetch(this.getRestUrl(id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(payload),
      });

      if (patchRes.ok) {
        const patchData = await patchRes.json();
        const item = Array.isArray(patchData) && patchData.length > 0 ? patchData[0] : null;
        return {
          success: true,
          data: item
            ? {
                id: item.id,
                device_code: item.device_code,
                channel_1: Boolean(item.channel_1),
                channel_2: Boolean(item.channel_2),
                channel_3: Boolean(item.channel_3),
                channel_4: Boolean(item.channel_4),
                updated_at: item.updated_at,
              }
            : undefined,
        };
      }

      return {
        success: false,
        error: error?.message || `HTTP ${patchRes.status}: Gagal memperbarui status relay`,
      };
    } catch (err: any) {
      return { success: false, error: err.message || 'Gagal mengubah status relay' };
    }
  },

  /**
   * Mengubah status seluruh channel sekaligus (All ON / All OFF)
   */
  async setAllChannels(
    status: boolean,
    id = 1
  ): Promise<{ success: boolean; error?: string }> {
    if (!isSupabaseConfigured) {
      return { success: false, error: 'Klien Supabase belum terkonfigurasi' };
    }

    const payload = {
      channel_1: status,
      channel_2: status,
      channel_3: status,
      channel_4: status,
      updated_at: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('relay_status')
        .update(payload)
        .eq('id', id);

      if (!error) return { success: true };

      // Fallback REST PATCH
      const patchRes = await fetch(this.getRestUrl(id), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
          Authorization: `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify(payload),
      });

      return { success: patchRes.ok };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  /**
   * Realtime Listener untuk sinkronisasi seketika jika ada perubahan di tabel public.relay_status
   */
  subscribeToRelayStatus(callback: (record: RelayStatusRecord) => void) {
    if (!isSupabaseConfigured) return () => {};

    const channel = supabase
      .channel('public:relay_status')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'relay_status' },
        (payload) => {
          if (payload.new) {
            const item: any = payload.new;
            callback({
              id: item.id,
              device_code: item.device_code || 'SLT-SBG-01',
              channel_1: Boolean(item.channel_1),
              channel_2: Boolean(item.channel_2),
              channel_3: Boolean(item.channel_3),
              channel_4: Boolean(item.channel_4),
              updated_at: item.updated_at,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  },
};

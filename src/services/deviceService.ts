import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SmartLightTrapDevice, DeviceCommand, DeviceTelemetry, DeviceProvisioningCredentials } from '../types';
import { INITIAL_DEVICES, INITIAL_COMMANDS } from '../data/mockData';
import { relayStatusService } from './relayStatusService';

export interface ProvisionDeviceResult {
  device: SmartLightTrapDevice;
  credentials: DeviceProvisioningCredentials;
}

export const deviceService = {
  async getDevices(): Promise<SmartLightTrapDevice[]> {
    if (!isSupabaseConfigured) {
      return INITIAL_DEVICES;
    }

    try {
      const { data: devicesData, error: devErr } = await supabase
        .from('devices')
        .select('*')
        .order('device_code', { ascending: true });

      if (devErr) {
        console.warn(`Gagal memuat perangkat dari Supabase: ${devErr.message}. Menggunakan data cadangan.`);
        return INITIAL_DEVICES;
      }

      if (!devicesData || devicesData.length === 0) {
        return [];
      }

      // Fetch latest telemetry for each device
      const devicesWithTel: SmartLightTrapDevice[] = await Promise.all(
        devicesData.map(async (d: any) => {
          const { data: telData } = await supabase
            .from('device_telemetry')
            .select('*')
            .eq('device_id', d.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

          // Calculate connection status based on heartbeat (e.g. 10 minutes timeout)
          let calculatedStatus: SmartLightTrapDevice['status'] = d.connection_status;
          if (d.last_seen_at) {
            const lastSeenMs = new Date(d.last_seen_at).getTime();
            const nowMs = Date.now();
            const diffMinutes = (nowMs - lastSeenMs) / (1000 * 60);
            if (diffMinutes > 15) {
              calculatedStatus = 'offline';
            }
          }

          const defaultTelemetry: DeviceTelemetry = {
            id: telData?.id || `tel_${d.id}`,
            deviceId: d.id,
            timestamp: telData?.recorded_at || d.last_seen_at || new Date().toISOString(),
            sequenceNumber: telData?.sequence_number || 1,
            battery: {
              busVoltageV: telData?.battery_voltage || 12.8,
              shuntVoltageMv: telData?.shunt_voltage_mv || -30.0,
              currentMa: telData?.battery_current || -850,
              powerMw: telData?.power_mw || 10880,
              isCharging: telData?.is_charging || false,
              solarIrradianceEstimateWm2: telData?.solar_irradiance_wm2 || 0,
            },
            water: {
              trayLevelPercent: telData?.tray_level || 80,
              trayLevelCm: telData?.tray_level_cm || 4.0,
              tankLevelPercent: telData?.tank_level || 75,
              tankVolumeLiters: telData?.tank_volume_liters || 37.5,
              turbidityNtu: telData?.turbidity || 35,
              isTurbid: telData?.is_turbid || false,
              drainValveStatus: telData?.drain_valve_status || 'closed',
              fillPumpStatus: telData?.fill_pump_status || 'idle',
              lastWaterChange: telData?.last_water_change || new Date().toISOString(),
              safetyLockout: telData?.safety_lockout || false,
            },
            lamp: {
              isActive: d.lamp_status || false,
              mode: telData?.lamp_mode || 'schedule_auto',
              scheduleStart: '18:00',
              scheduleEnd: '05:00',
              wavelengthNm: telData?.lamp_wavelength_nm || 365,
              ledCurrentMa: telData?.lamp_led_current_ma || (d.lamp_status ? 850 : 0),
              isHealthy: telData?.lamp_is_healthy ?? true,
            },
            connectivity: {
              networkType: telData?.network_type || '4G_LTE',
              rssiDbm: telData?.modem_signal_strength || -75,
              operator: telData?.operator || 'Telkomsel IoT SIM',
              unsyncedMicroSdPackets: telData?.unsynced_microsd_packets || 0,
            },
            temperatureC: telData?.temperature || 26.0,
            humidityPercent: telData?.humidity || 85,
          };

          return {
            id: d.id,
            code: d.device_code,
            name: d.device_name,
            locationName: d.location_name,
            farmSector: d.farm_sector,
            latitude: Number(d.latitude),
            longitude: Number(d.longitude),
            cropType: d.crop_type,
            plantingDate: d.planting_date || '',
            status: calculatedStatus,
            firmwareVersion: d.firmware_version,
            esp32ChipId: d.esp32_chip_id || '',
            rtcStatus: 'synced_ds3231',
            currentTelemetry: defaultTelemetry,
            batteryCutoffThresholdV: Number(d.battery_cutoff_threshold_v),
            pestThresholdPerNight: d.pest_threshold_per_night,
            lastSyncAt: d.last_seen_at || new Date().toISOString(),
            isSimulated: d.is_simulated || false,
          };
        })
      );

      return devicesWithTel;
    } catch (err: any) {
      console.error('Error fetching devices from Supabase:', err);
      throw err;
    }
  },

  async getCommands(deviceId?: string): Promise<DeviceCommand[]> {
    if (!isSupabaseConfigured) {
      return deviceId ? INITIAL_COMMANDS.filter((c) => c.deviceId === deviceId) : INITIAL_COMMANDS;
    }

    try {
      let query = supabase
        .from('device_commands')
        .select('*')
        .order('created_at', { ascending: false });

      if (deviceId) {
        query = query.eq('device_id', deviceId);
      }

      const { data, error } = await query;
      if (error || !data) return INITIAL_COMMANDS;

      return data.map((cmd: any) => ({
        id: cmd.id,
        deviceId: cmd.device_id,
        commandType: cmd.command_type,
        parameters: cmd.parameters,
        status: cmd.status,
        createdAt: cmd.created_at,
        executedAt: cmd.completed_at || cmd.acknowledged_at,
        responseMessage: cmd.result?.message || cmd.error_message,
      }));
    } catch {
      return INITIAL_COMMANDS;
    }
  },

  async sendCommand(
    deviceId: string,
    commandType: DeviceCommand['commandType'],
    parameters?: Record<string, any>
  ): Promise<DeviceCommand> {
    if (!isSupabaseConfigured) {
      // Local simulation
      const newCmd: DeviceCommand = {
        id: `cmd_${Date.now()}`,
        deviceId,
        commandType,
        parameters,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        responseMessage: 'Perintah berhasil dieksekusi secara lokal (Demo Mode).',
      };
      return newCmd;
    }

    try {
      // Sinkronisasi status ke tabel relay_status jika perintah bertipe SET_RELAY
      if (commandType === 'SET_RELAY' && parameters?.relay) {
        relayStatusService.updateChannel(Number(parameters.relay) as 1 | 2 | 3 | 4, String(parameters.state).toUpperCase() === 'ON', 1).catch(() => {});
      }

      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('device_commands')
        .insert({
          device_id: deviceId,
          command_type: commandType,
          parameters: parameters || {},
          status: 'pending',
          requested_by: user.user?.id || null,
        })
        .select()
        .single();

      if (error || !data) {
        // Fallback jika tabel device_commands belum dimigrasi di proyek Supabase baru,
        // namun perintah relay telah tersinkron ke tabel relay_status
        if (commandType === 'SET_RELAY') {
          return {
            id: `cmd_relay_${Date.now()}`,
            deviceId,
            commandType,
            parameters,
            status: 'COMPLETED',
            createdAt: new Date().toISOString(),
            executedAt: new Date().toISOString(),
            responseMessage: `Relay ${parameters?.relay} berhasil diubah ke ${parameters?.state} via relay_status (id=1).`,
          };
        }
        throw new Error(error?.message || 'Gagal mengirim perintah ke Supabase');
      }

      return {
        id: data.id,
        deviceId: data.device_id,
        commandType: data.command_type,
        parameters: data.parameters,
        status: data.status.toUpperCase() as any,
        createdAt: data.created_at,
      };
    } catch (err: any) {
      throw err;
    }
  },

  /**
   * Melacak siklus hidup perintah secara asynchronous hingga mendapatkan konfirmasi (ACK)
   * atau laporan eksekusi dari ESP32 di database Supabase.
   */
  async trackCommandStatus(commandId: string, timeoutMs: number = 16000): Promise<DeviceCommand> {
    if (!isSupabaseConfigured) {
      // Demo simulation
      return {
        id: commandId,
        deviceId: '',
        commandType: 'SET_RELAY',
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
        executedAt: new Date().toISOString(),
        responseMessage: 'Konfirmasi fisik simulasi selesai (Demo Mode).',
      };
    }

    const startTime = Date.now();
    const pollInterval = 1500; // Poll setiap 1.5 detik

    while (Date.now() - startTime < timeoutMs) {
      const { data, error } = await supabase
        .from('device_commands')
        .select('*')
        .eq('id', commandId)
        .single();

      if (!error && data) {
        const statusUpper = data.status.toUpperCase();
        if (statusUpper === 'COMPLETED' || statusUpper === 'FAILED' || statusUpper === 'EXPIRED') {
          return {
            id: data.id,
            deviceId: data.device_id,
            commandType: data.command_type,
            parameters: data.parameters,
            status: statusUpper as any,
            createdAt: data.created_at,
            executedAt: data.completed_at || data.acknowledged_at,
            responseMessage: data.result?.message || data.error_message || `Status: ${statusUpper}`,
          };
        }
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    // Timeout: status unconfirmed
    return {
      id: commandId,
      deviceId: '',
      commandType: 'SET_RELAY',
      status: 'SENT',
      createdAt: new Date(startTime).toISOString(),
      responseMessage: 'Menunggu polling konfirmasi dari ESP32 (Timeout). Perintah tetap berada di antrean antitesis.',
    };
  },

  /**
   * Mengirim perintah darurat 'OFF' ke seluruh 4 aktuator relay perangkat secara bertahap
   * dan mencatat laporan individu per aktuator.
   */
  async emergencyStopActuators(deviceId: string): Promise<{
    relay: number;
    name: string;
    success: boolean;
    message: string;
  }[]> {
    const ACTUATOR_NAMES: Record<number, string> = {
      1: 'Pompa Air Pengisi (Relay 1 - D1 / GPIO5)',
      2: 'Katup Solenoid Drain (Relay 2 - D2 / GPIO4)',
      3: 'Lampu LED UV 365nm (Relay 3 - D7 / GPIO13)',
      4: 'Kipas Blower / Aux (Relay 4 - D0 / GPIO16)',
    };

    const results: { relay: number; name: string; success: boolean; message: string }[] = [];

    for (let r = 1; r <= 4; r++) {
      try {
        const cmd = await this.sendCommand(deviceId, 'SET_RELAY', { relay: r, state: 'OFF' });
        results.push({
          relay: r,
          name: ACTUATOR_NAMES[r],
          success: true,
          message: `Perintah OFF terkirim (ID: ${cmd.id.slice(0, 8)}...)`,
        });
      } catch (err: any) {
        results.push({
          relay: r,
          name: ACTUATOR_NAMES[r],
          success: false,
          message: err?.message || 'Gagal mengirim perintah OFF',
        });
      }
    }

    return results;
  },

  async createDevice(deviceData: {
    code: string;
    name: string;
    locationName: string;
    farmSector: string;
    latitude: number;
    longitude: number;
    cropType: string;
    plantingDate?: string;
    firmwareVersion?: string;
    batteryCutoffThresholdV?: number;
    pestThresholdPerNight?: number;
  }): Promise<ProvisionDeviceResult> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase belum terkonfigurasi pada file .env.');
    }

    try {
      // Dapatkan sesi admin aktif dari Supabase Client aplikasi
      const { data: sessionData } = await supabase.auth.getSession();
      const headers = sessionData?.session?.access_token
        ? { Authorization: `Bearer ${sessionData.session.access_token}` }
        : undefined;

      // Invoke server-side Edge Function 'device-provisioning'
      const { data, error } = await supabase.functions.invoke('device-provisioning', {
        headers,
        body: {
          action: 'provision',
          device_code: deviceData.code.trim().toUpperCase(),
          device_name: deviceData.name.trim(),
          location_name: deviceData.locationName.trim(),
          farm_sector: deviceData.farmSector.trim(),
          latitude: deviceData.latitude,
          longitude: deviceData.longitude,
          crop_type: deviceData.cropType.trim(),
          planting_date: deviceData.plantingDate || null,
          firmware_version: deviceData.firmwareVersion || 'v2.3.1-prod',
          battery_cutoff_threshold_v: deviceData.batteryCutoffThresholdV ?? 11.8,
          pest_threshold_per_night: deviceData.pestThresholdPerNight ?? 50,
        },
      });

      if (error) {
        throw new Error(error.message || 'Gagal memanggil fungsi provisioning server.');
      }

      if (!data || (data.status !== 'success' && !data.success)) {
        throw new Error(data?.message || 'Provisioning perangkat gagal di server.');
      }

      const createdDevice = data.device;
      const credentials: DeviceProvisioningCredentials = {
        deviceCode: data.credentials?.device_code || createdDevice.device_code,
        rawToken: data.credentials?.raw_token || '',
        configHSnippet: data.credentials?.config_h_snippet || `#define DEVICE_CODE  "${createdDevice.device_code}"\n#define DEVICE_TOKEN "${data.credentials?.raw_token}"`,
        warning: data.credentials?.warning || 'PERHATIAN: Salin token ini sekarang. Token hanya ditampilkan satu kali.',
      };

      const defaultTelemetry: DeviceTelemetry = {
        id: `tel_${createdDevice.id}`,
        deviceId: createdDevice.id,
        timestamp: new Date().toISOString(),
        sequenceNumber: 1,
        battery: {
          busVoltageV: 12.8,
          shuntVoltageMv: -25.0,
          currentMa: -750,
          powerMw: 9600,
          isCharging: false,
          solarIrradianceEstimateWm2: 0,
        },
        water: {
          trayLevelPercent: 85,
          trayLevelCm: 4.2,
          tankLevelPercent: 80,
          tankVolumeLiters: 40,
          turbidityNtu: 25,
          isTurbid: false,
          drainValveStatus: 'closed',
          fillPumpStatus: 'idle',
          lastWaterChange: new Date().toISOString(),
          safetyLockout: false,
        },
        lamp: {
          isActive: false,
          mode: 'schedule_auto',
          scheduleStart: '18:00',
          scheduleEnd: '05:00',
          wavelengthNm: 365,
          ledCurrentMa: 0,
          isHealthy: true,
        },
        connectivity: {
          networkType: '4G_LTE',
          rssiDbm: -72,
          operator: 'Telkomsel IoT SIM',
          unsyncedMicroSdPackets: 0,
        },
        temperatureC: 26.5,
        humidityPercent: 82,
      };

      const mappedDevice: SmartLightTrapDevice = {
        id: createdDevice.id,
        code: createdDevice.device_code,
        name: createdDevice.device_name,
        locationName: createdDevice.location_name,
        farmSector: createdDevice.farm_sector,
        latitude: Number(createdDevice.latitude),
        longitude: Number(createdDevice.longitude),
        cropType: createdDevice.crop_type,
        plantingDate: createdDevice.planting_date || '',
        status: createdDevice.operational_status === 'active' ? 'online' : 'offline',
        firmwareVersion: createdDevice.firmware_version,
        esp32ChipId: createdDevice.esp32_chip_id || '',
        rtcStatus: 'synced_ds3231',
        currentTelemetry: defaultTelemetry,
        batteryCutoffThresholdV: Number(createdDevice.battery_cutoff_threshold_v),
        pestThresholdPerNight: createdDevice.pest_threshold_per_night,
        lastSyncAt: createdDevice.last_seen_at || new Date().toISOString(),
        isSimulated: false,
      };

      return {
        device: mappedDevice,
        credentials,
      };
    } catch (err: any) {
      console.error('Error in createDevice provisioning:', err);
      throw err;
    }
  },

  async rotateDeviceToken(deviceCode: string): Promise<DeviceProvisioningCredentials> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase belum terkonfigurasi pada file .env.');
    }

    // 1. Dapatkan sesi admin aktif dari Supabase Client aplikasi (bukan window/global storage)
    let { data: sessionData, error: sessionErr } = await supabase.auth.getSession();

    // Auto-refresh jika token sudah kedaluwarsa atau mendekati kedaluwarsa (< 60 detik)
    if (sessionData?.session) {
      const nowSec = Math.floor(Date.now() / 1000);
      const isExpiring = sessionData.session.expires_at ? sessionData.session.expires_at <= nowSec + 60 : false;
      if (isExpiring) {
        try {
          const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
          if (!refreshErr && refreshed.session) {
            sessionData = refreshed;
          }
        } catch {
          // Lanjutkan jika refresh gagal, akan ditangani oleh validasi di bawah
        }
      }
    }

    if (sessionErr || !sessionData?.session?.access_token) {
      throw new Error(
        'Sesi autentikasi tidak ditemukan atau telah kedaluwarsa. Silakan login kembali dengan akun Administrator (admin@gmail.com).'
      );
    }

    const accessToken = sessionData.session.access_token;
    const cleanDeviceCode = deviceCode.trim().toUpperCase();

    // 2. Kirim POST ke Edge Function 'device-provisioning' dengan Bearer JWT dan payload
    const { data, error, response } = await supabase.functions.invoke('device-provisioning', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: {
        action: 'rotate-token',
        device_code: cleanDeviceCode,
      },
    });

    // 3. Tangani respons error HTTP 401, 403, 404, atau lainnya dengan pesan yang jelas
    if (error) {
      const status = response?.status || (error as any)?.context?.status;
      let detailedMsg = '';

      const respObj = response || (error as any)?.context;
      if (respObj && typeof respObj.json === 'function') {
        try {
          const bodyJson = await respObj.json();
          detailedMsg = bodyJson?.error || bodyJson?.message || '';
        } catch {
          // ignore parsing error
        }
      }

      if (status === 401) {
        throw new Error(
          `Autentikasi Gagal (HTTP 401): ${detailedMsg || 'Sesi login tidak valid atau telah berakhir. Silakan login ulang.'}`
        );
      }
      if (status === 403) {
        throw new Error(
          `Akses Ditolak (HTTP 403): ${detailedMsg || 'Hanya pengguna dengan role Administrator yang memiliki izin merotasi token perangkat.'}`
        );
      }
      if (status === 404) {
        throw new Error(
          `Perangkat Tidak Ditemukan (HTTP 404): ${detailedMsg || `Perangkat dengan kode '${cleanDeviceCode}' tidak terdaftar dalam database.`}`
        );
      }

      throw new Error(
        detailedMsg || error.message || `Gagal merotasi token perangkat (Status HTTP ${status || 'Error'}).`
      );
    }

    if (!data || (data.status !== 'success' && !data.success)) {
      throw new Error(data?.message || data?.error || 'Rotasi token gagal di server.');
    }

    return {
      deviceCode: data.credentials?.device_code || cleanDeviceCode,
      rawToken: data.credentials?.raw_token || '',
      configHSnippet:
        data.credentials?.config_h_snippet ||
        `#define DEVICE_CODE  "${cleanDeviceCode}"\n#define DEVICE_TOKEN "${data.credentials?.raw_token}"`,
      warning:
        data.credentials?.warning ||
        'PERHATIAN: Salin token ini sekarang. Token hanya ditampilkan satu kali dan tidak disimpan di database.',
    };
  },

  async updateDevice(
    deviceId: string,
    updates: Partial<{
      name: string;
      locationName: string;
      farmSector: string;
      cropType: string;
      plantingDate: string;
      batteryCutoffThresholdV: number;
      pestThresholdPerNight: number;
      operationalStatus: string;
    }>
  ): Promise<boolean> {
    if (!isSupabaseConfigured) return true;

    try {
      const payload: any = {};
      if (updates.name !== undefined) payload.device_name = updates.name.trim();
      if (updates.locationName !== undefined) payload.location_name = updates.locationName.trim();
      if (updates.farmSector !== undefined) payload.farm_sector = updates.farmSector.trim();
      if (updates.cropType !== undefined) payload.crop_type = updates.cropType.trim();
      if (updates.plantingDate !== undefined) payload.planting_date = updates.plantingDate || null;
      if (updates.batteryCutoffThresholdV !== undefined)
        payload.battery_cutoff_threshold_v = updates.batteryCutoffThresholdV;
      if (updates.pestThresholdPerNight !== undefined)
        payload.pest_threshold_per_night = updates.pestThresholdPerNight;
      if (updates.operationalStatus !== undefined)
        payload.operational_status = updates.operationalStatus;

      payload.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from('devices')
        .update(payload)
        .eq('id', deviceId);

      if (error) {
        throw new Error(error.message || 'Gagal memperbarui perangkat di Supabase.');
      }

      return true;
    } catch (err: any) {
      console.error('Error updating device:', err);
      throw err;
    }
  },

  async deleteDevice(deviceId: string): Promise<boolean> {
    if (!isSupabaseConfigured) return true;

    try {
      const { error } = await supabase
        .from('devices')
        .delete()
        .eq('id', deviceId);

      if (error) {
        throw new Error(error.message || 'Gagal menghapus perangkat dari Supabase.');
      }

      return true;
    } catch (err: any) {
      console.error('Error deleting device:', err);
      throw err;
    }
  },

  async getDeviceSettings(deviceId: string): Promise<any | null> {
    if (!isSupabaseConfigured || !deviceId) return null;

    try {
      const { data, error } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', deviceId)
        .maybeSingle();

      if (error || !data) return null;
      return data;
    } catch {
      return null;
    }
  },

  async updateSettings(deviceId: string, settings: Record<string, any>): Promise<boolean> {
    if (!isSupabaseConfigured) return true;

    try {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('device_settings')
        .upsert({
          device_id: deviceId,
          ...settings,
          updated_by: user.user?.id || null,
          updated_at: new Date().toISOString(),
        });

      return !error;
    } catch {
      return false;
    }
  },

  subscribeToDevices(onUpdate: (payload: any) => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };

    const channel = supabase
      .channel('realtime_devices')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'devices' },
        (payload) => onUpdate(payload)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'device_telemetry' },
        (payload) => onUpdate(payload)
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },

  subscribeToCommands(deviceId: string, onUpdate: (command: DeviceCommand) => void) {
    if (!isSupabaseConfigured) return { unsubscribe: () => {} };

    const channel = supabase
      .channel(`realtime_commands_${deviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'device_commands',
          filter: `device_id=eq.${deviceId}`,
        },
        (payload) => {
          const row: any = payload.new;
          if (row) {
            onUpdate({
              id: row.id,
              deviceId: row.device_id,
              commandType: row.command_type,
              parameters: row.parameters,
              status: row.status.toUpperCase() as any,
              createdAt: row.created_at,
              executedAt: row.completed_at || row.acknowledged_at,
              responseMessage: row.result?.message || row.error_message,
            });
          }
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      },
    };
  },
};


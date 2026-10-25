import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { SmartLightTrapDevice, DeviceCommand, DeviceTelemetry } from '../types';
import { INITIAL_DEVICES, INITIAL_COMMANDS } from '../data/mockData';

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
        throw new Error(`Gagal memuat perangkat dari Supabase: ${devErr.message}`);
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
  }): Promise<SmartLightTrapDevice> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase belum terkonfigurasi pada file .env.');
    }

    try {
      // Generate a mock hash for hardware api key token (64 hex characters)
      const randomHex = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
      ).join('');

      const chipId = `ESP32S3-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      const { data, error } = await supabase
        .from('devices')
        .insert({
          device_code: deviceData.code.trim().toUpperCase(),
          device_name: deviceData.name.trim(),
          location_name: deviceData.locationName.trim(),
          farm_sector: deviceData.farmSector.trim(),
          latitude: deviceData.latitude,
          longitude: deviceData.longitude,
          crop_type: deviceData.cropType.trim(),
          planting_date: deviceData.plantingDate || null,
          firmware_version: deviceData.firmwareVersion || 'v2.3.1-prod',
          esp32_chip_id: chipId,
          api_key_hash: randomHex,
          connection_status: 'online',
          lamp_status: false,
          operational_status: 'active',
          battery_cutoff_threshold_v: deviceData.batteryCutoffThresholdV ?? 11.8,
          pest_threshold_per_night: deviceData.pestThresholdPerNight ?? 50,
          is_simulated: false,
          last_seen_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error(`Kode perangkat '${deviceData.code}' sudah terdaftar. Gunakan kode unik.`);
        }
        throw new Error(error.message || 'Gagal menambahkan perangkat ke Supabase.');
      }

      // Initialize default settings row for the new device
      await supabase.from('device_settings').insert({
        device_id: data.id,
        lamp_on_time: '18:00:00',
        lamp_off_time: '05:00:00',
        timezone: 'Asia/Jakarta',
        photo_interval_minutes: 60,
        pest_alert_threshold: deviceData.pestThresholdPerNight ?? 50,
        battery_cutoff_threshold: deviceData.batteryCutoffThresholdV ?? 11.8,
        telemetry_interval_minutes: 5,
      }).select().maybeSingle();

      const defaultTelemetry: DeviceTelemetry = {
        id: `tel_${data.id}`,
        deviceId: data.id,
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

      return {
        id: data.id,
        code: data.device_code,
        name: data.device_name,
        locationName: data.location_name,
        farmSector: data.farm_sector,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        cropType: data.crop_type,
        plantingDate: data.planting_date || '',
        status: data.connection_status,
        firmwareVersion: data.firmware_version,
        esp32ChipId: data.esp32_chip_id || '',
        rtcStatus: 'synced_ds3231',
        currentTelemetry: defaultTelemetry,
        batteryCutoffThresholdV: Number(data.battery_cutoff_threshold_v),
        pestThresholdPerNight: data.pest_threshold_per_night,
        lastSyncAt: data.last_seen_at || new Date().toISOString(),
        isSimulated: false,
      };
    } catch (err: any) {
      console.error('Error creating device:', err);
      throw err;
    }
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


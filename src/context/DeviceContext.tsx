import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  SmartLightTrapDevice,
  DeviceAlert,
  DeviceCommand,
  CaptureImage,
  WaterChangeLog,
  InsectSpeciesId,
  UserProfile,
} from '../types';
import {
  INITIAL_DEVICES,
  INITIAL_ALERTS,
  INITIAL_COMMANDS,
  MOCK_CAPTURES,
  MOCK_WATER_LOGS,
} from '../data/mockData';

export type NavigationTab =
  | 'overview'
  | 'devices'
  | 'pests'
  | 'gallery'
  | 'energy'
  | 'water'
  | 'alerts'
  | 'settings'
  | 'architecture';

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  lastTestStatus: 'idle' | 'success' | 'failed';
  lastTestMessage?: string;
}

export const DEMO_USERS: UserProfile[] = [
  {
    id: 'usr_01',
    name: 'Pak Rahmat',
    email: 'rahmat@smarttrap.id',
    role: 'Agronomis Lapangan',
    avatarInitials: 'PR',
    assignedRegion: 'Subang, Jawa Barat',
  },
  {
    id: 'usr_02',
    name: 'Siti Aminah',
    email: 'siti@smarttrap.id',
    role: 'Operator Teknis Subang',
    avatarInitials: 'SA',
    assignedRegion: 'Pagaden & Binong',
  },
  {
    id: 'usr_03',
    name: 'Dr. Hendra',
    email: 'hendra@smarttrap.id',
    role: 'Supervisor PHT',
    avatarInitials: 'DH',
    assignedRegion: 'Jawa Barat (Pusat)',
  },
];

interface DeviceContextType {
  devices: SmartLightTrapDevice[];
  selectedDeviceId: string;
  selectedDevice: SmartLightTrapDevice;
  setSelectedDeviceId: (id: string) => void;
  operationalRegion: string;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  appMode: 'landing' | 'dashboard';
  setAppMode: (mode: 'landing' | 'dashboard') => void;
  alerts: DeviceAlert[];
  acknowledgeAlert: (alertId: string, operatorName?: string) => void;
  commands: DeviceCommand[];
  sendCommand: (
    deviceId: string,
    commandType: DeviceCommand['commandType'],
    params?: Record<string, any>
  ) => Promise<DeviceCommand>;
  captures: CaptureImage[];
  updateBoundingBoxLabel: (
    captureId: string,
    boxId: string,
    newSpeciesId: InsectSpeciesId,
    operatorName: string
  ) => void;
  waterLogs: WaterChangeLog[];
  triggerHardwareSimulation: (scenario: string) => void;
  isSimulatingAction: boolean;
  simulatedActionMessage: string | null;
  telegramConfig: TelegramConfig;
  updateTelegramConfig: (config: Partial<TelegramConfig>) => void;
  testTelegramNotification: () => Promise<void>;
  // Auth state & actions
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  login: (email: string, password?: string) => Promise<boolean>;
  logout: () => void;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [devices, setDevices] = useState<SmartLightTrapDevice[]>(INITIAL_DEVICES);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('dev_01_sbg_01');
  const [activeTab, setActiveTab] = useState<NavigationTab>('overview');
  const [appMode, setAppModeState] = useState<'landing' | 'dashboard'>('landing');
  const operationalRegion = 'Subang, Jawa Barat';
  const [alerts, setAlerts] = useState<DeviceAlert[]>(INITIAL_ALERTS);
  const [commands, setCommands] = useState<DeviceCommand[]>(INITIAL_COMMANDS);
  const [captures, setCaptures] = useState<CaptureImage[]>(MOCK_CAPTURES);
  const [waterLogs, setWaterLogs] = useState<WaterChangeLog[]>(MOCK_WATER_LOGS);
  const [isSimulatingAction, setIsSimulatingAction] = useState(false);
  const [simulatedActionMessage, setSimulatedActionMessage] = useState<string | null>(null);

  // Authentication state (null by default if not logged in)
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('slt_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const isAuthenticated = currentUser !== null;

  const setAppMode = (mode: 'landing' | 'dashboard') => {
    if (mode === 'dashboard' && !currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    setAppModeState(mode);
  };

  const login = async (email: string, password?: string): Promise<boolean> => {
    // Find matching demo user or create session
    const matched = DEMO_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
    const userToSet: UserProfile = matched || {
      id: `usr_${Date.now()}`,
      name: email.split('@')[0].replace('.', ' '),
      email,
      role: 'Agronomis Lapangan',
      avatarInitials: email.slice(0, 2).toUpperCase(),
      assignedRegion: 'Subang, Jawa Barat',
    };

    setCurrentUser(userToSet);
    try {
      localStorage.setItem('slt_user', JSON.stringify(userToSet));
    } catch {
      // storage unavailable
    }
    setIsLoginModalOpen(false);
    setAppModeState('dashboard');
    return true;
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem('slt_user');
    } catch {
      // storage unavailable
    }
    setAppModeState('landing');
    setIsLoginModalOpen(false);
  };

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    enabled: true,
    botToken: 'bot71829381:AAF4-sample-esp32-light-trap-token',
    chatId: '-100234891823',
    lastTestStatus: 'idle',
  });

  const selectedDevice =
    devices.find((d) => d.id === selectedDeviceId) || devices[0];

  const acknowledgeAlert = (alertId: string, operatorName = 'Operator Lapangan') => {
    setAlerts((prev) =>
      prev.map((alt) =>
        alt.id === alertId
          ? {
              ...alt,
              isAcknowledged: true,
              acknowledgedBy: operatorName,
              actionTaken: 'Ditinjau dan dikonfirmasi melalui dashboard web',
            }
          : alt
      )
    );
  };

  const sendCommand = async (
    deviceId: string,
    commandType: DeviceCommand['commandType'],
    params?: Record<string, any>
  ): Promise<DeviceCommand> => {
    const newCmdId = `cmd_${Date.now()}`;
    const newCommand: DeviceCommand = {
      id: newCmdId,
      deviceId,
      commandType,
      parameters: params,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setCommands((prev) => [newCommand, ...prev]);

    // Simulate real IoT handshake protocol (PENDING -> SENT -> ACK -> COMPLETED)
    return new Promise((resolve) => {
      setTimeout(() => {
        setCommands((prev) =>
          prev.map((cmd) =>
            cmd.id === newCmdId ? { ...cmd, status: 'SENT' } : cmd
          )
        );
      }, 600);

      setTimeout(() => {
        setCommands((prev) =>
          prev.map((cmd) =>
            cmd.id === newCmdId ? { ...cmd, status: 'ACKNOWLEDGED' } : cmd
          )
        );
      }, 1400);

      setTimeout(() => {
        let resp = 'Perintah berhasil dieksekusi oleh firmware ESP32-S3.';
        if (commandType === 'FORCE_WATER_CHANGE') {
          resp = 'Siklus kuras 25 detik dan pengisian baki tuntas. Kekeruhan air normal kembali.';
          // Update device state
          setDevices((prev) =>
            prev.map((d) =>
              d.id === deviceId
                ? {
                    ...d,
                    currentTelemetry: {
                      ...d.currentTelemetry,
                      water: {
                        ...d.currentTelemetry.water,
                        turbidityNtu: 28,
                        isTurbid: false,
                        trayLevelPercent: 85,
                        tankVolumeLiters: Math.max(0, d.currentTelemetry.water.tankVolumeLiters - 5),
                        tankLevelPercent: Math.max(0, d.currentTelemetry.water.tankLevelPercent - 10),
                        lastWaterChange: new Date().toISOString(),
                      },
                    },
                  }
                : d
            )
          );
        } else if (commandType === 'TOGGLE_LAMP') {
          setDevices((prev) =>
            prev.map((d) => {
              if (d.id !== deviceId) return d;
              const nextActive = !d.currentTelemetry.lamp.isActive;
              return {
                ...d,
                currentTelemetry: {
                  ...d.currentTelemetry,
                  lamp: {
                    ...d.currentTelemetry.lamp,
                    isActive: nextActive,
                    ledCurrentMa: nextActive ? 850 : 0,
                  },
                },
              };
            })
          );
          resp = 'Status lampu UV berhasil diubah secara aman.';
        } else if (commandType === 'REBOOT_ESP32') {
          resp = 'ESP32-S3 reboot bersih dilakukan. RTC DS3231 dan modem 4G terhubung kembali.';
        }

        const completedCmd: DeviceCommand = {
          ...newCommand,
          status: 'COMPLETED',
          executedAt: new Date().toISOString(),
          responseMessage: resp,
        };

        setCommands((prev) =>
          prev.map((cmd) => (cmd.id === newCmdId ? completedCmd : cmd))
        );
        resolve(completedCmd);
      }, 2500);
    });
  };

  const updateBoundingBoxLabel = (
    captureId: string,
    boxId: string,
    newSpeciesId: InsectSpeciesId,
    operatorName: string
  ) => {
    setCaptures((prev) =>
      prev.map((cap) => {
        if (cap.id !== captureId) return cap;
        const updatedBoxes = cap.bboxes.map((box) =>
          box.id === boxId
            ? {
                ...box,
                speciesId: newSpeciesId,
                isManuallyVerified: true,
                verifiedBy: operatorName,
                verifiedAt: new Date().toISOString(),
              }
            : box
        );
        const targetCount = updatedBoxes.filter(
          (b) => b.speciesId !== 'other_neutral' && b.speciesId !== 'unidentified'
        ).length;
        const otherCount = updatedBoxes.length - targetCount;
        return {
          ...cap,
          bboxes: updatedBoxes,
          targetPestsCount: targetCount,
          otherInsectsCount: otherCount,
          isManuallyVerified: true,
          notes: `Label dikoreksi manual oleh ${operatorName} pada ${new Date().toLocaleTimeString('id-ID')}`,
        };
      })
    );
  };

  const triggerHardwareSimulation = (scenario: string) => {
    setIsSimulatingAction(true);
    if (scenario === 'water_change_cycle') {
      setSimulatedActionMessage('Memulai siklus hidraulik: Katup drain terbuka...');
      setTimeout(() => {
        setSimulatedActionMessage('Membuang air keruh baki penampung (25 detik)...');
      }, 1000);
      setTimeout(() => {
        setSimulatedActionMessage('Menutup katup drain, mengaktifkan pompa pengisi dari tandon...');
      }, 2200);
      setTimeout(() => {
        setSimulatedActionMessage('Sensor ultrasonik mendeteksi air baki mencapai 85%. Pompa dimatikan.');
        setDevices((prev) =>
          prev.map((d) =>
            d.id === selectedDeviceId
              ? {
                  ...d,
                  currentTelemetry: {
                    ...d.currentTelemetry,
                    water: {
                      ...d.currentTelemetry.water,
                      turbidityNtu: 26,
                      isTurbid: false,
                      trayLevelPercent: 85,
                      lastWaterChange: new Date().toISOString(),
                    },
                  },
                }
              : d
          )
        );
        const newLog: WaterChangeLog = {
          id: `wlog_${Date.now()}`,
          deviceId: selectedDeviceId,
          startedAt: new Date(Date.now() - 45000).toISOString(),
          completedAt: new Date().toISOString(),
          triggerReason: 'manual_operator',
          initialTurbidityNtu: 124,
          finalTurbidityNtu: 26,
          waterUsedLiters: 4.9,
          status: 'SUCCESS',
        };
        setWaterLogs((prev) => [newLog, ...prev]);
        setIsSimulatingAction(false);
      }, 4000);
    } else if (scenario === 'pest_surge') {
      setSimulatedActionMessage('Simulasi penangkapan gelombang serangga nokturnal...');
      setTimeout(() => {
        setSimulatedActionMessage('Kamera snapshot diambil, inferensi YOLOv8 mendeteksi 18 Penggerek Batang baru.');
        setAlerts((prev) => [
          {
            id: `alt_${Date.now()}`,
            deviceId: selectedDeviceId,
            deviceName: selectedDevice.name,
            location: selectedDevice.farmSector,
            severity: 'critical',
            category: 'pest_threshold',
            title: 'Ambang Batas Hama Terlampaui (Simulasi)',
            message: 'Tangkapan serangga meningkat tajam (+18 ekor dalam 1 jam). Rekomendasi PHT aktif.',
            timestamp: new Date().toISOString(),
            isAcknowledged: false,
          },
          ...prev,
        ]);
        setIsSimulatingAction(false);
      }, 1800);
    } else if (scenario === 'low_battery_eco') {
      setSimulatedActionMessage('Simulasi cuaca mendung 3 hari: Tegangan turun ke 11.75V...');
      setTimeout(() => {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === selectedDeviceId
              ? {
                  ...d,
                  currentTelemetry: {
                    ...d.currentTelemetry,
                    battery: {
                      ...d.currentTelemetry.battery,
                      busVoltageV: 11.75,
                      currentMa: -350,
                    },
                    lamp: {
                      ...d.currentTelemetry.lamp,
                      mode: 'eco_low_battery',
                      ledCurrentMa: 350,
                    },
                  },
                }
              : d
          )
        );
        setSimulatedActionMessage('Firmware mengaktifkan proteksi: Eco Dimming & Cut-off warning dipicu.');
        setIsSimulatingAction(false);
      }, 1600);
    } else if (scenario === 'tank_depleted') {
      setSimulatedActionMessage('Simulasi tandon air cadangan kosong (Level 8%)...');
      setTimeout(() => {
        setDevices((prev) =>
          prev.map((d) =>
            d.id === selectedDeviceId
              ? {
                  ...d,
                  currentTelemetry: {
                    ...d.currentTelemetry,
                    water: {
                      ...d.currentTelemetry.water,
                      tankLevelPercent: 8,
                      tankVolumeLiters: 4,
                      safetyLockout: true,
                      fillPumpStatus: 'dry_run_lockout',
                    },
                  },
                }
              : d
          )
        );
        setSimulatedActionMessage('Dry-run protection aktif: Pompa terkunci dari risiko terbakar.');
        setIsSimulatingAction(false);
      }, 1500);
    } else {
      setIsSimulatingAction(false);
    }
  };

  const updateTelegramConfig = (config: Partial<TelegramConfig>) => {
    setTelegramConfig((prev) => ({ ...prev, ...config }));
  };

  const testTelegramNotification = async () => {
    setTelegramConfig((prev) => ({
      ...prev,
      lastTestStatus: 'idle',
      lastTestMessage: 'Mengirim pesan uji coba ke bot...',
    }));
    await new Promise((r) => setTimeout(r, 1200));
    setTelegramConfig((prev) => ({
      ...prev,
      lastTestStatus: 'success',
      lastTestMessage: `Pesan uji coba sukses dikirim ke chat ID ${prev.chatId}: "[ALERT SLT] Tes integrasi notifikasi Smart Light Trap berhasil."`,
    }));
  };

  return (
    <DeviceContext.Provider
      value={{
        devices,
        selectedDeviceId,
        selectedDevice,
        setSelectedDeviceId,
        operationalRegion,
        activeTab,
        setActiveTab,
        appMode,
        setAppMode,
        alerts,
        acknowledgeAlert,
        commands,
        sendCommand,
        captures,
        updateBoundingBoxLabel,
        waterLogs,
        triggerHardwareSimulation,
        isSimulatingAction,
        simulatedActionMessage,
        telegramConfig,
        updateTelegramConfig,
        testTelegramNotification,
        currentUser,
        isAuthenticated,
        isLoginModalOpen,
        setIsLoginModalOpen,
        login,
        logout,
      }}
    >
      {children}
    </DeviceContext.Provider>
  );
};

export const useDevice = () => {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used within a DeviceProvider');
  return ctx;
};

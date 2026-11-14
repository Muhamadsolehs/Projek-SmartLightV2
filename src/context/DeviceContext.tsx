import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  SmartLightTrapDevice,
  DeviceAlert,
  DeviceCommand,
  CaptureImage,
  BoundingBox,
  WaterChangeLog,
  InsectSpeciesId,
  UserProfile,
  DeviceProvisioningCredentials,
} from '../types';
import {
  INITIAL_DEVICES,
  INITIAL_ALERTS,
  INITIAL_COMMANDS,
  MOCK_CAPTURES,
  MOCK_WATER_LOGS,
  DEMO_USERS,
} from '../data/mockData';
import { supabase, isSupabaseConfigured, OPERATIONAL_REGION } from '../lib/supabase';
import { authService } from '../services/authService';
import { deviceService, ProvisionDeviceResult } from '../services/deviceService';
import { alertService } from '../services/alertService';
import { pestService } from '../services/pestService';
import { waterService } from '../services/waterService';
import { deviceImagesService, getDeletedCaptureTombstones, addDeletedCaptureTombstone } from '../services/deviceImagesService';
import { aiDetectionService } from '../services/aiDetectionService';
import { hasPermission, sanitizeRole } from '../lib/permissions';

export type NavigationTab =
  | 'overview'
  | 'devices'
  | 'controls'
  | 'pests'
  | 'gallery'
  | 'energy'
  | 'water'
  | 'alerts'
  | 'settings'
  | 'architecture'
  | 'users';

interface TelegramConfig {
  enabled: boolean;
  botToken: string;
  chatId: string;
  lastTestStatus: 'idle' | 'success' | 'failed';
  lastTestMessage?: string;
}

export { DEMO_USERS };

export type DataSourceMode = 'supabase_live' | 'simulation_demo';

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
  addCapture: (capture: CaptureImage) => void;
  deleteCapture: (
    captureId: string,
    dbRecordId?: number,
    filePath?: string,
    imageUrl?: string
  ) => Promise<void>;
  runAiDetection: (captureId: string) => Promise<CaptureImage | null>;
  deleteBoundingBox: (captureId: string, boxId: string) => Promise<void> | void;
  addBoundingBox: (captureId: string, box: BoundingBox) => Promise<void> | void;
  clearBoundingBoxes: (captureId: string) => Promise<void> | void;
  updateBoundingBoxLabel: (
    captureId: string,
    boxId: string,
    newSpeciesId: InsectSpeciesId,
    operatorName: string
  ) => Promise<void> | void;
  updateBoundingBoxCoords?: (
    captureId: string,
    boxId: string,
    coords: { x: number; y: number; width: number; height: number }
  ) => Promise<void> | void;
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
  login: (email: string, password?: string) => Promise<{ success: boolean; error: string | null }>;
  signUp: (
    email: string,
    password: string,
    fullName: string
  ) => Promise<{ success: boolean; needsConfirmation: boolean; error: string | null }>;
  loginAsDemo: (demoUser: UserProfile) => void;
  logout: () => Promise<void>;
  // Device CRUD actions (Admin only)
  createDevice: (data: any) => Promise<ProvisionDeviceResult>;
  rotateDeviceToken: (deviceCode: string) => Promise<DeviceProvisioningCredentials>;
  updateDevice: (id: string, updates: any) => Promise<boolean>;
  deleteDevice: (id: string) => Promise<boolean>;
  // Live connectivity & state
  dataSource: DataSourceMode;
  dataSourceMode?: DataSourceMode;
  setDataSource: (mode: DataSourceMode) => void;
  isLiveConnected: boolean;
  isLoadingData: boolean;
  devicesLoading: boolean;
  devicesEmpty: boolean;
  devicesError: string | null;
  refreshData: () => Promise<void>;
}

const DeviceContext = createContext<DeviceContextType | undefined>(undefined);

export const DeviceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Data source mode: 'supabase_live' (default) vs 'simulation_demo' (explicit mock preview)
  const [dataSource, setDataSourceState] = useState<DataSourceMode>(() => {
    try {
      const saved = localStorage.getItem('slt_datasource');
      return (saved as DataSourceMode) || 'supabase_live';
    } catch {
      return 'supabase_live';
    }
  });

  const [devices, setDevices] = useState<SmartLightTrapDevice[]>(() => {
    const savedSource = localStorage.getItem('slt_datasource');
    return savedSource === 'simulation_demo' ? INITIAL_DEVICES : [];
  });
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesEmpty, setDevicesEmpty] = useState(false);
  const [devicesError, setDevicesError] = useState<string | null>(null);

  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('a1111111-1111-1111-1111-111111111111');

  // 1. Persistence Active Tab: Menjaga tab aktif tetap sama saat halaman direfresh
  const [activeTab, setActiveTabState] = useState<NavigationTab>(() => {
    try {
      const savedTab = localStorage.getItem('slt_active_tab') as NavigationTab | null;
      const validTabs: NavigationTab[] = [
        'overview',
        'devices',
        'controls',
        'pests',
        'gallery',
        'energy',
        'water',
        'alerts',
        'settings',
        'architecture',
        'users',
      ];
      if (savedTab && validTabs.includes(savedTab)) {
        return savedTab;
      }
    } catch {}
    return 'overview';
  });

  const setActiveTab = (tab: NavigationTab) => {
    setActiveTabState(tab);
    try {
      localStorage.setItem('slt_active_tab', tab);
    } catch {}
  };

  // 2. Persistence App Mode: Mencegah pengguna keluar dari dashboard saat direfresh
  const [appMode, setAppModeState] = useState<'landing' | 'dashboard'>(() => {
    try {
      const savedMode = localStorage.getItem('slt_app_mode') as 'landing' | 'dashboard' | null;
      if (savedMode === 'landing' || savedMode === 'dashboard') {
        return savedMode;
      }
      const savedUser = localStorage.getItem('slt_user');
      if (savedUser) {
        return 'dashboard';
      }
    } catch {}
    return 'dashboard';
  });
  const operationalRegion = OPERATIONAL_REGION;
  const [alerts, setAlerts] = useState<DeviceAlert[]>(() => {
    const savedSource = localStorage.getItem('slt_datasource');
    return savedSource === 'simulation_demo' ? INITIAL_ALERTS : [];
  });
  const [commands, setCommands] = useState<DeviceCommand[]>(INITIAL_COMMANDS);
  const [captures, setCaptures] = useState<CaptureImage[]>(() => {
    const savedSource = localStorage.getItem('slt_datasource');
    const base = savedSource === 'simulation_demo' ? MOCK_CAPTURES : [];
    try {
      const custom = localStorage.getItem('slt_custom_captures');
      if (custom) {
        const parsed = JSON.parse(custom);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return [...parsed, ...base];
        }
      }
    } catch {}
    return base;
  });
  const [waterLogs, setWaterLogs] = useState<WaterChangeLog[]>(() => {
    const savedSource = localStorage.getItem('slt_datasource');
    return savedSource === 'simulation_demo' ? MOCK_WATER_LOGS : [];
  });
  const [isSimulatingAction, setIsSimulatingAction] = useState(false);
  const [simulatedActionMessage, setSimulatedActionMessage] = useState<string | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(isSupabaseConfigured);

  // Authentication state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('slt_user');
      if (saved) {
        const parsed = JSON.parse(saved);
        const role = sanitizeRole(parsed.role);
        return {
          ...parsed,
          role,
        };
      }
      return DEMO_USERS[0];
    } catch {
      return DEMO_USERS[0];
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const isAuthenticated = currentUser !== null;

  // Telegram Config
  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    enabled: true,
    botToken: '(Terkonfigurasi di Supabase Secrets)',
    chatId: '1523500422',
    lastTestStatus: 'idle',
  });

  // Selected device with fallback
  const selectedDevice =
    devices.find((d) => d.id === selectedDeviceId || d.code === selectedDeviceId) ||
    devices[0] ||
    INITIAL_DEVICES[0];

  const setDataSource = (mode: DataSourceMode) => {
    setDataSourceState(mode);
    try {
      localStorage.setItem('slt_datasource', mode);
    } catch {}
  };

  // Fetch all dashboard data from Supabase or load simulation fixtures
  const loadDashboardData = useCallback(async () => {
    if (dataSource === 'simulation_demo') {
      // In explicit simulation demo mode, use mock fixtures
      setDevices(INITIAL_DEVICES);
      setAlerts(INITIAL_ALERTS);
      setCommands(INITIAL_COMMANDS);
      setCaptures(MOCK_CAPTURES);
      setWaterLogs(MOCK_WATER_LOGS);
      setDevicesEmpty(false);
      setDevicesError(null);
      setIsLiveConnected(true);
      return;
    }

    if (!isSupabaseConfigured) {
      setDevicesError('Klien Supabase belum terkonfigurasi pada file .env.');
      setDevices([]);
      setDevicesEmpty(true);
      return;
    }

    setIsLoadingData(true);
    setDevicesLoading(true);
    setDevicesError(null);

    try {
      const [fetchedDevices, fetchedAlerts, fetchedCommands, fetchedCaptures, fetchedLogs, fetchedDbImages] = await Promise.all([
        deviceService.getDevices(),
        alertService.getAlerts().catch(() => []),
        deviceService.getCommands().catch(() => []),
        pestService.getCaptureSessions().catch(() => []),
        waterService.getWaterLogs().catch(() => []),
        deviceImagesService.getAllDeviceImages().catch(() => []),
      ]);

      if (Array.isArray(fetchedDevices)) {
        setDevices(fetchedDevices);
        setDevicesEmpty(fetchedDevices.length === 0);
        if (fetchedDevices.length > 0) {
          if (!fetchedDevices.some((d) => d.id === selectedDeviceId)) {
            setSelectedDeviceId(fetchedDevices[0].id);
          }
        }
      }

      setAlerts(fetchedAlerts || []);
      setCommands(fetchedCommands || []);

      let customCaptures: CaptureImage[] = [];
      try {
        const custom = localStorage.getItem('slt_custom_captures');
        if (custom) customCaptures = JSON.parse(custom);
      } catch {}

      // Dapatkan tombstone foto yang telah dihapus agar tidak muncul kembali setelah refresh
      const tombstones = getDeletedCaptureTombstones();

      const isItemDeleted = (item: {
        id?: string;
        dbRecordId?: number;
        filePath?: string;
        imageUrl?: string;
      }) => {
        if (!item) return false;
        if (item.id && tombstones.has(item.id)) return true;
        if (item.id && tombstones.has(`SES-${item.id}`)) return true;
        if (
          item.dbRecordId &&
          (tombstones.has(String(item.dbRecordId)) ||
            tombstones.has(`db-${item.dbRecordId}`) ||
            tombstones.has(`IMG-DB-${item.dbRecordId}`))
        ) {
          return true;
        }
        if (item.filePath && tombstones.has(item.filePath)) return true;
        if (item.imageUrl && tombstones.has(item.imageUrl)) return true;
        if (item.id && item.id.startsWith('IMG-DB-')) {
          const num = item.id.replace('IMG-DB-', '');
          if (tombstones.has(num) || tombstones.has(`db-${num}`)) return true;
        }
        return false;
      };

      const cleanDbImages = (fetchedDbImages || []).filter(
        (img) =>
          !isItemDeleted({
            id: `IMG-DB-${img.id}`,
            dbRecordId: img.id,
            filePath: img.file_path,
            imageUrl: img.image_url,
          })
      );

      const cleanCustomCaptures = customCaptures.filter((c) => !isItemDeleted(c));
      const cleanFetchedCaptures = (fetchedCaptures || []).filter((s) => !isItemDeleted(s));

      // Petakan gambar dari tabel public.device_images & bucket Supabase ke CaptureImage
      // Menggabungkan anotasi deteksi dari capture_sessions Supabase atau local cache
      const mappedDbImages: CaptureImage[] = cleanDbImages.map((img) => {
        const imgKey = `IMG-DB-${img.id}`;

        // 1. Cari data deteksi dari local customCaptures
        const customMatch = cleanCustomCaptures.find(
          (c) => c.dbRecordId === img.id || c.id === imgKey || (c.imageUrl && c.imageUrl === img.image_url)
        );

        // 2. Cari data deteksi dari fetchedCaptures (tabel public.capture_sessions & public.insect_detections)
        const sessionMatch = cleanFetchedCaptures.find(
          (s) =>
            s.id === imgKey ||
            s.id === `SES-${imgKey}` ||
            (s as any).sessionCode === `SES-${imgKey}` ||
            (s as any).sessionCode === imgKey ||
            (s.notes && s.notes.includes(imgKey))
        );

        // Prioritas kotak: database Supabase (sessionMatch), fallback ke local cache (customMatch)
        const bboxes =
          sessionMatch?.bboxes && sessionMatch.bboxes.length > 0
            ? sessionMatch.bboxes
            : customMatch?.bboxes && customMatch.bboxes.length > 0
            ? customMatch.bboxes
            : [];

        const totalPests =
          bboxes.length > 0
            ? bboxes.length
            : sessionMatch?.totalPests ??
              customMatch?.totalPests ??
              0;

        const targetPests =
          bboxes.length > 0
            ? bboxes.filter((b) => b.speciesId !== 'other_neutral' && b.speciesId !== 'unidentified').length
            : sessionMatch?.targetPestsCount ??
              customMatch?.targetPestsCount ??
              0;

        const otherInsects =
          bboxes.length > 0
            ? Math.max(0, totalPests - targetPests)
            : sessionMatch?.otherInsectsCount ??
              customMatch?.otherInsectsCount ??
              0;

        const isManuallyVerified = Boolean(
          sessionMatch?.isManuallyVerified ||
          bboxes.some((b) => b.isManuallyVerified) ||
          customMatch?.isManuallyVerified ||
          false
        );

        const isAiProcessed = Boolean(
          isManuallyVerified ||
          sessionMatch ||
          customMatch?.isAiProcessed ||
          bboxes.length > 0
        );

        return {
          id: imgKey,
          deviceId: img.device_id || 'SLT-SBG-01',
          timestamp: img.captured_at,
          imageUrl: img.image_url,
          resolution: '1280x720 (DroidCam HD)',
          totalPests,
          targetPestsCount: targetPests,
          otherInsectsCount: otherInsects,
          avgConfidence: sessionMatch?.avgConfidence || customMatch?.avgConfidence || 0.95,
          modelVersion:
            sessionMatch?.modelVersion ||
            customMatch?.modelVersion ||
            `YOLOv8 (${img.trigger_source || 'Manual'})`,
          isManuallyVerified,
          isAiProcessed,
          bboxes,
          notes:
            sessionMatch?.notes ||
            customMatch?.notes ||
            `Tersimpan di Supabase (${img.file_path || 'device_images'})`,
          dbRecordId: img.id,
          filePath: img.file_path,
          triggerSource: img.trigger_source,
        };
      });

      // Prioritaskan database Supabase sebagai Sumber Kebenaran Tunggal (Single Source of Truth)
      const existingDbKeys = new Set(mappedDbImages.map((m) => m.id));
      const orphanedSessions = cleanFetchedCaptures.filter(
        (s) =>
          !existingDbKeys.has(s.id) &&
          !existingDbKeys.has(s.id.replace(/^SES-/, '')) &&
          Boolean(s.imageUrl)
      );

      const sourceList =
        mappedDbImages.length > 0
          ? [...mappedDbImages, ...orphanedSessions]
          : cleanFetchedCaptures.length > 0
          ? cleanFetchedCaptures
          : customCaptures.length > 0 && !isSupabaseConfigured
          ? cleanCustomCaptures
          : [];

      const seenKeys = new Set<string>();
      const dedupedCaptures: CaptureImage[] = [];
      for (const item of sourceList) {
        if (isItemDeleted(item)) continue;
        const key = item.dbRecordId ? `IMG-DB-${item.dbRecordId}` : item.id;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          dedupedCaptures.push(item);
        }
      }

      setCaptures(dedupedCaptures);
      setWaterLogs(fetchedLogs || []);
      setIsLiveConnected(true);
      setDevicesError(null);
    } catch (err: any) {
      console.error('Error loading Supabase dashboard data:', err);
      setDevicesError(err?.message || 'Gagal memuat data dari database Supabase.');
      setDevices([]);
      setDevicesEmpty(true);
      setIsLiveConnected(false);
    } finally {
      setIsLoadingData(false);
      setDevicesLoading(false);
    }
  }, [dataSource, selectedDeviceId]);

  // Auth restore & Realtime listeners
  useEffect(() => {
    if (isSupabaseConfigured) {
      // Restore authenticated session from Supabase
      authService.getSession().then((user) => {
        if (user) {
          setCurrentUser(user);
          setDataSourceState('supabase_live');
          localStorage.setItem('slt_user', JSON.stringify(user));
          localStorage.setItem('slt_datasource', 'supabase_live');
        }
      });

      const { unsubscribe: unsubAuth } = authService.onAuthStateChange((user) => {
        if (user) {
          setCurrentUser(user);
          setDataSourceState('supabase_live');
          localStorage.setItem('slt_user', JSON.stringify(user));
          localStorage.setItem('slt_datasource', 'supabase_live');
        } else {
          // If logged out from Supabase and not explicitly in demo mode, clear user
          const savedSource = localStorage.getItem('slt_datasource');
          if (savedSource !== 'simulation_demo') {
            setCurrentUser(null);
            localStorage.removeItem('slt_user');
          }
        }
      });

      return () => {
        unsubAuth();
      };
    }
  }, []);

  // Realtime subscription effect
  useEffect(() => {
    if (!isSupabaseConfigured || !isAuthenticated || dataSource !== 'supabase_live') return;

    loadDashboardData();

    // Subscribe to devices and telemetry
    const { unsubscribe: unsubDevices } = deviceService.subscribeToDevices(() => {
      loadDashboardData();
    });

    // Subscribe to alerts
    const { unsubscribe: unsubAlerts } = alertService.subscribeToAlerts(() => {
      alertService.getAlerts().then((updated) => setAlerts(updated));
    });

    // Subscribe to command execution updates
    const { unsubscribe: unsubCommands } = deviceService.subscribeToCommands(
      selectedDeviceId,
      (updatedCmd) => {
        setCommands((prev) => {
          const exists = prev.some((c) => c.id === updatedCmd.id);
          if (exists) {
            return prev.map((c) => (c.id === updatedCmd.id ? updatedCmd : c));
          } else {
            return [updatedCmd, ...prev];
          }
        });
      }
    );

    // Subscribe to device_images (Realtime update foto baki)
    const { unsubscribe: unsubImages } = deviceImagesService.subscribeToDeviceImages(() => {
      loadDashboardData();
    });

    return () => {
      unsubDevices();
      unsubAlerts();
      unsubCommands();
      unsubImages();
    };
  }, [isAuthenticated, dataSource, loadDashboardData, selectedDeviceId]);

  const setAppMode = (mode: 'landing' | 'dashboard') => {
    if (mode === 'dashboard' && !currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    setAppModeState(mode);
    try {
      localStorage.setItem('slt_app_mode', mode);
    } catch {}
  };

  /**
   * Login strictly using Supabase Auth.
   * If authentication fails, returns { success: false, error } without setting mock data.
   */
  const login = async (email: string, password?: string): Promise<{ success: boolean; error: string | null }> => {
    const res = await authService.signIn(email, password);
    if (res.user) {
      setCurrentUser(res.user);
      setDataSourceState('supabase_live');
      try {
        localStorage.setItem('slt_user', JSON.stringify(res.user));
        localStorage.setItem('slt_datasource', 'supabase_live');
        localStorage.setItem('slt_app_mode', 'dashboard');
      } catch {}
      setIsLoginModalOpen(false);
      setAppModeState('dashboard');
      loadDashboardData();
      return { success: true, error: null };
    } else {
      return { success: false, error: res.error || 'Autentikasi gagal. Periksa kembali akun Anda.' };
    }
  };

  /**
   * Register a new user via Supabase Auth with strict 'viewer' role.
   */
  const signUp = async (
    email: string,
    password: string,
    fullName: string
  ): Promise<{ success: boolean; needsConfirmation: boolean; error: string | null }> => {
    const res = await authService.signUp(email, password, fullName);
    if (res.error) {
      return { success: false, needsConfirmation: false, error: res.error };
    }

    if (res.user && !res.needsConfirmation) {
      setCurrentUser(res.user);
      setDataSourceState('supabase_live');
      try {
        localStorage.setItem('slt_user', JSON.stringify(res.user));
        localStorage.setItem('slt_datasource', 'supabase_live');
        localStorage.setItem('slt_app_mode', 'dashboard');
      } catch {}
      setIsLoginModalOpen(false);
      setAppModeState('dashboard');
      loadDashboardData();
    }

    return { success: true, needsConfirmation: res.needsConfirmation, error: null };
  };

  /**
   * Explicit Demo/Simulation Mode for UI preview without contacting live Supabase.
   */
  const loginAsDemo = (demoUser: UserProfile) => {
    setCurrentUser(demoUser);
    setDataSourceState('simulation_demo');
    try {
      localStorage.setItem('slt_user', JSON.stringify(demoUser));
      localStorage.setItem('slt_datasource', 'simulation_demo');
      localStorage.setItem('slt_app_mode', 'dashboard');
    } catch {}
    setDevices(INITIAL_DEVICES);
    setAlerts(INITIAL_ALERTS);
    setCommands(INITIAL_COMMANDS);
    setCaptures(MOCK_CAPTURES);
    setWaterLogs(MOCK_WATER_LOGS);
    setDevicesEmpty(false);
    setDevicesError(null);
    setIsLoginModalOpen(false);
    setAppModeState('dashboard');
  };

  const logout = async () => {
    await authService.signOut();
    setCurrentUser(null);
    setDataSourceState('supabase_live');
    setDevices([]);
    try {
      localStorage.removeItem('slt_user');
      localStorage.removeItem('slt_datasource');
      localStorage.setItem('slt_app_mode', 'landing');
      localStorage.removeItem('slt_active_tab');
    } catch {}
    setAppModeState('landing');
    setIsLoginModalOpen(false);
  };

  const acknowledgeAlert = async (alertId: string, operatorName = 'Operator Lapangan') => {
    if (!hasPermission(currentUser?.role, 'action:acknowledge_alert')) {
      alert('Akses Ditolak: Role Anda tidak memiliki wewenang untuk mengonfirmasi peringatan.');
      return;
    }
    await alertService.acknowledgeAlert(alertId, operatorName);
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
    if (!hasPermission(currentUser?.role, 'control:devices')) {
      throw new Error(
        'Akses Ditolak: Hanya Operator Teknis dan Administrator yang memiliki wewenang mengirim perintah pengendalian aktuator perangkat.'
      );
    }
    try {
      const createdCmd = await deviceService.sendCommand(deviceId, commandType, params);
      setCommands((prev) => [createdCmd, ...prev]);

      // If simulated or demo mode, execute simulated transitions
      if (!isSupabaseConfigured || selectedDevice.isSimulated) {
        return new Promise((resolve) => {
          setTimeout(() => {
            setCommands((prev) =>
              prev.map((cmd) => (cmd.id === createdCmd.id ? { ...cmd, status: 'SENT' } : cmd))
            );
          }, 600);

          setTimeout(() => {
            setCommands((prev) =>
              prev.map((cmd) => (cmd.id === createdCmd.id ? { ...cmd, status: 'ACKNOWLEDGED' } : cmd))
            );
          }, 1400);

          setTimeout(() => {
            let resp = 'Perintah berhasil dieksekusi oleh firmware ESP32-S3.';
            if (commandType === 'FORCE_WATER_CHANGE') {
              resp = 'Siklus kuras 25 detik dan pengisian baki tuntas. Kekeruhan air normal kembali.';
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
            } else if (commandType === 'SET_RELAY') {
              const rNum = params?.relay || 1;
              const rState = params?.state || 'ON';
              resp = `Relay ${rNum} berhasil diset ke ${rState} (Logika Active LOW).`;
              if (rNum === 4) {
                // Relay 4 is LED / Lamp
                setDevices((prev) =>
                  prev.map((d) =>
                    d.id === deviceId
                      ? {
                          ...d,
                          currentTelemetry: {
                            ...d.currentTelemetry,
                            lamp: {
                              ...d.currentTelemetry.lamp,
                              isActive: rState === 'ON',
                              ledCurrentMa: rState === 'ON' ? 850 : 0,
                            },
                          },
                        }
                      : d
                  )
                );
              }
            } else if (commandType === 'REBOOT_ESP32') {
              resp = 'ESP32-S3 reboot bersih dilakukan. RTC DS3231 dan modem 4G terhubung kembali.';
            }

            const completedCmd: DeviceCommand = {
              ...createdCmd,
              status: 'COMPLETED',
              executedAt: new Date().toISOString(),
              responseMessage: resp,
            };

            setCommands((prev) =>
              prev.map((cmd) => (cmd.id === createdCmd.id ? completedCmd : cmd))
            );
            resolve(completedCmd);
          }, 2500);
        });
      }

      return createdCmd;
    } catch (err: any) {
      throw err;
    }
  };

  const updateBoundingBoxLabel = async (
    captureId: string,
    boxId: string,
    newSpeciesId: InsectSpeciesId,
    operatorName: string
  ) => {
    if (!hasPermission(currentUser?.role, 'action:verify_detection')) {
      alert('Akses Ditolak: Role Anda tidak memiliki izin untuk mengoreksi label deteksi serangga.');
      return;
    }

    const currentCap = captures.find((c) => c.id === captureId);
    if (!currentCap) return;

    const updatedBoxes = currentCap.bboxes.map((box) =>
      box.id === boxId
        ? {
            ...box,
            speciesId: newSpeciesId,
            confidence: 1.0,
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
    const updated: CaptureImage = {
      ...currentCap,
      bboxes: updatedBoxes,
      totalPests: updatedBoxes.length,
      targetPestsCount: targetCount,
      otherInsectsCount: otherCount,
      isManuallyVerified: true,
      isAiProcessed: true,
      notes: `Diverifikasi & dikoreksi manual oleh ${operatorName} pada ${new Date().toLocaleTimeString('id-ID')}`,
    };

    setCaptures((prev) => prev.map((cap) => (cap.id === captureId ? updated : cap)));

    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((c) => c.id === captureId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('slt_custom_captures', JSON.stringify(list));
    } catch {}

    // Simpan permanen ke Supabase Database (capture_sessions, insect_detections, device_images)
    try {
      await pestService.saveManualAnnotations(updated, updatedBoxes, operatorName);
    } catch (e) {
      console.warn('[DeviceContext] Gagal sync label verifikasi ke Supabase:', e);
    }
  };

  const updateBoundingBoxCoords = async (
    captureId: string,
    boxId: string,
    coords: { x: number; y: number; width: number; height: number }
  ) => {
    const currentCap = captures.find((c) => c.id === captureId);
    if (!currentCap) return;

    const updatedBoxes = currentCap.bboxes.map((box) =>
      box.id === boxId
        ? {
            ...box,
            x: Math.max(0, Math.min(95, Math.round(coords.x * 10) / 10)),
            y: Math.max(0, Math.min(95, Math.round(coords.y * 10) / 10)),
            width: Math.max(2, Math.min(90, Math.round(coords.width * 10) / 10)),
            height: Math.max(2, Math.min(90, Math.round(coords.height * 10) / 10)),
            isManuallyVerified: true,
            verifiedBy: box.verifiedBy || currentUser?.name || 'Operator',
            verifiedAt: box.verifiedAt || new Date().toISOString(),
          }
        : box
    );

    const updated: CaptureImage = {
      ...currentCap,
      bboxes: updatedBoxes,
    };

    setCaptures((prev) => prev.map((cap) => (cap.id === captureId ? updated : cap)));

    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((c) => c.id === captureId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('slt_custom_captures', JSON.stringify(list));
    } catch {}

    try {
      await pestService.saveManualAnnotations(updated, updatedBoxes, currentUser?.name || 'Operator');
    } catch (e) {
      console.warn('[DeviceContext] Gagal sync koordinat kotak ke Supabase:', e);
    }
  };

  const deleteBoundingBox = async (captureId: string, boxId: string) => {
    const currentCap = captures.find((c) => c.id === captureId);
    if (!currentCap) return;

    const updatedBoxes = currentCap.bboxes.filter((b) => b.id !== boxId);
    const targetCount = updatedBoxes.filter(
      (b) => b.speciesId !== 'other_neutral' && b.speciesId !== 'unidentified'
    ).length;
    const otherCount = updatedBoxes.length - targetCount;
    const updated: CaptureImage = {
      ...currentCap,
      bboxes: updatedBoxes,
      totalPests: updatedBoxes.length,
      targetPestsCount: targetCount,
      otherInsectsCount: otherCount,
      isManuallyVerified: true,
      notes: `Kotak dihapus manual oleh ${currentUser?.name || 'Operator'}. Sisa: ${updatedBoxes.length} serangga.`,
    };

    setCaptures((prev) => prev.map((cap) => (cap.id === captureId ? updated : cap)));

    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((c) => c.id === captureId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('slt_custom_captures', JSON.stringify(list));
    } catch {}

    // Sinkronisasi ke Supabase database (capture_sessions, insect_detections, device_images)
    try {
      await pestService.saveManualAnnotations(updated, updatedBoxes, currentUser?.name || 'Operator');
    } catch (e) {
      console.warn('[DeviceContext] Gagal sync delete bounding box ke Supabase:', e);
    }
  };

  const addBoundingBox = async (captureId: string, newBox: BoundingBox) => {
    const currentCap = captures.find((c) => c.id === captureId);
    if (!currentCap) return;

    const updatedBoxes = [...currentCap.bboxes, newBox];
    const targetCount = updatedBoxes.filter(
      (b) => b.speciesId !== 'other_neutral' && b.speciesId !== 'unidentified'
    ).length;
    const otherCount = updatedBoxes.length - targetCount;
    const updated: CaptureImage = {
      ...currentCap,
      bboxes: updatedBoxes,
      totalPests: updatedBoxes.length,
      targetPestsCount: targetCount,
      otherInsectsCount: otherCount,
      isManuallyVerified: true,
      isAiProcessed: true,
      notes: `Ditambahkan manual oleh ${currentUser?.name || 'Operator'}. Total: ${updatedBoxes.length} serangga.`,
    };

    setCaptures((prev) => prev.map((cap) => (cap.id === captureId ? updated : cap)));

    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((c) => c.id === captureId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('slt_custom_captures', JSON.stringify(list));
    } catch {}

    // Sinkronisasi penambahan kotak ke Supabase database
    try {
      await pestService.saveManualAnnotations(updated, updatedBoxes, currentUser?.name || 'Operator');
    } catch (e) {
      console.warn('[DeviceContext] Gagal sync add bounding box ke Supabase:', e);
    }
  };

  const clearBoundingBoxes = async (captureId: string) => {
    const currentCap = captures.find((c) => c.id === captureId);
    if (!currentCap) return;

    const updated: CaptureImage = {
      ...currentCap,
      bboxes: [],
      totalPests: 0,
      targetPestsCount: 0,
      otherInsectsCount: 0,
      isManuallyVerified: true,
      notes: `Semua kotak anotasi dibersihkan manual oleh ${currentUser?.name || 'Operator'}.`,
    };

    setCaptures((prev) => prev.map((cap) => (cap.id === captureId ? updated : cap)));

    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
      const idx = list.findIndex((c) => c.id === captureId);
      if (idx >= 0) {
        list[idx] = updated;
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('slt_custom_captures', JSON.stringify(list));
    } catch {}

    // Sinkronisasi pembersihan kotak ke Supabase database
    try {
      await pestService.saveManualAnnotations(updated, [], currentUser?.name || 'Operator');
    } catch (e) {
      console.warn('[DeviceContext] Gagal sync clear bounding box ke Supabase:', e);
    }
  };

  const addCapture = (newCapture: CaptureImage) => {
    setCaptures((prev) => [newCapture, ...prev]);
    try {
      const existing = localStorage.getItem('slt_custom_captures');
      const list = existing ? JSON.parse(existing) : [];
      localStorage.setItem('slt_custom_captures', JSON.stringify([newCapture, ...list]));
    } catch {}
  };

  const deleteCapture = async (
    captureId: string,
    dbRecordId?: number,
    filePath?: string,
    imageUrl?: string
  ) => {
    const target = captures.find((c) => c.id === captureId);
    const finalDbId =
      dbRecordId ||
      target?.dbRecordId ||
      (captureId.startsWith('IMG-DB-')
        ? parseInt(captureId.replace('IMG-DB-', ''), 10)
        : undefined);
    const finalFilePath =
      filePath ||
      target?.filePath ||
      (target?.imageUrl && target.imageUrl.includes('/captures/')
        ? 'captures/' + target.imageUrl.split('/captures/')[1].split('?')[0]
        : undefined);
    const finalImageUrl = imageUrl || target?.imageUrl;

    // 1. Tambahkan ke daftar tombstone agar foto tidak pernah muncul kembali setelah refresh
    addDeletedCaptureTombstone(
      captureId,
      finalDbId,
      finalDbId ? `db-${finalDbId}` : undefined,
      finalDbId ? `IMG-DB-${finalDbId}` : undefined,
      finalFilePath,
      finalImageUrl,
      `SES-${captureId}`,
      finalDbId ? `SES-IMG-DB-${finalDbId}` : undefined
    );

    // 2. Bersihkan dari state memori React secara instan
    setCaptures((prev) =>
      prev.filter((c) => {
        if (c.id === captureId) return false;
        if (finalDbId && (c.dbRecordId === finalDbId || c.id === `IMG-DB-${finalDbId}`)) return false;
        if (finalFilePath && c.filePath === finalFilePath) return false;
        if (finalImageUrl && c.imageUrl === finalImageUrl) return false;
        return true;
      })
    );

    // 3. Bersihkan dari localStorage cache
    try {
      const custom = localStorage.getItem('slt_custom_captures');
      if (custom) {
        const list: CaptureImage[] = JSON.parse(custom);
        const filtered = list.filter((c) => {
          if (c.id === captureId) return false;
          if (finalDbId && (c.dbRecordId === finalDbId || c.id === `IMG-DB-${finalDbId}`)) return false;
          if (finalFilePath && c.filePath === finalFilePath) return false;
          if (finalImageUrl && c.imageUrl === finalImageUrl) return false;
          return true;
        });
        localStorage.setItem('slt_custom_captures', JSON.stringify(filtered));
      }
    } catch {}

    // 4. Eksekusi penghapusan di database Supabase (device_images, capture_sessions, insect_detections) & storage
    try {
      const res = await deviceImagesService.deleteImage(
        finalDbId,
        finalFilePath,
        captureId,
        finalImageUrl
      );
      if (!res.success && res.error) {
        console.warn('[DeviceContext] Peringatan hapus di database Supabase:', res.error);
      }
    } catch (err) {
      console.warn('[DeviceContext] Exception saat menghapus gambar di Supabase:', err);
    }
  };

  /**
   * Menjalankan inferensi model deteksi & klasifikasi serangga berbasis dataset IP102
   * pada citra baki yang dipilih.
   */
  const runAiDetection = async (captureId: string): Promise<CaptureImage | null> => {
    const target = captures.find((c) => c.id === captureId);
    if (!target) return null;

    try {
      const result = await aiDetectionService.runInference(target);

      const updatedCapture: CaptureImage = {
        ...target,
        bboxes: result.bboxes,
        totalPests: result.totalPests,
        targetPestsCount: result.targetPestsCount,
        otherInsectsCount: result.otherInsectsCount,
        avgConfidence: result.avgConfidence,
        modelVersion: result.modelVersion,
        notes: result.notes,
        isManuallyVerified: false,
        isAiProcessed: true,
      };

      setCaptures((prev) =>
        prev.map((c) => (c.id === captureId ? updatedCapture : c))
      );

      // Simpan di local storage cache agar tidak hilang saat reload
      try {
        const existing = localStorage.getItem('slt_custom_captures');
        const list: CaptureImage[] = existing ? JSON.parse(existing) : [];
        const index = list.findIndex((c) => c.id === captureId);
        if (index >= 0) {
          list[index] = updatedCapture;
        } else {
          list.unshift(updatedCapture);
        }
        localStorage.setItem('slt_custom_captures', JSON.stringify(list));
      } catch {}

      return updatedCapture;
    } catch (err) {
      console.error('[DeviceContext] Gagal menjalankan inferensi deteksi hama:', err);
      return null;
    }
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

    try {
      if (isSupabaseConfigured) {
        // Call Edge Function send-telegram-alert
        const { data, error } = await supabase.functions.invoke('send-telegram-alert', {
          body: {
            alert_type: 'test_notification',
            severity: 'info',
            title: 'Tes Integrasi Notifikasi Smart Light Trap',
            message: `Pesan uji coba sistem Smart Light Trap Subang dikirim pada ${new Date().toLocaleString('id-ID')}`,
            device_code: selectedDevice.code,
            location_name: selectedDevice.locationName,
          },
        });

        if (error) {
          throw new Error(error.message || 'Gagal menghubungi Supabase Edge Function.');
        }

        if (data && !data.success) {
          throw new Error(data.details || data.error || 'Telegram Bot API menolak pengiriman.');
        }

        setTelegramConfig((prev) => ({
          ...prev,
          lastTestStatus: 'success',
          lastTestMessage: `Pesan sukses dikirim via Supabase Edge Function ke Telegram Chat ID ${prev.chatId || '1523500422'}.`,
        }));
        return;
      }

      throw new Error('Klien Supabase belum terkonfigurasi. Pastikan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY diatur di .env.');
    } catch (err: any) {
      setTelegramConfig((prev) => ({
        ...prev,
        lastTestStatus: 'failed',
        lastTestMessage: err?.message || 'Gagal mengirim pesan uji coba.',
      }));
    }
  };

  /**
   * Device Management (Admin Only)
   */
  const createDevice = async (deviceData: any): Promise<ProvisionDeviceResult> => {
    if (!hasPermission(currentUser?.role, 'manage:devices')) {
      throw new Error('Akses Ditolak: Hanya Administrator yang berhak menambahkan unit perangkat.');
    }
    const result = await deviceService.createDevice(deviceData);
    await loadDashboardData();
    return result;
  };

  const rotateDeviceToken = async (deviceCode: string): Promise<DeviceProvisioningCredentials> => {
    if (!hasPermission(currentUser?.role, 'manage:devices')) {
      throw new Error('Akses Ditolak: Hanya Administrator yang berhak merotasi token API perangkat.');
    }
    const creds = await deviceService.rotateDeviceToken(deviceCode);
    await loadDashboardData();
    return creds;
  };

  const updateDevice = async (id: string, updates: any): Promise<boolean> => {
    if (!hasPermission(currentUser?.role, 'manage:devices')) {
      throw new Error('Akses Ditolak: Hanya Administrator yang berhak memperbarui unit perangkat.');
    }
    const success = await deviceService.updateDevice(id, updates);
    await loadDashboardData();
    return success;
  };

  const deleteDevice = async (id: string): Promise<boolean> => {
    if (!hasPermission(currentUser?.role, 'manage:devices')) {
      throw new Error('Akses Ditolak: Hanya Administrator yang berhak menghapus unit perangkat.');
    }
    const success = await deviceService.deleteDevice(id);
    await loadDashboardData();
    return success;
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
        addCapture,
        deleteCapture,
        runAiDetection,
        deleteBoundingBox,
        addBoundingBox,
        clearBoundingBoxes,
        updateBoundingBoxLabel,
        updateBoundingBoxCoords,
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
        signUp,
        loginAsDemo,
        logout,
        createDevice,
        rotateDeviceToken,
        updateDevice,
        deleteDevice,
        dataSource,
        dataSourceMode: dataSource,
        setDataSource,
        isLiveConnected,
        isLoadingData,
        devicesLoading,
        devicesEmpty,
        devicesError,
        refreshData: loadDashboardData,
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

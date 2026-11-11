import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Wifi,
  Bug,
  BatteryWarning,
  Droplets,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  ExternalLink,
  Activity,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { pestService } from '../../services/pestService';
import { DailyPestTrend } from '../../types';
import { INSECT_SPECIES_LIST } from '../../data/mockData';

export const OverviewView: React.FC = () => {
  const { devices, alerts, setActiveTab, setSelectedDeviceId, dataSource } = useDevice();

  const [pestTrends, setPestTrends] = useState<DailyPestTrend[]>([]);
  const [isLoadingTrends, setIsLoadingTrends] = useState<boolean>(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadTrends = async () => {
      setIsLoadingTrends(true);
      setTrendError(null);
      try {
        const trends = await pestService.getDailyPestTrends(undefined, 7);
        if (isMounted) {
          setPestTrends(trends);
        }
      } catch (err: any) {
        if (isMounted) {
          setTrendError(err.message || 'Gagal memuat tren hama');
        }
      } finally {
        if (isMounted) {
          setIsLoadingTrends(false);
        }
      }
    };

    loadTrends();
    return () => {
      isMounted = false;
    };
  }, [dataSource]);

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === 'online').length;
  const offlineDevices = devices.filter((d) => d.status === 'offline').length;
  const lowBatteryDevices = devices.filter(
    (d) => d.currentTelemetry.battery.busVoltageV < 12.0
  ).length;
  const lowWaterDevices = devices.filter(
    (d) => d.currentTelemetry.water.tankLevelPercent < 20
  ).length;
  const activeAlerts = alerts.filter((a) => !a.isAcknowledged).length;

  // Pest numbers today & yesterday
  const todayTrend = pestTrends.length > 0 ? pestTrends[pestTrends.length - 1] : null;
  const yesterdayTrend = pestTrends.length > 1 ? pestTrends[pestTrends.length - 2] : null;
  const pestDeltaPercent =
    todayTrend && yesterdayTrend && yesterdayTrend.totalTarget > 0
      ? Math.round(((todayTrend.totalTarget - yesterdayTrend.totalTarget) / yesterdayTrend.totalTarget) * 100)
      : 0;

  const highestPest =
    pestTrends.length > 0 ? Math.max(...pestTrends.map((d) => d.totalAll), 0) : 0;
  const maxPestCount = Math.max(Math.ceil((highestPest || 10) / 10) * 10, 20);
  const gridSteps = [
    0,
    Math.round(maxPestCount * 0.25),
    Math.round(maxPestCount * 0.5),
    Math.round(maxPestCount * 0.75),
    maxPestCount,
  ];

  return (
    <div className="space-y-4">
      {/* Page Header — Clean & Minimal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Ringkasan Lahan
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1DCD6] bg-white px-2.5 py-1 text-xs font-medium text-[#192A20] shadow-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                dataSource === 'supabase_live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="text-[11px]">
              {dataSource === 'supabase_live' ? 'Live Subang' : 'Mode Simulasi'}
            </span>
          </span>
          <button
            onClick={() => setActiveTab('devices')}
            className="inline-flex items-center gap-1 rounded-lg bg-[#1B4332] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[#2D6A4F] transition-colors cursor-pointer"
          >
            <span>Kelola Armada</span>
            <ExternalLink className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* KPI Cards Strip — Compact & Clickable */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Perangkat */}
        <div
          onClick={() => setActiveTab('devices')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#2D6A4F] transition-all cursor-pointer group"
          title="Klik untuk membuka Manajemen Perangkat"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Perangkat</span>
            <Cpu className="h-3.5 w-3.5 text-[#52796F] group-hover:text-[#2D6A4F]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {totalDevices}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[10px] text-[#2D6A4F] font-medium">
            <Wifi className="h-2.5 w-2.5 shrink-0" />
            <span>{onlineDevices} Online</span>
            <span className="text-[#A0AEC0]">·</span>
            <span className="text-[#718096]">{offlineDevices} Off</span>
          </div>
        </div>

        {/* Hama Sasaran Hari Ini */}
        <div
          onClick={() => setActiveTab('pests')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#D97706] transition-all cursor-pointer group"
          title="Klik untuk membuka Analisis Hama PHT"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Hama Hari Ini</span>
            <Bug className="h-3.5 w-3.5 text-[#D97706]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {todayTrend ? todayTrend.totalTarget : 0}
          </div>
          <div className="mt-0.5 flex items-center gap-0.5 text-[10px] text-[#DC2626] font-semibold">
            {pestDeltaPercent >= 0 ? (
              <ArrowUpRight className="h-2.5 w-2.5 shrink-0" />
            ) : (
              <ArrowDownRight className="h-2.5 w-2.5 shrink-0" />
            )}
            <span>{pestDeltaPercent >= 0 ? `+${pestDeltaPercent}%` : `${pestDeltaPercent}%`} vs kemarin</span>
          </div>
        </div>

        {/* Serangga Netral */}
        <div
          onClick={() => setActiveTab('pests')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#52796F] transition-all cursor-pointer group"
          title="Klik untuk membuka Analisis Hama PHT"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Serangga Netral</span>
            <Layers className="h-3.5 w-3.5 text-[#52796F]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {todayTrend ? todayTrend.otherInsects : 0}
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096]">
            Total: {todayTrend ? todayTrend.totalAll : 0}
          </div>
        </div>

        {/* Baterai Rendah */}
        <div
          onClick={() => setActiveTab('energy')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#DC2626] transition-all cursor-pointer group"
          title="Klik untuk membuka Pemantauan Daya & Energi"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Baterai Rendah</span>
            <BatteryWarning className="h-3.5 w-3.5 text-[#DC2626]" />
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              lowBatteryDevices > 0 ? 'text-[#DC2626]' : 'text-[#192A20]'
            }`}
          >
            {lowBatteryDevices} <span className="text-[11px] font-normal text-[#718096]">unit</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096]">Cutoff 11.8V</div>
        </div>

        {/* Tandon Air Kritis */}
        <div
          onClick={() => setActiveTab('water')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#2B6CB0] transition-all cursor-pointer group"
          title="Klik untuk membuka Manajemen Air & Kuras"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Tandon Kritis</span>
            <Droplets className="h-3.5 w-3.5 text-[#2B6CB0]" />
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              lowWaterDevices > 0 ? 'text-[#D97706]' : 'text-[#192A20]'
            }`}
          >
            {lowWaterDevices} <span className="text-[11px] font-normal text-[#718096]">unit</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096]">&lt;20% tandon</div>
        </div>

        {/* Peringatan Aktif */}
        <div
          onClick={() => setActiveTab('alerts')}
          className="rounded-lg border border-[#E2E8F0] bg-white p-3 shadow-xs hover:border-[#DC2626] transition-all cursor-pointer group"
          title="Klik untuk membuka Peringatan Sistem"
        >
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span className="text-[11px] font-medium">Peringatan</span>
            <AlertTriangle className="h-3.5 w-3.5 text-[#DC2626]" />
          </div>
          <div
            className={`text-xl font-bold font-mono tabular-nums ${
              activeAlerts > 0 ? 'text-[#DC2626]' : 'text-[#192A20]'
            }`}
          >
            {activeAlerts}
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096]">Belum selesai</div>
        </div>
      </div>

      {/* Main Grid: Chart & Side Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Chart Column (2 cols) */}
        <div className="lg:col-span-2 rounded-lg border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2.5 mb-3">
            <h2 className="text-xs font-bold text-[#192A20]">
              Tren Tangkapan Hama (7 Hari Terakhir)
            </h2>
            <button
              onClick={() => setActiveTab('pests')}
              className="text-[11px] font-semibold text-[#2D6A4F] hover:text-[#1B4332] inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Detail Analisis</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          {isLoadingTrends ? (
            <div className="h-56 flex flex-col items-center justify-center text-xs text-[#718096]">
              <RefreshCw className="h-5 w-5 animate-spin text-[#2D6A4F] mb-1.5" />
              <span>Memuat data tren hama...</span>
            </div>
          ) : pestTrends.length === 0 ? (
            <div className="h-56 flex flex-col items-center justify-center text-xs text-[#718096] border border-dashed border-[#E2E8F0] rounded-lg bg-[#F8FAF9]">
              <Bug className="h-6 w-6 text-[#A0AEC0] mb-1.5" />
              <p className="font-semibold text-[#192A20]">Belum Ada Data Deteksi 7 Hari</p>
            </div>
          ) : (
            <div className="h-56 w-full">
              <svg className="w-full h-full overflow-hidden" viewBox="0 0 700 240">
                {/* Grid Lines */}
                {gridSteps.map((val, idx) => {
                  const y = 200 - (val / Math.max(maxPestCount, 1)) * 180;
                  return (
                    <g key={idx}>
                      <line
                        x1="40"
                        y1={y}
                        x2="690"
                        y2={y}
                        stroke="#EDF2F0"
                        strokeWidth="1"
                        strokeDasharray="4 4"
                      />
                      <text
                        x="32"
                        y={y + 4}
                        textAnchor="end"
                        fontSize="10"
                        fill="#A0AEC0"
                        className="font-mono tabular-nums"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Stacked Bars */}
                {pestTrends.map((item, idx) => {
                  const colWidth = 620 / Math.max(pestTrends.length, 1);
                  const x = 55 + idx * colWidth;
                  const barWidth = Math.min(colWidth * 0.6, 34);

                  const stemH = (item.stemBorer / Math.max(maxPestCount, 1)) * 180;
                  const planthopperH = (item.planthopper / Math.max(maxPestCount, 1)) * 180;
                  const otherH = (item.otherInsects / Math.max(maxPestCount, 1)) * 180;
                  const totalH = stemH + planthopperH + otherH;

                  const yStem = 200 - stemH;
                  const yPlanthopper = yStem - planthopperH;
                  const yOther = yPlanthopper - otherH;

                  return (
                    <g key={item.date} className="group cursor-pointer">
                      <rect x={x} y={yStem} width={barWidth} height={stemH} fill="#D97706" rx="2" />
                      <rect x={x} y={yPlanthopper} width={barWidth} height={planthopperH} fill="#2D6A4F" />
                      <rect x={x} y={yOther} width={barWidth} height={otherH} fill="#CBD5E1" rx="2" />
                      <text
                        x={x + barWidth / 2}
                        y="220"
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#4A5568"
                        fontWeight={idx === pestTrends.length - 1 ? 'bold' : 'normal'}
                      >
                        {item.dayLabel}
                      </text>
                      <text
                        x={x + barWidth / 2}
                        y={200 - totalH - 5}
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#192A20"
                        fontWeight="bold"
                        className="font-mono tabular-nums"
                      >
                        {item.totalAll}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Chart Legend — Compact */}
          <div className="flex flex-wrap items-center justify-center gap-4 pt-2.5 border-t border-[#E2E8F0] text-[11px] text-[#4A5568]">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#D97706]" />
              <span>Penggerek Batang</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#2D6A4F]" />
              <span>Wereng Coklat (WBC)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-xs bg-[#CBD5E1]" />
              <span>Serangga Netral</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#DC2626] font-medium">
              <span className="w-3 border-b-2 border-dashed border-[#DC2626]" />
              <span>Ambang PHT (50)</span>
            </div>
          </div>
        </div>

        {/* Right Column: Status & Armada */}
        <div className="space-y-3">
          {/* Status Operasional Hardware */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3.5 shadow-xs">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#52796F] mb-2.5">
              Status Operasional
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-md bg-[#F8FAF9] border border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
                  <span className="font-medium text-[#192A20]">Lampu UV (365nm)</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#2D6A4F] bg-[#EAF4EE] px-1.5 py-0.2 rounded">
                  18:00 - 05:00 WIB
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-[#F8FAF9] border border-[#E2E8F0]">
                <div className="flex items-center gap-2">
                  <Droplets className="h-3.5 w-3.5 text-[#2B6CB0]" />
                  <span className="font-medium text-[#192A20]">Otomasi Baki</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#192A20] bg-[#F1F5F2] px-1.5 py-0.2 rounded">
                  Siap Kuras
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-md bg-[#F6F9F5] border border-[#90A955]/30">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-[#4F772D]" />
                  <span className="font-medium text-[#132A13]">RTC DS3231</span>
                </div>
                <span className="text-[10px] font-mono font-semibold text-[#132A13] bg-[#ECF39E]/50 px-1.5 py-0.2 rounded">
                  Sinkron
                </span>
              </div>
            </div>
          </div>

          {/* Daftar Armada Lapangan */}
          <div className="rounded-lg border border-[#E2E8F0] bg-white p-3.5 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#52796F]">
                Armada Lapangan
              </h3>
              <span className="text-[10px] text-[#718096] font-mono">{devices.length} Unit</span>
            </div>

            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {devices.length === 0 ? (
                <div className="p-3 text-center text-xs text-[#718096]">Belum ada unit terdaftar.</div>
              ) : (
                devices.map((device) => {
                  const isOnline = device.status === 'online';
                  const hasWarning = device.status === 'warning';
                  return (
                    <div
                      key={device.id}
                      onClick={() => {
                        setSelectedDeviceId(device.id);
                        setActiveTab('devices');
                      }}
                      className="flex items-center justify-between p-2 rounded-md border border-[#E2E8F0] hover:border-[#2D6A4F] hover:bg-[#F8FAF9] transition-colors cursor-pointer text-xs"
                    >
                      <div className="truncate mr-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-[#192A20]">{device.code}</span>
                          <span className="text-[11px] text-[#718096] truncate">{device.locationName.split(' ')[0]}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-[11px] text-[#192A20] font-semibold">
                          {device.currentTelemetry.battery.busVoltageV.toFixed(1)}V
                        </span>
                        <span
                          className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded ${
                            isOnline
                              ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                              : hasWarning
                              ? 'bg-[#FEF3C7] text-[#D97706]'
                              : 'bg-[#FEE2E2] text-[#DC2626]'
                          }`}
                        >
                          {isOnline ? 'Online' : hasWarning ? 'Warn' : 'Off'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Species Target Reference — Compact Strip */}
      <div className="rounded-lg border border-[#E2E8F0] bg-white p-3.5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2 mb-2.5">
          <h2 className="text-xs font-bold text-[#192A20]">
            Target Hama Utama & Ambang PHT
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
          {INSECT_SPECIES_LIST.slice(0, 3).map((species) => (
            <div
              key={species.id}
              className="p-2.5 rounded-md border border-[#E2E8F0] bg-[#F8FAF9] text-xs flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-[#192A20] text-xs">{species.commonName}</div>
                <div className="text-[10px] text-[#718096]">
                  Ambang: <strong className="text-[#DC2626]">&gt;{species.economicThresholdPerNight}/malam</strong>
                </div>
              </div>
              <span className="font-mono text-[10px] font-bold text-[#2D6A4F] bg-[#EAF4EE] px-1.5 py-0.5 rounded shrink-0">
                {species.preferredWavelengthNm} nm
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

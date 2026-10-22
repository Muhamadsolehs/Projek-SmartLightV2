import React from 'react';
import {
  Cpu,
  Wifi,
  WifiOff,
  Bug,
  BatteryWarning,
  Droplets,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  ExternalLink,
  ShieldCheck,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { MOCK_DAILY_TRENDS, INSECT_SPECIES_LIST } from '../../data/mockData';

export const OverviewView: React.FC = () => {
  const { devices, alerts, setActiveTab, setSelectedDeviceId } = useDevice();

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

  // Pest numbers today
  const todayTrend = MOCK_DAILY_TRENDS[MOCK_DAILY_TRENDS.length - 1];
  const yesterdayTrend = MOCK_DAILY_TRENDS[MOCK_DAILY_TRENDS.length - 2];
  const pestDeltaPercent = Math.round(
    ((todayTrend.totalTarget - yesterdayTrend.totalTarget) / yesterdayTrend.totalTarget) * 100
  );

  // 7 days trend for chart
  const last7Days = MOCK_DAILY_TRENDS.slice(-7);
  const maxPestCount = Math.max(...last7Days.map((d) => d.totalAll));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Ringkasan Lahan</span>
      </nav>

      {/* Top Banner / Agritech Context */}
      <div className="rounded-xl border border-[#D1DCD6] bg-gradient-to-r from-[#F0F7F3] via-white to-[#F0F7F3] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2D6A4F]">
              <ShieldCheck className="h-4 w-4" />
              <span>Sistem Pemantauan Hama PHT Berbasis IoT & AI</span>
              <span className="text-[#A0AEC0]">·</span>
              <span className="text-[#718096]">Musim Tanam Rendengan 2026</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
              Ringkasan Operasional Lahan
            </h1>
            <p className="text-xs sm:text-sm text-[#52796F] max-w-2xl">
              Pemantauan populasi Penggerek Batang Padi dan Wereng Batang Coklat secara otomatis dengan baki air berkuras mandiri, panel surya INA226, dan konektivitas 4G LTE.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#D1DCD6] bg-white px-3 py-1.5 text-xs font-medium text-[#192A20] shadow-xs">
              <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
              Data Uji Lapangan Aktif (Simulasi ESP32-S3)
            </span>
            <button
              onClick={() => setActiveTab('devices')}
              className="inline-flex items-center gap-1 rounded-lg bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F] transition-colors"
            >
              <span>Kelola Armada</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Perangkat */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Total Perangkat</span>
            <Cpu className="h-4 w-4 text-[#52796F]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {totalDevices}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-[#2D6A4F]">
            <Wifi className="h-3 w-3" />
            <span className="font-semibold">{onlineDevices} Terhubung</span>
            <span className="text-[#718096]">· {offlineDevices} Offline</span>
          </div>
        </div>

        {/* Hama Sasaran Hari Ini */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Hama Sasaran Hari Ini</span>
            <Bug className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {todayTrend.totalTarget}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-[#DC2626] font-semibold">
            {pestDeltaPercent >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            <span>+{pestDeltaPercent}% vs kemarin</span>
          </div>
        </div>

        {/* Serangga Lain Hari Ini */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Serangga Netral</span>
            <Layers className="h-4 w-4 text-[#52796F]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {todayTrend.otherInsects}
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Total tangkapan: {todayTrend.totalAll}
          </div>
        </div>

        {/* Baterai Rendah (<12.0V) */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Baterai Rendah</span>
            <BatteryWarning className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${lowBatteryDevices > 0 ? 'text-[#DC2626]' : 'text-[#192A20]'}`}>
            {lowBatteryDevices} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Ambang cutoff: 11.8V
          </div>
        </div>

        {/* Tandon Air Kritis (<20%) */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Tandon Kritis</span>
            <Droplets className="h-4 w-4 text-[#2B6CB0]" />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${lowWaterDevices > 0 ? 'text-[#D97706]' : 'text-[#192A20]'}`}>
            {lowWaterDevices} <span className="text-xs font-normal text-[#718096]">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Dry-run safety lock
          </div>
        </div>

        {/* Peringatan Aktif */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Peringatan Aktif</span>
            <AlertTriangle className="h-4 w-4 text-[#DC2626]" />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${activeAlerts > 0 ? 'text-[#DC2626]' : 'text-[#192A20]'}`}>
            {activeAlerts}
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Belum dikonfirmasi
          </div>
        </div>
      </div>

      {/* Main Grid: Pest Population Chart + Sector Fleet Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Chart Column (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3 mb-4">
            <div>
              <h2 className="text-sm font-bold text-[#192A20]">
                Tren Tangkapan Populasi Hama (7 Hari Terakhir)
              </h2>
              <p className="text-xs text-[#718096]">
                Perbandingan Penggerek Batang Padi Kuning vs Wereng Batang Coklat (WBC) vs Serangga Netral
              </p>
            </div>
            <button
              onClick={() => setActiveTab('pests')}
              className="text-xs font-semibold text-[#2D6A4F] hover:text-[#1B4332] inline-flex items-center gap-1 self-start sm:self-auto"
            >
              <span>Detail Analisis PHT</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Custom Responsive SVG Chart */}
          <div className="h-64 w-full">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 700 240">
              {/* Grid Lines */}
              {[0, 60, 120, 180, 240].map((val, idx) => {
                const y = 200 - (val / maxPestCount) * 180;
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

              {/* Economic Threshold Reference Line (Ambang Kendali 50 ekor) */}
              {(() => {
                const thresholdY = 200 - (50 / maxPestCount) * 180;
                return (
                  <g>
                    <line
                      x1="40"
                      y1={thresholdY}
                      x2="690"
                      y2={thresholdY}
                      stroke="#DC2626"
                      strokeWidth="1.5"
                      strokeDasharray="6 3"
                    />
                    <text
                      x="685"
                      y={thresholdY - 5}
                      textAnchor="end"
                      fontSize="9"
                      fill="#DC2626"
                      fontWeight="bold"
                    >
                      Ambang Kendali PHT (50 ekor)
                    </text>
                  </g>
                );
              })()}

              {/* Stacked Bars for 7 days */}
              {last7Days.map((item, idx) => {
                const x = 70 + idx * 88;
                const barWidth = 36;
                const totalH = (item.totalAll / maxPestCount) * 180;
                const stemH = (item.stemBorer / maxPestCount) * 180;
                const planthopperH = (item.planthopper / maxPestCount) * 180;
                const otherH = (item.otherInsects / maxPestCount) * 180;

                const yStem = 200 - stemH;
                const yPlanthopper = yStem - planthopperH;
                const yOther = yPlanthopper - otherH;

                return (
                  <g key={item.date} className="group cursor-pointer">
                    {/* Stem borer (Red/Amber) */}
                    <rect
                      x={x}
                      y={yStem}
                      width={barWidth}
                      height={stemH}
                      fill="#D97706"
                      rx="2"
                    />
                    {/* Planthopper (Dark Green) */}
                    <rect
                      x={x}
                      y={yPlanthopper}
                      width={barWidth}
                      height={planthopperH}
                      fill="#2D6A4F"
                    />
                    {/* Other Neutral (Muted Gray-Green) */}
                    <rect
                      x={x}
                      y={yOther}
                      width={barWidth}
                      height={otherH}
                      fill="#CBD5E1"
                      rx="2"
                    />

                    {/* Date label */}
                    <text
                      x={x + barWidth / 2}
                      y="222"
                      textAnchor="middle"
                      fontSize="10"
                      fill="#4A5568"
                      fontWeight={idx === 6 ? 'bold' : 'normal'}
                    >
                      {item.dayLabel}
                    </text>

                    {/* Total on top */}
                    <text
                      x={x + barWidth / 2}
                      y={200 - totalH - 6}
                      textAnchor="middle"
                      fontSize="10"
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

          {/* Chart Legend */}
          <div className="flex flex-wrap items-center justify-center gap-5 pt-3 border-t border-[#E2E8F0] text-xs text-[#4A5568]">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#D97706]" />
              <span>Penggerek Batang Padi Kuning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#2D6A4F]" />
              <span>Wereng Batang Coklat (WBC)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#CBD5E1]" />
              <span>Serangga Netral / Non-Hama</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#DC2626] font-medium">
              <span className="w-4 border-b-2 border-dashed border-[#DC2626]" />
              <span>Garis Ambang PHT</span>
            </div>
          </div>
        </div>

        {/* Sector Distribution & Hardware Operational Status */}
        <div className="space-y-4">
          {/* Status Operasional Lampu & Baki */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F] mb-3">
              Status Operasional Lapangan
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0]">
                <div className="flex items-center gap-2.5">
                  <Lightbulb className="h-4 w-4 text-[#D97706]" />
                  <div>
                    <div className="font-semibold text-[#192A20]">Lampu Penarik UV (365nm)</div>
                    <div className="text-[11px] text-[#718096]">Jadwal Otomatis: 18:00 - 05:00 WIB</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#2D6A4F] bg-[#EAF4EE] px-2 py-0.5 rounded">
                  AKTIF MALAM
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0]">
                <div className="flex items-center gap-2.5">
                  <Droplets className="h-4 w-4 text-[#2B6CB0]" />
                  <div>
                    <div className="font-semibold text-[#192A20]">Otomasi Baki & Kekeruhan</div>
                    <div className="text-[11px] text-[#718096]">Sensor DF-Robot & Solenoid 12V</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#192A20] bg-[#F1F5F2] px-2 py-0.5 rounded">
                  SIAP KURAS
                </span>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-[#F6F9F5] border border-[#90A955]/30">
                <div className="flex items-center gap-2.5">
                  <Activity className="h-4 w-4 text-[#4F772D]" />
                  <div>
                    <div className="font-semibold text-[#132A13]">Otomasi RTC DS3231</div>
                    <div className="text-[11px] text-[#4F772D]">Tersinkronisasi Cadangan Koin</div>
                  </div>
                </div>
                <span className="font-mono text-[11px] font-semibold text-[#132A13] bg-[#ECF39E]/50 px-2 py-0.5 rounded">
                  TERVALIDASI
                </span>
              </div>
            </div>
          </div>

          {/* Ringkasan Perangkat Lapangan */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
                Daftar Unit Terpasang
              </h3>
              <span className="text-[11px] text-[#718096]">4 Unit</span>
            </div>

            <div className="space-y-2">
              {devices.map((device) => {
                const isOnline = device.status === 'online';
                const hasWarning = device.status === 'warning';
                return (
                  <div
                    key={device.id}
                    onClick={() => {
                      setSelectedDeviceId(device.id);
                      setActiveTab('devices');
                    }}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-[#E2E8F0] hover:border-[#2D6A4F] hover:bg-[#F8FAF9] transition-colors cursor-pointer text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-[#192A20]">
                          {device.code}
                        </span>
                        <span className="text-[#718096]">· {device.locationName.split(' ')[0]}</span>
                      </div>
                      <div className="text-[11px] text-[#52796F] truncate max-w-[180px]">
                        {device.cropType}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-mono tabular-nums text-[#192A20] font-semibold">
                        {device.currentTelemetry.battery.busVoltageV.toFixed(2)} V
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isOnline
                            ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                            : hasWarning
                            ? 'bg-[#FEF3C7] text-[#D97706]'
                            : 'bg-[#FEE2E2] text-[#DC2626]'
                        }`}
                      >
                        {isOnline ? 'Online' : hasWarning ? 'Peringatan' : 'Offline'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Species Target Reference Grid */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3 mb-4">
          <div>
            <h2 className="text-sm font-bold text-[#192A20]">
              Karakteristik Hama Sasaran Lampu Perangkap
            </h2>
            <p className="text-xs text-[#718096]">
              Parameter panjang gelombang UV LED dan batas ambang ekonomi kendali PHT
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {INSECT_SPECIES_LIST.slice(0, 3).map((species) => (
            <div
              key={species.id}
              className="p-3.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] space-y-2 text-xs"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-[#192A20]">{species.commonName}</h3>
                  <div className="font-serif italic text-[11px] text-[#52796F]">
                    {species.scientificName}
                  </div>
                </div>
                <span className="font-mono text-[11px] font-bold text-[#2D6A4F] bg-[#EAF4EE] px-2 py-0.5 rounded">
                  {species.preferredWavelengthNm} nm
                </span>
              </div>
              <p className="text-[11px] text-[#4A5568] leading-relaxed">
                {species.description}
              </p>
              <div className="pt-2 border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#718096]">
                <span>Ambang Kendali PHT:</span>
                <span className="font-mono font-bold text-[#DC2626]">
                  &gt; {species.economicThresholdPerNight} ekor/malam
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

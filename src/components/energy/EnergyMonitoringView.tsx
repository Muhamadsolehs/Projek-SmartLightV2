import React from 'react';
import {
  BatteryCharging,
  Sun,
  Zap,
  ShieldCheck,
  AlertTriangle,
  Info,
  Clock,
  Activity,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { MOCK_BATTERY_24H } from '../../data/mockData';

export const EnergyMonitoringView: React.FC = () => {
  const { selectedDevice, devices, setSelectedDeviceId } = useDevice();
  const tel = selectedDevice.currentTelemetry;
  const bat = tel.battery;

  const maxV = 14.6;
  const minV = 11.5;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Daya & Baterai</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Monitoring Tenaga Surya & Baterai
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Pengukuran tegangan bus, arus shunt sensor INA226, dan proteksi cut-off baterai LiFePO4 12.8V.
          </p>
        </div>

        {/* Device Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#718096]">Pilih Unit:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden"
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.code} - {d.locationName.split(' ')[0]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Telemetry Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tegangan Bus INA226 */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Tegangan Bus (V_bus)</span>
            <Zap className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {bat.busVoltageV.toFixed(2)} <span className="text-xs font-normal text-[#718096]">Volt</span>
          </div>
          <div className="mt-1 text-[11px] text-[#2D6A4F] font-semibold">
            Tegangan Shunt: {bat.shuntVoltageMv.toFixed(1)} mV
          </div>
        </div>

        {/* Arus Baterai Netto */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Arus Netto (I_load/charge)</span>
            <BatteryCharging className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <div className={`text-2xl font-bold font-mono tabular-nums ${bat.currentMa > 0 ? 'text-[#2D6A4F]' : 'text-[#192A20]'}`}>
            {bat.currentMa > 0 ? `+${bat.currentMa}` : bat.currentMa} <span className="text-xs font-normal text-[#718096]">mA</span>
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            {bat.isCharging ? 'Solar Charging Aktif' : 'Discharging (Beban Malam)'}
          </div>
        </div>

        {/* Daya Beban / Masukan */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Daya Listrik (P)</span>
            <Sun className="h-4 w-4 text-[#D97706]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {(bat.powerMw / 1000).toFixed(2)} <span className="text-xs font-normal text-[#718096]">Watt</span>
          </div>
          <div className="mt-1 text-[11px] text-[#718096]">
            Reg: 0x03 Power INA226
          </div>
        </div>

        {/* Ambang Cut-Off Firmware */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-1">
            <span>Batas Cut-off Aman</span>
            <ShieldCheck className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <div className="text-2xl font-bold font-mono tabular-nums text-[#192A20]">
            {selectedDevice.batteryCutoffThresholdV.toFixed(1)} <span className="text-xs font-normal text-[#718096]">Volt</span>
          </div>
          <div className="mt-1 text-[11px] text-[#52796F]">
            Mencegah over-discharge LiFePO4
          </div>
        </div>
      </div>

      {/* 24-Hour Voltage & Current Timeline Curve */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#192A20]">
              Riwayat Profil Tegangan & Arus Baterai (24 Jam Terakhir)
            </h2>
            <p className="text-xs text-[#718096]">
              Siklus pengisian panel surya siang hari (07:00 - 16:00) vs beban lampu UV malam hari (18:00 - 05:00)
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-[#2D6A4F] font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2D6A4F]" />
              Tegangan Bus (V)
            </span>
            <span className="flex items-center gap-1.5 text-[#D97706] font-semibold">
              <span className="h-2.5 w-2.5 rounded-full bg-[#D97706]" />
              Arus Solar (mA)
            </span>
          </div>
        </div>

        {/* SVG Chart */}
        <div className="h-64 w-full overflow-x-auto">
          <svg className="w-full min-w-[720px] h-full" viewBox="0 0 800 240">
            {/* Grid Lines */}
            {[11.5, 12.0, 12.5, 13.0, 13.5, 14.0, 14.5].map((v) => {
              const y = 200 - ((v - minV) / (maxV - minV)) * 180;
              return (
                <g key={v}>
                  <line
                    x1="45"
                    y1={y}
                    x2="780"
                    y2={y}
                    stroke="#EDF2F0"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x="38"
                    y={y + 4}
                    textAnchor="end"
                    fontSize="9.5"
                    fill="#A0AEC0"
                    className="font-mono tabular-nums"
                  >
                    {v.toFixed(1)}V
                  </text>
                </g>
              );
            })}

            {/* Cut-off Reference Line */}
            {(() => {
              const yCut = 200 - ((11.8 - minV) / (maxV - minV)) * 180;
              return (
                <g>
                  <line
                    x1="45"
                    y1={yCut}
                    x2="780"
                    y2={yCut}
                    stroke="#DC2626"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                  />
                  <text
                    x="775"
                    y={yCut - 4}
                    textAnchor="end"
                    fontSize="9"
                    fill="#DC2626"
                    fontWeight="bold"
                  >
                    Ambang Cutoff 11.8V
                  </text>
                </g>
              );
            })()}

            {/* Voltage Curve Polyline */}
            {(() => {
              const points = MOCK_BATTERY_24H.map((item, i) => {
                const x = 55 + (i / (MOCK_BATTERY_24H.length - 1)) * 710;
                const y = 200 - ((item.busVoltageV - minV) / (maxV - minV)) * 180;
                return `${x},${y}`;
              }).join(' ');

              return (
                <>
                  <polyline
                    fill="none"
                    stroke="#2D6A4F"
                    strokeWidth="2.5"
                    points={points}
                  />
                  {MOCK_BATTERY_24H.map((item, i) => {
                    const x = 55 + (i / (MOCK_BATTERY_24H.length - 1)) * 710;
                    const y = 200 - ((item.busVoltageV - minV) / (maxV - minV)) * 180;
                    return (
                      <circle
                        key={i}
                        cx={x}
                        cy={y}
                        r="3"
                        fill="#2D6A4F"
                        stroke="#FFFFFF"
                        strokeWidth="1.5"
                      />
                    );
                  })}
                </>
              );
            })()}

            {/* X Axis Time Labels */}
            {MOCK_BATTERY_24H.filter((_, i) => i % 3 === 0).map((item, i) => {
              const origIdx = i * 3;
              const x = 55 + (origIdx / (MOCK_BATTERY_24H.length - 1)) * 710;
              return (
                <text
                  key={item.hour}
                  x={x}
                  y="222"
                  textAnchor="middle"
                  fontSize="9.5"
                  fill="#718096"
                  className="font-mono tabular-nums"
                >
                  {item.hour}
                </text>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Engineering Note on LiFePO4 Voltage & Calibration */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-[#EAF4EE] text-[#1B4332] shrink-0">
            <Info className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-2 text-xs">
            <h3 className="font-bold text-[#192A20]">
              Pedoman Teknis Pengukuran Energi LiFePO4 & Proteksi Hardware
            </h3>
            <p className="text-[#4A5568] leading-relaxed">
              Baterai Lithium Iron Phosphate (LiFePO4) memiliki kurva pengosongan yang sangat datar di rentang 13.2V hingga 12.8V. Sesuai prinsip rekayasa agritech, persentase baterai tidak boleh diestimasi semata-mata dari tegangan tanpa kalibrasi Coulomb Counter (integrasi arus shunt INA226).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-[11px]">
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-1">Proteksi Hardware (BMS)</strong>
                <p className="text-[#718096]">
                  Proteksi primer dilakukan oleh BMS 4S 30A independen untuk over-voltage (14.6V) dan under-voltage (10.0V).
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-1">Proteksi Firmware ESP32</strong>
                <p className="text-[#718096]">
                  ESP32 mematikan relay lampu UV jika tegangan bus turun &lt; 11.8V selama 3 pembacaan berturut-turut untuk menjaga daya modem 4G.
                </p>
              </div>
              <div className="p-3 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-1">Kapasitas Panel Surya</strong>
                <p className="text-[#718096]">
                  Modul surya 50Wp monokristalin menghasilkan rata-rata 180Wh pada hari cerah, cukup untuk konsumsi harian 125Wh sistem.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

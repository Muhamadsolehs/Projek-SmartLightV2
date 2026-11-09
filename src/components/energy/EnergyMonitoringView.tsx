import React, { useState, useEffect } from 'react';
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
  RotateCw,
  Loader2,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { MOCK_BATTERY_24H } from '../../data/mockData';
import { telemetryService, TelemetryHistoryRecord } from '../../services/telemetryService';

export const EnergyMonitoringView: React.FC = () => {
  const { selectedDevice, devices, setSelectedDeviceId, dataSource } = useDevice();
  const tel = selectedDevice.currentTelemetry;
  const bat = tel.battery;

  const [history, setHistory] = useState<TelemetryHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  useEffect(() => {
    if (dataSource === 'simulation_demo') {
      // In simulation mode, use mock fixture
      setHistory([]);
      setIsLoadingHistory(false);
      return;
    }

    let isMounted = true;
    setIsLoadingHistory(true);
    setHistoryError(null);

    telemetryService
      .getTelemetryHistory(selectedDevice.id, 24)
      .then((data) => {
        if (isMounted) {
          setHistory(data);
          setIsLoadingHistory(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHistoryError(err.message || 'Gagal memuat riwayat telemetri.');
          setIsLoadingHistory(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedDevice.id, dataSource]);

  const maxV = 14.6;
  const minV = 11.5;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Monitoring Tenaga Surya &amp; Baterai
          </h1>
        </div>

        {/* Device Picker */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Unit:</span>
          <select
            value={selectedDevice.id}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="rounded-lg border border-[#E2E8F0] bg-white px-2.5 py-1 font-mono text-xs font-bold text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden"
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Tegangan Bus INA226 */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span>Tegangan Bus (V)</span>
            <Zap className="h-3.5 w-3.5 text-[#D97706]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {bat.busVoltageV.toFixed(2)} <span className="text-[11px] font-normal text-[#718096]">V</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#2D6A4F] font-semibold">
            Shunt: {bat.shuntVoltageMv.toFixed(1)} mV
          </div>
        </div>

        {/* Arus Baterai Netto */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span>Arus Netto</span>
            <BatteryCharging className="h-3.5 w-3.5 text-[#2D6A4F]" />
          </div>
          <div className={`text-xl font-bold font-mono tabular-nums ${bat.currentMa > 0 ? 'text-[#2D6A4F]' : 'text-[#192A20]'}`}>
            {bat.currentMa > 0 ? `+${bat.currentMa}` : bat.currentMa} <span className="text-[11px] font-normal text-[#718096]">mA</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096]">
            {bat.isCharging ? 'Solar Charging' : 'Discharging (Beban)'}
          </div>
        </div>

        {/* Daya Listrik */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span>Daya Listrik (P)</span>
            <Sun className="h-3.5 w-3.5 text-[#D97706]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {(bat.powerMw / 1000).toFixed(2)} <span className="text-[11px] font-normal text-[#718096]">W</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#718096] font-mono">
            INA226 0x03
          </div>
        </div>

        {/* Ambang Cut-Off */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-3 shadow-2xs">
          <div className="flex items-center justify-between text-xs text-[#718096] mb-0.5">
            <span>Cut-off Proteksi</span>
            <ShieldCheck className="h-3.5 w-3.5 text-[#2D6A4F]" />
          </div>
          <div className="text-xl font-bold font-mono tabular-nums text-[#192A20]">
            {selectedDevice.batteryCutoffThresholdV.toFixed(1)} <span className="text-[11px] font-normal text-[#718096]">V</span>
          </div>
          <div className="mt-0.5 text-[10px] text-[#52796F]">
            LiFePO4 Safe Cut-off
          </div>
        </div>
      </div>

      {/* 24-Hour Voltage & Current Timeline Curve */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 border-b border-[#E2E8F0] pb-2">
          <h2 className="text-xs font-bold text-[#192A20]">
            Profil Tegangan &amp; Arus Baterai (24 Jam)
          </h2>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-[#2D6A4F] font-semibold text-[11px]">
              <span className="h-2 w-2 rounded-full bg-[#2D6A4F]" />
              Tegangan (V)
            </span>
            <span className="flex items-center gap-1.5 text-[#D97706] font-semibold text-[11px]">
              <span className="h-2 w-2 rounded-full bg-[#D97706]" />
              Arus (mA)
            </span>
          </div>
        </div>

        {/* Loading / Empty / Live Chart Viewport */}
        {isLoadingHistory ? (
          <div className="h-56 flex flex-col items-center justify-center gap-1.5 bg-[#F8FAF9] rounded-lg border border-dashed border-[#CBD5E1]">
            <Loader2 className="h-6 w-6 text-[#2D6A4F] animate-spin" />
            <span className="text-xs text-[#52796F]">
              Memuat data telemetri INA226...
            </span>
          </div>
        ) : dataSource === 'supabase_live' && history.length === 0 ? (
          <div className="h-56 flex flex-col items-center justify-center gap-1.5 bg-[#F8FAF9] rounded-lg border border-dashed border-[#CBD5E1] p-4 text-center">
            <Zap className="h-6 w-6 text-[#90A955]" />
            <div className="font-bold text-xs text-[#132A13]">
              Belum Ada Riwayat Telemetri untuk Unit Ini
            </div>
            <p className="text-[11px] text-[#718096] max-w-sm">
              Data akan tampil secara otomatis saat mikrokontroler mengirimkan paket heartbeat telemetri.
            </p>
          </div>
        ) : (
          <div className="h-56 w-full overflow-x-auto">
            {(() => {
              const chartData =
                dataSource === 'simulation_demo' || history.length === 0
                  ? MOCK_BATTERY_24H.map((m) => ({
                      timeLabel: m.hour,
                      busVoltageV: m.busVoltageV,
                      currentMa: m.currentMa,
                    }))
                  : history.map((h) => ({
                      timeLabel: h.timeLabel,
                      busVoltageV: h.busVoltageV,
                      currentMa: h.currentMa,
                    }));

              return (
                <svg className="w-full min-w-[680px] h-full" viewBox="0 0 800 240">
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
                    const yCut = 200 - ((selectedDevice.batteryCutoffThresholdV - minV) / (maxV - minV)) * 180;
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
                          Cutoff {selectedDevice.batteryCutoffThresholdV.toFixed(1)}V
                        </text>
                      </g>
                    );
                  })()}

                  {/* Voltage Curve Polyline */}
                  {(() => {
                    const points = chartData
                      .map((item, i) => {
                        const x = 55 + (i / Math.max(1, chartData.length - 1)) * 710;
                        const clampedV = Math.max(minV, Math.min(maxV, item.busVoltageV));
                        const y = 200 - ((clampedV - minV) / (maxV - minV)) * 180;
                        return `${x},${y}`;
                      })
                      .join(' ');

                    return (
                      <>
                        <polyline
                          fill="none"
                          stroke="#2D6A4F"
                          strokeWidth="2"
                          points={points}
                        />
                        {chartData.map((item, i) => {
                          const x = 55 + (i / Math.max(1, chartData.length - 1)) * 710;
                          const clampedV = Math.max(minV, Math.min(maxV, item.busVoltageV));
                          const y = 200 - ((clampedV - minV) / (maxV - minV)) * 180;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="2.5"
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
                  {chartData
                    .filter((_, i) => i % Math.max(1, Math.floor(chartData.length / 8)) === 0)
                    .map((item, i) => {
                      const step = Math.max(1, Math.floor(chartData.length / 8));
                      const origIdx = Math.min(chartData.length - 1, i * step);
                      const x = 55 + (origIdx / Math.max(1, chartData.length - 1)) * 710;
                      return (
                        <text
                          key={origIdx}
                          x={x}
                          y="222"
                          textAnchor="middle"
                          fontSize="9"
                          fill="#718096"
                          className="font-mono tabular-nums"
                        >
                          {item.timeLabel}
                        </text>
                      );
                    })}
                </svg>
              );
            })()}
          </div>
        )}
      </div>

      {/* Engineering Note on LiFePO4 Voltage & Calibration */}
      <div className="rounded-xl border border-[#D1DCD6] bg-[#F8FAF9] p-3 shadow-2xs space-y-2">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 rounded-lg bg-[#EAF4EE] text-[#1B4332] shrink-0 mt-0.5">
            <Info className="h-4 w-4" />
          </div>
          <div className="flex-1 space-y-1.5 text-xs">
            <h3 className="font-bold text-[#192A20] text-xs">
              Catatan Teknis LiFePO4 &amp; Proteksi Sistem
            </h3>
            <p className="text-[#4A5568] leading-relaxed text-[11px]">
              Kurva pengosongan LiFePO4 sangat datar (13.2V–12.8V). Kapasitas diestimasi melalui integrasi arus shunt INA226 (Coulomb Counter).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-0.5 text-[11px]">
              <div className="p-2 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-0.5">BMS Hardware</strong>
                <p className="text-[#718096]">
                  BMS 4S 30A membatasi over-voltage (14.6V) dan under-voltage (10.0V).
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-0.5">Firmware Auto Cut-Off</strong>
                <p className="text-[#718096]">
                  Lampu UV dimatikan jika tegangan &lt; 11.8V untuk menjaga daya mikrokontroler.
                </p>
              </div>
              <div className="p-2 bg-white rounded-lg border border-[#E2E8F0]">
                <strong className="text-[#192A20] block mb-0.5">Panel Surya</strong>
                <p className="text-[#718096]">
                  50Wp menghasilkan ~180Wh/hari (konsumsi harian sistem ~125Wh).
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

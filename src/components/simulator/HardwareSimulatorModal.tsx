import React from 'react';
import {
  X,
  Play,
  RotateCcw,
  Droplets,
  Bug,
  BatteryLow,
  Sun,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { hasPermission } from '../../lib/permissions';

export const HardwareSimulatorModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    selectedDevice,
    triggerHardwareSimulation,
    isSimulatingAction,
    simulatedActionMessage,
    sendCommand,
    currentUser,
  } = useDevice();

  if (!isOpen || !hasPermission(currentUser?.role, 'manage:system_settings')) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-xl border border-[#E2E8F0] bg-white shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAF9] px-4 sm:px-6 py-3.5 sm:py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1B4332] text-white shrink-0">
              <Radio className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-[#192A20]">
                Simulator Perangkat Keras ESP32-S3
              </h2>
              <p className="text-[11px] sm:text-xs text-[#52796F]">
                Uji coba logika sensor hidraulik, baterai INA226, dan algoritma PHT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#718096] hover:bg-[#E2E8F0] hover:text-[#192A20] transition-colors shrink-0"
            aria-label="Tutup simulator"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {/* Target Device Selector */}
          <div>
            <label className="block text-xs font-semibold text-[#192A20] mb-1.5">
              Target Perangkat Uji Lapangan
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {devices.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setSelectedDeviceId(d.id)}
                  className={`p-2.5 text-left rounded-lg border text-xs transition-colors ${
                    selectedDeviceId === d.id
                      ? 'border-[#2D6A4F] bg-[#EAF4EE] text-[#1B4332] font-semibold'
                      : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:bg-[#F8FAF9]'
                  }`}
                >
                  <div className="font-mono text-[11px] font-bold">{d.code}</div>
                  <div className="truncate text-[10px] text-[#718096] mt-0.5">{d.locationName.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Live State Preview */}
          <div className="p-4 rounded-lg bg-[#F8FAF9] border border-[#E2E8F0] space-y-2 text-xs">
            <div className="font-semibold text-[#192A20] flex items-center justify-between">
              <span>Status Terkini {selectedDevice.code} ({selectedDevice.name})</span>
              <span className="font-mono text-[11px] text-[#2D6A4F]">Chip: {selectedDevice.esp32ChipId}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-[#718096]">Tegangan Baterai</div>
                <div className="font-mono tabular-nums font-bold text-[#192A20]">
                  {selectedDevice.currentTelemetry.battery.busVoltageV.toFixed(2)} V
                </div>
              </div>
              <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-[#718096]">Lampu UV (365nm)</div>
                <div className="font-mono font-bold text-[#192A20]">
                  {selectedDevice.currentTelemetry.lamp.isActive ? 'MENYALA' : 'MATI'}
                </div>
              </div>
              <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-[#718096]">Kekeruhan Air</div>
                <div className="font-mono tabular-nums font-bold text-[#192A20]">
                  {selectedDevice.currentTelemetry.water.turbidityNtu} NTU
                </div>
              </div>
              <div className="bg-white p-2 rounded border border-[#E2E8F0]">
                <div className="text-[10px] text-[#718096]">Level Tandon</div>
                <div className="font-mono tabular-nums font-bold text-[#192A20]">
                  {selectedDevice.currentTelemetry.water.tankLevelPercent}%
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Simulation Triggers */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
              Skenario Simulasi Hardware Interaktif
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Skenario 1: Water Change */}
              <div className="border border-[#E2E8F0] rounded-lg p-3 hover:border-[#CBD5E1] transition-colors bg-white">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-md bg-[#EBF8FF] text-[#2B6CB0] shrink-0">
                    <Droplets className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#192A20]">
                      Siklus Kuras & Isi Baki
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5 leading-snug">
                      Buka katup buang solenoid 12V, kosongkan baki keruh, nyalakan pompa tandon hingga sensor ultrasonik 85%.
                    </div>
                    <button
                      disabled={isSimulatingAction}
                      onClick={() => triggerHardwareSimulation('water_change_cycle')}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-[#2D6A4F] text-white rounded text-xs font-medium hover:bg-[#1B4332] disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Jalankan Siklus Air
                    </button>
                  </div>
                </div>
              </div>

              {/* Skenario 2: Pest Surge */}
              <div className="border border-[#E2E8F0] rounded-lg p-3 hover:border-[#CBD5E1] transition-colors bg-white">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-md bg-[#FEF3C7] text-[#D97706] shrink-0">
                    <Bug className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#192A20]">
                      Lonjakan Hama Nokturnal
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5 leading-snug">
                      Simulasikan serbuan Penggerek Batang Padi pada jam 20:00 WIB untuk menguji ambang batas PHT dan notifikasi.
                    </div>
                    <button
                      disabled={isSimulatingAction}
                      onClick={() => triggerHardwareSimulation('pest_surge')}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-[#D97706] text-white rounded text-xs font-medium hover:bg-[#B45309] disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Picukan Lonjakan Hama
                    </button>
                  </div>
                </div>
              </div>

              {/* Skenario 3: Low Battery */}
              <div className="border border-[#E2E8F0] rounded-lg p-3 hover:border-[#CBD5E1] transition-colors bg-white">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-md bg-[#FEE2E2] text-[#DC2626] shrink-0">
                    <BatteryLow className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#192A20]">
                      Drop Tegangan Baterai (11.75V)
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5 leading-snug">
                      Uji logika cut-off firmware INA226: peralihan ke mode hemat energi (Eco dimming) sebelum cutoff 11.8V.
                    </div>
                    <button
                      disabled={isSimulatingAction}
                      onClick={() => triggerHardwareSimulation('low_battery_eco')}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-[#DC2626] text-white rounded text-xs font-medium hover:bg-[#B91C1C] disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Simulasikan Baterai Rendah
                    </button>
                  </div>
                </div>
              </div>

              {/* Skenario 4: Depleted Tank Safety Lockout */}
              <div className="border border-[#E2E8F0] rounded-lg p-3 hover:border-[#CBD5E1] transition-colors bg-white">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 rounded-md bg-[#F3E8FF] text-[#7E22CE] shrink-0">
                    <AlertTriangle className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-[#192A20]">
                      Tandon Kosong & Dry-Run Lock
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5 leading-snug">
                      Turunkan air tandon ke 8% untuk menguji safety interlock: pompa dilarang berputar agar tidak terbakar.
                    </div>
                    <button
                      disabled={isSimulatingAction}
                      onClick={() => triggerHardwareSimulation('tank_depleted')}
                      className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 bg-[#7E22CE] text-white rounded text-xs font-medium hover:bg-[#6B21A8] disabled:opacity-50"
                    >
                      <Play className="h-3 w-3" />
                      Uji Safety Lockout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Hardware Commands */}
          <div className="pt-2 border-t border-[#E2E8F0]">
            <div className="text-xs font-bold uppercase tracking-wider text-[#52796F] mb-3">
              Perintah Jarak Jauh Langsung (Handshake TLS)
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                disabled={isSimulatingAction}
                onClick={() => sendCommand(selectedDeviceId, 'TOGGLE_LAMP')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-xs font-medium text-[#192A20] hover:bg-[#F8FAF9]"
              >
                <Lightbulb className="h-3.5 w-3.5 text-[#D97706]" />
                Toggle Saklar Lampu UV
              </button>
              <button
                disabled={isSimulatingAction}
                onClick={() => sendCommand(selectedDeviceId, 'CAPTURE_NOW')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-xs font-medium text-[#192A20] hover:bg-[#F8FAF9]"
              >
                <Sun className="h-3.5 w-3.5 text-[#2D6A4F]" />
                Ambil Snapshot Baki Sekarang
              </button>
              <button
                disabled={isSimulatingAction}
                onClick={() => sendCommand(selectedDeviceId, 'REBOOT_ESP32')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E2E8F0] bg-white rounded-lg text-xs font-medium text-[#192A20] hover:bg-[#F8FAF9]"
              >
                <RotateCcw className="h-3.5 w-3.5 text-[#718096]" />
                Soft Reboot ESP32-S3
              </button>
            </div>
          </div>

          {/* Simulation Status Feedback Box */}
          {simulatedActionMessage && (
            <div className="p-3 bg-[#EAF4EE] border border-[#A7D7C5] rounded-lg text-xs text-[#1B4332] flex items-center gap-2">
              {isSimulatingAction ? (
                <div className="h-4 w-4 border-2 border-[#2D6A4F] border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
              )}
              <span>{simulatedActionMessage}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E2E8F0] bg-[#F8FAF9] px-6 py-3 flex items-center justify-between text-xs text-[#718096]">
          <span>Mode: ESP32-S3 FreeRTOS Hardware Emulation</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#192A20] text-white font-medium rounded-lg hover:bg-[#2D3748]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

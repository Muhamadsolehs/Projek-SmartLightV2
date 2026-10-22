import React from 'react';
import {
  Sparkles,
  Compass,
  Cpu,
  Droplets,
  Sun,
  Wifi,
  CheckCircle2,
  Layers,
  RefreshCw,
  ArrowUpRight,
} from 'lucide-react';

interface FeaturePillarsSectionProps {
  activeFeatureTab: 'all' | 'siklus' | 'ai' | 'surya' | 'iot';
  setActiveFeatureTab: (tab: 'all' | 'siklus' | 'ai' | 'surya' | 'iot') => void;
  isCycleRunning: boolean;
  cycleProgress: number;
  cycleStep: string;
  runSimulatedFlushCycle: () => void;
  handleEnterDashboard: (targetTab?: string) => void;
}

export const FeaturePillarsSection: React.FC<FeaturePillarsSectionProps> = ({
  activeFeatureTab,
  setActiveFeatureTab,
  isCycleRunning,
  cycleProgress,
  cycleStep,
  runSimulatedFlushCycle,
  handleEnterDashboard,
}) => {
  return (
    <section id="fitur-unggulan" className="py-16 sm:py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#FAFDF9] via-[#F2F7F4] to-[#EAF2ED] border-b border-[#90A955]/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header: Two-tone Title & Subtitle matching reference design */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 sm:mb-10 gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#ECF39E]/80 text-[#132A13] border border-[#90A955]/50 mb-3 shadow-2xs">
              <Sparkles className="h-3.5 w-3.5 text-[#31572C]" />
              Pilar Fitur Utama Terintegrasi
            </span>
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight">
              <span className="text-[#132A13]">Pilar Fitur Utama </span>
              <span className="text-[#31572C]">Terintegrasi Padi Subang</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#52796F] max-w-3xl mt-2.5 leading-relaxed">
              Arsitektur 6 sub-sistem cerdas yang saling tersinkronisasi untuk memantau, menjebak hama nokturnal, membersihkan baki secara otomatis, dan memutus siklus serangan tanpa racun kimia berlebih.
            </p>
          </div>
        </div>

        {/* Main Layout Grid: Left Diamond Navigator Card + Right Stat Bar & 2-Card Grid (Aligned & Equal Height) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
          {/* LEFT COLUMN: Interactive Diamond / Rhombus Category Navigator (lg:col-span-4) */}
          <div className="lg:col-span-4 rounded-3xl border border-[#90A955]/40 bg-white p-5 sm:p-7 shadow-sm flex flex-col justify-between h-full">
            {/* Card Header */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] font-mono font-bold tracking-widest uppercase text-[#4F772D] flex items-center gap-1.5">
                  <Compass className="h-3.5 w-3.5 text-[#31572C]" /> NAVIGATION
                </span>
                <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-[#ECF39E]/80 text-[#132A13] border border-[#90A955]/40">
                  4 PILAR
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-[#132A13]">Pilih Kategori Pilar</h3>
              <p className="text-xs text-[#52796F] mt-1 leading-relaxed">
                Pilih salah satu modul pada kluster belah ketupat untuk menjelajahi fitur perangkat keras & AI.
              </p>
            </div>

            {/* Central Diamond / Rhombus Cluster */}
            <div className="relative my-6 sm:my-8 h-64 sm:h-72 w-full flex items-center justify-center select-none">
              {/* Decorative Dashed Background Circles & Cross Axis */}
              <div className="absolute w-52 h-52 sm:w-56 sm:h-56 rounded-full border border-dashed border-[#90A955]/30 pointer-events-none" />
              <div className="absolute w-36 h-36 rounded-full border border-[#90A955]/20 pointer-events-none" />
              <div className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-[#90A955]/35 to-transparent pointer-events-none" />
              <div className="absolute inset-y-10 left-1/2 w-px bg-gradient-to-b from-transparent via-[#90A955]/35 to-transparent pointer-events-none" />

              {/* Central Core Hub */}
              <div className="absolute z-10 w-11 h-11 rounded-full bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] flex items-center justify-center shadow-md border-2 border-white pointer-events-none">
                <Cpu className="h-5 w-5" />
              </div>

              {/* 1. TOP DIAMOND: SIKLUS */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('siklus')}
                className={`absolute top-1 sm:top-2 left-1/2 -translate-x-1/2 z-20 w-20 h-20 sm:w-22 sm:h-22 rotate-45 rounded-2xl transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 ${
                  activeFeatureTab === 'siklus'
                    ? 'bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] border-2 border-[#90A955] shadow-lg ring-4 ring-[#ECF39E]/60'
                    : 'bg-white hover:bg-[#F2F7F4] text-[#31572C] border-2 border-[#90A955]/40 hover:border-[#31572C]'
                }`}
                aria-label="Pilih kategori Siklus Otomatis"
              >
                <div className="-rotate-45 flex flex-col items-center justify-center text-center">
                  <Droplets className={`h-4.5 w-4.5 sm:h-5 sm:w-5 mb-0.5 ${activeFeatureTab === 'siklus' ? 'text-[#ECF39E]' : 'text-[#31572C]'}`} />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">SIKLUS</span>
                </div>
              </button>

              {/* 2. LEFT DIAMOND: AI VISION */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('ai')}
                className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-20 w-20 h-20 sm:w-22 sm:h-22 rotate-45 rounded-2xl transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 ${
                  activeFeatureTab === 'ai'
                    ? 'bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] border-2 border-[#90A955] shadow-lg ring-4 ring-[#ECF39E]/60'
                    : 'bg-white hover:bg-[#F2F7F4] text-[#31572C] border-2 border-[#90A955]/40 hover:border-[#31572C]'
                }`}
                aria-label="Pilih kategori AI Vision"
              >
                <div className="-rotate-45 flex flex-col items-center justify-center text-center">
                  <Sparkles className={`h-4.5 w-4.5 sm:h-5 sm:w-5 mb-0.5 ${activeFeatureTab === 'ai' ? 'text-[#ECF39E]' : 'text-[#31572C]'}`} />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">AI VISION</span>
                </div>
              </button>

              {/* 3. RIGHT DIAMOND: SURYA */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('surya')}
                className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-20 w-20 h-20 sm:w-22 sm:h-22 rotate-45 rounded-2xl transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 ${
                  activeFeatureTab === 'surya'
                    ? 'bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] border-2 border-[#90A955] shadow-lg ring-4 ring-[#ECF39E]/60'
                    : 'bg-white hover:bg-[#F2F7F4] text-[#31572C] border-2 border-[#90A955]/40 hover:border-[#31572C]'
                }`}
                aria-label="Pilih kategori Tenaga Surya"
              >
                <div className="-rotate-45 flex flex-col items-center justify-center text-center">
                  <Sun className={`h-4.5 w-4.5 sm:h-5 sm:w-5 mb-0.5 ${activeFeatureTab === 'surya' ? 'text-[#ECF39E]' : 'text-[#BC6C25]'}`} />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">SURYA</span>
                </div>
              </button>

              {/* 4. BOTTOM DIAMOND: IOT 4G */}
              <button
                type="button"
                onClick={() => setActiveFeatureTab('iot')}
                className={`absolute bottom-1 sm:bottom-2 left-1/2 -translate-x-1/2 z-20 w-20 h-20 sm:w-22 sm:h-22 rotate-45 rounded-2xl transition-all duration-200 flex items-center justify-center cursor-pointer shadow-sm hover:scale-105 ${
                  activeFeatureTab === 'iot'
                    ? 'bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] border-2 border-[#90A955] shadow-lg ring-4 ring-[#ECF39E]/60'
                    : 'bg-white hover:bg-[#F2F7F4] text-[#31572C] border-2 border-[#90A955]/40 hover:border-[#31572C]'
                }`}
                aria-label="Pilih kategori IoT & Telemetri"
              >
                <div className="-rotate-45 flex flex-col items-center justify-center text-center">
                  <Wifi className={`h-4.5 w-4.5 sm:h-5 sm:w-5 mb-0.5 ${activeFeatureTab === 'iot' ? 'text-[#ECF39E]' : 'text-[#31572C]'}`} />
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider">IOT 4G</span>
                </div>
              </button>
            </div>

            {/* Bottom Category Status Pill */}
            <div className="rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 p-3.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase text-[#52796F] block">Kategori Terpilih:</span>
                <span className="text-xs font-bold text-[#132A13] flex items-center gap-1.5 truncate mt-0.5">
                  <span className="h-2 w-2 rounded-full bg-[#4F772D] animate-pulse shrink-0" />
                  {activeFeatureTab === 'siklus' && 'Siklus Otomasi Hidraulik'}
                  {activeFeatureTab === 'ai' && 'AI Pest Analysis & PHT'}
                  {activeFeatureTab === 'surya' && 'Mandiri Surya & LiFePO4'}
                  {activeFeatureTab === 'iot' && 'Telemetri 4G & Bot Telegram'}
                  {activeFeatureTab === 'all' && 'Semua 4 Pilar Terintegrasi'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveFeatureTab('all')}
                className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                  activeFeatureTab === 'all'
                    ? 'bg-[#132A13] text-[#ECF39E] border-[#132A13]'
                    : 'bg-white text-[#31572C] border-[#90A955]/40 hover:bg-[#ECF39E]/40'
                }`}
              >
                {activeFeatureTab === 'all' ? 'Tampil Semua' : 'Lihat Semua'}
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: 3 Stat Cards + Sub-Heading + 2-Card Feature Grid (lg:col-span-8) */}
          <div className="lg:col-span-8 flex flex-col justify-between h-full space-y-6">
            {/* TOP 3 STAT METRIC CARDS (Directly matching reference layout) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-stretch">
              {/* Metric 1 */}
              <div className="bg-white rounded-2xl border border-[#90A955]/30 p-4 sm:p-5 shadow-xs hover:border-[#4F772D] transition-colors flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-[#132A13] font-mono tracking-tight">6+</span>
                  <div className="h-8 w-8 rounded-xl bg-[#ECF39E]/50 flex items-center justify-center text-[#31572C]">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-extrabold text-[#192A20]">Sub-Sistem Lapangan</div>
                  <div className="text-[11px] text-[#52796F] mt-0.5">Terintegrasi & Teruji Sawah</div>
                </div>
              </div>

              {/* Metric 2 */}
              <div className="bg-white rounded-2xl border border-[#90A955]/30 p-4 sm:p-5 shadow-xs hover:border-[#4F772D] transition-colors flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-[#31572C] font-mono tracking-tight">4</span>
                  <div className="h-8 w-8 rounded-xl bg-[#ECF39E]/50 flex items-center justify-center text-[#31572C]">
                    <Layers className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-extrabold text-[#192A20]">Pilar Kategori</div>
                  <div className="text-[11px] text-[#52796F] mt-0.5">Siklus, AI, Surya, IoT</div>
                </div>
              </div>

              {/* Metric 3 */}
              <div className="bg-white rounded-2xl border border-[#90A955]/30 p-4 sm:p-5 shadow-xs hover:border-[#4F772D] transition-colors flex flex-col justify-between h-full">
                <div className="flex items-center justify-between">
                  <span className="text-2xl sm:text-3xl font-black text-[#4F772D] font-mono tracking-tight">100%</span>
                  <div className="h-8 w-8 rounded-xl bg-[#ECF39E]/50 flex items-center justify-center text-[#BC6C25]">
                    <Sun className="h-4.5 w-4.5" />
                  </div>
                </div>
                <div className="mt-2">
                  <div className="text-xs sm:text-sm font-extrabold text-[#192A20]">Mandiri Energi</div>
                  <div className="text-[11px] text-[#52796F] mt-0.5">Operasi 24/7 Tanpa PLN</div>
                </div>
              </div>
            </div>

            {/* Active Category Section Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-[#90A955]/30">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#4F772D]" />
                <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-[#132A13]">
                  {activeFeatureTab === 'siklus' && '• SIKLUS OTOMASI HIDRAULIK'}
                  {activeFeatureTab === 'ai' && '• AI PEST ANALYSIS & PHT'}
                  {activeFeatureTab === 'surya' && '• MANDIRI SURYA & DAYA 24/7'}
                  {activeFeatureTab === 'iot' && '• KONEKTIVITAS IOT & TELEMETRI'}
                  {activeFeatureTab === 'all' && '• SELURUH SUB-SISTEM UNGGULAN'}
                </span>
              </div>
              <span className="text-[11px] font-mono font-medium text-[#52796F]">
                {activeFeatureTab === 'all' ? '6 Sub-Sistem Lapangan' : '2 Sub-Sistem Lapangan'}
              </span>
            </div>

            {/* 2-CARD GRID (Equal Height & Perfectly Aligned: flex-1 items-stretch) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 flex-1 items-stretch">
              {/* === PILAR 1: SIKLUS OTOMASI CARDS === */}
              {(activeFeatureTab === 'all' || activeFeatureTab === 'siklus') && (
                <>
                  {/* Siklus Card 1: Flush 25 Detik */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31572C]/10 text-[#31572C] border border-[#31572C]/20">
                          HIDRAULIK OTOMATIS
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          AKTIF 06:00
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[ESP32-S3]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[12V Solenoid]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Sensor NTU]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Siklus Kuras Baki 25 Detik
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Katup solenoid normally closed membuka otomatis setiap subuh selama 25 detik membuang kotoran serangga dan lumpur secara gravitasi langsung ke saluran sawah.
                      </p>

                      {/* Interactive Mini Console (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-between text-xs">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-[#132A13]">Simulasi Kuras Baki</span>
                            <button
                              type="button"
                              onClick={runSimulatedFlushCycle}
                              disabled={isCycleRunning}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                isCycleRunning
                                  ? 'bg-[#90A955] text-white'
                                  : 'bg-[#31572C] text-[#ECF39E] hover:bg-[#132A13]'
                              }`}
                            >
                              <RefreshCw className={`h-3 w-3 ${isCycleRunning ? 'animate-spin' : ''}`} />
                              <span>{isCycleRunning ? 'Proses...' : 'Uji 25s'}</span>
                            </button>
                          </div>
                          <div className="w-full bg-[#E2EAE4] h-2 rounded-full overflow-hidden my-1">
                            <div
                              className="bg-gradient-to-r from-[#4F772D] to-[#31572C] h-full transition-all duration-300"
                              style={{ width: `${cycleProgress}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-[#52796F] block truncate">{cycleStep}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Otomatisasi Penuh</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('water')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Lihat Detail Air</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Siklus Card 2: Pengisian Baki Mandiri */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#4F772D]/10 text-[#4F772D] border border-[#4F772D]/20">
                          PENGISIAN PREVENTIF
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          SIAGA AUTO
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Float Switch]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Pompa 12V DC]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Anti Dry-Run]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Tandon 5L & Bilas Mandiri
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Sensor pelampung ganda memantau level air baki. Jika air berkurang akibat evaporasi terik sawah, pompa mengisi otomatis tanpa risiko pompa rusak kering.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Volume Tandon:</span>
                            <span className="font-mono font-bold text-[#132A13]">5.0 Liter (Bersih)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Level Air Baki:</span>
                            <span className="font-mono font-bold text-[#31572C]">85% (Optimal)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Sensor Kekeruhan:</span>
                            <span className="font-mono font-semibold text-emerald-700">18 NTU (Jernih)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Sistem Proteksi</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('water')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Lihat Detail Hidraulik</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* === PILAR 2: AI PEST ANALYSIS CARDS === */}
              {(activeFeatureTab === 'all' || activeFeatureTab === 'ai') && (
                <>
                  {/* AI Card 1: YOLOv8 Computer Vision */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31572C]/10 text-[#31572C] border border-[#31572C]/20">
                          COMPUTER VISION
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          94.2% AKURASI
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[OV5640]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[YOLOv8-Nano]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[NPU ESP32]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Klasifikasi 6 Ordo Hama Subang
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Kamera makro mengambil snapshot resolusi tinggi saat subuh. Model edge AI mendeteksi wereng coklat, penggerek batang, dan membedakan musuh alami secara instan.
                      </p>

                      {/* Mini Detection Meter (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Wereng Batang Coklat (WBC):</span>
                            <span className="font-mono font-bold text-[#132A13]">96.4% Konfiden</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Penggerek Batang Padi:</span>
                            <span className="font-mono font-bold text-[#31572C]">93.8% Konfiden</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Musuh Alami (Kepik Mirid):</span>
                            <span className="font-mono font-semibold text-emerald-700">Dikecualikan (Aman)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Edge AI Inference</span>
                      <a
                        href="#ai-classifier"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Uji Klasifikasi AI</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* AI Card 2: Ambang Kendali PHT */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31572C]/10 text-[#31572C] border border-[#31572C]/20">
                          STANDAR PHT NASIONAL
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          REKOMENDASI PPL
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Kementan PHT]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Per Rumpun Padi]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Export PDF]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Ambang Kendali PHT Cerdas
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Menghapus kebiasaan semprot terjadwal membabi-buta. Petani hanya menyemprot jika tangkapan melampaui kurva ambang batas ekonomi, menghemat 42% biaya pestisida.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Pengurangan Racun Kimia:</span>
                            <span className="font-mono font-bold text-emerald-700">-42% per Musim</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Musuh Alami Terlindungi:</span>
                            <span className="font-mono font-bold text-[#132A13]">Kepik Mirid & Laba-laba</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Kualitas Gabah:</span>
                            <span className="font-mono font-semibold text-[#31572C]">Beras Rendah Residu</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Panduan Agronomis</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('pests')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Buka Analisis PHT</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* === PILAR 3: MANDIRI TENAGA SURYA CARDS === */}
              {(activeFeatureTab === 'all' || activeFeatureTab === 'surya') && (
                <>
                  {/* Surya Card 1: 50Wp MPPT */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#BC6C25]/10 text-[#BC6C25] border border-[#BC6C25]/20">
                          PANEL SURYA 50WP
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          98.6% EFISIENSI
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Monokristalin]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[INA226 I2C]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[P&O Tracking]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Pemanen Surya Efisiensi Tinggi
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Algoritma MPPT melacak titik daya maksimal radiasi matahari Subang, memaksimalkan pasokan arus hingga 3.8A ke baterai meskipun cuaca berawan sebagian.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Daya Puncak (Pmax):</span>
                            <span className="font-mono font-bold text-[#132A13]">50 Wp (18.2 V)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Arus Panen Siang:</span>
                            <span className="font-mono font-bold text-amber-700">3.82 A (MPPT Aktif)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Sensor Monitoring:</span>
                            <span className="font-mono font-semibold text-[#31572C]">INA226 16-bit Precision</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Off-Grid 100%</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('energy')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Pantau Daya Lapangan</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Surya Card 2: LiFePO4 Battery */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#4F772D]/10 text-[#4F772D] border border-[#4F772D]/20">
                          BATERAI LIFEPO4 12AH
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          CADANGAN 72 JAM
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[LiFePO4 4S]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[BMS Cut-off 11.2V]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[2.000+ Siklus]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Cadangan Daya 3 Hari Hujan
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Kimia LiFePO4 tahan suhu terik sawah hingga 60°C. Dilengkapi pemutus otomatis 11.2V untuk melindungi sel dari pembuangan berlebih saat musim hujan berkepanjangan.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Tegangan Nominal:</span>
                            <span className="font-mono font-bold text-[#132A13]">12.8V - 13.3V (Sehat)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Ambang Cut-off:</span>
                            <span className="font-mono font-bold text-red-600">11.2V (Proteksi Sel)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Suhu Operasional:</span>
                            <span className="font-mono font-semibold text-[#31572C]">-10°C s/d +60°C</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">BMS Terproteksi</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('energy')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Lihat Telemetri Baterai</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* === PILAR 4: IOT & TELEMETRI 4G CARDS === */}
              {(activeFeatureTab === 'all' || activeFeatureTab === 'iot') && (
                <>
                  {/* IoT Card 1: Modem 4G LTE */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31572C]/10 text-[#31572C] border border-[#31572C]/20">
                          KONEKTIVITAS LAPANGAN
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          ONLINE MQTT TLS
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Modem 4G Cat-1]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Buffer MicroSD]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Auto-Reconnect]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Telemetri 4G Real-time ke Cloud
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Mengirimkan telemetri sensor setiap 5 menit ke cloud platform. Dilengkapi buffer MicroSD SPI lokal sehingga data tidak pernah hilang jika sinyal seluler drop di tengah sawah.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Protokol Komunikasi:</span>
                            <span className="font-mono font-bold text-[#132A13]">MQTT Port 8883 (TLS)</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Cadangan Offline:</span>
                            <span className="font-mono font-bold text-[#31572C]">MicroSD SPI Auto-Sync</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Interval Laporan:</span>
                            <span className="font-mono font-semibold text-emerald-700">5 Menit (Dapat Diatur)</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Enkripsi TLS 1.3</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('architecture')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Lihat Arsitektur API</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* IoT Card 2: Bot Telegram Alert */}
                  <div className="group rounded-3xl border border-[#90A955]/35 bg-white p-5 sm:p-6 shadow-xs hover:shadow-md hover:border-[#4F772D] transition-all flex flex-col justify-between h-full">
                    <div className="flex-1 flex flex-col">
                      {/* Upper Preview Banner & Status */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#31572C]/10 text-[#31572C] border border-[#31572C]/20">
                          PERINGATAN INSTAN
                        </span>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-[#ECF39E] text-[#132A13] border border-[#90A955]/50">
                          RESPON &lt; 3 DETIK
                        </span>
                      </div>

                      {/* Tech Badges */}
                      <div className="flex flex-wrap gap-1.5 mb-3 text-[10px] font-mono">
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Telegram Bot]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Webhook]</span>
                        <span className="px-2 py-0.5 rounded-md bg-[#F2F7F4] text-[#132A13] border border-[#90A955]/30">[Foto Baki Lapangan]</span>
                      </div>

                      <h3 className="text-base sm:text-lg font-black text-[#132A13] group-hover:text-[#31572C] transition-colors min-h-[28px] flex items-center">
                        Bot Telegram Agronomis Petani
                      </h3>
                      <p className="text-xs text-[#52796F] mt-1.5 leading-relaxed min-h-[54px] sm:min-h-[48px]">
                        Notifikasi instan dikirim ke grup chat kelompok tani dan petugas penyuluh saat lonjakan hama terdeteksi melampaui batas ambang ekonomi, lengkap dengan foto bukti baki.
                      </p>

                      {/* Mini Spec Box (Harmonized Fixed Height) */}
                      <div className="mt-auto pt-3">
                        <div className="h-[98px] p-3 rounded-2xl bg-[#F6F9F5] border border-[#90A955]/30 flex flex-col justify-center space-y-1.5 text-[11px]">
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Kanal Notifikasi:</span>
                            <span className="font-mono font-bold text-[#132A13]">Grup Telegram Gapoktan</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Kecepatan Notif:</span>
                            <span className="font-mono font-bold text-[#31572C]">&lt; 3 Detik dari Deteksi</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-[#52796F]">Lampiran:</span>
                            <span className="font-mono font-semibold text-emerald-700">Foto Makro Baki + Statistik</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Action */}
                    <div className="mt-4 pt-3.5 border-t border-[#90A955]/20 flex items-center justify-between">
                      <span className="text-[11px] text-[#52796F]">Peringatan Dini</span>
                      <button
                        type="button"
                        onClick={() => handleEnterDashboard('alerts')}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#31572C] hover:text-[#132A13] group-hover:underline cursor-pointer"
                      >
                        <span>Buka Pusat Peringatan</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

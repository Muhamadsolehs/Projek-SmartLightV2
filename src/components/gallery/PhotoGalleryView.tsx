import React, { useState } from 'react';
import {
  Camera,
  Filter,
  CheckCircle2,
  Clock,
  Edit3,
  Layers,
  Sparkles,
  ZoomIn,
  ShieldCheck,
  Tag,
  AlertCircle,
  Eye,
  Info,
  ChevronRight,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { CaptureImage, InsectSpeciesId } from '../../types';
import { INSECT_SPECIES_LIST } from '../../data/mockData';

export const PhotoGalleryView: React.FC = () => {
  const { captures, updateBoundingBoxLabel } = useDevice();
  const [selectedCapture, setSelectedCapture] = useState<CaptureImage>(captures[0]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [editingSpecies, setEditingSpecies] = useState<InsectSpeciesId>('scirpophaga_incertulas');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const filteredCaptures = captures.filter((cap) => {
    if (filterVerified === 'verified') return cap.isManuallyVerified;
    if (filterVerified === 'unverified') return !cap.isManuallyVerified;
    return true;
  });

  const activeBox = selectedCapture.bboxes.find((b) => b.id === activeBoxId);

  const handleSaveCorrection = () => {
    if (!activeBoxId) return;
    updateBoundingBoxLabel(
      selectedCapture.id,
      activeBoxId,
      editingSpecies,
      'Pak Rahmat (Agronomis Lapangan)'
    );
    setSaveSuccessMsg('Label berhasil diperbarui dan dicatat dalam dataset pelatihan AI.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-[#52796F]">
        <span className="text-[#718096]">Smart Light Trap</span>
        <ChevronRight className="h-3.5 w-3.5 text-[#A0AEC0]" />
        <span className="font-semibold text-[#192A20]">Galeri Foto & CV</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A20]">
            Galeri Foto & Validasi CV
          </h1>
          <p className="text-xs sm:text-sm text-[#52796F] mt-1 max-w-2xl">
            Inspeksi citra baki air beriluminasi, verifikasi bounding box AI YOLOv8, dan koreksi dataset serangga.
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 bg-[#F1F5F2] rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterVerified('all')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterVerified === 'all'
                ? 'bg-white text-[#192A20] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua Foto ({captures.length})
          </button>
          <button
            onClick={() => setFilterVerified('unverified')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterVerified === 'unverified'
                ? 'bg-white text-[#D97706] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Menunggu Verifikasi ({captures.filter((c) => !c.isManuallyVerified).length})
          </button>
          <button
            onClick={() => setFilterVerified('verified')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              filterVerified === 'verified'
                ? 'bg-white text-[#2D6A4F] shadow-xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Tervalidasi ({captures.filter((c) => c.isManuallyVerified).length})
          </button>
        </div>
      </div>

      {/* Main Split: Photo Inspector on Left, Captures list & Box Editor on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Photo Canvas & Bounding Boxes (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-[#2D6A4F] bg-[#EAF4EE] px-2 py-0.5 rounded">
                  {selectedCapture.id}
                </span>
                <span className="text-xs font-semibold text-[#192A20]">
                  Unit: {selectedCapture.deviceId}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                  selectedCapture.isManuallyVerified
                    ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                    : 'bg-[#FEF3C7] text-[#D97706]'
                }`}>
                  {selectedCapture.isManuallyVerified ? 'Diverifikasi Manusia' : 'Prediksi AI Otomatis'}
                </span>
              </div>
              <div className="text-[11px] text-[#718096] mt-1">
                Waktu Ambil: {selectedCapture.timestamp} · Resolusi: {selectedCapture.resolution}
              </div>
            </div>

            <div className="text-right">
              <span className="text-xs font-mono font-bold text-[#192A20]">
                {selectedCapture.modelVersion}
              </span>
              <div className="text-[10px] text-[#52796F]">
                Rata-rata Confidence: {(selectedCapture.avgConfidence * 100).toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Interactive Bounding Box Canvas */}
          <div className="relative aspect-video w-full rounded-xl border border-[#CBD5E1] bg-[#121A15] overflow-hidden flex items-center justify-center shadow-inner select-none">
            {/* Illumination LED Lighting Backdrop */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(80,180,120,0.3)_0%,_rgba(10,22,14,0.95)_75%)]" />

            {/* Scientific Grid overlay */}
            <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" fill="none" stroke="#2D6A4F" strokeWidth="0.3" strokeDasharray="1 1" />
              <line x1="5" y1="50" x2="95" y2="50" stroke="#2D6A4F" strokeWidth="0.2" />
              <line x1="50" y1="5" x2="50" y2="95" stroke="#2D6A4F" strokeWidth="0.2" />
            </svg>

            {/* Water tray rim representation */}
            <div className="absolute inset-4 rounded-full border border-[#2D6A4F]/40 pointer-events-none" />

            {/* Bounding boxes */}
            {selectedCapture.bboxes.map((box, i) => {
              const isSelected = activeBoxId === box.id;
              const isVerified = box.isManuallyVerified;
              return (
                <div
                  key={box.id}
                  onClick={() => {
                    setActiveBoxId(box.id);
                    setEditingSpecies(box.speciesId);
                  }}
                  className={`absolute rounded-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-2 border-[#F59E0B] bg-[#F59E0B]/25 z-20 scale-105'
                      : isVerified
                      ? 'border border-[#22C55E] bg-[#22C55E]/15 hover:bg-[#22C55E]/30 z-10'
                      : 'border border-[#38BDF8] bg-[#38BDF8]/15 hover:bg-[#38BDF8]/30 z-10'
                  }`}
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                >
                  <div
                    className={`absolute -top-4 left-0 font-mono text-[9px] font-bold px-1 rounded-xs whitespace-nowrap shadow-xs ${
                      isSelected
                        ? 'bg-[#F59E0B] text-black'
                        : isVerified
                        ? 'bg-[#22C55E] text-[#0A2213]'
                        : 'bg-[#0284C7] text-white'
                    }`}
                  >
                    #{i + 1} {box.speciesId === 'scirpophaga_incertulas' ? 'Penggerek' : box.speciesId === 'nilaparvata_lugens' ? 'WBC' : 'Serangga'} {(box.confidence * 100).toFixed(0)}%
                  </div>
                </div>
              );
            })}

            {/* Bottom Legend on Image */}
            <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-[11px] text-white/90 bg-black/60 backdrop-blur-xs px-3 py-1.5 rounded-lg">
              <span className="flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5 text-[#4ade80]" />
                <span>Klik kotak serangga di atas untuk memeriksa / mengubah label</span>
              </span>
              <span className="font-mono text-[10px] text-[#A7D7C5]">
                Total {selectedCapture.bboxes.length} Bounding Box
              </span>
            </div>
          </div>

          {/* Capture Notes */}
          <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] text-xs flex items-start gap-2">
            <Info className="h-4 w-4 text-[#52796F] shrink-0 mt-0.5" />
            <div className="text-[#52796F]">
              <strong>Catatan Lapangan:</strong> {selectedCapture.notes || 'Pencahayaan LED merata, baki air bersih.'}
            </div>
          </div>
        </div>

        {/* Right Column: Object Inspector & Re-labeling Tool */}
        <div className="space-y-4">
          {/* Active Object Detail / Re-labeling Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>Koreksi Manual Label (Human-in-the-Loop)</span>
              </h2>
            </div>

            {activeBox ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096]">Objek Terpilih:</span>
                    <span className="font-mono font-bold text-[#192A20]">{activeBox.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096]">Confidence Score:</span>
                    <span className="font-mono font-bold text-[#2D6A4F]">
                      {(activeBox.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096]">Status Verifikasi:</span>
                    <span className={`font-semibold ${activeBox.isManuallyVerified ? 'text-[#2D6A4F]' : 'text-[#D97706]'}`}>
                      {activeBox.isManuallyVerified ? `Diverifikasi (${activeBox.verifiedBy || 'Operator'})` : 'Otomatis AI'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#192A20] mb-1.5">
                    Klasifikasikan Ulang Spesies Serangga:
                  </label>
                  <select
                    value={editingSpecies}
                    onChange={(e) => setEditingSpecies(e.target.value as InsectSpeciesId)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-2 text-xs text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden font-medium"
                  >
                    {INSECT_SPECIES_LIST.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.commonName} ({sp.scientificName})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSaveCorrection}
                  className="w-full py-2 px-3 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Simpan Koreksi Label</span>
                </button>

                {saveSuccessMsg && (
                  <div className="p-2.5 bg-[#EAF4EE] text-[#1B4332] rounded-lg text-xs flex items-center gap-1.5 font-medium border border-[#A7D7C5]">
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#2D6A4F] shrink-0" />
                    <span>{saveSuccessMsg}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
                <Edit3 className="h-6 w-6 mx-auto mb-2 text-[#A0AEC0]" />
                <p>Silakan klik salah satu kotak serangga pada foto baki air untuk melakukan verifikasi atau koreksi label.</p>
              </div>
            )}
          </div>

          {/* List of Sesi Captures */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
              Daftar Foto Sesi Lainnya
            </h3>

            <div className="space-y-2">
              {filteredCaptures.map((cap) => {
                const isCurrent = cap.id === selectedCapture.id;
                return (
                  <div
                    key={cap.id}
                    onClick={() => {
                      setSelectedCapture(cap);
                      setActiveBoxId(null);
                    }}
                    className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isCurrent
                        ? 'border-[#2D6A4F] bg-[#EAF4EE] text-[#1B4332]'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:bg-[#F8FAF9]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-bold">
                      <span>{cap.id}</span>
                      <span className="text-[10px] text-[#2D6A4F]">
                        {cap.totalPests} ekor
                      </span>
                    </div>
                    <div className="text-[11px] text-[#718096] mt-0.5">
                      {cap.timestamp.split('T')[1].slice(0, 5)} WIB · {cap.targetPestsCount} hama sasaran
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

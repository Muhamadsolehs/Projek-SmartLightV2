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
  Lock,
  Trash2,
  Download,
  ExternalLink,
  RefreshCw,
  Database,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { CaptureImage, InsectSpeciesId } from '../../types';
import { INSECT_SPECIES_LIST } from '../../data/mockData';
import { hasPermission } from '../../lib/permissions';
import { DroidCamLivePanel } from './DroidCamLivePanel';

export const PhotoGalleryView: React.FC = () => {
  const { captures, updateBoundingBoxLabel, deleteCapture, refreshData, currentUser } = useDevice();
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [filterVerified, setFilterVerified] = useState<'all' | 'verified' | 'unverified'>('all');
  const [editingSpecies, setEditingSpecies] = useState<InsectSpeciesId>('scirpophaga_incertulas');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canVerify = hasPermission(currentUser?.role, 'action:verify_detection');

  const filteredCaptures = captures.filter((cap) => {
    if (filterVerified === 'verified') return cap.isManuallyVerified;
    if (filterVerified === 'unverified') return !cap.isManuallyVerified;
    return true;
  });

  const selectedCapture = captures.find((c) => c.id === selectedCaptureId) || filteredCaptures[0] || captures[0] || null;
  const activeBox = selectedCapture?.bboxes.find((b) => b.id === activeBoxId);

  const handleSaveCorrection = () => {
    if (!selectedCapture || !activeBoxId || !canVerify) return;
    updateBoundingBoxLabel(
      selectedCapture.id,
      activeBoxId,
      editingSpecies,
      currentUser?.name || 'Operator Lapangan'
    );
    setSaveSuccessMsg('Label berhasil diperbarui dan dicatat dalam dataset pelatihan AI.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshData();
      setSaveSuccessMsg('Daftar foto baki berhasil disegarkan dari tabel database Supabase & bucket storage.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDeletePhoto = async (cap: CaptureImage) => {
    const confirmDelete = window.confirm(
      `Apakah Anda yakin ingin menghapus foto "${cap.id}" dari database Supabase dan bucket storage?`
    );
    if (!confirmDelete) return;

    try {
      await deleteCapture(cap.id, cap.dbRecordId, cap.filePath);
      setSaveSuccessMsg(`Foto ${cap.id} berhasil dihapus dari database.`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      if (selectedCaptureId === cap.id) {
        setSelectedCaptureId(null);
      }
    } catch (err: any) {
      alert(`Gagal menghapus foto: ${err?.message || 'Error'}`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20]">
            Galeri Foto &amp; Validasi CV
          </h1>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-0.5 p-0.5 bg-[#F1F5F2] rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterVerified('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              filterVerified === 'all'
                ? 'bg-white text-[#192A20] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({captures.length})
          </button>
          <button
            onClick={() => setFilterVerified('unverified')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              filterVerified === 'unverified'
                ? 'bg-white text-[#D97706] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Menunggu ({captures.filter((c) => !c.isManuallyVerified).length})
          </button>
          <button
            onClick={() => setFilterVerified('verified')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs ${
              filterVerified === 'verified'
                ? 'bg-white text-[#2D6A4F] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Tervalidasi ({captures.filter((c) => c.isManuallyVerified).length})
          </button>
        </div>
      </div>

      {/* Live Realtime DroidCam Panel with Manual Shutter & IP Configuration */}
      <DroidCamLivePanel
        onCaptureCreated={(newId) => {
          setSelectedCaptureId(newId);
          setActiveBoxId(null);
        }}
      />

      {/* Section Divider & Gallery Title */}
      <div className="pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h2 className="text-sm sm:text-base font-bold text-[#192A20] flex items-center gap-2">
          <Database className="h-4 w-4 text-[#2D6A4F]" />
          <span>Arsip Citra Baki &amp; Validasi AI</span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#EAF4EE] text-[#2D6A4F]">
            {filteredCaptures.length} Foto di Database
          </span>
        </h2>

        {/* Tombol Segarkan Database */}
        <button
          onClick={handleManualRefresh}
          disabled={isRefreshing}
          className="px-3 py-1.5 rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] hover:bg-white text-[#31572C] font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-60"
          title="Muat ulang seluruh foto dari tabel public.device_images & bucket storage"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-emerald-600' : ''}`} />
          <span>{isRefreshing ? 'Menyinkronkan...' : 'Segarkan Database'}</span>
        </button>
      </div>

      {saveSuccessMsg && (
        <div className="p-3 bg-[#EAF4EE] text-[#1B4332] rounded-xl text-xs flex items-center gap-2 font-medium border border-[#A7D7C5] animate-fadeIn">
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F] shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {!selectedCapture ? (
        <div className="rounded-2xl border-2 border-dashed border-[#90A955]/30 bg-white p-8 text-center space-y-2">
          <Camera className="mx-auto h-10 w-10 text-[#90A955]" />
          <h3 className="text-sm font-bold text-[#192A20]">Belum Ada Citra Baki di Galeri</h3>
          <p className="text-xs text-[#52796F] max-w-md mx-auto leading-relaxed">
            Gunakan tombol <strong>"Potret Baki Manual (Admin)"</strong> pada panel kamera DroidCam di atas untuk mengambil foto baki air pertama Anda secara langsung ke database.
          </p>
        </div>
      ) : (
      /* Main Split: Photo Inspector on Left, Captures list & Box Editor on Right */
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Left Column: Photo Canvas & Bounding Boxes (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-xs font-bold text-[#2D6A4F] bg-[#EAF4EE] px-1.5 py-0.5 rounded">
                  {selectedCapture.id}
                </span>
                <span className="text-xs font-semibold text-[#192A20]">
                  Unit: {selectedCapture.deviceId}
                </span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  selectedCapture.isManuallyVerified
                    ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                    : 'bg-[#FEF3C7] text-[#D97706]'
                }`}>
                  {selectedCapture.isManuallyVerified ? 'Tervalidasi' : 'Deteksi AI'}
                </span>
                {selectedCapture.dbRecordId && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    Supabase DB #{selectedCapture.dbRecordId}
                  </span>
                )}
              </div>
              <div className="text-[10px] text-[#718096] mt-1">
                Waktu: {new Date(selectedCapture.timestamp).toLocaleString('id-ID')} · Res: {selectedCapture.resolution}
              </div>
            </div>

            {/* Quick Action Buttons (Download, Open Tab, Delete) */}
            <div className="flex items-center gap-1.5">
              {selectedCapture.imageUrl && (
                <a
                  href={selectedCapture.imageUrl}
                  download={`SLT_${selectedCapture.id}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAF9] text-[#2D6A4F] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Unduh file foto ini"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">Unduh</span>
                </a>
              )}

              {selectedCapture.imageUrl && (
                <a
                  href={selectedCapture.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAF9] text-[#52796F] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Buka citra resolusi penuh di tab baru"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">Buka Tab Baru</span>
                </a>
              )}

              {canVerify && (
                <button
                  onClick={() => handleDeletePhoto(selectedCapture)}
                  className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                  title="Hapus foto dari database dan storage"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-[11px]">Hapus</span>
                </button>
              )}
            </div>
          </div>

          {/* Interactive Bounding Box Canvas */}
          <div className="relative aspect-video w-full rounded-xl border border-[#CBD5E1] bg-[#121A15] overflow-hidden flex items-center justify-center shadow-inner select-none">
            {selectedCapture.imageUrl ? (
              <img
                src={selectedCapture.imageUrl}
                alt={`Tangkapan Baki ${selectedCapture.id}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              /* Illumination LED Lighting Backdrop (Tray Simulation) */
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(80,180,120,0.3)_0%,_rgba(10,22,14,0.95)_75%)]" />
            )}

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
            <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white/90 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-lg">
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3 text-[#4ade80]" />
                <span>Klik kotak serangga untuk memeriksa / mengubah label</span>
              </span>
              <span className="font-mono text-[10px] text-[#A7D7C5]">
                {selectedCapture.bboxes.length} Box
              </span>
            </div>
          </div>

          {/* Capture Notes */}
          <div className="p-2.5 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] text-xs flex items-center gap-2">
            <Info className="h-3.5 w-3.5 text-[#52796F] shrink-0" />
            <div className="text-[#52796F] text-[11px]">
              <strong>Catatan:</strong> {selectedCapture.notes || 'Pencahayaan normal, baki air bersih.'}
            </div>
          </div>
        </div>

        {/* Right Column: Object Inspector & Re-labeling Tool */}
        <div className="space-y-3">
          {/* Active Object Detail / Re-labeling Card */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-1.5">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#52796F] flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" />
                <span>Koreksi Label AI</span>
              </h2>
            </div>

            {activeBox ? (
              <div className="space-y-2.5 text-xs">
                <div className="p-2.5 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] text-[11px]">Objek:</span>
                    <span className="font-mono font-bold text-[#192A20] text-xs">{activeBox.id}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] text-[11px]">Confidence:</span>
                    <span className="font-mono font-bold text-[#2D6A4F] text-xs">
                      {(activeBox.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#718096] text-[11px]">Status:</span>
                    <span className={`font-semibold text-xs ${activeBox.isManuallyVerified ? 'text-[#2D6A4F]' : 'text-[#D97706]'}`}>
                      {activeBox.isManuallyVerified ? `Diverifikasi (${activeBox.verifiedBy || 'Operator'})` : 'Otomatis AI'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#192A20] mb-1">
                    Klasifikasi Spesies:
                  </label>
                  <select
                    value={editingSpecies}
                    onChange={(e) => setEditingSpecies(e.target.value as InsectSpeciesId)}
                    className="w-full rounded-lg border border-[#E2E8F0] bg-[#F8FAF9] p-1.5 text-xs text-[#192A20] focus:border-[#2D6A4F] focus:outline-hidden font-medium"
                  >
                    {INSECT_SPECIES_LIST.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.commonName} ({sp.scientificName})
                      </option>
                    ))}
                  </select>
                </div>

                {!canVerify && (
                  <div className="p-2 rounded-lg border border-red-200 bg-red-50 text-[10px] text-red-800 flex items-center gap-1.5">
                    <Lock className="h-3 w-3 text-red-600 shrink-0" />
                    <span>Mode Baca-Saja: Koreksi label dibatasi untuk Operator &amp; Admin.</span>
                  </div>
                )}

                <button
                  disabled={!canVerify}
                  onClick={handleSaveCorrection}
                  className="w-full py-1.5 px-3 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{!canVerify ? 'Dibatasi' : 'Simpan Koreksi Label'}</span>
                </button>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
                <Edit3 className="h-5 w-5 mx-auto mb-1 text-[#A0AEC0]" />
                <p className="text-[11px]">Klik salah satu kotak serangga pada foto baki untuk memvalidasi label.</p>
              </div>
            )}
          </div>

          {/* List of Sesi Captures with Thumbnails & Database Badges */}
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
              Semua Foto di Database ({filteredCaptures.length})
            </h3>

            <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredCaptures.map((cap) => {
                const isCurrent = cap.id === selectedCapture.id;
                const isFromDb = Boolean(cap.dbRecordId || cap.filePath);
                return (
                  <div
                    key={cap.id}
                    onClick={() => {
                      setSelectedCaptureId(cap.id);
                      setActiveBoxId(null);
                    }}
                    className={`p-2 rounded-xl border text-xs cursor-pointer transition-all flex items-center gap-2.5 ${
                      isCurrent
                        ? 'border-[#2D6A4F] bg-[#EAF4EE] text-[#1B4332] shadow-2xs'
                        : 'border-[#E2E8F0] bg-white text-[#4A5568] hover:bg-[#F8FAF9]'
                    }`}
                  >
                    {/* Thumbnail Preview */}
                    <div className="w-12 h-10 rounded-lg overflow-hidden bg-black/20 shrink-0 border border-black/10">
                      {cap.imageUrl ? (
                        <img
                          src={cap.imageUrl}
                          alt={cap.id}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                          <Camera className="h-3.5 w-3.5" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between font-mono font-bold text-xs">
                        <span className="truncate">{cap.id}</span>
                        {isFromDb ? (
                          <span className="text-[9px] font-sans font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                            Supabase DB
                          </span>
                        ) : (
                          <span className="text-[10px] text-[#2D6A4F] shrink-0">
                            {cap.totalPests} ekor
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-[#718096] mt-0.5 truncate">
                        {new Date(cap.timestamp).toLocaleString('id-ID', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} WIB · {cap.deviceId}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};

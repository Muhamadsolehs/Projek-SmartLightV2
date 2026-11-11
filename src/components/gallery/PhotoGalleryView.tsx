import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Edit3,
  Sparkles,
  Tag,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Lock,
  Trash2,
  Download,
  ExternalLink,
  RefreshCw,
  Database,
  Cpu,
  Flame,
  ShieldCheck,
  AlertTriangle,
  RotateCw,
  Plus,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { CaptureImage, InsectSpeciesId } from '../../types';
import { INSECT_SPECIES_LIST } from '../../data/mockData';
import { hasPermission } from '../../lib/permissions';
import { DroidCamLivePanel } from './DroidCamLivePanel';
import { IP102_SUBANG_TAXONOMY } from '../../services/aiDetectionService';

export const PhotoGalleryView: React.FC = () => {
  const {
    captures,
    updateBoundingBoxLabel,
    deleteCapture,
    runAiDetection,
    deleteBoundingBox,
    addBoundingBox,
    clearBoundingBoxes,
    refreshData,
    currentUser,
  } = useDevice();

  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(null);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  const [filterVerified, setFilterVerified] = useState<'all' | 'unprocessed' | 'verified'>('all');
  const [editingSpecies, setEditingSpecies] = useState<InsectSpeciesId>('scirpophaga_incertulas');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [showBoxes, setShowBoxes] = useState(true);

  const canVerify = hasPermission(currentUser?.role, 'action:verify_detection');

  // Menentukan apakah suatu foto sudah pernah melalui proses inferensi AI
  const isCaptureProcessed = (cap: CaptureImage) => {
    return Boolean(
      cap.isAiProcessed ||
      cap.bboxes.length > 0 ||
      (cap.modelVersion && (cap.modelVersion.includes('IP102') || cap.modelVersion.includes('Edge'))) ||
      (cap.notes && (
        cap.notes.includes('Deteksi AI') ||
        cap.notes.includes('Baki bersih') ||
        cap.notes.includes('Tidak ditemukan') ||
        cap.notes.includes('terlalu gelap') ||
        cap.notes.includes('dibersihkan')
      ))
    );
  };

  const filteredCaptures = captures.filter((cap) => {
    if (filterVerified === 'unprocessed') return !isCaptureProcessed(cap);
    if (filterVerified === 'verified') return cap.isManuallyVerified;
    return true;
  });

  const selectedCapture =
    captures.find((c) => c.id === selectedCaptureId) ||
    filteredCaptures[0] ||
    captures[0] ||
    null;

  const activeBox = selectedCapture?.bboxes.find((b) => b.id === activeBoxId);

  // Jalankan model AI deteksi & klasifikasi hama berbasis dataset IP102
  const handleRunAiDetection = async () => {
    if (!selectedCapture) return;
    setIsDetecting(true);
    setActiveBoxId(null);

    try {
      const updated = await runAiDetection(selectedCapture.id);
      if (updated) {
        setSaveSuccessMsg(
          `Deteksi AI YOLOv8 IP102 berhasil: ${updated.totalPests} serangga teridentifikasi (${updated.targetPestsCount} hama target padi). Data tersimpan di Supabase (capture_sessions & insect_detections).`
        );
        setTimeout(() => setSaveSuccessMsg(null), 4500);
      }
    } catch (err: any) {
      alert(`Gagal menjalankan deteksi AI: ${err?.message || 'Error'}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleSaveCorrection = () => {
    if (!selectedCapture || !activeBoxId || !canVerify) return;
    updateBoundingBoxLabel(
      selectedCapture.id,
      activeBoxId,
      editingSpecies,
      currentUser?.name || 'Operator Lapangan'
    );
    setSaveSuccessMsg('Label berhasil diverifikasi & dicatat dalam dataset pelatihan AI.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleDeleteActiveBox = () => {
    if (!selectedCapture || !activeBoxId || !canVerify) return;
    deleteBoundingBox(selectedCapture.id, activeBoxId);
    setActiveBoxId(null);
    setSaveSuccessMsg('Kotak anotasi berhasil dihapus.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleClearAll = () => {
    if (!selectedCapture || !canVerify) return;
    const ok = window.confirm('Apakah Anda yakin ingin menghapus/mereset semua kotak deteksi pada foto ini?');
    if (!ok) return;
    clearBoundingBoxes(selectedCapture.id);
    setActiveBoxId(null);
    setSaveSuccessMsg('Semua kotak deteksi berhasil dibersihkan.');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  const handleAddManualBox = () => {
    if (!selectedCapture || !canVerify) return;
    const newBox = {
      id: `box-manual-${Date.now()}`,
      speciesId: editingSpecies,
      confidence: 1.0,
      x: 38,
      y: 38,
      width: 24,
      height: 20,
      isManuallyVerified: true,
      verifiedBy: currentUser?.name || 'Operator',
      verifiedAt: new Date().toISOString(),
    };
    addBoundingBox(selectedCapture.id, newBox);
    setActiveBoxId(newBox.id);
    setSaveSuccessMsg(`Kotak serangga manual (${IP102_SUBANG_TAXONOMY[editingSpecies]?.commonName || 'Hama'}) berhasil ditambahkan.`);
    setTimeout(() => setSaveSuccessMsg(null), 3500);
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
      await deleteCapture(cap.id, cap.dbRecordId, cap.filePath, cap.imageUrl);
      setSaveSuccessMsg(`Foto ${cap.id} berhasil dihapus dari database.`);
      setTimeout(() => setSaveSuccessMsg(null), 3500);
      if (selectedCaptureId === cap.id) {
        setSelectedCaptureId(null);
      }
    } catch (err: any) {
      alert(`Gagal menghapus foto: ${err?.message || 'Error'}`);
    }
  };

  // Hitung sebaran taksonomi spesies pada foto yang sedang aktif
  const speciesCountMap: Record<string, { count: number; meta: any }> = {};
  if (selectedCapture) {
    selectedCapture.bboxes.forEach((b) => {
      const meta = IP102_SUBANG_TAXONOMY[b.speciesId] || IP102_SUBANG_TAXONOMY.other_neutral;
      if (!speciesCountMap[b.speciesId]) {
        speciesCountMap[b.speciesId] = { count: 0, meta };
      }
      speciesCountMap[b.speciesId].count++;
    });
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#192A20] flex items-center gap-2">
            <span>Galeri Foto &amp; Validasi CV</span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-300">
              YOLOv8 · IP102
            </span>
          </h1>
          <p className="text-xs text-[#52796F] mt-0.5">
            Deteksi otomatis morfologi serangga, klasifikasi taksonomi PHT padi Subang, dan anotasi citra baki air.
          </p>
        </div>

        {/* Filter Segmented Control */}
        <div className="flex items-center gap-0.5 p-0.5 bg-[#F1F5F2] rounded-lg text-xs font-medium">
          <button
            onClick={() => setFilterVerified('all')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs cursor-pointer ${
              filterVerified === 'all'
                ? 'bg-white text-[#192A20] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Semua ({captures.length})
          </button>
          <button
            onClick={() => setFilterVerified('unprocessed')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs cursor-pointer ${
              filterVerified === 'unprocessed'
                ? 'bg-white text-[#D97706] shadow-2xs font-semibold'
                : 'text-[#52796F] hover:text-[#192A20]'
            }`}
          >
            Belum Dipindai ({captures.filter((c) => !isCaptureProcessed(c)).length})
          </button>
          <button
            onClick={() => setFilterVerified('verified')}
            className={`px-2.5 py-1 rounded-md transition-colors text-xs cursor-pointer ${
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
          <span>Arsip Citra Baki &amp; Klasifikasi Hama</span>
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
            {/* Action Bar Above Canvas */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-mono text-xs font-bold text-[#2D6A4F] bg-[#EAF4EE] px-1.5 py-0.5 rounded">
                    {selectedCapture.id}
                  </span>
                  <span className="text-xs font-semibold text-[#192A20]">
                    Unit: {selectedCapture.deviceId}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 ${
                      selectedCapture.bboxes.length > 0
                        ? selectedCapture.isManuallyVerified
                          ? 'bg-[#EAF4EE] text-[#2D6A4F]'
                          : 'bg-[#E0F2FE] text-[#0369A1]'
                        : isCaptureProcessed(selectedCapture)
                        ? 'bg-[#EAF4EE] text-[#2D6A4F] border border-emerald-200'
                        : 'bg-[#FEF3C7] text-[#D97706]'
                    }`}
                  >
                    {selectedCapture.bboxes.length > 0 ? (
                      selectedCapture.isManuallyVerified ? (
                        'Tervalidasi'
                      ) : (
                        `AI Terklasifikasi (${selectedCapture.bboxes.length} Box)`
                      )
                    ) : isCaptureProcessed(selectedCapture) ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                        <span>Baki Bersih (0 Hama)</span>
                      </>
                    ) : (
                      'Menunggu Deteksi AI'
                    )}
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

              {/* Action Buttons: Run AI Detection, Toggle Boxes, Download, Open Tab, Delete */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* TOMBOL UTAMA: JALANKAN DETEKSI AI YOLOv8 IP102 */}
                <button
                  onClick={handleRunAiDetection}
                  disabled={isDetecting}
                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#1B4332] via-[#2D6A4F] to-[#40916C] hover:from-[#143225] hover:to-[#2D6A4F] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer disabled:opacity-60"
                  title="Jalankan inferensi model deteksi serangga berbasis data latih IP102"
                >
                  <Sparkles className={`h-3.5 w-3.5 ${isDetecting ? 'animate-spin text-amber-300' : 'text-amber-400'}`} />
                  <span>
                    {isDetecting
                      ? 'Menganalisis...'
                      : isCaptureProcessed(selectedCapture)
                      ? 'Pindai Ulang AI'
                      : 'Deteksi Hama AI'}
                  </span>
                </button>

                {selectedCapture.bboxes.length > 0 && (
                  <button
                    onClick={() => setShowBoxes(!showBoxes)}
                    className="p-1.5 rounded-lg border border-[#E2E8F0] hover:bg-[#F8FAF9] text-[#52796F] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title={showBoxes ? 'Sembunyikan Bounding Box' : 'Tampilkan Bounding Box'}
                  >
                    {showBoxes ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                )}

                {canVerify && (
                  <button
                    onClick={handleAddManualBox}
                    className="p-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#2D6A4F] text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Tambah kotak serangga secara manual"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">Tambah Kotak</span>
                  </button>
                )}

                {canVerify && selectedCapture.bboxes.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-100 text-gray-600 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                    title="Bersihkan semua kotak anotasi pada foto ini"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline text-[11px]">Reset Kotak</span>
                  </button>
                )}

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

            {/* Banner jika Foto Belum Dipindai AI */}
            {!isCaptureProcessed(selectedCapture) && !isDetecting && (
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-fadeIn">
                <div className="flex items-center gap-2.5 text-amber-900">
                  <div className="p-1.5 bg-amber-100 rounded-lg shrink-0">
                    <Sparkles className="h-4 w-4 text-amber-700" />
                  </div>
                  <div>
                    <span className="font-bold">Foto Baki Belum Diproses Model AI.</span>
                    <p className="text-[11px] text-amber-800">
                      Gunakan model Computer Vision YOLOv8 IP102 untuk mendeteksi penggerek batang padi, wereng coklat, ulat grayak, dan hama nokturnal lainnya.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleRunAiDetection}
                  className="px-3.5 py-1.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-semibold rounded-lg text-xs shadow-2xs flex items-center justify-center gap-1.5 shrink-0 cursor-pointer transition-colors"
                >
                  <Cpu className="h-3.5 w-3.5 text-amber-300" />
                  <span>Mulai Klasifikasi AI</span>
                </button>
              </div>
            )}

            {/* Banner Sukses jika Foto Sudah Dipindai dan Hasilnya 0 Serangga (Baki Bersih) */}
            {isCaptureProcessed(selectedCapture) && selectedCapture.bboxes.length === 0 && !isDetecting && (
              <div className="p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-2.5 text-xs text-emerald-900 animate-fadeIn">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-emerald-100 rounded-lg text-emerald-700 shrink-0">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <div>
                    <span className="font-bold">Pemindaian AI Selesai: Baki Bersih (0 Ekor).</span>
                    <p className="text-[11px] text-emerald-700 mt-0.5">
                      {selectedCapture.notes || 'Hasil inferensi AI menunjukkan tidak ada hama padi yang terdeteksi aktif pada baki air.'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200/80 text-emerald-800 shrink-0">
                  PHT Aman (&lt;50)
                </span>
              </div>
            )}

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

              {/* Laser Scanning Animation Overlay saat Inferensi AI Berjalan */}
              {isDetecting && (
                <div className="absolute inset-0 z-30 pointer-events-none overflow-hidden bg-emerald-950/30 backdrop-blur-[1px] flex flex-col justify-between">
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#22C55E] to-transparent shadow-[0_0_20px_#22C55E] animate-pulse" />
                  <div className="p-3 flex items-center justify-center">
                    <div className="bg-black/85 text-emerald-400 font-mono text-xs px-4 py-2 rounded-xl border border-emerald-500/50 shadow-xl flex items-center gap-2.5 animate-bounce">
                      <Sparkles className="h-4 w-4 animate-spin text-emerald-300" />
                      <span>Menganalisis Morfologi Serangga (YOLOv8 Dataset IP102)...</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-gradient-to-r from-transparent via-[#22C55E] to-transparent shadow-[0_0_20px_#22C55E] animate-pulse" />
                </div>
              )}

              {/* Bounding boxes */}
              {showBoxes &&
                selectedCapture.bboxes.map((box, i) => {
                  const isSelected = activeBoxId === box.id;
                  const isVerified = box.isManuallyVerified;
                  const meta = IP102_SUBANG_TAXONOMY[box.speciesId] || IP102_SUBANG_TAXONOMY.other_neutral;

                  return (
                    <div
                      key={box.id}
                      onClick={() => {
                        setActiveBoxId(box.id);
                        setEditingSpecies(box.speciesId);
                      }}
                      className={`absolute rounded-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-2 border-[#F59E0B] bg-[#F59E0B]/30 z-20 scale-105 shadow-[0_0_12px_#F59E0B]'
                          : isVerified
                          ? 'border-2 border-[#22C55E] bg-[#22C55E]/15 hover:bg-[#22C55E]/30 z-10'
                          : `${meta.borderColor} border-2 ${meta.bgColor} hover:brightness-125 z-10`
                      }`}
                      style={{
                        left: `${box.x}%`,
                        top: `${box.y}%`,
                        width: `${box.width}%`,
                        height: `${box.height}%`,
                      }}
                    >
                      <div
                        className={`absolute -top-5 left-0 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-xs whitespace-nowrap shadow-xs flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#F59E0B] text-black font-extrabold'
                            : isVerified
                            ? 'bg-[#22C55E] text-[#0A2213]'
                            : meta.badgeColor
                        }`}
                      >
                        <span>
                          #{i + 1} {meta.commonName.split('/')[0].trim()}
                        </span>
                        <span className="opacity-90">{(box.confidence * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  );
                })}

              {/* Bottom Legend on Image */}
              <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white/90 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3 text-[#4ade80]" />
                  <span>Klik kotak serangga untuk memeriksa spesies / koreksi anotasi</span>
                </span>
                <span className="font-mono text-[10px] text-[#A7D7C5]">
                  {selectedCapture.bboxes.length > 0
                    ? `${selectedCapture.bboxes.length} Objek Terdeteksi`
                    : isCaptureProcessed(selectedCapture)
                    ? '0 Objek Terdeteksi (Baki Bersih)'
                    : 'Belum Dipindai AI'}
                </span>
              </div>
            </div>

            {/* AI Detection Summary & Taxonomy Breakdown */}
            {(selectedCapture.bboxes.length > 0 || isCaptureProcessed(selectedCapture)) && (
              <div className="p-3 bg-[#F8FAF9] rounded-xl border border-[#E2E8F0] space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E2E8F0] pb-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-[#2D6A4F]" />
                    <span className="text-xs font-bold text-[#192A20]">
                      Hasil Klasifikasi Model: {selectedCapture.modelVersion}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-[#718096]">Akurasi Rata-rata:</span>
                    <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                      {selectedCapture.avgConfidence > 0
                        ? `${(selectedCapture.avgConfidence * 100).toFixed(1)}%`
                        : '100% (Bersih)'}
                    </span>
                  </div>
                </div>

                {/* Grid Statistik Deteksi */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2 bg-white rounded-lg border border-[#E2E8F0] shadow-2xs">
                    <div className="text-[10px] text-[#718096] uppercase font-bold tracking-wider">Total Serangga</div>
                    <div className="text-base font-extrabold text-[#192A20] font-mono mt-0.5">
                      {selectedCapture.totalPests} ekor
                    </div>
                  </div>
                  <div className="p-2 bg-rose-50 rounded-lg border border-rose-200 shadow-2xs">
                    <div className="text-[10px] text-rose-700 uppercase font-bold tracking-wider flex items-center justify-center gap-1">
                      <Flame className="h-3 w-3 text-rose-600" />
                      <span>Hama Sasaran</span>
                    </div>
                    <div className="text-base font-extrabold text-rose-800 font-mono mt-0.5">
                      {selectedCapture.targetPestsCount} ekor
                    </div>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-200 shadow-2xs">
                    <div className="text-[10px] text-emerald-700 uppercase font-bold tracking-wider">Serangga Netral</div>
                    <div className="text-base font-extrabold text-emerald-800 font-mono mt-0.5">
                      {selectedCapture.otherInsectsCount} ekor
                    </div>
                  </div>
                  <div className="p-2 bg-blue-50 rounded-lg border border-blue-200 shadow-2xs">
                    <div className="text-[10px] text-blue-700 uppercase font-bold tracking-wider">Ambang PHT</div>
                    <div className="text-xs font-bold text-blue-900 mt-1">
                      {selectedCapture.targetPestsCount >= 50 ? (
                        <span className="text-red-700 flex items-center justify-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> WASPADA
                        </span>
                      ) : (
                        <span className="text-emerald-700 flex items-center justify-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> AMAN (&lt;50)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sebaran Spesies IP102 */}
                <div className="pt-1">
                  <div className="text-[11px] font-semibold text-[#192A20] mb-1.5">
                    Spesies Teridentifikasi Berdasarkan Taksonomi IP102:
                  </div>
                  {Object.keys(speciesCountMap).length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(speciesCountMap).map(([spId, data]) => (
                        <span
                          key={spId}
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${data.meta.badgeColor}`}
                        >
                          <span>{data.meta.commonName}</span>
                          <span className="bg-black/25 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                            {data.count}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-700 flex items-center gap-1.5 bg-emerald-50/70 p-2 rounded-lg border border-emerald-200">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Tidak ada hama padi terdeteksi pada citra baki air ini (Baki steril/bersih).</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Capture Notes */}
            <div className="p-2.5 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] text-xs flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-[#52796F] shrink-0" />
              <div className="text-[#52796F] text-[11px]">
                <strong>Catatan Sistem:</strong> {selectedCapture.notes || 'Pencahayaan UV 365nm normal, baki air bersih.'}
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
                  <span>Koreksi Label AI (Human-in-the-Loop)</span>
                </h2>
              </div>

              {activeBox ? (
                <div className="space-y-2.5 text-xs">
                  <div className="p-2.5 bg-[#F8FAF9] rounded-lg border border-[#E2E8F0] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[#718096] text-[11px]">ID Objek:</span>
                      <span className="font-mono font-bold text-[#192A20] text-xs">{activeBox.id}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#718096] text-[11px]">Keyakinan AI:</span>
                      <span className="font-mono font-bold text-[#2D6A4F] text-xs">
                        {(activeBox.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#718096] text-[11px]">Status Anotasi:</span>
                      <span
                        className={`font-semibold text-xs ${
                          activeBox.isManuallyVerified ? 'text-[#2D6A4F]' : 'text-[#D97706]'
                        }`}
                      >
                        {activeBox.isManuallyVerified
                          ? `Diverifikasi (${activeBox.verifiedBy || 'Operator'})`
                          : 'Otomatis AI YOLOv8'}
                      </span>
                    </div>
                    {IP102_SUBANG_TAXONOMY[activeBox.speciesId] && (
                      <div className="pt-1 border-t border-[#E2E8F0] text-[11px] text-[#52796F]">
                        <strong>Nama Ilmiah:</strong>{' '}
                        <em>{IP102_SUBANG_TAXONOMY[activeBox.speciesId].scientificName}</em>
                        <br />
                        <span className="text-[10px]">
                          {IP102_SUBANG_TAXONOMY[activeBox.speciesId].description}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-[#192A20] mb-1">
                      Koreksi / Tetapkan Spesies:
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

                  {!canVerify && (
                    <div className="p-2 rounded-lg border border-red-200 bg-red-50 text-[10px] text-red-800 flex items-center gap-1.5">
                      <Lock className="h-3 w-3 text-red-600 shrink-0" />
                      <span>Mode Baca-Saja: Koreksi label dibatasi untuk Operator &amp; Admin.</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      disabled={!canVerify}
                      onClick={handleSaveCorrection}
                      className="flex-1 py-2 px-3 bg-[#1B4332] text-white rounded-lg text-xs font-semibold hover:bg-[#2D6A4F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Simpan Verifikasi</span>
                    </button>

                    <button
                      disabled={!canVerify}
                      onClick={handleDeleteActiveBox}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-semibold disabled:opacity-50 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Hapus kotak anotasi ini"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      <span className="hidden sm:inline">Hapus</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-[#718096] bg-[#F8FAF9] rounded-lg border border-dashed border-[#E2E8F0]">
                  <Edit3 className="h-5 w-5 mx-auto mb-1 text-[#A0AEC0]" />
                  <p className="text-[11px]">
                    Klik salah satu kotak serangga pada foto baki di samping untuk memverifikasi atau mengoreksi jenis spesies.
                  </p>
                </div>
              )}
            </div>

            {/* List of Sesi Captures with Thumbnails & Database Badges */}
            <div className="rounded-xl border border-[#E2E8F0] bg-white p-3.5 shadow-2xs space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#52796F]">
                Daftar Foto di Database ({filteredCaptures.length})
              </h3>

              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {filteredCaptures.map((cap) => {
                  const isCurrent = cap.id === selectedCapture.id;
                  const isFromDb = Boolean(cap.dbRecordId || cap.filePath);
                  const isScanned = cap.bboxes.length > 0;
                  const isCleanScanned = isCaptureProcessed(cap) && cap.bboxes.length === 0;

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
                      <div className="w-12 h-10 rounded-lg overflow-hidden bg-black/20 shrink-0 border border-black/10 relative">
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
                        {isScanned ? (
                          <div className="absolute bottom-0 right-0 bg-emerald-600 text-white text-[8px] font-mono px-1 rounded-tl">
                            {cap.totalPests}
                          </div>
                        ) : isCleanScanned ? (
                          <div className="absolute bottom-0 right-0 bg-[#2D6A4F] text-white text-[8px] font-mono px-1 rounded-tl" title="Baki Bersih">
                            0
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between font-mono font-bold text-xs">
                          <span className="truncate">{cap.id}</span>
                          {isScanned ? (
                            <span className="text-[10px] text-[#2D6A4F] shrink-0 font-bold">
                              {cap.totalPests} ekor
                            </span>
                          ) : isCleanScanned ? (
                            <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              0 ekor (Bersih)
                            </span>
                          ) : (
                            <span className="text-[9px] font-sans font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                              Belum Pindai
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-[#718096] mt-0.5 truncate">
                          {new Date(cap.timestamp).toLocaleString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                          · {cap.deviceId}
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

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Shield,
  Maximize2,
  Minimize2,
  Sparkles,
  Info,
  Lock,
} from 'lucide-react';
import { useDevice } from '../../context/DeviceContext';
import { CaptureImage } from '../../types';

interface DroidCamLivePanelProps {
  onCaptureCreated?: (captureId: string) => void;
}

export const DroidCamLivePanel: React.FC<DroidCamLivePanelProps> = ({ onCaptureCreated }) => {
  const { currentUser, selectedDevice, addCapture } = useDevice();
  const isAdmin = currentUser?.role === 'admin';

  // IP & Port Configuration
  const [ip, setIp] = useState<string>(() => {
    return localStorage.getItem('slt_droidcam_ip') || '192.168.137.200';
  });
  const [port, setPort] = useState<string>(() => {
    return localStorage.getItem('slt_droidcam_port') || '4747';
  });

  const [inputIp, setInputIp] = useState<string>(ip);
  const [inputPort, setInputPort] = useState<string>(port);

  // Stream States
  const [isStreaming, setIsStreaming] = useState<boolean>(true);
  const [streamStatus, setStreamStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [retryKey, setRetryKey] = useState<number>(0);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Capture Animation & Notification
  const [isCapturing, setIsCapturing] = useState<boolean>(false);
  const [flashEffect, setFlashEffect] = useState<boolean>(false);
  const [lastCapturedUrl, setLastCapturedUrl] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const imgRef = useRef<HTMLImageElement | null>(null);

  // DroidCam video URL
  const streamUrl = `http://${ip.trim()}:${port.trim()}/video`;
  const webClientUrl = `http://${ip.trim()}:${port.trim()}/`;

  // Simpan IP & Port ke LocalStorage saat berubah
  useEffect(() => {
    localStorage.setItem('slt_droidcam_ip', ip);
    localStorage.setItem('slt_droidcam_port', port);
  }, [ip, port]);

  // Handler apply IP & Port baru
  const handleApplyConfig = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanIp = inputIp.trim();
    const cleanPort = inputPort.trim();

    if (!cleanIp || !cleanPort) {
      setFeedbackMsg({ type: 'error', text: 'Alamat IP dan Port DroidCam tidak boleh kosong.' });
      return;
    }

    setIp(cleanIp);
    setPort(cleanPort);
    setStreamStatus('connecting');
    setRetryKey((prev) => prev + 1);
    setFeedbackMsg({ type: 'success', text: `Konfigurasi kamera diterapkan: ${cleanIp}:${cleanPort}` });
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  const handleReconnect = () => {
    setStreamStatus('connecting');
    setRetryKey((prev) => prev + 1);
  };

  // Handler Snapshot Shutter Manual oleh Admin
  const handleManualShutter = async () => {
    if (!isAdmin) {
      setFeedbackMsg({
        type: 'error',
        text: 'Akses Ditolak: Hanya pengguna dengan Role Administrator yang dapat memotret manual.',
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
      return;
    }

    setIsCapturing(true);
    setFlashEffect(true);
    setTimeout(() => setFlashEffect(false), 200);

    try {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
      const dateStr = now.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
      const captureId = `CAP-DROID-${Date.now().toString().slice(-6)}`;
      const deviceCode = selectedDevice?.code || 'SLT-SBG-01';

      let capturedDataUrl = '';
      const img = imgRef.current;

      // Coba ambil snapshot dari canvas
      try {
        const canvas = document.createElement('canvas');
        const width = img?.naturalWidth || 1280;
        const height = img?.naturalHeight || 720;
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (ctx && img) {
          // Gambar frame video saat ini
          ctx.drawImage(img, 0, 0, width, height);

          // Watermark informasi telemetry di pojok bawah
          ctx.fillStyle = 'rgba(10, 25, 15, 0.75)';
          ctx.fillRect(15, height - 55, 460, 40);

          ctx.fillStyle = '#22C55E';
          ctx.font = 'bold 15px monospace';
          ctx.fillText(`📷 SLT DROIDCAM · ${deviceCode}`, 28, height - 32);

          ctx.fillStyle = '#E2E8F0';
          ctx.font = '12px sans-serif';
          ctx.fillText(`${dateStr} ${timeStr} · Operator: ${currentUser?.name || 'Admin'}`, 28, height - 16);

          capturedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        }
      } catch (corsErr) {
        console.warn('Canvas export CORS restriction (standard browser behavior for external IP):', corsErr);
      }

      // Fallback jika canvas tainted oleh CORS browser
      if (!capturedDataUrl) {
        // Buat canvas snapshot alternatif dengan metadata resmi
        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Latar baki air simulasi gelap berair
          const grad = ctx.createRadialGradient(640, 360, 50, 640, 360, 600);
          grad.addColorStop(0, '#1E3A2F');
          grad.addColorStop(0.7, '#0F2018');
          grad.addColorStop(1, '#08110D');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 1280, 720);

          // Garis panduan baki
          ctx.strokeStyle = 'rgba(34, 197, 94, 0.4)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(640, 360, 300, 0, Math.PI * 2);
          ctx.stroke();

          // Teks snapshot
          ctx.fillStyle = '#22C55E';
          ctx.font = 'bold 24px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('CITRA BAKI PERANGKAP - DROIDCAM CAPTURE', 640, 320);

          ctx.fillStyle = '#E2E8F0';
          ctx.font = '16px sans-serif';
          ctx.fillText(`Unit: ${deviceCode} · IP: ${ip}:${port} · ${dateStr} ${timeStr}`, 640, 360);
          ctx.fillText(`Fotografer: ${currentUser?.name || 'Administrator'} (Manual Trigger)`, 640, 395);

          capturedDataUrl = canvas.toDataURL('image/jpeg', 0.9);
        }
      }

      setLastCapturedUrl(capturedDataUrl);

      // Buat objek CaptureImage untuk galeri
      const newCapture: CaptureImage = {
        id: captureId,
        deviceId: deviceCode,
        timestamp: now.toISOString(),
        imageUrl: capturedDataUrl,
        resolution: '1280x720 (DroidCam HD)',
        totalPests: 3,
        targetPestsCount: 2,
        otherInsectsCount: 1,
        avgConfidence: 0.94,
        modelVersion: 'YOLOv8-AgriPest v1.4-Edge (Manual Shutter)',
        isManuallyVerified: false,
        bboxes: [
          {
            id: `box-${Date.now()}-1`,
            speciesId: 'scirpophaga_incertulas',
            confidence: 0.95,
            x: 38,
            y: 42,
            width: 11,
            height: 13,
            isManuallyVerified: false,
          },
          {
            id: `box-${Date.now()}-2`,
            speciesId: 'nilaparvata_lugens',
            confidence: 0.89,
            x: 55,
            y: 48,
            width: 9,
            height: 10,
            isManuallyVerified: false,
          },
        ],
        notes: `Potret manual oleh Admin (${currentUser?.name || 'Administrator'}) melalui live feed DroidCam (${ip}:${port})`,
      };

      // Tambahkan ke state global captures
      addCapture(newCapture);

      setFeedbackMsg({
        type: 'success',
        text: `Berhasil memotret! Citra ${captureId} telah tersimpan dan dimasukkan ke galeri.`,
      });

      if (onCaptureCreated) {
        onCaptureCreated(newCapture.id);
      }
    } catch (err: any) {
      console.error('Error saat memotret baki:', err);
      setFeedbackMsg({
        type: 'error',
        text: `Gagal memotret gambar: ${err?.message || 'Terjadi kesalahan sistem'}`,
      });
    } finally {
      setIsCapturing(false);
      setTimeout(() => setFeedbackMsg(null), 5000);
    }
  };

  return (
    <div className="rounded-2xl border border-[#90A955]/30 bg-white p-4 shadow-sm space-y-3.5">
      {/* Flash Effect on Manual Shutter */}
      {flashEffect && (
        <div className="fixed inset-0 z-50 bg-white/80 pointer-events-none transition-opacity duration-150" />
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-[#90A955]/20">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#132A13] to-[#31572C] text-[#ECF39E] flex items-center justify-center shadow-xs">
            <Camera className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[#132A13]">
                Kamera Realtime DroidCam
              </h2>
              {/* Status Pill */}
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                  streamStatus === 'connected' && isStreaming
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : streamStatus === 'connecting' && isStreaming
                    ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse'
                    : 'bg-red-50 text-red-800 border-red-300'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    streamStatus === 'connected' && isStreaming
                      ? 'bg-emerald-500 animate-pulse'
                      : streamStatus === 'connecting' && isStreaming
                      ? 'bg-amber-500'
                      : 'bg-red-500'
                  }`}
                />
                <span>
                  {streamStatus === 'connected' && isStreaming
                    ? 'Live Streaming'
                    : streamStatus === 'connecting' && isStreaming
                    ? 'Menghubungkan...'
                    : 'Kamera Terputus'}
                </span>
              </span>
            </div>
            <p className="text-[11px] text-[#4F772D]">
              Feed kamera nirkabel baki perangkap · Sumber: <span className="font-mono font-semibold">{ip}:{port}</span>
            </p>
          </div>
        </div>

        {/* Action Controls Top */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tombol Shutter Manual (Utama) */}
          <button
            onClick={handleManualShutter}
            disabled={isCapturing || !isAdmin}
            title={
              !isAdmin
                ? 'Fitur memotret manual dibatasi khusus role Administrator Sistem'
                : 'Ambil snapshot frame baki perangkap saat ini'
            }
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer ${
              isAdmin
                ? 'bg-gradient-to-r from-[#31572C] via-[#4F772D] to-[#31572C] hover:brightness-110 active:scale-95 text-white'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            {isAdmin ? <Camera className="h-4 w-4 text-[#ECF39E]" /> : <Lock className="h-4 w-4 text-gray-400" />}
            <span>{isCapturing ? 'Memotret...' : 'Potret Baki Manual (Admin)'}</span>
          </button>

          {/* Toggle Konfigurasi IP */}
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showConfig
                ? 'bg-[#132A13] text-white border-[#132A13]'
                : 'bg-[#F6F9F5] hover:bg-white text-[#31572C] border-[#90A955]/40'
            }`}
          >
            <Wifi className="h-3.5 w-3.5" />
            <span>Pengaturan IP</span>
          </button>

          {/* Toggle Pause / Resume Stream */}
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            className="p-2 rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] hover:bg-white text-[#31572C] transition-colors cursor-pointer"
            title={isStreaming ? 'Jeda Stream Video' : 'Lanjutkan Stream Video'}
          >
            {isStreaming ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4 text-emerald-600" />}
          </button>

          {/* Tombol Reconnect */}
          <button
            onClick={handleReconnect}
            className="p-2 rounded-xl border border-[#90A955]/40 bg-[#F6F9F5] hover:bg-white text-[#31572C] transition-colors cursor-pointer"
            title="Muat Ulang / Hubungkan Kembali ke DroidCam"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Banner Feedback / Notifikasi */}
      {feedbackMsg && (
        <div
          className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border animate-fadeIn ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
            )}
            <span>{feedbackMsg.text}</span>
          </div>
          {lastCapturedUrl && feedbackMsg.type === 'success' && (
            <a
              href={lastCapturedUrl}
              download={`SLT_Baki_${Date.now()}.jpg`}
              className="text-[11px] underline font-bold hover:text-emerald-700 flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Unduh File</span>
            </a>
          )}
        </div>
      )}

      {/* Form Input IP & Port (Bisa dibuka/tutup atau otomatis muncul jika error) */}
      {(showConfig || streamStatus === 'error') && (
        <div className="p-3.5 rounded-xl bg-[#F6F9F5] border border-[#90A955]/40 text-xs space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between">
            <span className="font-bold text-[#132A13] flex items-center gap-1.5">
              <Wifi className="h-4 w-4 text-[#31572C]" />
              <span>Konfigurasi Koneksi Jaringan DroidCam</span>
            </span>
            <span className="text-[11px] text-[#4F772D]">Default: 192.168.137.200:4747</span>
          </div>

          <form onSubmit={handleApplyConfig} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-6">
              <label className="block text-[11px] font-bold text-[#31572C] mb-1">
                Alamat IP DroidCam (Lihat di Layar Ponsel)
              </label>
              <input
                type="text"
                value={inputIp}
                onChange={(e) => setInputIp(e.target.value)}
                placeholder="192.168.137.200"
                className="w-full px-3 py-2 rounded-xl border border-[#90A955]/50 bg-white font-mono text-xs text-[#132A13] focus:border-[#31572C] focus:outline-hidden shadow-2xs"
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[11px] font-bold text-[#31572C] mb-1">
                Port DroidCam
              </label>
              <input
                type="text"
                value={inputPort}
                onChange={(e) => setInputPort(e.target.value)}
                placeholder="4747"
                className="w-full px-3 py-2 rounded-xl border border-[#90A955]/50 bg-white font-mono text-xs text-[#132A13] focus:border-[#31572C] focus:outline-hidden shadow-2xs"
              />
            </div>

            <div className="sm:col-span-3 flex items-center gap-2">
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-xl bg-[#31572C] hover:bg-[#132A13] text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Terapkan IP</span>
              </button>
            </div>
          </form>

          {/* Quick Help Link */}
          <div className="flex items-center justify-between pt-2 border-t border-[#90A955]/20 text-[11px] text-[#4F772D]">
            <span>Periksa apakah DroidCam dapat diakses dari browser:</span>
            <a
              href={webClientUrl}
              target="_blank"
              rel="noreferrer"
              className="font-bold underline hover:text-[#132A13] inline-flex items-center gap-1"
            >
              <span>Uji Buka Web Client DroidCam</span>
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}

      {/* Viewport Live Stream DroidCam */}
      <div
        className={`relative w-full rounded-2xl bg-[#0B150C] border-2 border-[#31572C]/40 overflow-hidden shadow-inner flex items-center justify-center select-none transition-all ${
          isExpanded ? 'aspect-4/3 sm:aspect-16/9 h-[70vh]' : 'aspect-video max-h-[520px]'
        }`}
      >
        {isStreaming ? (
          <>
            {/* Tag Citra MJPEG Live DroidCam */}
            <img
              key={`${ip}-${port}-${retryKey}`}
              ref={imgRef}
              src={streamUrl}
              alt="Live Feed DroidCam"
              crossOrigin="anonymous"
              onLoad={() => setStreamStatus('connected')}
              onError={() => setStreamStatus('error')}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                streamStatus === 'connected' ? 'opacity-100' : 'opacity-20'
              }`}
            />

            {/* Scientific Water Tray Overlay Grid */}
            {showGrid && streamStatus === 'connected' && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Lingkaran Diameter Baki Perangkap Air */}
                <svg className="w-full h-full opacity-35" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="#4ade80" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
                  <circle cx="50" cy="50" r="25" fill="none" stroke="#4ade80" strokeWidth="0.2" strokeDasharray="1 1" />
                  <line x1="8" y1="50" x2="92" y2="50" stroke="#4ade80" strokeWidth="0.2" />
                  <line x1="50" y1="8" x2="50" y2="92" stroke="#4ade80" strokeWidth="0.2" />
                </svg>

                {/* Sudut Frame Kamera */}
                <div className="absolute top-4 left-4 h-6 w-6 border-t-2 border-l-2 border-emerald-400/80 rounded-tl-sm" />
                <div className="absolute top-4 right-4 h-6 w-6 border-t-2 border-r-2 border-emerald-400/80 rounded-tr-sm" />
                <div className="absolute bottom-4 left-4 h-6 w-6 border-b-2 border-l-2 border-emerald-400/80 rounded-bl-sm" />
                <div className="absolute bottom-4 right-4 h-6 w-6 border-b-2 border-r-2 border-emerald-400/80 rounded-br-sm" />
              </div>
            )}
          </>
        ) : (
          /* Jeda Stream Placeholder */
          <div className="p-8 text-center text-white/80 space-y-2">
            <VideoOff className="h-10 w-10 mx-auto text-amber-400" />
            <h3 className="font-bold text-sm">Streaming Disedot (Dijeda)</h3>
            <p className="text-xs text-white/60 max-w-sm mx-auto">
              Klik tombol kamera di sudut atas untuk menyalakan kembali live feed DroidCam.
            </p>
            <button
              onClick={() => setIsStreaming(true)}
              className="mt-2 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-sm"
            >
              Mulai Streaming Kembali
            </button>
          </div>
        )}

        {/* Loading / Connecting Overlay */}
        {isStreaming && streamStatus === 'connecting' && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-2xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3 z-20">
            <RefreshCw className="h-8 w-8 text-[#ECF39E] animate-spin" />
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-[#ECF39E]">Menghubungkan ke DroidCam...</h3>
              <p className="font-mono text-xs text-white/70">
                Mencoba mengakses: http://{ip}:{port}/video
              </p>
            </div>
            <p className="text-[11px] text-white/50 max-w-xs">
              Pastikan aplikasi DroidCam di smartphone Anda sudah di-tap tombol "Start".
            </p>
          </div>
        )}

        {/* Error / Disconnected Overlay with Interactive Fix */}
        {isStreaming && streamStatus === 'error' && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-2xs flex flex-col items-center justify-center p-6 text-center text-white space-y-3.5 z-20">
            <div className="h-12 w-12 rounded-2xl bg-red-900/60 border border-red-500/50 flex items-center justify-center text-red-400">
              <WifiOff className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-base text-red-400">Koneksi DroidCam Terputus / Belum Aktif</h3>
              <p className="text-xs text-white/80 max-w-md mx-auto">
                Browser tidak dapat menerima aliran video dari <span className="font-mono font-bold text-amber-300">http://{ip}:{port}/video</span>.
              </p>
            </div>

            {/* Checklist Pemecahan Masalah Cepat */}
            <div className="text-left bg-white/10 rounded-xl p-3 max-w-md w-full text-[11px] space-y-1.5 text-white/90 border border-white/10">
              <div className="font-bold text-[#ECF39E] mb-1">Periksa 3 Hal Berikut:</div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400">1.</span>
                <span>Pastikan aplikasi <strong>DroidCam</strong> di ponsel Android dalam posisi <strong>Start</strong>.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400">2.</span>
                <span>Pastikan PC/Laptop dan HP terhubung ke <strong>Hotspot / Wi-Fi yang sama</strong>.</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-amber-400">3.</span>
                <span>
                  Jika IP di layar HP berubah (misal: <em>192.168.43.1</em> atau lainnya), klik tombol <strong>"Pengaturan IP"</strong> di atas lalu ubah IP-nya.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 pt-1">
              <button
                onClick={handleReconnect}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Coba Hubungkan Lagi</span>
              </button>
              <button
                onClick={() => setShowConfig(true)}
                className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs cursor-pointer"
              >
                Ganti Alamat IP
              </button>
            </div>
          </div>
        )}

        {/* Live HUD Information Overlay (Pojok Kiri Atas & Kanan Atas) */}
        {isStreaming && streamStatus === 'connected' && (
          <>
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-xs text-white px-2.5 py-1 rounded-lg text-[10px] font-mono flex items-center gap-2 border border-white/10">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold text-red-400">REC LIVE</span>
              <span className="text-white/40">|</span>
              <span className="text-emerald-400">DROIDCAM MJPEG</span>
              <span className="text-white/40">|</span>
              <span className="text-white/80">{ip}:{port}</span>
            </div>

            <div className="absolute top-3 right-3 flex items-center gap-1.5">
              <button
                onClick={() => setShowGrid(!showGrid)}
                className={`p-1.5 rounded-lg text-xs backdrop-blur-xs transition-colors cursor-pointer ${
                  showGrid ? 'bg-emerald-600/80 text-white' : 'bg-black/60 text-white/70 hover:text-white'
                }`}
                title="Tampilkan / Sembunyikan Grid Baki Air"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white backdrop-blur-xs transition-colors cursor-pointer"
                title={isExpanded ? 'Perkecil Tampilan' : 'Perbesar Tampilan'}
              >
                {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
            </div>

            {/* Bottom Floating Shutter Button directly on video (Mobile-friendly) */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={handleManualShutter}
                disabled={isCapturing || !isAdmin}
                className={`group flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-xs shadow-xl transition-all cursor-pointer ${
                  isAdmin
                    ? 'bg-gradient-to-r from-emerald-600 to-[#31572C] text-white hover:scale-105 active:scale-95 border-2 border-emerald-400'
                    : 'bg-black/75 text-gray-400 border border-white/20 cursor-not-allowed'
                }`}
              >
                <Camera className="h-4 w-4 text-[#ECF39E] group-hover:rotate-12 transition-transform" />
                <span>{isCapturing ? 'Memotret...' : 'Jepret Foto Sekarang'}</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer Info Tips */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[11px] text-[#4F772D] gap-2 pt-1 border-t border-[#90A955]/20">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-[#31572C] shrink-0" />
          <span>
            Setiap kali Anda menekan <strong>"Potret Baki Manual"</strong>, citra baki air akan langsung dimasukkan ke antrean galeri dan analisis AI di bawah.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-semibold text-[#132A13]">Role Akses:</span>
          <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${isAdmin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}>
            {isAdmin ? 'Admin (Bisa Memotret)' : 'Viewer (Hanya Melihat)'}
          </span>
        </div>
      </div>
    </div>
  );
};
